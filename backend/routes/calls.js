const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Call, CallHistory } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all calls with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      status,
      followUpStatus,
      queue,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
      sortBy = 'last_call_at',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};

    if (status) where.lastCallStatus = status;
    if (followUpStatus) where.followUpStatus = followUpStatus;
    if (queue) where.queueName = queue;

    if (search) {
      where[Op.or] = [
        { callerNumber: { [Op.like]: `%${search}%` } },
        { callerName: { [Op.like]: `%${search}%` } }
      ];
    }

    if (dateFrom || dateTo) {
      where.lastCallAt = {};
      if (dateFrom) where.lastCallAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.lastCallAt[Op.lte] = new Date(dateTo);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSort = ['last_call_at', 'first_call_at', 'caller_number', 'follow_up_status', 'total_inbound_attempts'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'last_call_at';

    const { rows, count } = await Call.findAndCountAll({
      where,
      order: [[safeSort, sortOrder === 'ASC' ? 'ASC' : 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      calls: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get call details with history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const call = await Call.findByPk(req.params.id, {
      include: [{
        model: CallHistory,
        as: 'history',
        order: [['started_at', 'DESC']]
      }]
    });

    if (!call) return res.status(404).json({ error: 'Call not found' });
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update follow-up status
router.put('/:id/followup', authenticate, async (req, res) => {
  try {
    const call = await Call.findByPk(req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found' });

    const { followUpStatus, followUpNote, retryScheduledAt } = req.body;
    const slaMinutes = parseInt(process.env.SLA_TARGET_MINUTES) || 30;

    const updateData = {
      followUpStatus,
      followUpBy: req.user.fullName,
      followUpByExtension: req.user.extension,
      followUpAt: new Date()
    };

    if (followUpNote) updateData.followUpNote = followUpNote;
    if (retryScheduledAt) updateData.retryScheduledAt = new Date(retryScheduledAt);

    // Calculate SLA
    if (['callback_done_answered', 'callback_done_no_answer', 'closed'].includes(followUpStatus)) {
      const now = new Date();
      const missedAt = new Date(call.lastCallAt);
      const diffMinutes = (now - missedAt) / 60000;
      updateData.slaMetAt = now;
      updateData.slaMet = diffMinutes <= slaMinutes;
    }

    await call.update(updateData);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available queues
router.get('/meta/queues', authenticate, async (req, res) => {
  try {
    const queues = await Call.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('queue_name')), 'queueName']],
      where: { queueName: { [Op.ne]: null } },
      raw: true
    });
    res.json(queues.map(q => q.queueName).filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/stats/dashboard', authenticate, async (req, res) => {
  try {
    const { dateFrom, dateTo, queue } = req.query;
    const where = {};

    if (dateFrom || dateTo) {
      where.lastCallAt = {};
      if (dateFrom) where.lastCallAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.lastCallAt[Op.lte] = new Date(dateTo);
    }
    if (queue) where.queueName = queue;

    const totalCalls = await Call.count({ where });
    const answeredCalls = await Call.count({ where: { ...where, lastCallStatus: 'answered' } });
    const missedCalls = await Call.count({
      where: { ...where, lastCallStatus: { [Op.in]: ['missed_in_queue', 'missed_before_queue', 'abandoned', 'after_hours', 'voicemail'] } }
    });
    const pendingFollowUp = await Call.count({ where: { ...where, followUpStatus: 'pending' } });
    const callbackDone = await Call.count({
      where: { ...where, followUpStatus: { [Op.in]: ['callback_done_answered', 'callback_done_no_answer', 'closed'] } }
    });
    const retryLater = await Call.count({ where: { ...where, followUpStatus: 'retry_later' } });
    const slaMetCount = await Call.count({ where: { ...where, slaMet: true } });
    const slaTotalCount = await Call.count({ where: { ...where, slaMet: { [Op.ne]: null } } });

    const responseRate = totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : 0;
    const slaRate = slaTotalCount > 0 ? ((slaMetCount / slaTotalCount) * 100).toFixed(1) : 0;

    // Calls by queue
    const callsByQueue = await Call.findAll({
      attributes: [
        'queueName',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN last_call_status = 'answered' THEN 1 ELSE 0 END")), 'answered'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN last_call_status != 'answered' THEN 1 ELSE 0 END")), 'missed']
      ],
      where,
      group: ['queueName'],
      raw: true
    });

    // Calls by hour (for chart)
    const callsByHour = await Call.findAll({
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('last_call_at')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      where,
      group: [sequelize.fn('HOUR', sequelize.col('last_call_at'))],
      raw: true
    });

    res.json({
      totalCalls,
      answeredCalls,
      missedCalls,
      responseRate: parseFloat(responseRate),
      pendingFollowUp,
      callbackDone,
      retryLater,
      slaRate: parseFloat(slaRate),
      callsByQueue,
      callsByHour
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export calls (admin only)
router.get('/export/csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, queue, followUpStatus } = req.query;
    const where = {};

    if (dateFrom || dateTo) {
      where.lastCallAt = {};
      if (dateFrom) where.lastCallAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.lastCallAt[Op.lte] = new Date(dateTo);
    }
    if (queue) where.queueName = queue;
    if (followUpStatus) where.followUpStatus = followUpStatus;

    const calls = await Call.findAll({ where, order: [['lastCallAt', 'DESC']], raw: true });

    const headers = [
      'Caller Number', 'Caller Name', 'Queue', 'Source', 'Attempts',
      'First Call', 'Last Call', 'Status', 'Answered By',
      'Follow-Up Status', 'Follow-Up By', 'Follow-Up At', 'Note', 'SLA Met'
    ];

    const statusLabels = {
      answered: 'Answered',
      missed_in_queue: 'Missed in Queue',
      missed_before_queue: 'Missed Before Queue',
      abandoned: 'Abandoned',
      after_hours: 'After Hours',
      voicemail: 'Voicemail'
    };

    const followUpLabels = {
      not_required: 'Not Required',
      pending: 'Pending',
      callback_done_answered: 'Callback - Answered',
      callback_done_no_answer: 'Callback - No Answer',
      retry_later: 'Retry Later',
      closed: 'Closed'
    };

    const csvRows = [headers.join(',')];
    for (const c of calls) {
      csvRows.push([
        c.caller_number,
        `"${(c.caller_name || '').replace(/"/g, '""')}"`,
        `"${(c.queue_name || '').replace(/"/g, '""')}"`,
        c.call_source,
        c.total_inbound_attempts,
        c.first_call_at,
        c.last_call_at,
        statusLabels[c.last_call_status] || c.last_call_status,
        `"${(c.answered_by || '').replace(/"/g, '""')}"`,
        followUpLabels[c.follow_up_status] || c.follow_up_status,
        `"${(c.follow_up_by || '').replace(/"/g, '""')}"`,
        c.follow_up_at || '',
        `"${(c.follow_up_note || '').replace(/"/g, '""')}"`,
        c.sla_met !== null ? (c.sla_met ? 'Yes' : 'No') : ''
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=calltrack_export_${Date.now()}.csv`);
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts (pending calls past threshold)
router.get('/alerts/pending', authenticate, async (req, res) => {
  try {
    const thresholdMinutes = parseInt(process.env.ALERT_THRESHOLD_MINUTES) || 60;
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60000);

    const alerts = await Call.findAll({
      where: {
        followUpStatus: 'pending',
        lastCallAt: { [Op.lte]: thresholdTime },
        lastCallStatus: { [Op.ne]: 'answered' }
      },
      order: [['lastCallAt', 'ASC']]
    });

    res.json({
      count: alerts.length,
      thresholdMinutes,
      alerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
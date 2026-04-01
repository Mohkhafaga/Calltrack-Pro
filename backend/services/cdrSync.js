const { cxPool } = require('../config/database');
const { Call, CallHistory } = require('../models');
const { Op } = require('sequelize');

class CDRSyncService {
  constructor() {
    this.lastSyncTime = null;
    this.isRunning = false;
  }

  normalizeNumber(number) {
    if (!number) return null;
    let clean = number.replace(/[\s\-\(\)\+]/g, '');
    if (clean.startsWith('00')) clean = clean.substring(2);
    if (clean.length > 10 && clean.startsWith('966')) clean = clean.substring(3);
    if (clean.length > 10 && clean.startsWith('1')) clean = clean.substring(1);
    if (clean.startsWith('0') && clean.length === 10) clean = clean.substring(1);
    return clean;
  }

  async fetchCallFlows() {
    let whereClause = '';
    const params = [];
    if (this.lastSyncTime) {
      whereClause = 'AND cf.first_started > $1';
      params.push(this.lastSyncTime);
    } else {
      whereClause = "AND cf.first_started > NOW() - INTERVAL '365 days'";
    }

    // Get one record per call_history_id with the FINAL outcome
    const query = `
      WITH call_flows AS (
        SELECT
          c.call_history_id,
          MIN(c.cdr_started_at) as first_started,
          MAX(c.cdr_ended_at) as last_ended,

          -- Get the external caller number (from the first CDR)
          (SELECT c2.source_participant_phone_number 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.source_entity_type = 'external_line' 
           ORDER BY c2.cdr_started_at ASC LIMIT 1) as caller_number,

          -- Get caller name
          (SELECT COALESCE(c2.source_participant_name, c2.source_dn_name)
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.source_entity_type = 'external_line' 
           ORDER BY c2.cdr_started_at ASC LIMIT 1) as caller_name,

          -- Was the call answered by an extension?
          BOOL_OR(c.destination_entity_type = 'extension' AND c.cdr_answered_at IS NOT NULL) as was_answered,

          -- Who answered (extension name)
          (SELECT c2.destination_participant_name 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.destination_entity_type = 'extension' 
             AND c2.cdr_answered_at IS NOT NULL 
           ORDER BY c2.cdr_answered_at ASC LIMIT 1) as answered_by_name,

          -- Who answered (extension number)
          (SELECT c2.destination_dn_number 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.destination_entity_type = 'extension' 
             AND c2.cdr_answered_at IS NOT NULL 
           ORDER BY c2.cdr_answered_at ASC LIMIT 1) as answered_by_ext,

          -- Answer time
          (SELECT c2.cdr_answered_at 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.cdr_answered_at IS NOT NULL 
           ORDER BY c2.cdr_answered_at ASC LIMIT 1) as answered_at,

          -- Did call reach a queue?
          BOOL_OR(c.destination_entity_type = 'queue') as reached_queue,

          -- Queue name (actual queue, not extension)
          (SELECT c2.destination_dn_name 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.destination_entity_type = 'queue' 
           ORDER BY c2.cdr_started_at ASC LIMIT 1) as queue_name,

          -- Did call reach IVR?
          BOOL_OR(c.destination_entity_type = 'ivr') as reached_ivr,

          -- IVR name
          (SELECT c2.destination_dn_name 
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.destination_entity_type = 'ivr' 
           ORDER BY c2.cdr_started_at ASC LIMIT 1) as ivr_name,

          -- Did call go to voicemail?
          BOOL_OR(c.destination_entity_type = 'voicemail') as went_to_voicemail,

          -- Was it after hours / holiday?
          BOOL_OR(c.creation_forward_reason IN ('office_time', 'holiday', 'break_time')) as was_after_hours,

          -- Did caller hang up?
          BOOL_OR(c.termination_reason = 'src_participant_terminated') as caller_hung_up,

          -- Talk duration (answered calls only)
          (SELECT EXTRACT(EPOCH FROM (c2.cdr_ended_at - c2.cdr_answered_at))::int
           FROM cdroutput c2 
           WHERE c2.call_history_id = c.call_history_id 
             AND c2.destination_entity_type = 'extension' 
             AND c2.cdr_answered_at IS NOT NULL 
           ORDER BY c2.cdr_answered_at ASC LIMIT 1) as talk_duration

        FROM cdroutput c
        WHERE c.source_entity_type = 'external_line'
          OR (c.call_history_id IN (
            SELECT call_history_id FROM cdroutput WHERE source_entity_type = 'external_line'
          ))
        GROUP BY c.call_history_id
      )
      SELECT * FROM call_flows cf
      WHERE cf.caller_number IS NOT NULL
        ${whereClause}
      ORDER BY cf.first_started ASC
    `;

    try {
      const result = await cxPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[CDR Sync] Error fetching call flows:', error.message);
      return [];
    }
  }

  determineStatus(flow) {
    if (flow.was_answered) return 'answered';
    if (flow.was_after_hours) return 'after_hours';
    if (flow.went_to_voicemail) return 'voicemail';
    if (flow.reached_queue && flow.caller_hung_up) return 'abandoned';
    if (flow.reached_queue) return 'missed_in_queue';
    if (flow.reached_ivr && flow.caller_hung_up) return 'missed_before_queue';
    return 'missed_before_queue';
  }

  determineSource(flow) {
    if (flow.was_after_hours) return 'after_hours';
    if (flow.reached_queue) return 'queue';
    if (flow.reached_ivr) return 'ivr';
    return 'other';
  }

  determineQueueName(flow) {
    if (flow.queue_name) return flow.queue_name;
    if (flow.ivr_name) return flow.ivr_name;
    if (flow.was_after_hours) return 'خارج الدوام';
    return 'other';
  }

  async fetchOutboundCalls(sinceTime) {
    const query = `
      SELECT
        c.cdr_id, c.call_history_id, c.source_dn_number, c.source_dn_name,
        c.destination_participant_phone_number,
        c.cdr_started_at, c.cdr_answered_at, c.cdr_ended_at
      FROM cdroutput c
      WHERE c.source_entity_type = 'extension'
        AND c.destination_entity_type = 'external_line'
        AND c.cdr_started_at > $1
      ORDER BY c.cdr_started_at ASC
    `;
    try {
      const result = await cxPool.query(query, [sinceTime]);
      return result.rows;
    } catch (error) {
      console.error('[CDR Sync] Error fetching outbound calls:', error.message);
      return [];
    }
  }

  async processCallFlows(flows) {
    let processed = 0;
    for (const flow of flows) {
      try {
        // Skip if already processed
        const existing = await CallHistory.findOne({
          where: { cxHistoryId: flow.call_history_id }
        });
        if (existing) continue;

        const callerNumber = this.normalizeNumber(flow.caller_number);
        if (!callerNumber) continue;

        const callStatus = this.determineStatus(flow);
        const callSource = this.determineSource(flow);
        const queueName = this.determineQueueName(flow);
        const waitTime = flow.answered_at
          ? Math.round((new Date(flow.answered_at) - new Date(flow.first_started)) / 1000)
          : Math.round((new Date(flow.last_ended) - new Date(flow.first_started)) / 1000);

        // Find or create unified Call record - ONE per phone number only
        let [call, created] = await Call.findOrCreate({
          where: { callerNumber: callerNumber },
          defaults: {
            callerName: flow.caller_name,
            queueName: queueName,
            callSource: callSource,
            totalInboundAttempts: 1,
            firstCallAt: flow.first_started,
            lastCallAt: flow.first_started,
            lastCallStatus: callStatus,
            answeredBy: flow.answered_by_name || null,
            answeredByExtension: flow.answered_by_ext || null,
            lastCallDuration: flow.talk_duration || 0,
            lastWaitTime: waitTime,
            followUpStatus: callStatus === 'answered' ? 'not_required' : 'pending',
            lastCxHistoryId: flow.call_history_id
          }
        });

        if (!created) {
          const updateData = {
            totalInboundAttempts: call.totalInboundAttempts + 1,
            lastCallAt: flow.first_started,
            lastCallStatus: callStatus,
            lastCallDuration: flow.talk_duration || 0,
            lastWaitTime: waitTime,
            lastCxHistoryId: flow.call_history_id,
            queueName: queueName,
            callSource: callSource
          };

          if (flow.caller_name) updateData.callerName = flow.caller_name;

          if (callStatus === 'answered') {
            updateData.answeredBy = flow.answered_by_name;
            updateData.answeredByExtension = flow.answered_by_ext;
            updateData.followUpStatus = 'not_required';
          } else if (call.followUpStatus === 'not_required' || call.followUpStatus === 'closed') {
            updateData.followUpStatus = 'pending';
            updateData.followUpBy = null;
            updateData.followUpAt = null;
            updateData.followUpNote = null;
            updateData.autoDetectedCallback = false;
          }

          await call.update(updateData);
        }

        // Create history record - one per call flow
        await CallHistory.create({
          callId: call.id,
          cxHistoryId: flow.call_history_id,
          cxCdrId: flow.call_history_id,
          direction: 'inbound',
          callerNumber: callerNumber,
          destinationNumber: flow.answered_by_ext || null,
          status: callStatus === 'answered' ? 'answered' : (callStatus === 'abandoned' ? 'abandoned' : 'missed'),
          queueName: queueName,
          answeredBy: flow.answered_by_name || null,
          answeredByExtension: flow.answered_by_ext || null,
          duration: flow.talk_duration || 0,
          waitTime: waitTime,
          startedAt: flow.first_started,
          endedAt: flow.last_ended,
          terminationReason: callStatus,
          terminationDetails: flow.was_after_hours ? 'after_hours' : (flow.caller_hung_up ? 'caller_hung_up' : null)
        });

        processed++;
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError') {
          console.error(`[CDR Sync] Error processing flow ${flow.call_history_id}:`, error.message);
        }
      }
    }
    return processed;
  }

  async detectOutboundCallbacks() {
    const slaMinutes = parseInt(process.env.SLA_TARGET_MINUTES) || 30;
    const pendingCalls = await Call.findAll({
      where: { followUpStatus: 'pending', lastCallStatus: { [Op.ne]: 'answered' } }
    });
    if (pendingCalls.length === 0) return 0;
    const sinceTime = new Date();
    sinceTime.setHours(sinceTime.getHours() - 24);
    const outboundCalls = await this.fetchOutboundCalls(sinceTime.toISOString());
    let detected = 0;
    for (const pending of pendingCalls) {
      const normalizedPending = this.normalizeNumber(pending.callerNumber);
      const matchingOutbound = outboundCalls.find(ob => {
        return this.normalizeNumber(ob.destination_participant_phone_number) === normalizedPending;
      });
      if (matchingOutbound) {
        const followUpAt = new Date(matchingOutbound.cdr_started_at);
        const missedAt = new Date(pending.lastCallAt);
        const diffMinutes = (followUpAt - missedAt) / 60000;
        await pending.update({
          autoDetectedCallback: true,
          autoDetectedAt: matchingOutbound.cdr_started_at,
          autoDetectedByExtension: matchingOutbound.source_dn_number,
          followUpBy: matchingOutbound.source_dn_name,
          followUpByExtension: matchingOutbound.source_dn_number,
          followUpAt: matchingOutbound.cdr_started_at,
          followUpStatus: matchingOutbound.cdr_answered_at ? 'callback_done_answered' : 'callback_done_no_answer',
          slaMetAt: followUpAt,
          slaMet: diffMinutes <= slaMinutes
        });
        detected++;
      }
    }
    return detected;
  }

  async sync() {
    if (this.isRunning) {
      console.log('[CDR Sync] Already running, skipping...');
      return;
    }
    this.isRunning = true;
    const startTime = Date.now();
    try {
      console.log('[CDR Sync] Starting sync...');
      const flows = await this.fetchCallFlows();
      const processed = await this.processCallFlows(flows);
      const detected = await this.detectOutboundCallbacks();
      if (flows.length > 0) {
        this.lastSyncTime = flows[flows.length - 1].first_started;
      }
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[CDR Sync] Done in ${elapsed}s - ${processed} calls processed, ${detected} callbacks detected`);
    } catch (error) {
      console.error('[CDR Sync] Sync failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new CDRSyncService();
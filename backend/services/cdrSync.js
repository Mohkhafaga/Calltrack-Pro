const { cxDatabase } = require('../config/database');
const { Call, CallHistory } = require('../models');
const { QueryTypes, Op } = require('sequelize');

class CDRSyncService {
  constructor() {
    this.lastSyncTime = null;
    this.isRunning = false;
  }

  // Normalize phone number - remove country code prefix, spaces, dashes
  normalizeNumber(number) {
    if (!number) return null;
    let clean = number.replace(/[\s\-\(\)\+]/g, '');
    // Remove common country codes if present
    if (clean.startsWith('00')) clean = clean.substring(2);
    if (clean.length > 10 && clean.startsWith('966')) clean = clean.substring(3);
    if (clean.length > 10 && clean.startsWith('1')) clean = clean.substring(1);
    // Remove leading zero for local numbers
    if (clean.startsWith('0') && clean.length === 10) clean = clean.substring(1);
    return clean;
  }

  // Determine call source from CDR data
  determineCallSource(cdr) {
    const destType = cdr.destination_entity_type;
    const fwdReason = cdr.creation_forward_reason;

    if (fwdReason === 'office_time' || fwdReason === 'holiday' || fwdReason === 'break_time') {
      return 'after_hours';
    }
    if (destType === 'queue') return 'queue';
    if (destType === 'ivr') return 'ivr';
    if (destType === 'ring_group_hunt' || destType === 'ring_group_ring_all') return 'ring_group';
    if (destType === 'voicemail') return 'voicemail';
    if (destType === 'extension') return 'direct';
    return 'other';
  }

  // Determine call status from CDR data
  determineCallStatus(cdr) {
    const fwdReason = cdr.creation_forward_reason;

    if (fwdReason === 'office_time' || fwdReason === 'holiday' || fwdReason === 'break_time') {
      return 'after_hours';
    }
    if (cdr.cdr_answered_at) return 'answered';
    if (cdr.destination_entity_type === 'voicemail') return 'voicemail';

    const termReason = cdr.termination_reason;
    if (termReason === 'src_participant_terminated') return 'abandoned';

    const destType = cdr.destination_entity_type;
    if (destType === 'queue') return 'missed_in_queue';
    return 'missed_before_queue';
  }

  // Calculate duration in seconds
  calcDuration(start, end) {
    if (!start || !end) return 0;
    return Math.round((new Date(end) - new Date(start)) / 1000);
  }

  // Fetch new CDR records from 3CX
  async fetchNewCDRs() {
    let whereClause = '';
    const replacements = {};

    if (this.lastSyncTime) {
      whereClause = 'AND c.cdr_started_at > :lastSync';
      replacements.lastSync = this.lastSyncTime;
    } else {
      // First sync - get last 30 days
      whereClause = "AND c.cdr_started_at > NOW() - INTERVAL '30 days'";
    }

    const query = `
      SELECT
        c.cdr_id,
        c.call_history_id,
        c.source_entity_type,
        c.destination_entity_type,
        c.source_dn_number,
        c.source_dn_name,
        c.destination_dn_number,
        c.destination_dn_name,
        c.source_participant_phone_number,
        c.destination_participant_phone_number,
        c.source_participant_name,
        c.destination_participant_name,
        c.source_participant_is_incoming,
        c.destination_participant_is_incoming,
        c.creation_method,
        c.creation_forward_reason,
        c.termination_reason,
        c.termination_reason_details,
        c.cdr_started_at,
        c.cdr_ended_at,
        c.cdr_answered_at
      FROM cdroutput c
      WHERE c.source_entity_type = 'external_line'
        AND c.destination_entity_type != 'external_line'
        AND c.creation_method IN ('call_init', 'route_to', 'divert')
        ${whereClause}
      ORDER BY c.cdr_started_at ASC
    `;

    try {
      const results = await cxDatabase.query(query, {
        replacements,
        type: QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      console.error('[CDR Sync] Error fetching CDRs:', error.message);
      return [];
    }
  }

  // Fetch outbound calls for auto-detection
  async fetchOutboundCalls(sinceTime) {
    const query = `
      SELECT
        c.cdr_id,
        c.call_history_id,
        c.source_dn_number,
        c.source_dn_name,
        c.destination_participant_phone_number,
        c.cdr_started_at,
        c.cdr_answered_at,
        c.cdr_ended_at
      FROM cdroutput c
      WHERE c.source_entity_type = 'extension'
        AND c.destination_entity_type = 'external_line'
        AND c.cdr_started_at > :sinceTime
      ORDER BY c.cdr_started_at ASC
    `;

    try {
      const results = await cxDatabase.query(query, {
        replacements: { sinceTime },
        type: QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      console.error('[CDR Sync] Error fetching outbound calls:', error.message);
      return [];
    }
  }

  // Process inbound CDRs
  async processInboundCDRs(cdrs) {
    let processed = 0;

    for (const cdr of cdrs) {
      try {
        // Check if already processed
        const existing = await CallHistory.findOne({
          where: { cxCdrId: cdr.cdr_id }
        });
        if (existing) continue;

        const callerNumber = this.normalizeNumber(cdr.source_participant_phone_number);
        if (!callerNumber) continue;

        const callStatus = this.determineCallStatus(cdr);
        const callSource = this.determineCallSource(cdr);
        const queueName = cdr.destination_dn_name || callSource;
        const duration = this.calcDuration(cdr.cdr_answered_at || cdr.cdr_started_at, cdr.cdr_ended_at);
        const waitTime = this.calcDuration(cdr.cdr_started_at, cdr.cdr_answered_at || cdr.cdr_ended_at);

        // Find or create unified Call record
        let [call, created] = await Call.findOrCreate({
          where: {
            callerNumber: callerNumber,
            queueName: queueName
          },
          defaults: {
            callerName: cdr.source_participant_name || cdr.source_dn_name,
            queueName: queueName,
            callSource: callSource,
            totalInboundAttempts: 1,
            firstCallAt: cdr.cdr_started_at,
            lastCallAt: cdr.cdr_started_at,
            lastCallStatus: callStatus,
            answeredBy: callStatus === 'answered' ? (cdr.destination_participant_name || cdr.destination_dn_name) : null,
            answeredByExtension: callStatus === 'answered' ? cdr.destination_dn_number : null,
            lastCallDuration: duration,
            lastWaitTime: waitTime,
            followUpStatus: callStatus === 'answered' ? 'not_required' : 'pending',
            lastCxHistoryId: cdr.call_history_id
          }
        });

        if (!created) {
          // Update existing record
          const updateData = {
            totalInboundAttempts: call.totalInboundAttempts + 1,
            lastCallAt: cdr.cdr_started_at,
            lastCallStatus: callStatus,
            lastCallDuration: duration,
            lastWaitTime: waitTime,
            lastCxHistoryId: cdr.call_history_id
          };

          if (cdr.source_participant_name) {
            updateData.callerName = cdr.source_participant_name;
          }

          if (callStatus === 'answered') {
            updateData.answeredBy = cdr.destination_participant_name || cdr.destination_dn_name;
            updateData.answeredByExtension = cdr.destination_dn_number;
            updateData.followUpStatus = 'not_required';
          } else if (call.followUpStatus === 'not_required' || call.followUpStatus === 'closed') {
            // Reset follow-up if new missed call after being handled
            updateData.followUpStatus = 'pending';
            updateData.followUpBy = null;
            updateData.followUpAt = null;
            updateData.followUpNote = null;
            updateData.autoDetectedCallback = false;
          }

          await call.update(updateData);
        }

        // Create history record
        await CallHistory.create({
          callId: call.id,
          cxHistoryId: cdr.call_history_id,
          cxCdrId: cdr.cdr_id,
          direction: 'inbound',
          callerNumber: callerNumber,
          destinationNumber: cdr.destination_dn_number,
          status: callStatus === 'answered' ? 'answered' : (callStatus === 'abandoned' ? 'abandoned' : 'missed'),
          queueName: queueName,
          answeredBy: callStatus === 'answered' ? (cdr.destination_participant_name || cdr.destination_dn_name) : null,
          answeredByExtension: callStatus === 'answered' ? cdr.destination_dn_number : null,
          duration: duration,
          waitTime: waitTime,
          startedAt: cdr.cdr_started_at,
          endedAt: cdr.cdr_ended_at,
          terminationReason: cdr.termination_reason,
          terminationDetails: cdr.termination_reason_details
        });

        processed++;
      } catch (error) {
        console.error(`[CDR Sync] Error processing CDR ${cdr.cdr_id}:`, error.message);
      }
    }

    return processed;
  }

  // Auto-detect outbound callbacks
  async detectOutboundCallbacks() {
    const slaMinutes = parseInt(process.env.SLA_TARGET_MINUTES) || 30;

    // Get pending calls
    const pendingCalls = await Call.findAll({
      where: {
        followUpStatus: 'pending',
        lastCallStatus: { [Op.ne]: 'answered' }
      }
    });

    if (pendingCalls.length === 0) return 0;

    // Fetch recent outbound calls
    const sinceTime = new Date();
    sinceTime.setHours(sinceTime.getHours() - 24);

    const outboundCalls = await this.fetchOutboundCalls(sinceTime.toISOString());
    let detected = 0;

    for (const pending of pendingCalls) {
      const normalizedPending = this.normalizeNumber(pending.callerNumber);

      const matchingOutbound = outboundCalls.find(ob => {
        const normalizedDest = this.normalizeNumber(ob.destination_participant_phone_number);
        return normalizedDest === normalizedPending;
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

        // Add to history
        await CallHistory.create({
          callId: pending.id,
          cxHistoryId: matchingOutbound.call_history_id,
          cxCdrId: matchingOutbound.cdr_id,
          direction: 'outbound',
          callerNumber: matchingOutbound.source_dn_number,
          destinationNumber: pending.callerNumber,
          status: matchingOutbound.cdr_answered_at ? 'answered' : 'no_answer',
          answeredBy: matchingOutbound.source_dn_name,
          answeredByExtension: matchingOutbound.source_dn_number,
          duration: this.calcDuration(matchingOutbound.cdr_answered_at || matchingOutbound.cdr_started_at, matchingOutbound.cdr_ended_at),
          startedAt: matchingOutbound.cdr_started_at,
          endedAt: matchingOutbound.cdr_ended_at
        });

        detected++;
      }
    }

    return detected;
  }

  // Main sync function
  async sync() {
    if (this.isRunning) {
      console.log('[CDR Sync] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[CDR Sync] Starting sync...');

      // 1. Fetch and process inbound CDRs
      const cdrs = await this.fetchNewCDRs();
      const processed = await this.processInboundCDRs(cdrs);

      // 2. Auto-detect outbound callbacks
      const detected = await this.detectOutboundCallbacks();

      // Update last sync time
      if (cdrs.length > 0) {
        this.lastSyncTime = cdrs[cdrs.length - 1].cdr_started_at;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[CDR Sync] Done in ${elapsed}s — ${processed} inbound processed, ${detected} callbacks detected`);
    } catch (error) {
      console.error('[CDR Sync] Sync failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new CDRSyncService();
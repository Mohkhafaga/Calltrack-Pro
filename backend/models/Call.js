const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callerNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'caller_number',
    comment: 'Unified caller phone number'
  },
  callerName: {
    type: DataTypes.STRING(100),
    field: 'caller_name',
    comment: 'Caller display name from 3CX'
  },
  queueName: {
    type: DataTypes.STRING(100),
    field: 'queue_name',
    comment: 'Queue/IVR/source where the call landed'
  },
  callSource: {
    type: DataTypes.STRING(50),
    field: 'call_source',
    comment: 'e.g. queue, ivr, direct, after_hours, ring_group'
  },
  totalInboundAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'total_inbound_attempts'
  },
  firstCallAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'first_call_at'
  },
  lastCallAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'last_call_at'
  },
  lastCallStatus: {
    type: DataTypes.ENUM('answered', 'missed_in_queue', 'missed_before_queue', 'abandoned', 'after_hours', 'voicemail'),
    allowNull: false,
    field: 'last_call_status'
  },
  answeredBy: {
    type: DataTypes.STRING(100),
    field: 'answered_by',
    comment: 'Extension/name that answered the last call'
  },
  answeredByExtension: {
    type: DataTypes.STRING(10),
    field: 'answered_by_extension'
  },
  lastCallDuration: {
    type: DataTypes.INTEGER,
    field: 'last_call_duration',
    comment: 'Duration in seconds'
  },
  lastWaitTime: {
    type: DataTypes.INTEGER,
    field: 'last_wait_time',
    comment: 'Wait time in seconds before answer/abandon'
  },
  // Follow-up tracking
  followUpStatus: {
    type: DataTypes.ENUM('not_required', 'pending', 'in_progress', 'callback_done_answered', 'callback_done_no_answer', 'retry_later', 'closed'),
    defaultValue: 'pending',
    field: 'follow_up_status'
  },
  followUpBy: {
    type: DataTypes.STRING(100),
    field: 'follow_up_by',
    comment: 'Name of agent who did the callback'
  },
  followUpByExtension: {
    type: DataTypes.STRING(10),
    field: 'follow_up_by_extension'
  },
  followUpAt: {
    type: DataTypes.DATE,
    field: 'follow_up_at'
  },
  followUpNote: {
    type: DataTypes.TEXT,
    field: 'follow_up_note'
  },
  retryScheduledAt: {
    type: DataTypes.DATE,
    field: 'retry_scheduled_at',
    comment: 'When to retry the callback'
  },
  // Auto-detection of outbound callback
  autoDetectedCallback: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'auto_detected_callback',
    comment: 'True if system detected an outbound call to this number'
  },
  autoDetectedAt: {
    type: DataTypes.DATE,
    field: 'auto_detected_at'
  },
  autoDetectedByExtension: {
    type: DataTypes.STRING(10),
    field: 'auto_detected_by_extension'
  },
  // SLA tracking
  slaMetAt: {
    type: DataTypes.DATE,
    field: 'sla_met_at',
    comment: 'When follow-up was done (for SLA calculation)'
  },
  slaMet: {
    type: DataTypes.BOOLEAN,
    field: 'sla_met',
    comment: 'Whether follow-up was within SLA target'
  },
  // 3CX reference
  lastCxHistoryId: {
    type: DataTypes.STRING(100),
    field: 'last_cx_history_id',
    comment: 'Last 3CX call_history_id for reference'
  }
}, {
  tableName: 'calls',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['caller_number'] },
    { fields: ['follow_up_status'] },
    { fields: ['last_call_at'] },
    { fields: ['queue_name'] },
    { fields: ['last_call_status'] },
    { unique: true, fields: ['caller_number'], name: 'unique_caller_number' }
  ]
});

module.exports = Call;
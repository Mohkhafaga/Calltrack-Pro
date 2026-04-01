const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CallHistory = sequelize.define('CallHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'call_id',
    comment: 'Reference to the unified Call record'
  },
  cxHistoryId: {
    type: DataTypes.STRING(100),
    field: 'cx_history_id',
    comment: '3CX call_history_id'
  },
  cxCdrId: {
    type: DataTypes.STRING(100),
    field: 'cx_cdr_id',
    comment: '3CX cdr_id'
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false
  },
  callerNumber: {
    type: DataTypes.STRING(30),
    field: 'caller_number'
  },
  destinationNumber: {
    type: DataTypes.STRING(30),
    field: 'destination_number'
  },
  status: {
    type: DataTypes.ENUM('answered', 'missed', 'abandoned', 'voicemail', 'after_hours', 'no_answer'),
    allowNull: false
  },
  queueName: {
    type: DataTypes.STRING(100),
    field: 'queue_name'
  },
  answeredBy: {
    type: DataTypes.STRING(100),
    field: 'answered_by'
  },
  answeredByExtension: {
    type: DataTypes.STRING(10),
    field: 'answered_by_extension'
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: 'Call duration in seconds'
  },
  waitTime: {
    type: DataTypes.INTEGER,
    field: 'wait_time',
    comment: 'Wait time in seconds'
  },
  startedAt: {
    type: DataTypes.DATE,
    field: 'started_at'
  },
  endedAt: {
    type: DataTypes.DATE,
    field: 'ended_at'
  },
  terminationReason: {
    type: DataTypes.STRING(100),
    field: 'termination_reason'
  },
  terminationDetails: {
    type: DataTypes.STRING(100),
    field: 'termination_details'
  }
}, {
  tableName: 'call_history',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['call_id'] },
    { fields: ['cx_history_id'] },
    { fields: ['cx_cdr_id'], unique: true },
    { fields: ['started_at'] },
    { fields: ['direction'] }
  ]
});

module.exports = CallHistory;
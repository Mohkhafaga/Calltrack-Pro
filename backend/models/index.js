const User = require('./User');
const Call = require('./Call');
const CallHistory = require('./CallHistory');

// Relationships
Call.hasMany(CallHistory, { foreignKey: 'call_id', as: 'history' });
CallHistory.belongsTo(Call, { foreignKey: 'call_id', as: 'call' });

module.exports = { User, Call, CallHistory };
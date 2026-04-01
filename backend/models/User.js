const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'full_name'
  },
  extension: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '3CX Extension number e.g. 101'
  },
  role: {
    type: DataTypes.ENUM('admin', 'agent'),
    defaultValue: 'agent'
  },
  queueNames: {
    type: DataTypes.TEXT,
    field: 'queue_names',
    comment: 'Comma-separated queue names this user belongs to',
    get() {
      const val = this.getDataValue('queueNames');
      return val ? val.split(',').map(q => q.trim()) : [];
    },
    set(val) {
      this.setDataValue('queueNames', Array.isArray(val) ? val.join(',') : val);
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
});

User.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;
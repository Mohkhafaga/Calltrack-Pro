const { Sequelize } = require('sequelize');
require('dotenv').config();

// CallTrack Pro MariaDB Connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mariadb',
    logging: false,
    timezone: '+03:00',
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
);

// 3CX PostgreSQL CDR Connection
const cxDatabase = new Sequelize(
  process.env.CX_DB_NAME,
  process.env.CX_DB_USER,
  process.env.CX_DB_PASS,
  {
    host: process.env.CX_DB_HOST,
    port: process.env.CX_DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = { sequelize, cxDatabase };
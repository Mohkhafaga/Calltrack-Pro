const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { sequelize } = require('./config/database');
const { User } = require('./models');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/calls');
const cdrSync = require('./services/cdrSync');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manual sync trigger
app.post('/api/sync', async (req, res) => {
  try {
    await cdrSync.sync();
    res.json({ message: 'Sync completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize
async function start() {
  try {
    // Connect to MariaDB
    await sequelize.authenticate();
    console.log('[DB] MariaDB connected');

    // Sync tables
    await sequelize.sync({ alter: true });
    console.log('[DB] Tables synced');

    // Create default admin if none exists
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        fullName: 'System Admin',
        extension: '100',
        role: 'admin'
      });
      console.log('[DB] Default admin created (admin / admin123)');
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] CallTrack Pro running on port ${PORT}`);
    });

    // Schedule CDR sync
    const interval = process.env.CDR_SYNC_INTERVAL || 1;
    cron.schedule(`*/${interval} * * * *`, () => {
      cdrSync.sync();
    });
    console.log(`[CDR Sync] Scheduled every ${interval} minute(s)`);

    // Run initial sync after 10 seconds
    setTimeout(() => cdrSync.sync(), 10000);

  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
}

start();
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        extension: user.extension,
        role: user.role,
        queueNames: user.queueNames
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    fullName: req.user.fullName,
    extension: req.user.extension,
    role: req.user.role,
    queueNames: req.user.queueNames
  });
});

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['fullName', 'ASC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
router.post('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, fullName, extension, role, queueNames } = req.body;
    const user = await User.create({ username, password, fullName, extension, role, queueNames });
    res.status(201).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      extension: user.extension,
      role: user.role,
      queueNames: user.queueNames
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { fullName, extension, role, queueNames, isActive, password } = req.body;
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (extension !== undefined) updateData.extension = extension;
    if (role !== undefined) updateData.role = role;
    if (queueNames !== undefined) updateData.queueNames = queueNames;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.password = password;

    await user.update(updateData);
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      extension: user.extension,
      role: user.role,
      queueNames: user.queueNames,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.destroy();
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const express = require('express');
const oracledb = require('oracledb');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

// Get all users (admin only)
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT id, name, email, role FROM users`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `DELETE FROM users WHERE id = :id`,
      { id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs (admin only)
router.get('/jobs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT j.id, j.title, j.description, u.name as employer_name FROM jobs j JOIN users u ON j.employer_id = u.id`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete job (admin only)
router.delete('/jobs/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `DELETE FROM jobs WHERE id = :id`,
      { id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics
router.get('/analytics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const users = await connection.execute(`SELECT COUNT(*) as count FROM users`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const jobs = await connection.execute(`SELECT COUNT(*) as count FROM jobs`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const applications = await connection.execute(`SELECT COUNT(*) as count FROM applications`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    res.json({
      totalUsers: users.rows[0].COUNT,
      totalJobs: jobs.rows[0].COUNT,
      totalApplications: applications.rows[0].COUNT
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
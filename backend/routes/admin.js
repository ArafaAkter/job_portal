const express = require('express');
const bcrypt = require('bcryptjs');
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
      `SELECT "ID", "NAME", "EMAIL", "ROLE" FROM users`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
router.post('/users', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, role, company_name, company_description } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `INSERT INTO users ("ID", "NAME", "EMAIL", "PASSWORD", "ROLE", "COMPANY_NAME", "COMPANY_DESCRIPTION") VALUES (users_seq.NEXTVAL, :name, :email, :password, :role, :company_name, :company_description)`,
      { name, email, password: hashedPassword, role, company_name, company_description },
      { autoCommit: true }
    );
    await connection.close();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single user (admin only)
router.get('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT "ID", "NAME", "EMAIL", "ROLE", "SKILLS", "RESUME", "COMPANY_NAME", "COMPANY_DESCRIPTION" FROM users WHERE "ID" = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, skills, resume, company_name, company_description } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `UPDATE users SET "NAME" = :name, "EMAIL" = :email, "ROLE" = :role, "SKILLS" = :skills, "RESUME" = :resume, "COMPANY_NAME" = :company_name, "COMPANY_DESCRIPTION" = :company_description WHERE "ID" = :id`,
      { name, email, role, skills, resume, company_name, company_description, id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'User updated successfully' });
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
      `DELETE FROM users WHERE "ID" = :id`,
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
      `SELECT j."ID", j."TITLE", j."DESCRIPTION", j."REQUIREMENTS", j."SALARY", j."LOCATION", u."NAME" as employer_name, u."COMPANY_NAME", u."COMPANY_DESCRIPTION" FROM jobs j JOIN users u ON j."EMPLOYER_ID" = u."ID"`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update job (admin only)
router.put('/jobs/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, description, requirements, salary, location, company_name } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `UPDATE jobs SET "TITLE" = :title, "DESCRIPTION" = :description, "REQUIREMENTS" = :requirements, "SALARY" = :salary, "LOCATION" = :location, "COMPANY_NAME" = :company_name WHERE "ID" = :id`,
      { title, description, requirements, salary, location, company_name, id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Job updated successfully' });
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
      `DELETE FROM jobs WHERE "ID" = :id`,
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
  console.log('Analytics endpoint hit');
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const users = await connection.execute(`SELECT COUNT(*) as count FROM users`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const jobs = await connection.execute(`SELECT COUNT(*) as count FROM jobs`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const applications = await connection.execute(`SELECT COUNT(*) as count FROM applications`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const usersByRole = await connection.execute(`SELECT "ROLE", COUNT(*) as count FROM users GROUP BY "ROLE"`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const applicationsByStatus = await connection.execute(`SELECT "STATUS", COUNT(*) as count FROM applications GROUP BY "STATUS"`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    res.json({
      totalUsers: users.rows[0].COUNT,
      totalJobs: jobs.rows[0].COUNT,
      totalApplications: applications.rows[0].COUNT,
      usersByRole: usersByRole.rows,
      applicationsByStatus: applicationsByStatus.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Utility: Convert rows (array of objects) to CSV
function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [];
  lines.push(headers.join(','));
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

// Reports (admin only): users, jobs, applications
router.get('/reports/:type', authenticate, authorize('admin'), async (req, res) => {
  const { type } = req.params;
  const format = (req.query.format || 'csv').toLowerCase();

  let query = '';
  try {
    const connection = await oracledb.getConnection(dbConfig);
    if (type === 'users') {
      query = `SELECT "ID", "NAME", "EMAIL", "ROLE", "SKILLS", "RESUME", "COMPANY_NAME", "COMPANY_DESCRIPTION" FROM users ORDER BY "ID" DESC`;
    } else if (type === 'jobs') {
      query = `SELECT j."ID", j."TITLE", j."LOCATION", j."SALARY", j."COMPANY_NAME", u."NAME" AS EMPLOYER_NAME
               FROM jobs j JOIN users u ON j."EMPLOYER_ID" = u."ID"
               ORDER BY j."ID" DESC`;
    } else if (type === 'applications') {
      query = `SELECT a."ID", a."JOB_ID", a."SEEKER_ID", a."STATUS",
                      j."TITLE" AS JOB_TITLE,
                      u."NAME" AS SEEKER_NAME,
                      u."EMAIL" AS SEEKER_EMAIL
               FROM applications a
               JOIN jobs j ON a."JOB_ID" = j."ID"
               JOIN users u ON a."SEEKER_ID" = u."ID"
               ORDER BY a."ID" DESC`;
    } else {
      await connection.close();
      return res.status(400).json({ error: 'Invalid report type. Use users|jobs|applications' });
    }

    const result = await connection.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();

    if (format === 'csv') {
      const csv = toCSV(result.rows);
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename="${type}-report.csv"`);
      return res.send(csv);
    } else {
      return res.json(result.rows);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
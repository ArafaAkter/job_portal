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

// List all jobs with search and pagination
router.get('/', async (req, res) => {
  const { keyword, location, salary_min, salary_max, limit = 10, offset = 0 } = req.query;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    let query = `SELECT j.id, j.title, j.description, j.requirements, j.salary, j.location, u.name as employer_name FROM jobs j JOIN users u ON j.employer_id = u.id WHERE 1=1`;
    const params = {};
    if (keyword) {
      query += ` AND (j.title LIKE :keyword OR j.description LIKE :keyword OR j.requirements LIKE :keyword)`;
      params.keyword = `%${keyword}%`;
    }
    if (location) {
      query += ` AND j.location LIKE :location`;
      params.location = `%${location}%`;
    }
    if (salary_min) {
      query += ` AND j.salary >= :salary_min`;
      params.salary_min = Number(salary_min);
    }
    if (salary_max) {
      query += ` AND j.salary <= :salary_max`;
      params.salary_max = Number(salary_max);
    }
    query += ` ORDER BY j.id DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
    params.offset = Number(offset);
    params.limit = Number(limit);
    const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post new job (employer only)
router.post('/', authenticate, authorize('employer'), async (req, res) => {
  const { title, description, requirements, salary, location } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `INSERT INTO jobs (id, employer_id, title, description, requirements, salary, location) VALUES (jobs_seq.NEXTVAL, :employer_id, :title, :description, :requirements, :salary, :location)`,
      { employer_id: req.user.id, title, description, requirements, salary, location },
      { autoCommit: true }
    );
    await connection.close();
    res.status(201).json({ message: 'Job posted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit job (employer only)
router.put('/:id', authenticate, authorize('employer'), async (req, res) => {
  const { id } = req.params;
  const { title, description, requirements, salary, location } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    // Check if job belongs to user
    const check = await connection.execute(
      `SELECT employer_id FROM jobs WHERE id = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `UPDATE jobs SET title = :title, description = :description, requirements = :requirements, salary = :salary, location = :location WHERE id = :id`,
      { title, description, requirements, salary, location, id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Job updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete job (employer only)
router.delete('/:id', authenticate, authorize('employer'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const check = await connection.execute(
      `SELECT employer_id FROM jobs WHERE id = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `DELETE FROM jobs WHERE id = :id`,
      { id: Number(id) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply to job (seeker only)
router.post('/:id/apply', authenticate, authorize('job_seeker'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    // Check if already applied
    const check = await connection.execute(
      `SELECT id FROM applications WHERE job_id = :job_id AND seeker_id = :seeker_id`,
      { job_id: Number(id), seeker_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length > 0) {
      await connection.close();
      return res.status(400).json({ error: 'Already applied' });
    }
    await connection.execute(
      `INSERT INTO applications (id, job_id, seeker_id) VALUES (applications_seq.NEXTVAL, :job_id, :seeker_id)`,
      { job_id: Number(id), seeker_id: req.user.id },
      { autoCommit: true }
    );
    await connection.close();
    res.status(201).json({ message: 'Applied successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View applicants (employer only)
router.get('/:id/applicants', authenticate, authorize('employer'), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const check = await connection.execute(
      `SELECT employer_id FROM jobs WHERE id = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await connection.execute(
      `SELECT a.id, a.status, u.name, u.email, u.skills, u.resume FROM applications a JOIN users u ON a.seeker_id = u.id WHERE a.job_id = :job_id`,
      { job_id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get applied jobs for seeker
router.get('/applied', authenticate, authorize('job_seeker'), async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT j.id, j.title, j.description, j.location, a.status FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.seeker_id = :seeker_id`,
      { seeker_id: req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update application status (employer only)
router.put('/:jobId/applications/:appId/status', authenticate, authorize('employer'), async (req, res) => {
  const { jobId, appId } = req.params;
  const { status } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    // Check if job belongs to user
    const check = await connection.execute(
      `SELECT employer_id FROM jobs WHERE id = :id`,
      { id: Number(jobId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `UPDATE applications SET status = :status WHERE id = :id`,
      { status, id: Number(appId) },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
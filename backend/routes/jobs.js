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

// Get single job
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(`SELECT j."ID", j."EMPLOYER_ID", j."TITLE", j."DESCRIPTION", j."REQUIREMENTS", j."SALARY", j."LOCATION", j."COMPANY_NAME", u."NAME" as employer_name FROM jobs j JOIN users u ON j."EMPLOYER_ID" = u."ID" WHERE j."ID" = :id`, { id: Number(id) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (connection) await connection.close();
    res.status(500).json({ error: error.message });
  }
});

// Get my jobs (employer only)
router.get('/my-jobs', authenticate, authorize('employer'), async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT "ID", "EMPLOYER_ID", "TITLE", "DESCRIPTION", "REQUIREMENTS", "SALARY", "LOCATION", "COMPANY_NAME" FROM jobs WHERE "EMPLOYER_ID" = :employer_id ORDER BY "ID" DESC`,
      { employer_id: Number(req.user.id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all jobs with search and pagination
router.get('/', async (req, res) => {
  const { keyword, location, salary_min, salary_max, limit = 10, offset = 0 } = req.query;
  try {
    const numLimit = Number(limit);
    const numOffset = Number(offset);
    if (isNaN(numLimit) || isNaN(numOffset)) {
      return res.status(400).json({ error: 'Invalid limit or offset' });
    }
    const connection = await oracledb.getConnection(dbConfig);
    let query = `SELECT * FROM (
      SELECT j."ID", j."TITLE", j."DESCRIPTION", j."REQUIREMENTS", j."SALARY", j."LOCATION", j."COMPANY_NAME", j."EMPLOYER_ID", u."NAME" as employer_name, ROWNUM as rn
      FROM jobs j JOIN users u ON j."EMPLOYER_ID" = u."ID" WHERE 1=1`;
    const params = {};
    if (keyword) {
      query += ` AND (j."TITLE" LIKE :keyword OR j."DESCRIPTION" LIKE :keyword OR j."REQUIREMENTS" LIKE :keyword)`;
      params.keyword = `%${keyword}%`;
    }
    if (location) {
      query += ` AND j."LOCATION" LIKE :location`;
      params.location = `%${location}%`;
    }
    if (salary_min) {
      const min = Number(salary_min);
      if (!isNaN(min)) {
        query += ` AND j."SALARY" >= :salary_min`;
        params.salary_min = min;
      }
    }
    if (salary_max) {
      const max = Number(salary_max);
      if (!isNaN(max)) {
        query += ` AND j."SALARY" <= :salary_max`;
        params.salary_max = max;
      }
    }
    query += ` ORDER BY j."ID" DESC
    ) WHERE rn > :offset AND rn <= :end`;
    params.offset = numOffset;
    params.end = numOffset + numLimit;
    const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post new job (employer only)
router.post('/', authenticate, authorize('employer'), async (req, res) => {
  const { title, description, requirements, salary, location, company_name } = req.body;
  try {
    const numSalary = salary ? Number(salary) : null;
    if (numSalary !== null && isNaN(numSalary)) {
      return res.status(400).json({ error: 'Salary must be a valid number' });
    }
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `INSERT INTO jobs ("ID", "EMPLOYER_ID", "TITLE", "DESCRIPTION", "REQUIREMENTS", "SALARY", "LOCATION", "COMPANY_NAME") VALUES (jobs_seq.NEXTVAL, :employer_id, :title, :description, :requirements, :salary, :location, :company_name)`,
      { employer_id: Number(req.user.id), title, description, requirements, salary: numSalary, location, company_name },
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
  const { title, description, requirements, salary, location, company_name } = req.body;
  try {
    const numSalary = salary ? Number(salary) : null;
    if (numSalary !== null && isNaN(numSalary)) {
      return res.status(400).json({ error: 'Salary must be a valid number' });
    }
    const connection = await oracledb.getConnection(dbConfig);
    // Check if job belongs to user
    const check = await connection.execute(
      `SELECT "EMPLOYER_ID" FROM jobs WHERE "ID" = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `UPDATE jobs SET "TITLE" = :title, "DESCRIPTION" = :description, "REQUIREMENTS" = :requirements, "SALARY" = :salary, "LOCATION" = :location, "COMPANY_NAME" = :company_name WHERE "ID" = :id`,
      { title, description, requirements, salary: numSalary, location, company_name, id: Number(id) },
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
      `SELECT "EMPLOYER_ID" FROM jobs WHERE "ID" = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `DELETE FROM jobs WHERE "ID" = :id`,
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
        `SELECT "ID" FROM applications WHERE "JOB_ID" = :job_id AND "SEEKER_ID" = :seeker_id`,
        { job_id: Number(id), seeker_id: Number(req.user.id) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length > 0) {
      await connection.close();
      return res.status(400).json({ error: 'Already applied' });
    }
    await connection.execute(
        `INSERT INTO applications ("ID", "JOB_ID", "SEEKER_ID") VALUES (applications_seq.NEXTVAL, :job_id, :seeker_id)`,
        { job_id: Number(id), seeker_id: Number(req.user.id) },
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
      `SELECT "EMPLOYER_ID" FROM jobs WHERE "ID" = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await connection.execute(
      `SELECT a."ID", a."STATUS", u."NAME", u."EMAIL", u."SKILLS", u."RESUME" FROM applications a JOIN users u ON a."SEEKER_ID" = u."ID" WHERE a."JOB_ID" = :job_id`,
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
        console.log('Querying applied jobs for user ID:', req.user.id);
        const connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT a."ID" as APP_ID, j."TITLE", j."DESCRIPTION", j."LOCATION", a."STATUS" FROM applications a JOIN jobs j ON a."JOB_ID" = j."ID" WHERE a."SEEKER_ID" = :seeker_id`,
            { seeker_id: Number(req.user.id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Applied jobs result:', result.rows);
        await connection.close();
        res.json(result.rows);
    } catch (error) {
        console.log('Error in /applied:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all applicants for employer
router.get('/applicants', authenticate, authorize('employer'), async (req, res) => {
    try {
        const connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT a."ID" as app_id, a."JOB_ID" as job_id, a."STATUS", j."TITLE" as job_title, u."NAME", u."EMAIL", u."SKILLS", u."RESUME" FROM applications a JOIN jobs j ON a."JOB_ID" = j."ID" JOIN users u ON a."SEEKER_ID" = u."ID" WHERE j."EMPLOYER_ID" = :employer_id ORDER BY a."ID" DESC`,
            { employer_id: Number(req.user.id) },
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
      `SELECT "EMPLOYER_ID" FROM jobs WHERE "ID" = :id`,
      { id: Number(jobId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows.length === 0 || check.rows[0].EMPLOYER_ID !== req.user.id) {
      await connection.close();
      return res.status(403).json({ error: 'Forbidden' });
    }
    await connection.execute(
      `UPDATE applications SET "STATUS" = :status WHERE "ID" = :id`,
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
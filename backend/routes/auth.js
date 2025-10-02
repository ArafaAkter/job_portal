const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const oracledb = require('oracledb');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role, company_name, company_description } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    // Check if user already exists
    const result = await connection.execute(`SELECT id FROM users WHERE email = :email`, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows.length > 0) {
      await connection.close();
      return res.status(400).json({ error: 'User already exists' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    await connection.execute(`INSERT INTO users (id, name, email, password, role, company_name, company_description) VALUES (users_seq.nextval, :name, :email, :password, :role, :company_name, :company_description)`,
      { name, email, password: hashedPassword, role, company_name, company_description }, { autoCommit: true });
    await connection.close();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    if (connection) await connection.close();
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt for email:', email);
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(`SELECT id, name, email, password, role FROM users WHERE email = :email`, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Query result rows length:', result.rows.length);
    await connection.close();
    if (result.rows.length === 0) {
      console.log('No user found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const row = result.rows[0];
    console.log('User found:', row.EMAIL, 'Role:', row.ROLE);
    const isValid = bcrypt.compareSync(password, row.PASSWORD);
    console.log('Password match:', isValid);
    if (!isValid) {
      console.log('Password does not match for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: row.ID, role: row.ROLE }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for:', email);
    res.json({ token, user: { id: row.ID, name: row.NAME, email: row.EMAIL, role: row.ROLE } });
  } catch (error) {
    console.log('Login error:', error.message);
    if (connection) await connection.close();
    res.status(500).json({ error: error.message });
  }
});

// Get profile
router.get('/profile', authenticate, async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(`SELECT id, name, email, role, skills, resume, company_name, company_description FROM users WHERE id = :id`, { id: req.user.id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    await connection.close();
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (connection) await connection.close();
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  const { name, skills, resume, company_name, company_description } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const updates = [];
    const params = {};
    if (name !== undefined) {
      updates.push('name = :name');
      params.name = name;
    }
    if (skills !== undefined) {
      updates.push('skills = :skills');
      params.skills = skills;
    }
    if (resume !== undefined) {
      updates.push('resume = :resume');
      params.resume = resume;
    }
    if (company_name !== undefined) {
      updates.push('company_name = :company_name');
      params.company_name = company_name;
    }
    if (company_description !== undefined) {
      updates.push('company_description = :company_description');
      params.company_description = company_description;
    }
    if (updates.length > 0) {
      params.id = req.user.id;
      await connection.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = :id`, params, { autoCommit: true });
    }
    await connection.close();
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    if (connection) await connection.close();
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
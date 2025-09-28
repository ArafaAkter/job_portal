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
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `INSERT INTO users (id, name, email, password, role, company_name, company_description) VALUES (users_seq.NEXTVAL, :name, :email, :password, :role, :company_name, :company_description)`,
      { name, email, password: hashedPassword, role, company_name, company_description },
      { autoCommit: true }
    );
    await connection.close();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT id, name, email, password, role FROM users WHERE email = :email`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.PASSWORD);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.ID, role: user.ROLE }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.ID, name: user.NAME, email: user.EMAIL, role: user.ROLE } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT id, name, email, role, skills, resume, profile_pic, company_name, company_description FROM users WHERE id = :id`,
      { id: req.user.id },
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

// Update profile
router.put('/profile', authenticate, async (req, res) => {
  const { name, skills, resume, profile_pic, company_name, company_description } = req.body;
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `UPDATE users SET name = :name, skills = :skills, resume = :resume, profile_pic = :profile_pic, company_name = :company_name, company_description = :company_description WHERE id = :id`,
      { name, skills, resume, profile_pic, company_name, company_description, id: req.user.id },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
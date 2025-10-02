const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_8' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Serve static files from frontend folder
app.use(express.static('../frontend'));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
const jobRoutes = require('./routes/jobs');
app.use('/api/jobs', jobRoutes);
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Create database and test users
const createDatabase = async () => {
  console.log('Starting database setup...');
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log('Connected to Oracle database.');

    // Create sequences if not exist
    try {
      await connection.execute(`CREATE SEQUENCE users_seq START WITH 1 INCREMENT BY 1`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err; // 955 is name already used
    }
    try {
      await connection.execute(`CREATE SEQUENCE jobs_seq START WITH 1 INCREMENT BY 1`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err;
    }
    try {
      await connection.execute(`CREATE SEQUENCE applications_seq START WITH 1 INCREMENT BY 1`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err;
    }

    // Create tables if not exist
    try {
      await connection.execute(`CREATE TABLE users (
        id NUMBER PRIMARY KEY,
        name VARCHAR2(255) NOT NULL,
        email VARCHAR2(255) UNIQUE NOT NULL,
        password VARCHAR2(255) NOT NULL,
        role VARCHAR2(50) NOT NULL CHECK (role IN ('job_seeker', 'employer', 'admin')),
        skills VARCHAR2(1000),
        resume VARCHAR2(500),
        company_name VARCHAR2(255),
        company_description VARCHAR2(1000)
      )`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err;
    }

    try {
      await connection.execute(`CREATE TABLE jobs (
        id NUMBER PRIMARY KEY,
        employer_id NUMBER NOT NULL,
        title VARCHAR2(255) NOT NULL,
        description VARCHAR2(2000),
        requirements VARCHAR2(2000),
        salary VARCHAR2(100),
        location VARCHAR2(255),
        company_name VARCHAR2(255),
        FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err;
    }

    try {
      await connection.execute(`CREATE TABLE applications (
        id NUMBER PRIMARY KEY,
        job_id NUMBER NOT NULL,
        seeker_id NUMBER NOT NULL,
        status VARCHAR2(50) DEFAULT 'applied' CHECK (status IN ('applied', 'accepted', 'rejected')),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      await connection.commit();
    } catch (err) {
      if (err.errorNum !== 955) throw err;
    }

    // Create test users
    const bcrypt = require('bcryptjs');

    // Check and create admin
    const adminResult = await connection.execute(`SELECT id FROM users WHERE email = 'admin@jobportal.com'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (adminResult.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await connection.execute(`INSERT INTO users (id, name, email, password, role) VALUES (users_seq.nextval, :name, :email, :password, :role)`,
        { name: 'Admin User', email: 'admin@jobportal.com', password: hashedPassword, role: 'admin' });
      console.log('Admin user created');
    }

    // Check and create employer
    const employerResult = await connection.execute(`SELECT id FROM users WHERE email = 'employer@jobportal.com'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (employerResult.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('employer123', 10);
      await connection.execute(`INSERT INTO users (id, name, email, password, role, company_name, company_description) VALUES (users_seq.nextval, :name, :email, :password, :role, :company_name, :company_description)`,
        { name: 'Employer User', email: 'employer@jobportal.com', password: hashedPassword, role: 'employer', company_name: 'Test Company', company_description: 'A test company' });
      console.log('Employer user created');
    }

    // Check and create job seeker
    const seekerResult = await connection.execute(`SELECT id FROM users WHERE email = 'seeker@jobportal.com'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (seekerResult.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('seeker123', 10);
      await connection.execute(`INSERT INTO users (id, name, email, password, role, skills, resume) VALUES (users_seq.nextval, :name, :email, :password, :role, :skills, :resume)`,
        { name: 'Job Seeker', email: 'seeker@jobportal.com', password: hashedPassword, role: 'job_seeker', skills: 'JavaScript, Node.js', resume: 'resume.pdf' });
      console.log('Job seeker user created');
    }

    await connection.commit();
    console.log('Database setup complete.');
  } catch (err) {
    console.error('Error setting up database:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await createDatabase();
});
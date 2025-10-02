const oracledb = require('oracledb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_8' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

async function createAdmin() {
  try {
    console.log('Creating admin user...');
    const connection = await oracledb.getConnection(dbConfig);

    // Check if admin already exists
    const existingAdmin = await connection.execute(
      `SELECT "ID" FROM users WHERE "EMAIL" = :email`,
      { email: 'admin@jobportal.com' },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists');
      await connection.close();
      return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.execute(
      `INSERT INTO users ("ID", "NAME", "EMAIL", "PASSWORD", "ROLE") VALUES (users_seq.NEXTVAL, :name, :email, :password, :role)`,
      { name: 'Admin User', email: 'admin@jobportal.com', password: hashedPassword, role: 'admin' },
      { autoCommit: true }
    );
    await connection.close();
    console.log('Admin user created successfully!');
    console.log('Email: admin@jobportal.com');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createAdmin();
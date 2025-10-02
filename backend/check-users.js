const oracledb = require('oracledb');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_8' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

async function checkUsers() {
  try {
    console.log('Checking users in database...');
    const connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT "ID", "NAME", "EMAIL", "ROLE" FROM users`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    console.log('Users found:', result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();
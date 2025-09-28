const oracledb = require('oracledb');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_8' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
};

async function testConnection() {
  try {
    console.log('Attempting to connect to Oracle database...');
    const connection = await oracledb.getConnection(dbConfig);
    console.log('Connected successfully!');
    await connection.close();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

testConnection();
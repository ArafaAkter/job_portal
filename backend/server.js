const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
require('dotenv').config();

oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_8' });

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
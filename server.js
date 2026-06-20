require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routers
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Import jobs to initialize and schedule cron tasks
require('./jobs/dailySync');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Parse incoming requests JSON body
app.use(express.json());

// Wire up API routes
app.use('/api', usersRoutes);
app.use('/api', adminRoutes);

// Root path diagnostic endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: process.env.SUPABASE_URL ? 'Configured' : 'Missing'
  });
});

// Fallback 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: `Path not found: ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start listening for traffic
const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Layora Backend Service started successfully!`);
  console.log(`📡 Listening on port: http://localhost:${PORT}`);
  console.log(`📅 Daily activity sync job registered.`);
  console.log(`==================================================`);
});

module.exports = server; // Export for testing

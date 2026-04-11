const express = require('express');
// Import CORS middleware for enabling cross-origin requests
const cors = require('cors');
// Import bcrypt for password hashing
const bcrypt = require('bcrypt');
// Import mysql2/promise for asynchronous MySQL database operations
const mysql = require('mysql2/promise');
// Import express-validator for request data validation
const { body, validationResult } = require('express-validator');
// Import rate-limit middleware to prevent excessive requests
const rateLimit = require('express-rate-limit');
// Import winston for logging
const winston = require('winston');
// Load environment variables from .env file
require('dotenv').config();

// Create an Express router instance
const router = express.Router();

// Configure winston logger for logging security events and errors
const logger = winston.createLogger({
  level: 'info', // Set log level to 'info'
  format: winston.format.combine(
    winston.format.timestamp(), // Add timestamps to logs
    winston.format.json() // Format logs as JSON
  ),
  transports: [
    // Log to a file named 'security.log'
    new winston.transports.File({ filename: 'security.log' }),
    // Log to console for debugging
    new winston.transports.Console(),
  ],
});

// Apply CORS middleware to allow requests from specified origin
router.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:8080', // Use env variable or default to localhost
    credentials: true, // Allow cookies/credentials in requests
  })
);

// Configure rate limiting for the /add-user endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100, // Allow 100 requests per window
  message: 'Too many requests, please try again later.', // Error message for exceeding limit
});
router.use('/add-user', limiter);

// Middleware to check if the user is an admin (placeholder for session-based auth)
const isAdmin = (req, res, next) => {
  // Check if user is logged in and has 'admin' role
  if (req.session?.user?.role === 'admin') {
    return next(); // Proceed to next middleware/route handler
  }
  // Log unauthorized access attempt
  logger.warn(`Unauthorized access attempt to /add-user: ${req.ip}`);
  // Return 403 Forbidden response
  res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// Database configuration for MySQL connection pool
const dbConfig = {
  host: 'localhost', // Database host
  user: 'root', // Database user
  password: process.env.DB_PASSWORD || 'password123', // Use env variable or default password
  database: 'pinterest_clone', // Database name
};

// Create a MySQL connection pool for efficient database queries
const pool = mysql.createPool(dbConfig);

// Validation rules for user registration data
const validateUser = [
  // Validate and sanitize username
  body('username')
    .trim() // Remove leading/trailing whitespace
    .isLength({ min: 3, max: 20 }) // Ensure username is 3-20 characters
    .withMessage('Username must be 3-20 characters.')
    .escape(), // Sanitize to prevent XSS
  // Validate and normalize email
  body('email')
    .isEmail() // Ensure valid email format
    .withMessage('Invalid email format.')
    .normalizeEmail() // Normalize email (e.g., lowercase)
    .isLength({ max: 150 }) // Limit email length
    .withMessage('Email must be 150 characters or less.'),
  // Validate password complexity
  body('password')
    .isLength({ min: 8, max: 160 }) // Ensure password is 8-160 characters
    .withMessage('Password must be 8-160 characters.')
    .matches(/[A-Z]/) // Require at least one uppercase letter
    .withMessage('Must contain uppercase.')
    .matches(/[a-z]/) // Require at least one lowercase letter
    .withMessage('Must contain lowercase.')
    .matches(/[0-9]/) // Require at least one number
    .withMessage('Must contain number.')
    .matches(/[!@#$%^&*]/) // Require at least one special character
    .withMessage('Must contain special character.'),
];

// POST endpoint for adding a new user
router.post('/add-user', validateUser, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation failure with error details
    logger.warn(`Validation failed: ${JSON.stringify(errors.array())}`);
    // Return 400 Bad Request with validation errors
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  // Extract username, password, and email from request body
  const { username, password, email } = req.body;

  try {
    // Check if username or email already exists in the database
    const [existing] = await pool.execute(
      'SELECT username FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    // If a duplicate is found, return 409 Conflict
    if (existing.length > 0) {
      logger.warn(`Duplicate: ${username}, ${email}`);
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    // Hash the password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );

    // Log successful user creation with user ID and client IP
    logger.info(`User created: ${username}, ID: ${result.insertId}, IP: ${req.ip}`);
    // Return 201 Created with user ID
    res.status(201).json({ message: 'User created successfully!', userId: result.insertId });
  } catch (error) {
    // Log database error with client IP
    logger.error(`DB error: ${error.message}, IP: ${req.ip}`);
    // Return 500 Internal Server Error
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Export the router for use in the main application
module.exports = router;
const express = require('express');
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql');
const passport = require('passport');
const createPassport = require('./passportStruct');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

require('dotenv').config();

const app = express();

// create a 'pool' (group) of connections to be used for connecting with our SQL server
const dbConnectionPool = mysql.createPool({
    host: 'localhost',
    database: 'pinterest_clone'
});

app.use(function (req, res, next) {
    req.pool = dbConnectionPool;
    next();
});

// Passport helper functions
const getUserEmail = (userEmail) => new Promise((resolve, reject) => {
    dbConnectionPool.query('SELECT * FROM users WHERE email = ?', [userEmail], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
    });
});

const getUserID = (userID) => new Promise((resolve, reject) => {
    dbConnectionPool.query('SELECT * FROM users WHERE user_id = ?', [userID], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
    });
});

createPassport(passport, getUserEmail, getUserID);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET, // stores in env file
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
}));

const csrfExcludeRoutes = ['/users/login', '/users/signup'];

function validateToken(req, res, next) {
    const safeRequests = ['GET', 'HEAD', 'OPTIONS'];
    // Skip safe methods and skip signup and login page
    if (
    safeRequests.includes(req.method)
    || csrfExcludeRoutes.includes(req.path)) return next();

    const sentToken = req.get('X-CSRF-TOKEN'); // reads token which should include request header
    const sessionToken = req.session.csrfToken; // reads token stored in user's session

    if (!sessionToken || sentToken !== sessionToken) { // if no token or doesn't match then block
        return res.status(403).send('Invalid CSRF Token');
    }

    return next();
}

app.use(validateToken);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;

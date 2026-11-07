require('dotenv').config();
const { sessionOptions, enforceSessionLifetime } = require('./middleware/sessionLifecycle');
const configuredSession = sessionOptions();

const express = require('express');
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql2');
const passport = require('passport');
const createPassport = require('./passportStruct');

const pinsRouter = require('./routes/pins');
const boardsRouter = require('./routes/boards');
const usersRouter = require('./routes/users');
const { uploadAccess } = require('./middleware/authorization');



const app = express();

// create a 'pool' (group) of connections to be used for connecting with our SQL server
const dbConnectionPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
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
// Include anonymous responses and errors, even those produced before the users router.
app.use('/users', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session(configuredSession));
// Expire authenticated sessions before CSRF validation and Passport deserialization.
app.use(enforceSessionLifetime);

function validateToken(req, res, next) {
    const safeRequests = ['GET', 'HEAD', 'OPTIONS'];
    if (safeRequests.includes(req.method)) return next();

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

app.use((req, res, next) => {
    let pathname;
    try {
        // Static serving decodes URLs; its access check must do the same.
        pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')).toLowerCase();
    } catch {
        return res.status(400).json({ error: 'Invalid path' });
    }
    if (pathname === '/uploads' || pathname.startsWith('/uploads/')) {
        res.set('X-Content-Type-Options', 'nosniff');
        return privateResponse(req, res, () => requireAuth(req, res, () => uploadAccess(req, res, next)));
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.use('/users', usersRouter);

function requireAuth(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }
    next();
}

function privateResponse(req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    next();
}

app.use('/pins', privateResponse, requireAuth, pinsRouter);
app.use('/boards', privateResponse, requireAuth, boardsRouter);

app.get('/', (req, res) => {
    res.redirect('/landingpage.html');
});

module.exports = app;

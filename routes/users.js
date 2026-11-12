const bcrypt = require('bcrypt');
const { passwordWork } = require('../middleware/passwordWork');
const express = require('express');
const router = express.Router();
const passport = require('passport');
const { completeLogin } = require('../middleware/sessionLifecycle');
const { validateLogin, validateRegistration } = require('../middleware/authInput');
const { requireAdmin, requireOwner, validId } = require('../middleware/authorization');
const siteManagement = require('../controllers/siteManagementController');
router.get('/admin/summary', requireAdmin, siteManagement.getSummary);
router.patch('/admin/accounts/:user_id', requireOwner, siteManagement.updateAccount);

// Explicit bootstrap: ordinary anonymous pages still create no stored session.
router.get('/csrf', require('../controllers/csrfController'));

// Reusable user creation function
async function createUser(req, res, { autoLogin = false }) {
  const userName = req.body.username;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const userRole = 'user';

  const hash = await passwordWork(() => bcrypt.hash(userPassword, 13));

  req.pool.getConnection((err, connection) => {
    if (err) {
      console.error('Connection error:', err);
      return res.sendStatus(500);
    }

    const query1 = "SELECT * FROM users WHERE username=? OR email=?";
    connection.query(query1, [userName, userEmail], (err, rows) => {
      if (err) {
        console.error('Query error:', err);
        connection.release();
        return res.sendStatus(500);
      }

      const userNameTaken = rows.some(user => user.username === userName);
      const emailTaken = rows.some(user => user.email === userEmail);

      if (userNameTaken || emailTaken) {
        connection.release();
        if (userNameTaken && emailTaken) {
          return res.status(401).send("Username and Email already exist");
        } else if (userNameTaken) {
          return res.status(409).send("Username already exists");
        } else {
          return res.status(409).send("Email already exists");
        }
      }

      const query2 = "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)";
      connection.query(query2, [userName, userEmail, hash, userRole], (err, result) => {
        connection.release();
        if (err) {
          console.error('Insert error:', err);
          return res.sendStatus(500);
        }

        if (autoLogin) {
  req.login({
    user_id: result.insertId,
    username: userName,
    email: userEmail,
    role: userRole
  }, (err) => {
    if (err) {
      console.error('Login error:', err);
      return res.sendStatus(500);
    }

    return completeLogin(req, res, {
      message: 'Account created successfully',
      redirect: '/home.html'
    });
  });
} else {
          return res.status(200).json({ message: "User created", user_id: result.insertId });
        }
      });
    });
  });
}

/* Register a new user into the database */
router.post('/signup', validateRegistration, async (req, res) => {
  await createUser(req, res, { autoLogin: true });
});

/* Login route */
router.post('/login', validateLogin, passport.authenticate('local'), (req, res) => {
  req.session.user = {
    username: req.user.username,
    email: req.user.email
  };

  const redirectPath = ['owner', 'admin'].includes(req.user.role) ? '/admin.html' : '/home.html';
  completeLogin(req, res, {
    message: "logged in",
    redirect: redirectPath
  });
});

/* Retrieve profile details */
router.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({
    user_id: req.user.user_id,
    csrfToken: req.session.csrfToken,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    team_title: req.user.team_title || null
  });
});

/* Retrieve all user_info details */
router.get('/user_info', requireAdmin, (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }

  req.pool.getConnection((err, connection) => {
    if (err) {
      console.error('Connection error:', err);
      return res.sendStatus(500);
    }

    const query = 'SELECT user_id, username, email, avatar_url, DATE(created_at) AS created_at, role, team_title FROM users';
    connection.query(query, (err, results) => {
      connection.release();
      if (err) {
        console.error('Query error:', err);
        return res.sendStatus(500);
      }

      res.json(results);
    });
  });
});

/* Add user from admin interface */
router.post('/admin_add_user', requireAdmin, validateRegistration, async (req, res) => {
  await createUser(req, res, { autoLogin: false });
});

/* Delete user by ID */
router.post('/admin_del_user', requireAdmin, (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }

  if (!validId(req.body?.user_id)) return res.status(400).send('Invalid user_id');
  const userID = Number(req.body.user_id);
  const currentUserID = Number(req.user.user_id);

  if (!req.user || !['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).send('Admins only');
  }

  if (!userID) {
    return res.status(400).send('Missing user_id');
  }

  if (userID === currentUserID) {
    return res.status(403).send('Invalid Option');
  }

  req.pool.getConnection((err, connection) => {
    if (err) {
      console.error('Connection error:', err);
      return res.sendStatus(500);
    }

    const removableRoles = req.user.role === 'owner' ? ['user', 'admin'] : ['user'];
    connection.query('DELETE FROM users WHERE user_id = ? AND role IN (?)', [userID, removableRoles], (err, results) => {
      connection.release();
      if (err) {
        console.error('Query error:', err);
        return res.sendStatus(500);
      }

      if (results.affectedRows === 0) {
        return res.status(404).send('User not found');
      }

      return res.status(200).send('Successfully deleted');
    });
  });
});

/* Verify home page access */
router.get('/home', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }
  res.sendStatus(200);
});

// GET is navigation only; POST is protected by the application's CSRF middleware.
router.get('/logout', (req, res) => res.redirect('/logout.html'));
router.post('/logout', require('../controllers/logoutController'));

/* GET users listing - default test */
router.get('/', (req, res) => {
  res.send('respond with a resource');
});

module.exports = router;
// This code defines the user routes for handling user registration, login, profile retrieval, and admin functionalities.

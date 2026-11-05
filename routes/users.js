const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');

// Reusable user creation function
async function createUser(req, res, { autoLogin = false }) {
  const userName = req.body.username;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const userRole = 'user';

  const hash = await bcrypt.hash(userPassword, 13);

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

    const csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.csrfToken = csrfToken;

    return res.status(200).json({
      message: 'Account created successfully',
      csrfToken: csrfToken,
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
router.post('/signup', async (req, res) => {
  await createUser(req, res, { autoLogin: true });
});

/* Login route */
router.post('/login', passport.authenticate('local'), (req, res) => {
  req.session.user = {
    username: req.user.username,
    email: req.user.email
  };

  const redirectPath = req.user.role === 'admin' ? '/admin.html' : '/home.html';
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;

  res.status(200).json({
    message: "logged in",
    csrfToken: csrfToken,
    redirect: redirectPath
  });
});

/* Retrieve profile details */
router.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }
  res.status(200).json({
    username: req.user.username,
    email: req.user.email,
    role: req.user.role
  });
});

/* Retrieve all user_info details */
router.get('/user_info', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }

  req.pool.getConnection((err, connection) => {
    if (err) {
      console.error('Connection error:', err);
      return res.sendStatus(500);
    }

    const query = 'SELECT user_id, username, email, avatar_url, DATE(created_at) AS created_at, role FROM users';
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
router.post('/admin_add_user', async (req, res) => {
  await createUser(req, res, { autoLogin: false });
});

/* Delete user by ID */
router.post('/admin_del_user', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not Logged In');
  }

  const userID = parseInt(req.body.user_id, 10);
  const currentUserID = Number(req.user.user_id);

  if (!req.user || req.user.role !== 'admin') {
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

    connection.query('DELETE FROM users WHERE user_id = ?', [userID], (err, results) => {
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

/* Logout route */
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Failed to logout");
    }

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.sendStatus(200);
    });
  });
});

/* GET users listing - default test */
router.get('/', (req, res) => {
  res.send('respond with a resource');
});

module.exports = router;
// This code defines the user routes for handling user registration, login, profile retrieval, and admin functionalities.
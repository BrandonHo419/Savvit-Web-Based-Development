const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// Sets up password startegies
function initialize(passport, getUserByEmail, getUserById) {
    const authenticateUser = async (email, password, done) => {
        try {
            const user = await getUserByEmail(email);
            if (!user) return done(null, false, { message: 'Incorrect Password or Email' });
            if (await bcrypt.compare(password, user.password_hash)) {
                return done(null, user);
            }
            return done(null, false, { message: 'Incorrect Password or Email' });
        } catch (err) {
            return done(err);
        }
    };

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));
    passport.serializeUser((user, done) => done(null, user.user_id));
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await getUserById(id);
            done(null, user || false);
        } catch (err) {
            done(err);
        }
    });
}

module.exports = initialize;

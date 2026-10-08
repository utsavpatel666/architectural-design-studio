const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/db");

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const name = profile.displayName;
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : "";
          const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : "";

          let userResult = await db.query(
            "SELECT * FROM users WHERE google_id = $1",
            [googleId]
          );
          let user = userResult.rows[0];

          if (!user) {
            userResult = await db.query(
              `INSERT INTO users (google_id, name, email, avatar_url)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [googleId, name, email, avatar]
            );
            user = userResult.rows[0];
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

passport.googleEnabled = googleEnabled;

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

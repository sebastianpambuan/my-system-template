const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

if (
    !process.env.APP_SESSION_SECRET ||
    process.env.APP_SESSION_SECRET === "replace_with_a_random_secret"
) {
    throw new Error("APP_SESSION_SECRET must be set in .env");
}

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "my_system_user",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "my_system_template",
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
});

const sessionMiddleware = session({
    name: "app.sid",
    secret: process.env.APP_SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
    },
});

module.exports = {
    sessionMiddleware,
    sessionStore,
};

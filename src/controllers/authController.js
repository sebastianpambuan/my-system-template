const authService = require("../services/authService");
const { generateCsrfToken } = require("../config/csrf");

const appName = () => process.env.APP_NAME || "My System Template";

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function showLogin(req, res) {
    if (req.session.userId) {
        return res.redirect("/dashboard");
    }

    const error = req.query.limited
        ? "Too many login attempts. Please wait before trying again."
        : null;

    res.render("login", {
        appName: appName(),
        csrfToken: generateCsrfToken(req, res),
        error,
        username: "",
    });
}

async function login(req, res) {
    const username =
        typeof req.body.username === "string" ? req.body.username.trim() : "";

    const password =
        typeof req.body.password === "string" ? req.body.password : "";

    if (
        !username ||
        !password ||
        username.length > 100 ||
        password.length > 1024
    ) {
        return res.status(401).render("login", {
            appName: appName(),
            csrfToken: generateCsrfToken(req, res),
            error: "Invalid username or password.",
            username: username.slice(0, 100),
        });
    }

    const user = await authService.authenticate(username, password);

    if (!user) {
        return res.status(401).render("login", {
            appName: appName(),
            csrfToken: generateCsrfToken(req, res),
            error: "Invalid username or password.",
            username,
        });
    }

    await regenerateSession(req);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.firstName = user.firstName;
    req.session.lastName = user.lastName;
    req.session.mustChangePassword = user.mustChangePassword;

    await saveSession(req);

    res.redirect("/dashboard");
}

function logout(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        };

        res.clearCookie("app.sid", cookieOptions);
        res.clearCookie("app.csrf-token", cookieOptions);

        res.redirect("/login");
    });
}

module.exports = {
    showLogin,
    login,
    logout,
};

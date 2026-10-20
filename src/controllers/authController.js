const authService = require("../services/authService");
const { generateCsrfToken } = require("../config/csrf");

const appName = () => process.env.APP_NAME || "My System Template";

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function renderLogin(req, res, statusCode, error, username = "") {
    return res.status(statusCode).render("login", {
        appName: appName(),
        csrfToken: generateCsrfToken(req, res),
        error,
        username,
    });
}

async function showLogin(req, res) {
    if (req.session.userId) {
        return res.redirect("/dashboard");
    }

    if (!req.session.loginCsrfInitialized) {
        req.session.loginCsrfInitialized = true;
    }

    const error = req.query.limited
        ? "Too many login attempts. Please wait before trying again."
        : null;

    return res.render("login", {
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
        Buffer.byteLength(password, "utf8") > 1024
    ) {
        return renderLogin(
            req,
            res,
            401,
            "Invalid username or password.",
            username.slice(0, 100),
        );
    }

    const user = await authService.authenticate(username, password);

    if (!user) {
        return renderLogin(
            req,
            res,
            401,
            "Invalid username or password.",
            username,
        );
    }

    await regenerateSession(req);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.firstName = user.firstName;
    req.session.lastName = user.lastName;
    req.session.mustChangePassword = user.mustChangePassword;

    await saveSession(req);

    return res.redirect(
        user.mustChangePassword ? "/change-password" : "/dashboard",
    );
}

function showChangePassword(req, res) {
    return res.render("change-password", {
        appName: appName(),
        csrfToken: generateCsrfToken(req, res),
        error: null,
    });
}

async function updatePassword(req, res) {
    const currentPassword =
        typeof req.body.currentPassword === "string"
            ? req.body.currentPassword
            : "";

    const newPassword =
        typeof req.body.newPassword === "string" ? req.body.newPassword : "";

    const confirmPassword =
        typeof req.body.confirmPassword === "string"
            ? req.body.confirmPassword
            : "";

    let error = null;

    if (!currentPassword || Buffer.byteLength(currentPassword, "utf8") > 1024) {
        error = "Enter your current password.";
    } else if (
        newPassword.length < 12 ||
        Buffer.byteLength(newPassword, "utf8") > 1024
    ) {
        error =
            "Your new password must be at least 12 characters and no more than 1024 bytes.";
    } else if (newPassword !== confirmPassword) {
        error = "The new passwords do not match.";
    }

    if (error) {
        return res.status(400).render("change-password", {
            appName: appName(),
            csrfToken: generateCsrfToken(req, res),
            error,
        });
    }

    const result = await authService.changePassword(
        req.session.userId,
        currentPassword,
        newPassword,
    );

    if (!result.success) {
        return res.status(400).render("change-password", {
            appName: appName(),
            csrfToken: generateCsrfToken(req, res),
            error: result.message,
        });
    }

    req.session.mustChangePassword = false;
    await saveSession(req);

    return res.redirect("/dashboard");
}

function logout(req, res, next) {
    req.session.destroy((error) => {
        if (error) return next(error);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        };

        res.clearCookie("app.sid", cookieOptions);
        res.clearCookie("app.csrf-token", cookieOptions);

        return res.redirect("/login");
    });
}

module.exports = {
    showLogin,
    login,
    showChangePassword,
    updatePassword,
    logout,
};

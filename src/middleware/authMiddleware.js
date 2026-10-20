const userRepository = require("../repositories/userRepository");

function destroySession(req) {
    return new Promise((resolve) => {
        if (!req.session) {
            return resolve();
        }

        req.session.destroy(() => resolve());
    });
}

async function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        return res.redirect("/login");
    }

    try {
        const user = await userRepository.findAccessContext(req.session.userId);

        if (!user || user.status !== "active") {
            await destroySession(req);

            res.clearCookie("app.sid", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });

            return res.redirect("/login");
        }

        req.currentUser = user;
        req.permissions = new Set(user.permissions);

        // Accounts requiring a password change can only access
        // the password-change and logout endpoints.
        if (
            user.mustChangePassword &&
            req.path !== "/change-password" &&
            req.path !== "/logout"
        ) {
            return res.redirect("/change-password");
        }

        next();
    } catch (error) {
        next(error);
    }
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.currentUser) {
            return res.redirect("/login");
        }

        if (!req.permissions?.has(permission)) {
            return res.status(403).render("error", {
                appName: process.env.APP_NAME || "My System Template",
                statusCode: 403,
                message: "You do not have permission to access this resource.",
            });
        }

        next();
    };
}

module.exports = {
    requireAuth,
    requirePermission,
};

const { doubleCsrf } = require("csrf-csrf");

if (
    !process.env.APP_CSRF_SECRET ||
    process.env.APP_CSRF_SECRET === "replace_with_a_different_random_secret"
) {
    throw new Error("APP_CSRF_SECRET must be set in .env");
}

const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } =
    doubleCsrf({
        getSecret: () => process.env.APP_CSRF_SECRET,

        getSessionIdentifier: (req) => {
            if (!req.sessionID) {
                throw new Error("A session is required for CSRF protection.");
            }

            return req.sessionID;
        },

        cookieName: "app.csrf-token",

        cookieOptions: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        },

        getCsrfTokenFromRequest: (req) =>
            typeof req.body?._csrf === "string" ? req.body._csrf : "",
    });

module.exports = {
    generateCsrfToken,
    doubleCsrfProtection,
    invalidCsrfTokenError,
};

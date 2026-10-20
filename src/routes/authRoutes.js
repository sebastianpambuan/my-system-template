const express = require("express");
const { rateLimit } = require("express-rate-limit");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { doubleCsrfProtection } = require("../config/csrf");

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.redirect(303, "/login?limited=1");
    },
});

router.get("/login", authController.showLogin);

router.post("/login", loginLimiter, doubleCsrfProtection, authController.login);

router.get("/change-password", requireAuth, authController.showChangePassword);

router.post(
    "/change-password",
    requireAuth,
    doubleCsrfProtection,
    authController.updatePassword,
);

router.post(
    "/logout",
    requireAuth,
    doubleCsrfProtection,
    authController.logout,
);

module.exports = router;

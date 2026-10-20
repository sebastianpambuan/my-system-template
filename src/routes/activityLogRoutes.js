const express = require("express");

const activityLogController = require("../controllers/activityLogController");
const {
    requireAuth,
    requirePermission,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requirePermission("activity_logs.view"));

router.get("/", activityLogController.index);

module.exports = router;

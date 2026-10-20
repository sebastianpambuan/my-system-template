const express = require("express");

const roleController = require("../controllers/roleController");
const {
    requireAuth,
    requirePermission,
} = require("../middleware/authMiddleware");
const { doubleCsrfProtection } = require("../config/csrf");

const router = express.Router();

router.use(requireAuth, requirePermission("roles.manage"));

router.get("/", roleController.index);

router.post("/:id/permissions", doubleCsrfProtection, roleController.update);

module.exports = router;

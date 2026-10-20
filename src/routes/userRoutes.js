const express = require("express");

const userController = require("../controllers/userController");
const {
    requireAuth,
    requirePermission,
} = require("../middleware/authMiddleware");
const { doubleCsrfProtection } = require("../config/csrf");

const router = express.Router();

router.use(requireAuth);

router.get("/", requirePermission("users.view"), userController.index);

router.get(
    "/new",
    requirePermission("users.create"),
    userController.showCreate,
);

router.post(
    "/",
    requirePermission("users.create"),
    doubleCsrfProtection,
    userController.create,
);

router.get(
    "/:id/edit",
    requirePermission("users.edit"),
    userController.showEdit,
);

router.post(
    "/:id/edit",
    requirePermission("users.edit"),
    doubleCsrfProtection,
    userController.update,
);

router.post(
    "/:id/status",
    requirePermission("users.deactivate"),
    doubleCsrfProtection,
    userController.changeStatus,
);

module.exports = router;

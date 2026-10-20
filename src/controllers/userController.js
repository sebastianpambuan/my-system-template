const argon2 = require("argon2");
const crypto = require("node:crypto");

const users = require("../repositories/userManagementRepository");
const activityLog = require("../repositories/activityLogRepository");

const appName = () => process.env.APP_NAME || "My System Template";

function validId(value) {
    return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function renderError(res, statusCode, message) {
    return res.status(statusCode).render("error", {
        appName: appName(),
        statusCode,
        message,
    });
}

async function logAction(req, action, entityId, details) {
    try {
        await activityLog.record({
            userId: req.currentUser.id,
            action,
            entityType: "user",
            entityId,
            details,
            ipAddress: req.ip,
        });
    } catch (error) {
        // Do not log passwords, tokens, or other credentials.
        console.error(
            "Activity log write failed:",
            error.code || error.name || "UnknownError",
        );
    }
}

async function index(req, res) {
    const userList = await users.listUsers();

    res.render("users/index", {
        appName: appName(),
        currentUser: req.currentUser,
        users: userList,
        csrfToken: res.locals.csrfToken,
    });
}

async function showCreate(req, res) {
    res.render("users/form", {
        appName: appName(),
        mode: "create",
        user: null,
        roles: await users.listRoles(),
        csrfToken: res.locals.csrfToken,
        error: null,
    });
}

async function create(req, res) {
    const username = String(req.body.username || "").trim();
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const roleId = Number(req.body.roleId);

    const roles = await users.listRoles();

    if (
        !/^[a-zA-Z0-9_.-]{3,50}$/.test(username) ||
        !firstName ||
        !lastName ||
        firstName.length > 100 ||
        lastName.length > 100 ||
        !Number.isSafeInteger(roleId) ||
        !roles.some((role) => role.id === roleId)
    ) {
        return res.status(400).render("users/form", {
            appName: appName(),
            mode: "create",
            user: { username, first_name: firstName, last_name: lastName },
            roles,
            csrfToken: res.locals.csrfToken,
            error: "Check the username, names, and selected role.",
        });
    }

    if (await users.usernameExists(username)) {
        return res.status(409).render("users/form", {
            appName: appName(),
            mode: "create",
            user: { username, first_name: firstName, last_name: lastName },
            roles,
            csrfToken: res.locals.csrfToken,
            error: "That username is already in use.",
        });
    }

    const temporaryPassword = crypto.randomBytes(18).toString("base64url");
    const passwordHash = await argon2.hash(temporaryPassword, {
        type: argon2.argon2id,
    });

    const userId = await users.createUser({
        username,
        passwordHash,
        firstName,
        lastName,
        roleId,
    });

    await logAction(
        req,
        "user.created",
        userId,
        `Created account "${username}" with role "${roles.find((role) => role.id === roleId).name}".`,
    );

    // The temporary password is displayed only in this response.
    res.render("users/created", {
        appName: appName(),
        username,
        temporaryPassword,
        csrfToken: res.locals.csrfToken,
    });
}

async function showEdit(req, res) {
    if (!validId(req.params.id)) {
        return renderError(res, 400, "Invalid user ID.");
    }

    const user = await users.findUserById(Number(req.params.id));

    if (!user) {
        return renderError(res, 404, "User not found.");
    }

    res.render("users/form", {
        appName: appName(),
        mode: "edit",
        user,
        roles: await users.listRoles(),
        csrfToken: res.locals.csrfToken,
        error: null,
    });
}

async function update(req, res) {
    const id = Number(req.params.id);

    if (!validId(id)) {
        return renderError(res, 400, "Invalid user ID.");
    }

    const existing = await users.findUserById(id);

    if (!existing) {
        return renderError(res, 404, "User not found.");
    }

    // Prevent administrators from changing their own role here.
    if (id === Number(req.currentUser.id)) {
        return renderError(
            res,
            400,
            "You cannot change your own role through user management.",
        );
    }

    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const roleId = Number(req.body.roleId);
    const roles = await users.listRoles();

    if (
        !firstName ||
        !lastName ||
        firstName.length > 100 ||
        lastName.length > 100 ||
        !Number.isSafeInteger(roleId) ||
        !roles.some((role) => role.id === roleId)
    ) {
        return res.status(400).render("users/form", {
            appName: appName(),
            mode: "edit",
            user: { ...existing, first_name: firstName, last_name: lastName },
            roles,
            csrfToken: res.locals.csrfToken,
            error: "Check the names and selected role.",
        });
    }

    const currentRole = roles.find((role) => role.id === existing.roleId);

    if (
        currentRole?.name === "administrator" &&
        roles.find((role) => role.id === roleId)?.name !== "administrator"
    ) {
        const result = await users.updateUser({
            id,
            firstName,
            lastName,
            roleId,
        });

        if (!result) {
            return renderError(res, 409, "The account could not be updated.");
        }
    } else {
        await users.updateUser({ id, firstName, lastName, roleId });
    }

    await logAction(
        req,
        "user.updated",
        id,
        `Updated account "${existing.username}" and its role assignment.`,
    );

    res.redirect("/users");
}

async function changeStatus(req, res) {
    const id = Number(req.params.id);
    const status = req.body.status;

    if (!validId(id) || !["active", "inactive"].includes(status)) {
        return renderError(res, 400, "Invalid account status request.");
    }

    if (id === Number(req.currentUser.id) && status === "inactive") {
        return renderError(res, 400, "You cannot deactivate your own account.");
    }

    const existing = await users.findUserById(id);

    if (!existing) {
        return renderError(res, 404, "User not found.");
    }

    const result = await users.setUserStatus(id, status);

    if (!result.success && result.reason === "last_admin") {
        return renderError(
            res,
            409,
            "You cannot deactivate the last active administrator.",
        );
    }

    if (!result.success) {
        return renderError(res, 404, "User not found.");
    }

    if (!result.unchanged) {
        await logAction(
            req,
            status === "active" ? "user.activated" : "user.deactivated",
            id,
            `Changed account "${existing.username}" status to "${status}".`,
        );
    }

    res.redirect("/users");
}

module.exports = {
    index,
    showCreate,
    create,
    showEdit,
    update,
    changeStatus,
};

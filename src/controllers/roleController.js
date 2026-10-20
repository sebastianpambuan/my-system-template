const roleRepository = require("../repositories/roleRepository");
const activityLog = require("../repositories/activityLogRepository");

const appName = () => process.env.APP_NAME || "My System Template";

async function index(req, res) {
    const roles = await roleRepository.listRolesWithPermissions();

    res.render("roles/index", {
        appName: appName(),
        roles,
        csrfToken: res.locals.csrfToken,
        success: req.query.saved === "1",
    });
}

async function update(req, res) {
    const roleId = Number(req.params.id);

    if (!Number.isSafeInteger(roleId) || roleId < 1) {
        return res.status(400).render("error", {
            appName: appName(),
            statusCode: 400,
            message: "Invalid role ID.",
        });
    }

    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
        return res.status(404).render("error", {
            appName: appName(),
            statusCode: 404,
            message: "Role not found.",
        });
    }

    if (role.name === "administrator") {
        return res.status(403).render("error", {
            appName: appName(),
            statusCode: 403,
            message: "Administrator permissions cannot be changed here.",
        });
    }

    const rawIds =
        req.body.permissionIds === undefined
            ? []
            : Array.isArray(req.body.permissionIds)
              ? req.body.permissionIds
              : [req.body.permissionIds];

    const permissionIds = rawIds.map(Number);

    if (
        permissionIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
        new Set(permissionIds).size !== permissionIds.length
    ) {
        return res.status(400).render("error", {
            appName: appName(),
            statusCode: 400,
            message: "Invalid permission selection.",
        });
    }

    const updated = await roleRepository.updateRolePermissions(
        roleId,
        permissionIds,
    );

    if (!updated) {
        return res.status(400).render("error", {
            appName: appName(),
            statusCode: 400,
            message: "The role permissions could not be updated.",
        });
    }

    await activityLog.record({
        userId: req.currentUser.id,
        action: "role.permissions_updated",
        entityType: "role",
        entityId: roleId,
        details: `Updated permissions for role "${role.name}".`,
        ipAddress: req.ip,
    });

    return res.redirect("/roles?saved=1");
}

module.exports = {
    index,
    update,
};

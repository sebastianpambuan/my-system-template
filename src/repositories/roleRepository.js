const pool = require("../config/database");

async function listRolesWithPermissions() {
    const [roles] = await pool.execute(
        "SELECT id, name, description FROM roles ORDER BY name",
    );

    const [permissions] = await pool.execute(
        "SELECT id, name, description FROM permissions ORDER BY name",
    );

    const [assignments] = await pool.execute(
        "SELECT role_id, permission_id FROM role_permissions",
    );

    return roles
        .map((role) => ({
            ...role,
            permissionIds: assignments
                .filter((item) => item.role_id === role.id)
                .map((item) => item.permission_id),
        }))
        .map((role) => ({
            ...role,
            permissionIds: role.permissionIds.map(Number),
        }))
        .reduce((result, role) => {
            result.push(role);
            return result;
        }, [])
        .map((role) => ({
            ...role,
            permissions,
        }));
}

async function updateRolePermissions(roleId, permissionIds) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [roles] = await connection.execute(
            "SELECT id, name FROM roles WHERE id = ? FOR UPDATE",
            [roleId],
        );

        if (!roles[0]) {
            await connection.rollback();
            return false;
        }

        // Keep the administrator role capable of accessing all modules.
        if (roles[0].name === "administrator") {
            await connection.rollback();
            return false;
        }

        const [validPermissions] = await connection.execute(
            "SELECT id FROM permissions",
        );

        const allowedIds = new Set(
            validPermissions.map((item) => Number(item.id)),
        );

        if (permissionIds.some((id) => !allowedIds.has(id))) {
            await connection.rollback();
            return false;
        }

        await connection.execute(
            "DELETE FROM role_permissions WHERE role_id = ?",
            [roleId],
        );

        for (const permissionId of permissionIds) {
            await connection.execute(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                [roleId, permissionId],
            );
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getRoleById(roleId) {
    const [rows] = await pool.execute(
        "SELECT id, name, description FROM roles WHERE id = ? LIMIT 1",
        [roleId],
    );

    return rows[0] || null;
}

module.exports = {
    listRolesWithPermissions,
    updateRolePermissions,
    getRoleById,
};

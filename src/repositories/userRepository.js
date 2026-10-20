const pool = require("../config/database");

async function findByUsername(username) {
    const [rows] = await pool.execute(
        `SELECT
            id,
            username,
            password_hash,
            first_name,
            last_name,
            status,
            must_change_password
         FROM users
         WHERE username = ?
         LIMIT 1`,
        [username],
    );

    return rows[0] || null;
}

async function findAccessContext(userId) {
    const [rows] = await pool.execute(
        `SELECT
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.status,
            u.must_change_password,
            p.name AS permission_name
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
         LEFT JOIN permissions p ON p.id = rp.permission_id
         WHERE u.id = ?`,
        [userId],
    );

    if (rows.length === 0) {
        return null;
    }

    const user = {
        id: rows[0].id,
        username: rows[0].username,
        firstName: rows[0].first_name,
        lastName: rows[0].last_name,
        status: rows[0].status,
        mustChangePassword: Boolean(rows[0].must_change_password),
        permissions: [],
    };

    for (const row of rows) {
        if (
            row.permission_name &&
            !user.permissions.includes(row.permission_name)
        ) {
            user.permissions.push(row.permission_name);
        }
    }

    return user;
}

async function findPasswordHashById(userId) {
    const [rows] = await pool.execute(
        `SELECT password_hash
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
    );

    return rows[0]?.password_hash || null;
}

async function updatePassword(userId, passwordHash) {
    const [result] = await pool.execute(
        `UPDATE users
         SET password_hash = ?,
             must_change_password = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'active'`,
        [passwordHash, userId],
    );

    return result.affectedRows === 1;
}

module.exports = {
    findByUsername,
    findAccessContext,
    findPasswordHashById,
    updatePassword,
};

const pool = require("../config/database");

async function listUsers() {
    const [rows] = await pool.execute(
        `SELECT
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.status,
            u.must_change_password,
            u.created_at,
            GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY
            u.id, u.username, u.first_name, u.last_name,
            u.status, u.must_change_password, u.created_at
         ORDER BY u.id DESC`,
    );

    return rows;
}

async function findUserById(id) {
    const [rows] = await pool.execute(
        `SELECT
            id, username, first_name, last_name, status
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [id],
    );

    if (!rows[0]) {
        return null;
    }

    const [roles] = await pool.execute(
        "SELECT role_id FROM user_roles WHERE user_id = ?",
        [id],
    );

    return {
        ...rows[0],
        roleId: roles[0]?.role_id || null,
    };
}

async function listRoles() {
    const [rows] = await pool.execute(
        "SELECT id, name, description FROM roles ORDER BY name",
    );

    return rows;
}

async function usernameExists(username, exceptId = null) {
    const sql = exceptId
        ? "SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1"
        : "SELECT id FROM users WHERE username = ? LIMIT 1";

    const params = exceptId ? [username, exceptId] : [username];
    const [rows] = await pool.execute(sql, params);

    return rows.length > 0;
}

async function createUser({
    username,
    passwordHash,
    firstName,
    lastName,
    roleId,
}) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO users
                (username, password_hash, first_name, last_name,
                 status, must_change_password)
             VALUES (?, ?, ?, ?, 'active', 1)`,
            [username, passwordHash, firstName, lastName],
        );

        await connection.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
            [result.insertId, roleId],
        );

        await connection.commit();

        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function updateUser({ id, firstName, lastName, roleId }) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [targetUsers] = await connection.execute(
            `SELECT id, status
             FROM users
             WHERE id = ?
             FOR UPDATE`,
            [id],
        );

        if (!targetUsers[0]) {
            await connection.rollback();
            return false;
        }

        const [currentAdminRole] = await connection.execute(
            `SELECT COUNT(*) AS total
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = ?
               AND r.name = 'administrator'`,
            [id],
        );

        const [newRole] = await connection.execute(
            "SELECT name FROM roles WHERE id = ? LIMIT 1",
            [roleId],
        );

        if (!newRole[0]) {
            await connection.rollback();
            return false;
        }

        if (
            targetUsers[0].status === "active" &&
            Number(currentAdminRole[0].total) > 0 &&
            newRole[0].name !== "administrator"
        ) {
            const [activeAdmins] = await connection.execute(
                `SELECT COUNT(DISTINCT u.id) AS total
                 FROM users u
                 JOIN user_roles ur ON ur.user_id = u.id
                 JOIN roles r ON r.id = ur.role_id
                 WHERE u.status = 'active'
                   AND r.name = 'administrator'`,
            );

            if (Number(activeAdmins[0].total) <= 1) {
                await connection.rollback();
                return false;
            }
        }

        await connection.execute(
            `UPDATE users
             SET first_name = ?,
                 last_name = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [firstName, lastName, id],
        );

        await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [
            id,
        ]);

        await connection.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
            [id, roleId],
        );

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function setUserStatus(id, status) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [users] = await connection.execute(
            `SELECT id, status
             FROM users
             WHERE id = ?
             FOR UPDATE`,
            [id],
        );

        if (!users[0]) {
            await connection.rollback();
            return { success: false, reason: "not_found" };
        }

        if (users[0].status === status) {
            await connection.commit();
            return { success: true, unchanged: true };
        }

        if (status === "inactive") {
            const [admins] = await connection.execute(
                `SELECT COUNT(DISTINCT u.id) AS total
                 FROM users u
                 JOIN user_roles ur ON ur.user_id = u.id
                 JOIN roles r ON r.id = ur.role_id
                 WHERE u.status = 'active'
                   AND r.name = 'administrator'`,
            );

            const [targetAdmin] = await connection.execute(
                `SELECT COUNT(*) AS total
                 FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = ?
                   AND r.name = 'administrator'`,
                [id],
            );

            if (
                Number(targetAdmin[0].total) > 0 &&
                Number(admins[0].total) <= 1
            ) {
                await connection.rollback();
                return { success: false, reason: "last_admin" };
            }
        }

        await connection.execute(
            `UPDATE users
             SET status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, id],
        );

        await connection.commit();

        return { success: true };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    listUsers,
    findUserById,
    listRoles,
    usernameExists,
    createUser,
    updateUser,
    setUserStatus,
};

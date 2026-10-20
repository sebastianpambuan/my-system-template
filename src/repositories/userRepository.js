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

module.exports = {
    findByUsername,
};

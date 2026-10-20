const pool = require("../config/database");

async function record({
    userId = null,
    action,
    entityType,
    entityId = null,
    details = null,
    ipAddress = null,
}) {
    await pool.execute(
        `INSERT INTO activity_logs
            (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId, details, ipAddress],
    );
}

async function listRecent(limit = 200) {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);

    const [rows] = await pool.execute(
        `SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.details,
            al.ip_address,
            al.created_at,
            u.username AS actor_username
         FROM activity_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC, al.id DESC
         LIMIT ?`,
        [safeLimit],
    );

    return rows;
}

module.exports = {
    record,
    listRecent,
};

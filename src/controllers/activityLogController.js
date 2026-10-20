const activityLog = require("../repositories/activityLogRepository");

async function index(req, res) {
    const logs = await activityLog.listRecent(200);

    res.render("activity-logs/index", {
        appName: process.env.APP_NAME || "My System Template",
        logs,
    });
}

module.exports = {
    index,
};

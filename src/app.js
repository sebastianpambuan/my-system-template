const express = require("express");
const path = require("node:path");

const app = express();

// Configure EJS as the view engine.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve CSS, JavaScript, and images from the public folder.
app.use(express.static(path.join(__dirname, "../public")));

// Parse form submissions.
app.use(express.urlencoded({ extended: false }));

// Temporary home page to verify the application.
app.get("/", (req, res) => {
    res.render("index", {
        appName: process.env.APP_NAME || "My System Template",
    });
});

module.exports = app;

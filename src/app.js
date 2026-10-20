const express = require("express");
const path = require("node:path");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const { sessionMiddleware } = require("./config/session");
const { generateCsrfToken } = require("./config/csrf");
const { requireAuth } = require("./middleware/authMiddleware");

const app = express();
const appName = () => process.env.APP_NAME || "My System Template";

app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet());

app.use(express.static(path.join(__dirname, "../public")));

app.use(
    express.urlencoded({
        extended: false,
        limit: "10kb",
    }),
);

app.use(sessionMiddleware);
app.use(cookieParser());

app.get("/", (req, res) => {
    res.render("index", { appName: appName() });
});

app.use("/", require("./routes/authRoutes"));

app.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", {
        appName: appName(),
        username: req.session.username,
        firstName: req.session.firstName,
        lastName: req.session.lastName,
        csrfToken: generateCsrfToken(req, res),
    });
});

app.use((req, res) => {
    res.status(404).render("error", {
        appName: appName(),
        statusCode: 404,
        message: "The page you requested could not be found.",
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.code === "EBADCSRFTOKEN") {
        return res.status(403).render("error", {
            appName: appName(),
            statusCode: 403,
            message:
                "Your request could not be verified. Refresh the page and try again.",
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).render("error", {
            appName: appName(),
            statusCode: 413,
            message: "The submitted form is too large.",
        });
    }

    // Avoid sending internal error details to the browser.
    console.error(
        "Request failed:",
        error.code || error.name || "UnknownError",
    );

    res.status(500).render("error", {
        appName: appName(),
        statusCode: 500,
        message: "Something went wrong. Please try again later.",
    });
});

module.exports = app;

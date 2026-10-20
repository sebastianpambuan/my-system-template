require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
    console.log(
        `${process.env.APP_NAME || "My System Template"} is running at http://localhost:${PORT}`,
    );
});

require("dotenv").config();

const argon2 = require("argon2");
const crypto = require("node:crypto");
const readline = require("node:readline/promises");
const pool = require("../src/config/database");

const stdin = process.stdin;
const stdout = process.stdout;

function ask(rl, question) {
    return rl.question(question);
}

function askHidden(question) {
    return new Promise((resolve, reject) => {
        if (!stdin.isTTY || !stdout.isTTY) {
            reject(
                new Error(
                    "Run this script directly in an interactive terminal.",
                ),
            );
            return;
        }

        stdout.write(question);
        stdin.setRawMode(true);
        stdin.resume();

        let value = "";

        function onData(buffer) {
            for (const char of buffer.toString("utf8")) {
                if (char === "\u0003") {
                    cleanup();
                    reject(new Error("Operation cancelled."));
                    return;
                }

                if (char === "\r" || char === "\n") {
                    cleanup();
                    stdout.write("\n");
                    resolve(value);
                    return;
                }

                if (char === "\u007f" || char === "\b") {
                    value = value.slice(0, -1);
                    continue;
                }

                if (char >= " " && char !== "\u007f") {
                    value += char;
                }
            }
        }

        function cleanup() {
            stdin.removeListener("data", onData);
            stdin.setRawMode(false);
            stdin.pause();
        }

        stdin.on("data", onData);
    });
}

async function main() {
    const connection = await pool.getConnection();
    const rl = readline.createInterface({ input: stdin, output: stdout });

    try {
        const [adminRole] = await connection.execute(
            "SELECT id FROM roles WHERE name = ? LIMIT 1",
            ["administrator"],
        );

        if (adminRole.length === 0) {
            throw new Error(
                "Administrator role not found. Run database/seed.sql first.",
            );
        }

        const [existingAdmins] = await connection.execute(
            `SELECT COUNT(*) AS total
             FROM user_roles ur
             INNER JOIN roles r ON r.id = ur.role_id
             WHERE r.name = ?`,
            ["administrator"],
        );

        if (Number(existingAdmins[0].total) > 0) {
            throw new Error(
                "An administrator already exists. Use the user-management module to create additional accounts.",
            );
        }

        const username = (await ask(rl, "Administrator username: ")).trim();
        const firstName = (await ask(rl, "First name: ")).trim();
        const lastName = (await ask(rl, "Last name: ")).trim();
        rl.close();

        if (
            !/^[a-zA-Z0-9_.-]{3,50}$/.test(username) ||
            !firstName ||
            !lastName ||
            firstName.length > 100 ||
            lastName.length > 100
        ) {
            throw new Error(
                "Invalid username or name. Check the length and allowed characters.",
            );
        }

        const password = await askHidden("Password (minimum 12 characters): ");

        if (
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 1024
        ) {
            throw new Error(
                "Password must be at least 12 characters and no more than 1024 bytes.",
            );
        }

        const confirmation = await askHidden("Confirm password: ");

        if (
            !crypto.timingSafeEqual(
                Buffer.from(password),
                Buffer.from(confirmation),
            )
        ) {
            throw new Error("Passwords do not match.");
        }

        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
        });

        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO users
                (username, password_hash, first_name, last_name, status, must_change_password)
             VALUES (?, ?, ?, ?, 'active', 0)`,
            [username, passwordHash, firstName, lastName],
        );

        await connection.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
            [result.insertId, adminRole[0].id],
        );

        await connection.commit();

        console.log(
            `Administrator account "${username}" created successfully.`,
        );
    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => {});
        }

        throw error;
    } finally {
        rl.close();
        connection.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error("Administrator setup failed:", error.message);
    process.exitCode = 1;
});

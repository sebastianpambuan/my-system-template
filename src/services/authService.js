const argon2 = require("argon2");
const crypto = require("node:crypto");
const userRepository = require("../repositories/userRepository");

// Used for password verification when a username does not exist.
// This helps reduce timing differences between failed login cases.
const dummyPasswordHash = argon2.hash(crypto.randomBytes(32).toString("hex"), {
    type: argon2.argon2id,
});

async function authenticate(username, password) {
    const user = await userRepository.findByUsername(username);

    const passwordHash = user ? user.password_hash : await dummyPasswordHash;

    let passwordMatches = false;

    try {
        passwordMatches = await argon2.verify(passwordHash, password);
    } catch {
        passwordMatches = false;
    }

    if (!user || !passwordMatches || user.status !== "active") {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        mustChangePassword: Boolean(user.must_change_password),
    };
}

module.exports = {
    authenticate,
};

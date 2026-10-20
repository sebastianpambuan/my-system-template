const argon2 = require("argon2");
const crypto = require("node:crypto");
const userRepository = require("../repositories/userRepository");

// A dummy hash helps reduce timing differences when the username
// does not exist. It is generated once when the service loads.
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

async function changePassword(userId, currentPassword, newPassword) {
    const passwordHash = await userRepository.findPasswordHashById(userId);

    if (!passwordHash) {
        return { success: false, message: "Unable to update this account." };
    }

    const matches = await argon2.verify(passwordHash, currentPassword);

    if (!matches) {
        return { success: false, message: "Current password is incorrect." };
    }

    if (currentPassword === newPassword) {
        return {
            success: false,
            message:
                "Your new password must be different from your current password.",
        };
    }

    const newHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
    });

    const updated = await userRepository.updatePassword(userId, newHash);

    if (!updated) {
        return {
            success: false,
            message: "Unable to update this account. Please try again.",
        };
    }

    return { success: true };
}

module.exports = {
    authenticate,
    changePassword,
};

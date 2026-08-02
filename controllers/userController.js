const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const emailService = require("../services/emailService");
const { uploadImageToCloudinary } = require("../cloudinaryConfig");

// How long a password-reset link stays valid for.
const RESET_TOKEN_EXPIRY_MINUTES = 60;

function hashResetToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// PUT /account/picture  (any logged-in role)
async function uploadProfilePicture(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file was uploaded." });
        }

        const uploadResult = await uploadImageToCloudinary(req.file.buffer, req.file.mimetype, "hcms/profile-pictures");
        const updated = await userModel.updateProfilePicture(req.user.userID, uploadResult.secure_url);

        res.status(200).json({
            message: "Profile picture updated successfully.",
            profilePictureURL: updated.profilePictureURL,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error uploading profile picture." });
    }
}

// PUT /account/email  (any logged-in role)
// Confirms the current password, rejects an unchanged or already-taken email,
// then updates the shared Users.email column.
async function changeEmail(req, res) {
    try {
        const userID = req.user.userID;
        const { newEmail, currentPassword } = req.body;

        const user = await userModel.getUserByUserID(userID);
        if (!user) {
            return res.status(404).json({ error: "Account not found." });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({ error: "Current password is incorrect." });
        }

        if (newEmail === user.email) {
            return res.status(400).json({ error: "New email is the same as your current email." });
        }

        const existing = await userModel.getUserByEmailGlobal(newEmail);
        if (existing) {
            return res.status(409).json({ error: "Email is already in use." });
        }

        const updated = await userModel.updateEmail(userID, newEmail);

        res.status(200).json({
            message: "Email updated successfully.",
            email: updated.email,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating email." });
    }
}

// POST /forgot-password  (public)
// Always responds with the same generic message regardless of whether the email is
// registered, so this endpoint can't be used to enumerate accounts. An email is only
// actually sent when a matching, active account exists.
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const genericMessage = "If an account exists for that email, a password reset link has been sent.";

        const user = await userModel.getUserByEmailGlobal(email);
        if (!user || !user.isActive) {
            return res.status(200).json({ message: genericMessage });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        await userModel.createPasswordResetToken(user.userID, tokenHash, expiresAt);

        const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
        const resetLink = `${baseUrl}/reset-password.html?token=${rawToken}`;
        const emailResult = await emailService.sendPasswordResetEmail(email, resetLink);
        if (!emailResult.ok) {
            console.error("Password reset email failed:", emailResult.error);
        }

        res.status(200).json({ message: genericMessage });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error processing password reset request." });
    }
}

// POST /reset-password  (public)
// Redeems a reset token: verifies it's unused and unexpired, sets the new password,
// then marks the token used so the same link can never be redeemed twice.
async function resetPassword(req, res) {
    try {
        const { token, password } = req.body;

        const tokenHash = hashResetToken(token);
        const resetToken = await userModel.getValidPasswordResetToken(tokenHash);
        if (!resetToken) {
            return res.status(400).json({ error: "This reset link is invalid or has expired." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await userModel.redeemPasswordResetToken(resetToken.tokenID, resetToken.userID, passwordHash);

        res.status(200).json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error resetting password." });
    }
}

module.exports = {
    uploadProfilePicture,
    changeEmail,
    forgotPassword,
    resetPassword,
};

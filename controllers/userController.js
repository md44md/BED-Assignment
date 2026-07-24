const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const { uploadImageToCloudinary } = require("../cloudinaryConfig");

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

module.exports = {
    uploadProfilePicture,
    changeEmail,
};

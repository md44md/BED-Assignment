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

module.exports = {
    uploadProfilePicture,
};

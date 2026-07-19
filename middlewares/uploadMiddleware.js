const multer = require("multer");

// Keep the file in memory (as a Buffer) instead of writing it to our own disk.
// We only need it long enough to hand it off to Cloudinary.
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPEG, PNG, and WEBP images are allowed."));
        }
    },
});

// req.file will be attached under this field name — the front-end's
// FormData key ("image") must match it exactly.
module.exports = {
    uploadMenuItemImage: upload.single("image"),
};

const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads an in-memory file buffer (as produced by multer's memoryStorage)
// straight to Cloudinary — no temp file ever touches our own disk.
// Returns Cloudinary's full response; callers typically just need secure_url.
async function uploadImageToCloudinary(fileBuffer, mimetype, folder = "hcms/menu-items") {
    const base64Data = fileBuffer.toString("base64");
    const dataURI = `data:${mimetype};base64,${base64Data}`;

    return await cloudinary.uploader.upload(dataURI, {
        folder,
        resource_type: "image",
    });
}

module.exports = {
    uploadImageToCloudinary,
};

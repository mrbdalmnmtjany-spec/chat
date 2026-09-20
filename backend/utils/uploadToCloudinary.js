const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

/**
 * يرفع بافر ملف (صورة/صوت/فيديو) إلى Cloudinary مباشرة من الذاكرة
 * @param {Buffer} buffer - محتوى الملف
 * @param {Object} options - خيارات Cloudinary (resource_type, folder...)
 * @returns {Promise<Object>} نتيجة الرفع من Cloudinary
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "moaaz-chat", ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = uploadToCloudinary;

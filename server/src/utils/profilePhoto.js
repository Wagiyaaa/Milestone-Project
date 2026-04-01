const { saveImage, deleteImageByPath } = require("./imageStorage");

async function saveProfilePhoto(file) {
    return saveImage(file, "profiles");
}

async function deleteProfilePhotoByPath(profilePhotoPath) {
    return deleteImageByPath(profilePhotoPath, "profiles");
}

module.exports = { saveProfilePhoto, deleteProfilePhotoByPath };

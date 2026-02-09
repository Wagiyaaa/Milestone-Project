const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

async function detectFileType(buffer) {
    const { fileTypeFromBuffer } = await import("file-type");
    return fileTypeFromBuffer(buffer);
}

function getProfilesDir() {
    const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
    return path.join(baseDir, "profiles");
}

async function saveProfilePhoto(file) {
    if (!file?.buffer) {
        const err = new Error("NO_FILE_BUFFER");
        err.code = "NO_FILE_BUFFER";
        throw err;
    }

    const detected = await detectFileType(file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
        const err = new Error("INVALID_FILE_TYPE");
        err.code = "INVALID_FILE_TYPE";
        throw err;
    }

    const profilesDir = getProfilesDir();
    await fs.mkdir(profilesDir, { recursive: true });

    const filename = `${crypto.randomUUID()}.${detected.ext}`;
    const absPath = path.join(profilesDir, filename);

    await fs.writeFile(absPath, file.buffer, { flag: "wx" });

    return `/uploads/profiles/${filename}`;
}

async function deleteProfilePhotoByPath(profilePhotoPath) {
    try {
        if (!profilePhotoPath) return;
        const filename = profilePhotoPath.split("/").pop();
        if (!filename) return;

        const absPath = path.join(getProfilesDir(), filename);
        await fs.unlink(absPath);
    } catch {
        // best-effort cleanup
    }
}

module.exports = { saveProfilePhoto, deleteProfilePhotoByPath };

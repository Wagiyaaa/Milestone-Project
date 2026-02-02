const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

async function detectFileType(buffer) {
    // file-type is ESM-only; use dynamic import
    const { fileTypeFromBuffer } = await import("file-type");
    return fileTypeFromBuffer(buffer);
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

    const uploadsDir = path.join(process.cwd(), "uploads", "profiles");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `${crypto.randomUUID()}.${detected.ext}`; // jpg or png
    const absPath = path.join(uploadsDir, filename);

    await fs.writeFile(absPath, file.buffer, { flag: "wx" });

    return `/uploads/profiles/${filename}`;
}

// cleanup if DB insert fails after saving file
async function deleteProfilePhotoByPath(profilePhotoPath) {
    try {
        if (!profilePhotoPath) return;

        // profilePhotoPath: /uploads/profiles/<file>
        const filename = profilePhotoPath.split("/").pop();
        if (!filename) return;

        const absPath = path.join(process.cwd(), "uploads", "profiles", filename);
        await fs.unlink(absPath);
    } catch {
        // best-effort cleanup; don't crash the request because cleanup failed
    }
}

module.exports = { saveProfilePhoto, deleteProfilePhotoByPath };

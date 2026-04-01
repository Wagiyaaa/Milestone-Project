const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

async function detectFileType(buffer) {
  const { fileTypeFromBuffer } = await import("file-type");
  return fileTypeFromBuffer(buffer);
}

function getUploadsBaseDir() {
  return process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads");
}

function getTargetDir(folderName) {
  if (!/^[a-z0-9_-]+$/i.test(folderName)) {
    const err = new Error("INVALID_UPLOAD_FOLDER");
    err.code = "INVALID_UPLOAD_FOLDER";
    throw err;
  }

  return path.join(getUploadsBaseDir(), folderName);
}

async function saveImage(file, folderName) {
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

  const targetDir = getTargetDir(folderName);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${detected.ext}`;
  const absolutePath = path.join(targetDir, filename);

  await fs.writeFile(absolutePath, file.buffer, { flag: "wx", mode: 0o600 });

  return `/uploads/${folderName}/${filename}`;
}

async function deleteImageByPath(relativePath, folderName) {
  try {
    if (typeof relativePath !== "string" || !relativePath) return;

    const expectedPrefix = `/uploads/${folderName}/`;
    if (!relativePath.startsWith(expectedPrefix)) return;

    const filename = path.posix.basename(relativePath);
    if (!/^[0-9a-f-]+\.(?:jpg|jpeg|png)$/i.test(filename)) return;

    const absolutePath = path.join(getTargetDir(folderName), filename);
    await fs.unlink(absolutePath);
  } catch {
    // best-effort cleanup
  }
}

module.exports = { saveImage, deleteImageByPath };

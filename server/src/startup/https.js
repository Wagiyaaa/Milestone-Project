const fs = require("fs/promises");
const path = require("path");
const selfsigned = require("selfsigned");

const {
  httpsCertDaysValid,
  httpsCertPath,
  httpsCommonName,
  httpsKeyPath,
} = require("../config/runtime");

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readStoredCredentials() {
  const [hasKey, hasCert] = await Promise.all([
    fileExists(httpsKeyPath),
    fileExists(httpsCertPath),
  ]);

  if (!hasKey || !hasCert) {
    return null;
  }

  const [key, cert] = await Promise.all([
    fs.readFile(httpsKeyPath, "utf8"),
    fs.readFile(httpsCertPath, "utf8"),
  ]);

  return {
    key,
    cert,
    generated: false,
    keyPath: httpsKeyPath,
    certPath: httpsCertPath,
  };
}

async function generateSelfSignedCredentials() {
  const attrs = [{ name: "commonName", value: httpsCommonName }];
  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate);
  notAfterDate.setDate(notAfterDate.getDate() + httpsCertDaysValid);

  const pems = await selfsigned.generate(attrs, {
    algorithm: "sha256",
    keySize: 2048,
    notBeforeDate,
    notAfterDate,
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "keyUsage",
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: "extKeyUsage",
        serverAuth: true,
      },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: httpsCommonName },
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
          { type: 7, ip: "::1" },
        ],
      },
    ],
  });

  await fs.mkdir(path.dirname(httpsKeyPath), { recursive: true });
  await fs.mkdir(path.dirname(httpsCertPath), { recursive: true });
  await fs.writeFile(httpsKeyPath, pems.private, { encoding: "utf8", mode: 0o600 });
  await fs.writeFile(httpsCertPath, pems.cert, { encoding: "utf8", mode: 0o600 });

  return {
    key: pems.private,
    cert: pems.cert,
    generated: true,
    keyPath: httpsKeyPath,
    certPath: httpsCertPath,
  };
}

async function ensureHttpsCredentials() {
  const existing = await readStoredCredentials();
  if (existing) return existing;
  return generateSelfSignedCredentials();
}

module.exports = { ensureHttpsCredentials };

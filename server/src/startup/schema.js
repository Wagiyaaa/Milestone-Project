const fs = require("fs/promises");
const path = require("path");

const schemaPath = path.resolve(__dirname, "..", "..", "..", "schemas", "init.sql");

async function readSchemaSql() {
  return fs.readFile(schemaPath, "utf8");
}

async function applySchema(client) {
  const sql = await readSchemaSql();
  await client.query(sql);
}

module.exports = { applySchema, readSchemaSql, schemaPath };

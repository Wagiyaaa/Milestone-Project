const pool = require("../db");

let numericColumnPromise = null;

async function detectPostNumericColumn() {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'posts'
        AND column_name IN ('reference_count', 'topic_rating')
    `
  );

  const columnNames = new Set(result.rows.map((row) => row.column_name));

  if (columnNames.has("reference_count")) return "reference_count";
  if (columnNames.has("topic_rating")) return "topic_rating";

  return null;
}

async function getPostNumericColumn() {
  if (!numericColumnPromise) {
    numericColumnPromise = detectPostNumericColumn().catch((err) => {
      numericColumnPromise = null;
      throw err;
    });
  }

  return numericColumnPromise;
}

async function getPostNumericSelect(tableAlias = "p") {
  const numericColumn = await getPostNumericColumn();
  if (!numericColumn) {
    return `NULL::int AS reference_count`;
  }

  return `${tableAlias}.${numericColumn} AS reference_count`;
}

async function getPostNumericMutationParts() {
  const numericColumn = await getPostNumericColumn();
  const resolvedColumn = numericColumn || "reference_count";

  return {
    column: resolvedColumn,
    returning: resolvedColumn === "reference_count" ? "reference_count" : `${resolvedColumn} AS reference_count`,
  };
}

module.exports = {
  getPostNumericColumn,
  getPostNumericMutationParts,
  getPostNumericSelect,
};

const { Pool } = require("pg");

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function withClient(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  withClient
};

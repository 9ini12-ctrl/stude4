const { query } = require("./_lib/db");
const { ok, error, handleOptions } = require("./_lib/response");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;
  try {
    const result = await query(`SELECT COUNT(*)::int AS count FROM users`);
    return ok({
      needsBootstrap: Number(result.rows[0]?.count || 0) === 0
    });
  } catch (err) {
    return error(err.message || "تعذر فحص النظام", 500);
  }
};

const { query } = require("./_lib/db");
const { ok, handleOptions } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const user = requireAuth(event);
    requireRoles(user, ["admin", "supervisor"]);

    if (user.role === "admin") {
      const result = await query(`
        SELECT id, name, username, role, gender, created_at
        FROM users
        ORDER BY created_at DESC, name ASC
      `);
      return ok({ users: result.rows });
    }

    const result = await query(`
      SELECT id, name, username, role, gender, created_at
      FROM users
      WHERE (role = 'reader' AND gender = $1)
         OR id = $2
      ORDER BY created_at DESC, name ASC
    `, [user.gender, user.id]);

    return ok({ users: result.rows });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

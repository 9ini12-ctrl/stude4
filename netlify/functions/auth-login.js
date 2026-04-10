const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { ok, error, handleOptions, parseBody } = require("./_lib/response");
const { signUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;
  if (event.httpMethod !== "POST") return error("Method not allowed", 405);

  try {
    const body = parseBody(event);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    const result = await query(`
      SELECT id, name, username, password_hash, role, gender
      FROM users
      WHERE username = $1
      LIMIT 1
    `, [username]);

    const user = result.rows[0];
    if (!user) return error("بيانات الدخول غير صحيحة", 401);

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) return error("بيانات الدخول غير صحيحة", 401);

    const token = signUser(user);
    return ok({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        gender: user.gender
      }
    });
  } catch (err) {
    return error(err.message || "تعذر تسجيل الدخول", 500);
  }
};

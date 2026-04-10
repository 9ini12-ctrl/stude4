const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { ok, error, handleOptions, parseBody } = require("./_lib/response");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;
  if (event.httpMethod !== "POST") return error("Method not allowed", 405);

  try {
    const body = parseBody(event);
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!name || !username || !password) {
      return error("جميع الحقول مطلوبة");
    }

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM users`);
    if (Number(countRes.rows[0]?.count || 0) > 0) {
      return error("تم إنشاء مستخدمين مسبقًا", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(`
      INSERT INTO users (name, username, password_hash, role, gender)
      VALUES ($1, $2, $3, 'admin', NULL)
    `, [name, username, passwordHash]);

    return ok({ success: true, message: "تم إنشاء المدير الأول" }, 201);
  } catch (err) {
    return error(err.message || "تعذر إنشاء المدير الأول", 500);
  }
};

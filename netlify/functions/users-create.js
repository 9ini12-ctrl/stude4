const bcrypt = require("bcryptjs");
const { query } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin"]);

    const body = parseBody(event);
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const role = String(body.role || "").trim();
    const gender = body.gender ? String(body.gender).trim() : null;

    if (!name || !username || !password || !role) {
      throw Object.assign(new Error("جميع الحقول المطلوبة يجب تعبئتها"), { statusCode: 400 });
    }

    if (!["admin", "supervisor", "reader"].includes(role)) {
      throw Object.assign(new Error("الدور غير صالح"), { statusCode: 400 });
    }

    if (role !== "admin" && !["male", "female"].includes(gender)) {
      throw Object.assign(new Error("الجنس مطلوب للمشرف والمقرئ"), { statusCode: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(`
      INSERT INTO users (name, username, password_hash, role, gender)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, username, role, gender
    `, [name, username, passwordHash, role, role === "admin" ? null : gender]);

    return ok({ user: result.rows[0] }, 201);
  } catch (err) {
    if (String(err.message || "").includes("duplicate key")) {
      return handlerErrorResponse(Object.assign(new Error("اسم المستخدم موجود مسبقًا"), { statusCode: 409 }));
    }
    return handlerErrorResponse(err);
  }
};

const { query } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { ensureTeacherAccess } = require("./_lib/teachers");

const allowedFields = ["present", "pre_test", "post_test"];

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin", "supervisor"]);
    const body = parseBody(event);

    const teacherId = String(body.teacher_id || "").trim();
    const day = Number(body.day || 0);
    const field = String(body.field || "").trim();

    if (!teacherId || day < 1 || day > 12 || !allowedFields.includes(field)) {
      throw Object.assign(new Error("بيانات الحضور غير صحيحة"), { statusCode: 400 });
    }

    await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    const current = await query(`
      SELECT ${field}
      FROM attendance
      WHERE teacher_id = $1 AND day = $2
      LIMIT 1
    `, [teacherId, day]);

    const nextValue = !(current.rows[0]?.[field] || false);
    await query(`
      UPDATE attendance
      SET ${field} = $3, updated_at = NOW()
      WHERE teacher_id = $1 AND day = $2
    `, [teacherId, day, nextValue]);

    return ok({ success: true, value: nextValue });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

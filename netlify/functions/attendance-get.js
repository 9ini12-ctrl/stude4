const { query } = require("./_lib/db");
const { ok, handleOptions } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { ensureTeacherAccess } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const user = requireAuth(event);
    requireRoles(user, ["admin", "supervisor"]);
    const teacherId = String(event.queryStringParameters?.teacher_id || "").trim();
    if (!teacherId) {
      throw Object.assign(new Error("teacher_id مطلوب"), { statusCode: 400 });
    }

    await ensureTeacherAccess(user, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    const result = await query(`
      SELECT teacher_id, day, present, pre_test, post_test
      FROM attendance
      WHERE teacher_id = $1
      ORDER BY day ASC
    `, [teacherId]);

    return ok({ attendance: result.rows });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

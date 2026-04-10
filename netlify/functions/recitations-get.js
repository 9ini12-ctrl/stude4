const { query } = require("./_lib/db");
const { ok, handleOptions } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { ensureTeacherAccess } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const user = requireAuth(event);
    requireRoles(user, ["admin", "supervisor", "reader"]);
    const teacherId = String(event.queryStringParameters?.teacher_id || "").trim();
    if (!teacherId) {
      throw Object.assign(new Error("teacher_id مطلوب"), { statusCode: 400 });
    }

    await ensureTeacherAccess(user, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: true
    });

    const result = await query(`
      SELECT teacher_id, part_number, completed
      FROM recitations
      WHERE teacher_id = $1
      ORDER BY part_number ASC
    `, [teacherId]);

    return ok({ recitations: result.rows });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

const { query } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { ensureTeacherAccess } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin", "supervisor"]);
    const body = parseBody(event);
    const teacherId = String(body.teacher_id || "").trim();

    if (!teacherId) {
      throw Object.assign(new Error("teacher_id مطلوب"), { statusCode: 400 });
    }

    await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    await query(`DELETE FROM teachers WHERE id = $1`, [teacherId]);
    return ok({ success: true });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

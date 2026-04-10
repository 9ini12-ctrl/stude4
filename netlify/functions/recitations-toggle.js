const { query } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { ensureTeacherAccess } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin", "reader"]);
    const body = parseBody(event);

    const teacherId = String(body.teacher_id || "").trim();
    const partNumber = Number(body.part_number || 0);

    if (!teacherId || partNumber < 1 || partNumber > 30) {
      throw Object.assign(new Error("بيانات الجزء غير صحيحة"), { statusCode: 400 });
    }

    await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: false,
      allowReader: true
    });

    const current = await query(`
      SELECT completed
      FROM recitations
      WHERE teacher_id = $1 AND part_number = $2
      LIMIT 1
    `, [teacherId, partNumber]);

    const nextValue = !(current.rows[0]?.completed || false);

    await query(`
      UPDATE recitations
      SET completed = $3, updated_at = NOW()
      WHERE teacher_id = $1 AND part_number = $2
    `, [teacherId, partNumber, nextValue]);

    return ok({ success: true, completed: nextValue });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

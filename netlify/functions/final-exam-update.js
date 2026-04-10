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
    const score = Number(body.score || 0);

    if (!teacherId || Number.isNaN(score) || score < 0 || score > 100) {
      throw Object.assign(new Error("درجة النهائي يجب أن تكون بين 0 و100"), { statusCode: 400 });
    }

    await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    await query(`
      INSERT INTO final_exam (teacher_id, score, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (teacher_id)
      DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
    `, [teacherId, score]);

    return ok({ success: true, score });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

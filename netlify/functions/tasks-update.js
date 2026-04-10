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
    const taskNumber = Number(body.task_number || 0);

    if (!teacherId || taskNumber < 1 || taskNumber > 8) {
      throw Object.assign(new Error("بيانات المهمة غير صحيحة"), { statusCode: 400 });
    }

    await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    const current = await query(`
      SELECT completed
      FROM tasks
      WHERE teacher_id = $1 AND task_number = $2
      LIMIT 1
    `, [teacherId, taskNumber]);

    const nextValue = !(current.rows[0]?.completed || false);
    await query(`
      UPDATE tasks
      SET completed = $3, updated_at = NOW()
      WHERE teacher_id = $1 AND task_number = $2
    `, [teacherId, taskNumber, nextValue]);

    return ok({ success: true, value: nextValue });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

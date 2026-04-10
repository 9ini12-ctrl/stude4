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

    const teacher = await ensureTeacherAccess(authUser, teacherId, {
      allowAdmin: true,
      allowSupervisor: true,
      allowReader: false
    });

    const updates = [];
    const params = [];

    if (typeof body.is_graduated === "boolean") {
      params.push(body.is_graduated);
      updates.push(`is_graduated = $${params.length}`);
    }

    if (body.reader_id !== undefined) {
      if (body.reader_id) {
        const readerRes = await query(`
          SELECT id, role, gender
          FROM users
          WHERE id = $1
          LIMIT 1
        `, [body.reader_id]);
        const reader = readerRes.rows[0];
        if (!reader || reader.role !== "reader" || reader.gender !== teacher.gender) {
          throw Object.assign(new Error("المقرئ / المقرئة غير صالح لهذه الفئة"), { statusCode: 400 });
        }
        params.push(body.reader_id);
        updates.push(`reader_id = $${params.length}`);
      } else {
        updates.push(`reader_id = NULL`);
      }
    }

    if (body.name) {
      params.push(String(body.name).trim());
      updates.push(`name = $${params.length}`);
    }

    if (!updates.length) {
      throw Object.assign(new Error("لا توجد بيانات للتحديث"), { statusCode: 400 });
    }

    params.push(teacherId);
    await query(`
      UPDATE teachers
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
    `, params);

    return ok({ success: true });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

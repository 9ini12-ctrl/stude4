const { ok, handleOptions } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { listTeachers } = require("./_lib/teachers");

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

    const result = await listTeachers(user, { teacherId });
    const teacher = result.teachers[0];
    if (!teacher) {
      throw Object.assign(new Error("المعلم / المعلمة غير موجود"), { statusCode: 404 });
    }

    return ok({ teacher });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

const { ok, handleOptions } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");
const { listTeachers } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const user = requireAuth(event);
    requireRoles(user, ["admin", "supervisor", "reader"]);
    const gender = event.queryStringParameters?.gender || "";
    const result = await listTeachers(user, { gender: gender || undefined });
    return ok({ teachers: result.teachers });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

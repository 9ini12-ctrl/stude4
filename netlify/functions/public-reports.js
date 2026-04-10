const { ok, handleOptions } = require("./_lib/response");
const { handlerErrorResponse } = require("./_lib/auth");
const { listTeachers } = require("./_lib/teachers");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const overall = await listTeachers(null, {});
    const male = await listTeachers(null, { gender: "male" });
    const female = await listTeachers(null, { gender: "female" });

    return ok({
      overall: overall.summary,
      male: male.summary,
      female: female.summary
    });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

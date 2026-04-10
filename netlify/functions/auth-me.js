const { ok, error, handleOptions } = require("./_lib/response");
const { requireAuth, handlerErrorResponse } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const user = requireAuth(event);
    return ok({ user });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

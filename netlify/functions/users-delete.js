const { query } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin"]);
    const body = parseBody(event);
    const userId = String(body.user_id || "").trim();

    if (!userId) {
      throw Object.assign(new Error("معرّف المستخدم مطلوب"), { statusCode: 400 });
    }

    if (userId === authUser.id) {
      throw Object.assign(new Error("لا يمكنك حذف حسابك الحالي"), { statusCode: 400 });
    }

    await query(`DELETE FROM users WHERE id = $1`, [userId]);
    return ok({ success: true });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

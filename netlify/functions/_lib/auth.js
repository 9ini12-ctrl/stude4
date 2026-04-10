const jwt = require("jsonwebtoken");
const { error } = require("./response");

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }
  return process.env.JWT_SECRET;
}

function signUser(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      gender: user.gender || null
    },
    getSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}

function readUserFromEvent(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function requireAuth(event) {
  const user = readUserFromEvent(event);
  if (!user) throw Object.assign(new Error("غير مصرح بالوصول"), { statusCode: 401 });
  return user;
}

function requireRoles(user, roles = []) {
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error("صلاحيات غير كافية"), { statusCode: 403 });
  }
}

function handlerErrorResponse(err) {
  return error(err.message || "حدث خطأ غير متوقع", err.statusCode || 500);
}

module.exports = {
  signUser,
  readUserFromEvent,
  requireAuth,
  requireRoles,
  handlerErrorResponse
};

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function ok(body = {}, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}

function error(message, statusCode = 400, extra = {}) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({
      error: message,
      ...extra
    })
  };
}

function handleOptions(event) {
  if (event.httpMethod === "OPTIONS") {
    return ok({});
  }
  return null;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

module.exports = {
  ok,
  error,
  handleOptions,
  parseBody
};

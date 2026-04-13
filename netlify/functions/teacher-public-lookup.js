const { query } = require("./_lib/db");
const { ok, error, handleOptions, parseBody } = require("./_lib/response");
const { handlerErrorResponse } = require("./_lib/auth");
const { listTeachers } = require("./_lib/teachers");

function toMissingNumbers(limit, source = {}) {
  return Array.from({ length: limit })
    .map((_, index) => index + 1)
    .filter((number) => !source[number]);
}

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  if (event.httpMethod !== "POST") {
    return error("Method not allowed", 405);
  }

  try {
    const body = parseBody(event);
    const pin = String(body.pin || "").trim();

    if (!/^\d{4}$/.test(pin)) {
      throw Object.assign(new Error("أدخل رمزًا صحيحًا من 4 أرقام"), { statusCode: 400 });
    }

    const teacherRes = await query(
      `SELECT id FROM teachers WHERE public_pin = $1 LIMIT 1`,
      [pin]
    );

    const teacherId = teacherRes.rows[0]?.id;
    if (!teacherId) {
      throw Object.assign(new Error("الرمز غير صحيح"), { statusCode: 404 });
    }

    const { teachers } = await listTeachers(null, { teacherId });
    const teacher = teachers[0];

    if (!teacher) {
      throw Object.assign(new Error("تعذر العثور على بيانات المعلم/المعلمة"), { statusCode: 404 });
    }

    const recitations = teacher.recitations || {};
    const attendance = teacher.attendance || {};
    const tasks = teacher.tasks || {};

    const missingParts = toMissingNumbers(30, recitations);
    const missingAttendance = toMissingNumbers(
      12,
      Object.fromEntries(Object.entries(attendance).map(([day, row]) => [day, !!row.present]))
    );
    const missingPreTests = toMissingNumbers(
      12,
      Object.fromEntries(Object.entries(attendance).map(([day, row]) => [day, !!row.pre_test]))
    );
    const missingPostTests = toMissingNumbers(
      12,
      Object.fromEntries(Object.entries(attendance).map(([day, row]) => [day, !!row.post_test]))
    );
    const missingTasks = toMissingNumbers(8, tasks);

    const hasFinalExam = Number(teacher.final_score || 0) > 0;

    return ok({
      teacher: {
        name: teacher.name,
        gender: teacher.gender,
        is_graduated: teacher.is_graduated,
        supervisor_name: teacher.supervisor_name,
        reader_name: teacher.reader_name,
        final_score: Number(teacher.final_score || 0),
        metrics: teacher.metrics
      },
      pending: {
        missingParts,
        missingAttendance,
        missingPreTests,
        missingPostTests,
        missingTasks,
        hasFinalExam
      }
    });
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

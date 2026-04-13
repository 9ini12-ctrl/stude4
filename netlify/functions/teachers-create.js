const { query, withClient } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");

async function generateUniquePublicPin(client) {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const exists = await client.query(
      `SELECT 1 FROM teachers WHERE public_pin = $1 LIMIT 1`,
      [pin]
    );
    if (!exists.rows.length) return pin;
  }
  throw Object.assign(new Error("تعذر توليد رمز دخول فريد، حاول مرة أخرى"), {
    statusCode: 500
  });
}

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin", "supervisor", "reader"]);
    const body = parseBody(event);

    const name = String(body.name || "").trim();
    const requestedReaderId = body.reader_id ? String(body.reader_id).trim() : null;
    const requestedSupervisorId = body.supervisor_id ? String(body.supervisor_id).trim() : null;

    if (!name) {
      throw Object.assign(new Error("اسم المعلم / المعلمة مطلوب"), { statusCode: 400 });
    }

    let supervisorId = authUser.id;
    let supervisorGender = authUser.gender;
    let finalReaderId = requestedReaderId;

    if (authUser.role === "admin") {
      if (!requestedSupervisorId) {
        throw Object.assign(new Error("يجب اختيار المشرف / المشرفة"), { statusCode: 400 });
      }
      const supervisorRes = await query(`
        SELECT id, role, gender
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [requestedSupervisorId]);
      const supervisor = supervisorRes.rows[0];
      if (!supervisor || supervisor.role !== "supervisor" || !supervisor.gender) {
        throw Object.assign(new Error("المشرف / المشرفة غير صالح"), { statusCode: 400 });
      }
      supervisorId = supervisor.id;
      supervisorGender = supervisor.gender;
    }

    if (authUser.role === "supervisor") {
      finalReaderId = requestedReaderId;
    }

    if (authUser.role === "reader") {
      if (!authUser.gender) {
        throw Object.assign(new Error("تعذر تحديد فئة المقرئ / المقرئة"), { statusCode: 400 });
      }
      supervisorGender = authUser.gender;
      finalReaderId = authUser.id;

      const supervisorRes = await query(`
        SELECT id
        FROM users
        WHERE role = 'supervisor' AND gender = $1
        ORDER BY created_at ASC
        LIMIT 1
      `, [authUser.gender]);

      const supervisor = supervisorRes.rows[0];
      if (!supervisor) {
        throw Object.assign(new Error("لا يوجد مشرف / مشرفة من نفس الفئة لربط الاسم الجديد"), { statusCode: 400 });
      }
      supervisorId = supervisor.id;
    }

    if (!["male", "female"].includes(supervisorGender)) {
      throw Object.assign(new Error("تعذر تحديد جنس الفئة من المشرف"), { statusCode: 400 });
    }

    if (finalReaderId) {
      const readerRes = await query(`
        SELECT id, role, gender
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [finalReaderId]);
      const reader = readerRes.rows[0];
      if (!reader || reader.role !== "reader" || reader.gender !== supervisorGender) {
        throw Object.assign(new Error("المقرئ / المقرئة يجب أن يكون من نفس الفئة"), { statusCode: 400 });
      }
    }

    const teacher = await withClient(async (client) => {
      const publicPin = await generateUniquePublicPin(client);
      const insertTeacher = await client.query(`
        INSERT INTO teachers (name, supervisor_id, reader_id, gender, public_pin)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, public_pin
      `, [name, supervisorId, finalReaderId, supervisorGender, publicPin]);

      const teacherId = insertTeacher.rows[0].id;
      await client.query(`
        INSERT INTO recitations (teacher_id, part_number, completed)
        SELECT $1, gs, false
        FROM generate_series(1, 30) AS gs
      `, [teacherId]);

      await client.query(`
        INSERT INTO attendance (teacher_id, day, present, pre_test, post_test)
        SELECT $1, gs, false, false, false
        FROM generate_series(1, 12) AS gs
      `, [teacherId]);

      await client.query(`
        INSERT INTO tasks (teacher_id, task_number, completed)
        SELECT $1, gs, false
        FROM generate_series(1, 8) AS gs
      `, [teacherId]);

      await client.query(`
        INSERT INTO final_exam (teacher_id, score)
        VALUES ($1, 0)
      `, [teacherId]);

      return insertTeacher.rows[0];
    });

    return ok({ teacher }, 201);
  } catch (err) {
    return handlerErrorResponse(err);
  }
};

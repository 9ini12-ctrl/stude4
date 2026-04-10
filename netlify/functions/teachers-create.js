const { query, withClient } = require("./_lib/db");
const { ok, handleOptions, parseBody } = require("./_lib/response");
const { requireAuth, requireRoles, handlerErrorResponse } = require("./_lib/auth");

exports.handler = async (event) => {
  const preflight = handleOptions(event);
  if (preflight) return preflight;

  try {
    const authUser = requireAuth(event);
    requireRoles(authUser, ["admin", "supervisor"]);
    const body = parseBody(event);

    const name = String(body.name || "").trim();
    const requestedReaderId = body.reader_id ? String(body.reader_id).trim() : null;
    const requestedSupervisorId = body.supervisor_id ? String(body.supervisor_id).trim() : null;

    if (!name) {
      throw Object.assign(new Error("اسم المعلم / المعلمة مطلوب"), { statusCode: 400 });
    }

    let supervisorId = authUser.id;
    let supervisorGender = authUser.gender;

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

    if (!["male", "female"].includes(supervisorGender)) {
      throw Object.assign(new Error("تعذر تحديد جنس الفئة من المشرف"), { statusCode: 400 });
    }

    if (requestedReaderId) {
      const readerRes = await query(`
        SELECT id, role, gender
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [requestedReaderId]);
      const reader = readerRes.rows[0];
      if (!reader || reader.role !== "reader" || reader.gender !== supervisorGender) {
        throw Object.assign(new Error("المقرئ / المقرئة يجب أن يكون من نفس الفئة"), { statusCode: 400 });
      }
    }

    const teacher = await withClient(async (client) => {
      const insertTeacher = await client.query(`
        INSERT INTO teachers (name, supervisor_id, reader_id, gender)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name
      `, [name, supervisorId, requestedReaderId, supervisorGender]);

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

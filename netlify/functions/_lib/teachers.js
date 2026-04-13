const { query } = require("./db");
const { computeTeacherMetrics, summarizeTeachers } = require("./metrics");

function teacherWhereClause(user, filters = {}) {
  const conditions = [];
  const params = [];

  if (user) {
    if (user.role === "supervisor") {
      params.push(user.id);
      conditions.push(`t.supervisor_id = $${params.length}`);
      if (user.gender) {
        params.push(user.gender);
        conditions.push(`t.gender = $${params.length}`);
      }
    } else if (user.role === "reader") {
      params.push(user.id);
      conditions.push(`t.reader_id = $${params.length}`);
      if (user.gender) {
        params.push(user.gender);
        conditions.push(`t.gender = $${params.length}`);
      }
      conditions.push("t.is_graduated = false");
    }
  }

  if (filters.gender) {
    params.push(filters.gender);
    conditions.push(`t.gender = $${params.length}`);
  }

  if (filters.teacherId) {
    params.push(filters.teacherId);
    conditions.push(`t.id = $${params.length}`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

async function listTeachers(user, filters = {}) {
  const scope = teacherWhereClause(user, filters);
  const result = await query(`
    SELECT
      t.id,
      t.name,
      t.supervisor_id,
      t.reader_id,
      t.gender,
      t.is_graduated,
      t.public_pin,
      t.created_at,
      s.name AS supervisor_name,
      r.name AS reader_name,
      COALESCE((SELECT COUNT(*) FROM recitations rc WHERE rc.teacher_id = t.id AND rc.completed = true), 0) AS recitations_completed,
      COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.teacher_id = t.id AND a.present = true), 0) AS days_present,
      COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.teacher_id = t.id AND a.pre_test = true), 0) AS pre_tests_completed,
      COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.teacher_id = t.id AND a.post_test = true), 0) AS post_tests_completed,
      COALESCE((SELECT COUNT(*) FROM tasks tk WHERE tk.teacher_id = t.id AND tk.completed = true), 0) AS tasks_completed,
      COALESCE((SELECT score FROM final_exam fe WHERE fe.teacher_id = t.id), 0) AS final_score
    FROM teachers t
    LEFT JOIN users s ON s.id = t.supervisor_id
    LEFT JOIN users r ON r.id = t.reader_id
    ${scope.where}
    ORDER BY t.created_at DESC, t.name ASC
  `, scope.params);

  const recitations = await query(`
    SELECT teacher_id, part_number, completed
    FROM recitations
    WHERE teacher_id = ANY($1::uuid[])
  `, [result.rows.map((row) => row.id)]).catch(() => ({ rows: [] }));

  const attendance = await query(`
    SELECT teacher_id, day, present, pre_test, post_test
    FROM attendance
    WHERE teacher_id = ANY($1::uuid[])
  `, [result.rows.map((row) => row.id)]).catch(() => ({ rows: [] }));

  const tasks = await query(`
    SELECT teacher_id, task_number, completed
    FROM tasks
    WHERE teacher_id = ANY($1::uuid[])
  `, [result.rows.map((row) => row.id)]).catch(() => ({ rows: [] }));

  const recitationsMap = {};
  const attendanceMap = {};
  const tasksMap = {};

  for (const row of recitations.rows) {
    if (!recitationsMap[row.teacher_id]) recitationsMap[row.teacher_id] = {};
    recitationsMap[row.teacher_id][Number(row.part_number)] = row.completed;
  }

  for (const row of attendance.rows) {
    if (!attendanceMap[row.teacher_id]) attendanceMap[row.teacher_id] = {};
    attendanceMap[row.teacher_id][Number(row.day)] = {
      present: row.present,
      pre_test: row.pre_test,
      post_test: row.post_test
    };
  }

  for (const row of tasks.rows) {
    if (!tasksMap[row.teacher_id]) tasksMap[row.teacher_id] = {};
    tasksMap[row.teacher_id][Number(row.task_number)] = row.completed;
  }

  const teachers = result.rows.map((row) => ({
    ...row,
    metrics: computeTeacherMetrics(row),
    recitations: recitationsMap[row.id] || {},
    attendance: attendanceMap[row.id] || {},
    tasks: tasksMap[row.id] || {}
  }));

  return {
    teachers,
    summary: summarizeTeachers(teachers)
  };
}

async function ensureTeacherAccess(user, teacherId, { allowSupervisor = true, allowReader = true, allowAdmin = true } = {}) {
  const { teachers } = await listTeachers(
    allowAdmin || allowSupervisor || allowReader ? user : null,
    { teacherId }
  );

  const teacher = teachers[0];
  if (!teacher) {
    throw Object.assign(new Error("المعلم / المعلمة غير موجود أو خارج نطاق الصلاحية"), { statusCode: 404 });
  }

  if (user.role === "admin" && !allowAdmin) {
    throw Object.assign(new Error("غير مسموح"), { statusCode: 403 });
  }
  if (user.role === "supervisor" && !allowSupervisor) {
    throw Object.assign(new Error("غير مسموح"), { statusCode: 403 });
  }
  if (user.role === "reader" && !allowReader) {
    throw Object.assign(new Error("غير مسموح"), { statusCode: 403 });
  }

  return teacher;
}

module.exports = {
  listTeachers,
  ensureTeacherAccess
};

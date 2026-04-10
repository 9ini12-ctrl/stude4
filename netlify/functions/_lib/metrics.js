function clamp(num, min, max) {
  return Math.max(min, Math.min(max, Number(num) || 0));
}

function computeTeacherMetrics(row) {
  const recitationsCompleted = Number(row.recitations_completed || 0);
  const attendancePresent = Number(row.days_present || 0);
  const preTests = Number(row.pre_tests_completed || 0);
  const postTests = Number(row.post_tests_completed || 0);
  const tasksCompleted = Number(row.tasks_completed || 0);
  const finalScore = Number(row.final_score || 0);

  const partsBase = row.is_graduated ? 100 : row.gender === "female"
    ? Math.min(100, (recitationsCompleted / 15) * 100)
    : (recitationsCompleted / 30) * 100;

  const attendancePercent = (attendancePresent / 12) * 100;
  const prePercent = (preTests / 12) * 100;
  const postPercent = (postTests / 12) * 100;
  const testsPercent = (prePercent + postPercent) / 2;
  const tasksPercent = (tasksCompleted / 8) * 100;
  const finalExamPercent = clamp(finalScore, 0, 100);

  const finalResult = (partsBase * 0.40) + (testsPercent * 0.25) + (tasksPercent * 0.20) + (finalExamPercent * 0.15);

  return {
    partsPercent: clamp(partsBase, 0, 100),
    attendancePercent: clamp(attendancePercent, 0, 100),
    testsPercent: clamp(testsPercent, 0, 100),
    tasksPercent: clamp(tasksPercent, 0, 100),
    finalExamPercent,
    finalResult: clamp(finalResult, 0, 100)
  };
}

function average(list, key) {
  if (!list.length) return 0;
  const sum = list.reduce((acc, item) => acc + (Number(item.metrics?.[key]) || 0), 0);
  return sum / list.length;
}

function summarizeTeachers(teachers) {
  return {
    totalTeachers: teachers.length,
    graduatedCount: teachers.filter((teacher) => teacher.is_graduated).length,
    averageParts: average(teachers, "partsPercent"),
    averageTests: average(teachers, "testsPercent"),
    averageTasks: average(teachers, "tasksPercent"),
    averageFinalExam: average(teachers, "finalExamPercent"),
    averageFinalResult: average(teachers, "finalResult")
  };
}

module.exports = {
  computeTeacherMetrics,
  summarizeTeachers
};

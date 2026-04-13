const state = {
  token: localStorage.getItem("practitioner_token") || "",
  user: null,
  summary: null,
  teachers: [],
  users: [],
  readers: [],
  supervisors: [],
  adminNamedReports: { male: [], female: [] },
  selectedTeacherId: null,
  genderFilter: "",
  teacherViewMode: "report",
  teacherSearch: "",
  teacherSort: "name_asc",
  adminReportFilters: {
    male: { search: "", sort: "name_asc", page: 1, pageSize: 10 },
    female: { search: "", sort: "name_asc", page: 1, pageSize: 10 }
  }
};

function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  return fetch(`/api/${path}`, { ...options, headers }).then(async (response) => {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const message = payload?.error || payload?.message || "تعذر تنفيذ العملية";
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  });
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast fade-in";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function metricClass(value) {
  const safe = Number(value) || 0;
  if (safe <= 40) return "metric-red";
  if (safe <= 70) return "metric-yellow";
  return "metric-green";
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}٪`;
}

function progressHtml(label, value) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <span class="metric-label">${label}</span>
        <span class="text-sm font-bold text-slate-700">${formatPercent(safe)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar ${metricClass(safe)}" style="width:${safe}%"></div>
      </div>
    </div>
  `;
}

function circularHtml(label, value) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-center shadow-soft">
      <div class="circular mx-auto" style="background: conic-gradient(${safe <= 40 ? "#ef4444" : safe <= 70 ? "#eab308" : "#22c55e"} ${safe * 3.6}deg, #e2e8f0 0deg)">
        <span>${Math.round(safe)}٪</span>
      </div>
      <div class="mt-3 text-xs font-semibold text-slate-500">${label}</div>
    </div>
  `;
}

function emptyState(text) {
  return `<div class="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">${text}</div>`;
}

function summaryCardsSkeleton(count = 4) {
  return Array.from({ length: count }).map(() => `
    <div class="rounded-3xl border border-slate-200 bg-white p-5">
      <div class="skeleton h-4 w-24"></div>
      <div class="mt-4 skeleton h-7 w-20"></div>
      <div class="mt-4 skeleton h-3 w-full"></div>
    </div>
  `).join("");
}

function teacherSkeleton(count = 3) {
  return Array.from({ length: count }).map(() => `
    <div class="rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <div class="skeleton h-5 w-44"></div>
      <div class="mt-4 skeleton h-4 w-32"></div>
      <div class="mt-5 skeleton h-3 w-full"></div>
      <div class="mt-3 skeleton h-3 w-full"></div>
      <div class="mt-3 skeleton h-10 w-full"></div>
    </div>
  `).join("");
}

function setLoginMessage(message, isError = false) {
  const el = document.getElementById("form-message");
  if (!el) return;
  el.textContent = message || "";
  el.className = `text-center text-sm font-medium ${isError ? "text-rose-600" : "text-slate-500"}`;
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function sortTeachers(list, sortMode = "name_asc") {
  const items = [...(list || [])];
  const metricSort = (key, dir = "desc") => items.sort((a, b) => {
    const av = Number(a.metrics?.[key]) || 0;
    const bv = Number(b.metrics?.[key]) || 0;
    return dir === "asc" ? av - bv : bv - av;
  });

  if (sortMode === "name_desc") return items.sort((a, b) => (b.name || "").localeCompare(a.name || "", "ar"));
  if (sortMode === "result_desc") return metricSort("finalResult", "desc");
  if (sortMode === "result_asc") return metricSort("finalResult", "asc");
  if (sortMode === "parts_desc") return metricSort("partsPercent", "desc");
  if (sortMode === "attendance_desc") return metricSort("attendancePercent", "desc");
  if (sortMode === "tests_desc") return metricSort("testsPercent", "desc");
  if (sortMode === "tasks_desc") return metricSort("tasksPercent", "desc");
  if (sortMode === "final_exam_desc") return metricSort("finalExamPercent", "desc");
  return items.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
}

function filterAndSortTeachers(list, searchText = "", sortMode = "name_asc") {
  const search = normalizeText(searchText);
  const filtered = (list || []).filter((teacher) => !search || normalizeText(teacher.name).includes(search));
  return sortTeachers(filtered, sortMode);
}

function computeTeacherMetricsFromState(teacher) {
  const recitationsCompleted = Object.values(teacher.recitations || {}).filter(Boolean).length;
  const attendanceRows = Object.values(teacher.attendance || {});
  const attendancePresent = attendanceRows.filter((row) => row.present).length;
  const preTests = attendanceRows.filter((row) => row.pre_test).length;
  const postTests = attendanceRows.filter((row) => row.post_test).length;
  const tasksCompleted = Object.values(teacher.tasks || {}).filter(Boolean).length;
  const finalScore = Number(teacher.final_score || 0);

  const partsBase = teacher.is_graduated
    ? 100
    : teacher.gender === "female"
      ? Math.min(100, (recitationsCompleted / 15) * 100)
      : (recitationsCompleted / 30) * 100;

  const attendancePercent = (attendancePresent / 12) * 100;
  const prePercent = (preTests / 12) * 100;
  const postPercent = (postTests / 12) * 100;
  const testsPercent = (prePercent + postPercent) / 2;
  const tasksPercent = (tasksCompleted / 8) * 100;
  const finalExamPercent = Math.max(0, Math.min(100, finalScore));
  const finalResult = (partsBase * 0.40) + (testsPercent * 0.25) + (tasksPercent * 0.20) + (finalExamPercent * 0.15);

  return {
    partsPercent: Math.max(0, Math.min(100, partsBase)),
    attendancePercent: Math.max(0, Math.min(100, attendancePercent)),
    testsPercent: Math.max(0, Math.min(100, testsPercent)),
    tasksPercent: Math.max(0, Math.min(100, tasksPercent)),
    finalExamPercent,
    finalResult: Math.max(0, Math.min(100, finalResult))
  };
}

function summarizeTeachers(teachers) {
  const safeList = teachers || [];
  const average = (key) => safeList.length ? safeList.reduce((acc, item) => acc + (Number(item.metrics?.[key]) || 0), 0) / safeList.length : 0;
  return {
    totalTeachers: safeList.length,
    graduatedCount: safeList.filter((teacher) => teacher.is_graduated).length,
    averageParts: average("partsPercent"),
    averageAttendance: average("attendancePercent"),
    averageTests: average("testsPercent"),
    averageTasks: average("tasksPercent"),
    averageFinalExam: average("finalExamPercent"),
    averageFinalResult: average("finalResult")
  };
}

function setButtonBusy(button, busy) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.classList.add("opacity-70", "pointer-events-none");
    button.textContent = "جارٍ الحفظ...";
  } else {
    button.disabled = false;
    button.classList.remove("opacity-70", "pointer-events-none");
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
}

function preserveViewport(callback) {
  const top = window.scrollY;
  callback();
  requestAnimationFrame(() => window.scrollTo({ top, behavior: "auto" }));
}

function renderMetricCards(gridId, cards = [], columnsClass = "sm:grid-cols-2 xl:grid-cols-4") {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.className = `mt-5 grid gap-4 ${columnsClass}`;
  grid.innerHTML = cards.map((item) => `
    <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft fade-in">
      <div class="metric-label">${item.label}</div>
      <div class="mt-3 text-3xl font-extrabold">${item.value}</div>
      <div class="mt-4">${progressHtml(item.progressLabel || "المؤشر", item.progress)}</div>
    </div>
  `).join("");
}

function renderSummaryGrid(summary) {
  const overallCards = state.user?.role === "admin"
    ? [
        { label: "إجمالي المعلمين/ات", value: summary.totalTeachers, progress: summary.averageFinalResult },
        { label: "إجمالي المعلمين", value: state.adminNamedReports.male.length, progress: summarizeTeachers(state.adminNamedReports.male).averageFinalResult },
        { label: "إجمالي المعلمات", value: state.adminNamedReports.female.length, progress: summarizeTeachers(state.adminNamedReports.female).averageFinalResult },
        { label: "المجازون/ات / الخريجون/ات", value: summary.graduatedCount, progress: summary.averageParts },
        { label: "متوسط الأداء العام", value: formatPercent(summary.averageFinalResult), progress: summary.averageFinalResult },
        { label: "متوسط الاختبار النهائي ", value: formatPercent(summary.averageFinalExam), progress: summary.averageFinalExam }
      ]
    : [
        { label: "إجمالي المعلمين / ات", value: summary.totalTeachers, progress: summary.averageFinalResult },
        { label: "المجازون/ات / الخريجون/ات", value: summary.graduatedCount, progress: summary.averageParts },
        { label: "متوسط الأداء", value: formatPercent(summary.averageFinalResult), progress: summary.averageFinalResult },
        { label: "متوسط الاختبار النهائي", value: formatPercent(summary.averageFinalExam), progress: summary.averageFinalExam }
      ];

  renderMetricCards(
    "summary-grid",
    overallCards,
    state.user?.role === "admin" ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"
  );

  const circularWrap = document.getElementById("summary-circular");
  if (circularWrap && summary && state.user?.role !== "admin") {
    circularWrap.innerHTML = `
      ${circularHtml("الأجزاء", summary.averageParts)}
      ${circularHtml("الاختبارات", summary.averageTests)}
      ${circularHtml("المهام", summary.averageTasks)}
    `;
  }
}

function renderAdminSplitSummaries() {
  const maleSummary = summarizeTeachers(state.adminNamedReports.male || []);
  const femaleSummary = summarizeTeachers(state.adminNamedReports.female || []);

  renderMetricCards("admin-male-summary-grid", [
    { label: "عدد المعلمين", value: maleSummary.totalTeachers, progress: maleSummary.averageFinalResult },
    { label: "المجازون", value: maleSummary.graduatedCount, progress: maleSummary.averageParts, progressLabel: "متوسط الأجزاء" },
    { label: "متوسط الحضور", value: formatPercent(maleSummary.averageAttendance || 0), progress: maleSummary.averageAttendance || 0 },
    { label: "متوسط الاختبارات", value: formatPercent(maleSummary.averageTests), progress: maleSummary.averageTests },
    { label: "متوسط المهام", value: formatPercent(maleSummary.averageTasks), progress: maleSummary.averageTasks },
    { label: "متوسط النهائي", value: formatPercent(maleSummary.averageFinalExam), progress: maleSummary.averageFinalExam },
    { label: "متوسط الأداء ", value: formatPercent(maleSummary.averageFinalResult), progress: maleSummary.averageFinalResult },
    { label: "متوسط الأجزاء", value: formatPercent(maleSummary.averageParts), progress: maleSummary.averageParts }
  ], "sm:grid-cols-2");

  renderMetricCards("admin-female-summary-grid", [
    { label: "عدد المعلمات", value: femaleSummary.totalTeachers, progress: femaleSummary.averageFinalResult },
    { label: "المجازات", value: femaleSummary.graduatedCount, progress: femaleSummary.averageParts, progressLabel: "متوسط الأجزاء" },
    { label: "متوسط الحضور", value: formatPercent(femaleSummary.averageAttendance || 0), progress: femaleSummary.averageAttendance || 0 },
    { label: "متوسط الاختبارات", value: formatPercent(femaleSummary.averageTests), progress: femaleSummary.averageTests },
    { label: "متوسط المهام", value: formatPercent(femaleSummary.averageTasks), progress: femaleSummary.averageTasks },
    { label: "متوسط النهائي", value: formatPercent(femaleSummary.averageFinalExam), progress: femaleSummary.averageFinalExam },
    { label: "متوسط الاداء ", value: formatPercent(femaleSummary.averageFinalResult), progress: femaleSummary.averageFinalResult },
    { label: "متوسط الأجزاء", value: formatPercent(femaleSummary.averageParts), progress: femaleSummary.averageParts }
  ], "sm:grid-cols-2");
}


function currentRoleLabel(user) {
  if (!user) return "";
  if (user.role === "admin") return "مدير";
  if (user.role === "supervisor") return user.gender === "female" ? "مشرفة" : "مشرف";
  if (user.role === "reader") return user.gender === "female" ? "مقرئة" : "مقرئ";
  return user.role;
}

function currentViewMeta() {
  const map = {
    report: { title: "التقرير", note: "عرض المؤشرات والنسب المئوية لجميع الأسماء." },
    attendance: { title: "الحضور", note: "قائمة الأسماء مع متابعة حضور 12 يومًا." },
    tests: { title: "الاختبارات القبلية / البعدية", note: "قائمة الأسماء مع الاختبارات اليومية القبلية والبعدية." },
    tasks: { title: "المهام الأدائية", note: "قائمة الأسماء مع المهام الأدائية الثمانية." },
    final: { title: "الاختبار النهائي", note: "قائمة الأسماء مع إدخال درجة النهائي." }
  };
  return map[state.teacherViewMode] || map.report;
}

function renderTeacherViewTabs() {
  document.querySelectorAll("[data-view-mode]").forEach((button) => {
    const isActive = button.dataset.viewMode === state.teacherViewMode;
    button.className = `rounded-2xl border px-4 py-2 text-sm font-bold transition ${isActive
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`;
  });
}

function resultTone(value) {
  const safe = Number(value) || 0;
  if (safe <= 40) return "bg-rose-100 text-rose-700";
  if (safe <= 70) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function getAdminReportPrepared(targetKey = "male") {
  const filters = state.adminReportFilters[targetKey] || { search: "", sort: "name_asc", page: 1, pageSize: 10 };
  const filtered = filterAndSortTeachers(
    state.adminNamedReports[targetKey] || [],
    filters.search,
    filters.sort
  );

  const pageSize = Math.max(5, Number(filters.pageSize) || 10);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, Number(filters.page) || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + pageSize);

  state.adminReportFilters[targetKey].page = currentPage;
  state.adminReportFilters[targetKey].pageSize = pageSize;

  return { filters, filtered, total, totalPages, currentPage, pageSize, startIndex, pageRows };
}

function reportTableHtml(targetKey, label) {
  const { filtered, total, totalPages, currentPage, pageSize, startIndex, pageRows } = getAdminReportPrepared(targetKey);
  if (!filtered.length) return emptyState("لا توجد بيانات.");

  const sortableHeader = (text, sortValue, activeSort, align = "right") => {
    const isActive = activeSort === sortValue;
    return `<button type="button" data-admin-sort-target="${targetKey}" data-sort-value="${sortValue}" class="inline-flex items-center gap-1 whitespace-nowrap font-bold ${isActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}">${text}<span class="text-[10px]">${isActive ? "●" : "↕"}</span></button>`;
  };

  const pageOptions = [10, 25, 50, 100].map((size) => `<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("");
  const startLabel = total ? startIndex + 1 : 0;
  const endLabel = Math.min(startIndex + pageRows.length, total);

  return `
    <div class="space-y-4">
      <div class="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div class="font-semibold">${label}</div>
        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span class="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700">إجمالي السجلات: ${total}</span>
          <label class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-bold text-slate-700">
            <span>عرض</span>
            <select data-admin-pagesize-target="${targetKey}" class="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none">
              ${pageOptions}
            </select>
          </label>
          <span class="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700">${startLabel} - ${endLabel}</span>
        </div>
      </div>

      <div class="space-y-3 md:hidden">
        ${pageRows.map((teacher, index) => `
          <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-400">#${startIndex + index + 1}</div>
                <div class="mt-1 truncate text-base font-extrabold text-slate-900">${teacher.name}</div>
                <div class="mt-1 text-xs text-slate-500">${teacher.supervisor_name || "—"}</div>
              </div>
              <span class="inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${resultTone(teacher.metrics?.finalResult)}">${formatPercent(teacher.metrics?.finalResult)}</span>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <div class="text-[11px] text-slate-500">الأجزاء</div>
                <div class="mt-1 text-sm font-extrabold text-slate-800">${formatPercent(teacher.metrics?.partsPercent)}</div>
              </div>
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <div class="text-[11px] text-slate-500">النهائي</div>
                <div class="mt-1 text-sm font-extrabold text-slate-800">${formatPercent(teacher.metrics?.finalExamPercent)}</div>
              </div>
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <div class="text-[11px] text-slate-500">الحضور</div>
                <div class="mt-1 text-sm font-extrabold text-slate-800">${formatPercent(teacher.metrics?.attendancePercent)}</div>
              </div>
              <div class="rounded-xl bg-slate-50 px-3 py-2">
                <div class="text-[11px] text-slate-500">المهام</div>
                <div class="mt-1 text-sm font-extrabold text-slate-800">${formatPercent(teacher.metrics?.tasksPercent)}</div>
              </div>
            </div>
            <div class="mt-3">${teacher.is_graduated ? '<span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">خريج/ة /مجاز/ة</span>' : '<span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">نشط</span>'}</div>
          </article>
        `).join("")}
      </div>

      <div class="hidden md:block overflow-x-auto overscroll-x-contain rounded-3xl border border-slate-200 bg-white">
        <table class="w-full lg:min-w-[960px] xl:min-w-[1180px] divide-y divide-slate-200 text-sm">
          <thead class="sticky top-0 z-10 bg-slate-50 text-slate-600">
            <tr>
              <th class="px-3 py-3 text-right whitespace-nowrap">#</th>
              <th class="px-3 py-3 text-right whitespace-nowrap">${sortableHeader("الاسم", "name_asc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="px-3 py-3 text-right whitespace-nowrap">${sortableHeader("الأجزاء", "parts_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="hidden lg:table-cell px-3 py-3 text-right whitespace-nowrap">${sortableHeader("الحضور", "attendance_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="hidden lg:table-cell px-3 py-3 text-right whitespace-nowrap">${sortableHeader("الاختبارات", "tests_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="hidden lg:table-cell px-3 py-3 text-right whitespace-nowrap">${sortableHeader("المهام", "tasks_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="px-3 py-3 text-right whitespace-nowrap">${sortableHeader("النهائي", "final_exam_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="px-3 py-3 text-right whitespace-nowrap">${sortableHeader("النتيجة", "result_desc", state.adminReportFilters[targetKey].sort)}</th>
              <th class="hidden xl:table-cell px-3 py-3 text-right font-bold whitespace-nowrap">المشرف</th>
              <th class="hidden xl:table-cell px-3 py-3 text-right font-bold whitespace-nowrap">المقرئ</th>
              <th class="px-3 py-3 text-right font-bold whitespace-nowrap">الحالة</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${pageRows.map((teacher, index) => `
              <tr class="hover:bg-slate-50/80">
                <td class="px-3 py-3 align-middle font-semibold text-slate-500 whitespace-nowrap">${startIndex + index + 1}</td>
                <td class="px-3 py-3 align-middle font-bold text-slate-900 whitespace-nowrap max-w-[220px] truncate">${teacher.name}</td>
                <td class="px-3 py-3 align-middle whitespace-nowrap">${formatPercent(teacher.metrics?.partsPercent)}</td>
                <td class="hidden lg:table-cell px-3 py-3 align-middle whitespace-nowrap">${formatPercent(teacher.metrics?.attendancePercent)}</td>
                <td class="hidden lg:table-cell px-3 py-3 align-middle whitespace-nowrap">${formatPercent(teacher.metrics?.testsPercent)}</td>
                <td class="hidden lg:table-cell px-3 py-3 align-middle whitespace-nowrap">${formatPercent(teacher.metrics?.tasksPercent)}</td>
                <td class="px-3 py-3 align-middle whitespace-nowrap">${formatPercent(teacher.metrics?.finalExamPercent)}</td>
                <td class="px-3 py-3 align-middle whitespace-nowrap">
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${resultTone(teacher.metrics?.finalResult)}">${formatPercent(teacher.metrics?.finalResult)}</span>
                </td>
                <td class="hidden xl:table-cell px-3 py-3 align-middle whitespace-nowrap max-w-[180px] truncate">${teacher.supervisor_name || "—"}</td>
                <td class="hidden xl:table-cell px-3 py-3 align-middle whitespace-nowrap max-w-[180px] truncate">${teacher.reader_name || "—"}</td>
                <td class="px-3 py-3 align-middle whitespace-nowrap">${teacher.is_graduated ? '<span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">خريج/ة /مجاز/ة</span>' : '<span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">نشط</span>'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="text-xs font-semibold text-slate-500">صفحة ${currentPage} من ${totalPages}</div>
        <div class="overflow-x-auto">
          <div class="flex min-w-max items-center gap-2">
            <button type="button" data-admin-page-target="${targetKey}" data-page-action="prev" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:px-4 sm:text-sm ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}">السابق</button>
            ${Array.from({ length: totalPages }).slice(0, 7).map((_, idx) => {
              let pageNumber = idx + 1;
              if (totalPages > 7 && currentPage > 4) {
                pageNumber = currentPage - 3 + idx;
                if (pageNumber > totalPages) pageNumber = totalPages - (6 - idx);
              }
              return `<button type="button" data-admin-page-target="${targetKey}" data-page-action="go" data-page-number="${pageNumber}" class="rounded-2xl px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm ${pageNumber === currentPage ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}">${pageNumber}</button>`;
            }).join("")}
            <button type="button" data-admin-page-target="${targetKey}" data-page-action="next" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:px-4 sm:text-sm ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}">التالي</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAdminNamedReports() {
  const maleEl = document.getElementById("admin-male-report-table");
  const femaleEl = document.getElementById("admin-female-report-table");
  if (!maleEl || !femaleEl) return;

  maleEl.innerHTML = reportTableHtml("male", "بيان تفصيلي للمعلمين");
  femaleEl.innerHTML = reportTableHtml("female", "بيان تفصيلي للمعلمات");
}


function openSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("translate-x-full", "pointer-events-none");
  backdrop.classList.remove("pointer-events-none", "opacity-0");
  sidebar.setAttribute("aria-hidden", "false");
  toggleBtn?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("translate-x-full", "pointer-events-none");
  backdrop.classList.add("pointer-events-none", "opacity-0");
  sidebar.setAttribute("aria-hidden", "true");
  toggleBtn?.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("translate-x-full")) {
    openSidebar();
  } else {
    closeSidebar();
  }
}

function openAdminDrawer() { return; }


function closeAdminDrawer() { return; }


function updateAdminDrawerView() { return; }


function renderTeacherList() {
  const container = document.getElementById("teachers-list");
  const title = document.getElementById("teacher-list-title");
  const note = document.getElementById("teacher-list-note");
  if (!container) return;


  const teachersSorted = filterAndSortTeachers(state.teachers, state.teacherSearch, state.teacherSort);

  if (!teachersSorted.length) {
    container.innerHTML = emptyState("لا توجد بيانات مطابقة حاليًا.");
    return;
  }

  if (state.user?.role === "reader") {
    title.textContent = "المعلمون التابعون لك";
    if (note) note.textContent = "يظهر الاسم والأجزاء فقط.";

    container.innerHTML = state.teachers.map((teacher) => {
      const recitationButtons = Array.from({ length: 30 }).map((_, index) => {
        const part = index + 1;
        const isActive = teacher.recitations?.[part] || false;
        return `
          <button type="button" data-action="toggle-part" data-teacher="${teacher.id}" data-part="${part}" class="part-btn ${isActive ? "active" : ""} rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold">
            ${part}
          </button>
        `;
      }).join("");

      return `
        <article class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-soft fade-in">
          <div class="mb-4 text-lg font-extrabold text-slate-900">${teacher.name}</div>
          <div class="rounded-3xl border border-slate-200 p-4">
            <div class="grid grid-cols-5 gap-2 sm:grid-cols-6">${recitationButtons}</div>
          </div>
        </article>
      `;
    }).join("");
    return;
  }

  const meta = currentViewMeta();
  title.textContent = `قائمة ${meta.title}`;
  if (note) note.textContent = meta.note;

  container.innerHTML = teachersSorted.map((teacher, index) => {
    const canManage = state.user.role === "admin" || state.user.role === "supervisor";
    const canReassignReader = state.user.role === "supervisor" && state.teacherViewMode === "report";
    const canSetPublicPin = canManage && state.teacherViewMode === "report";
    const eligibleReaders = canReassignReader
      ? state.readers.filter((reader) => reader.gender === teacher.gender)
      : [];
    const attendanceDays = Array.from({ length: 12 }).map((_, idx) => {
      const day = idx + 1;
      const row = teacher.attendance?.[day] || {};
      return `
        <button type="button" data-action="toggle-attendance" data-kind="present" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.present ? "active" : ""} rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold ${canManage ? "" : "pointer-events-none opacity-70"}">${day}</button>
      `;
    }).join("");

    const preDays = Array.from({ length: 12 }).map((_, idx) => {
      const day = idx + 1;
      const row = teacher.attendance?.[day] || {};
      return `
        <button type="button" data-action="toggle-attendance" data-kind="pre_test" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.pre_test ? "active" : ""} rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold ${canManage ? "" : "pointer-events-none opacity-70"}">${day}</button>
      `;
    }).join("");

    const postDays = Array.from({ length: 12 }).map((_, idx) => {
      const day = idx + 1;
      const row = teacher.attendance?.[day] || {};
      return `
        <button type="button" data-action="toggle-attendance" data-kind="post_test" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.post_test ? "active" : ""} rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold ${canManage ? "" : "pointer-events-none opacity-70"}">${day}</button>
      `;
    }).join("");

    const taskButtons = Array.from({ length: 8 }).map((_, idx) => {
      const task = idx + 1;
      const active = teacher.tasks?.[task] || false;
      return `
        <button type="button" data-action="toggle-task" data-teacher="${teacher.id}" data-task="${task}" class="grid-toggle ${active ? "active" : ""} rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold ${canManage ? "" : "pointer-events-none opacity-70"}">${task}</button>
      `;
    }).join("");

    const readerTransferControl = canReassignReader ? `
      <div class="rounded-2xl border border-slate-200 bg-white p-3">
        <label class="mb-2 block text-xs font-bold text-slate-600">نقل إلى مقرئ / مقرئة</label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <select data-reader-input="${teacher.id}" class="soft-ring w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm">
            <option value="">بدون ربط</option>
            ${eligibleReaders.map((reader) => `
              <option value="${reader.id}" ${reader.id === teacher.reader_id ? "selected" : ""}>${reader.name}</option>
            `).join("")}
          </select>
          <button type="button" data-action="save-reader" data-teacher="${teacher.id}" class="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 sm:shrink-0">حفظ المقرئ</button>
        </div>
      </div>
    ` : "";

    const pinControl = canSetPublicPin ? `
      <div class="rounded-2xl border border-slate-200 bg-white p-3">
        <label class="mb-2 block text-xs font-bold text-slate-600">رمز دخول المعلم/المعلمة (4 أرقام)</label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputmode="numeric"
            maxlength="4"
            data-pin-input="${teacher.id}"
            value="${teacher.public_pin || ""}"
            placeholder="0000"
            class="soft-ring w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tracking-[0.25em] text-slate-900"
          />
          <button type="button" data-action="save-public-pin" data-teacher="${teacher.id}" class="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 sm:shrink-0">حفظ الرمز</button>
        </div>
      </div>
    ` : "";

    const actionButtons = `
      <div class="space-y-3">
        ${pinControl}
        ${readerTransferControl}
        <div class="flex flex-wrap gap-2">
          ${canManage ? `<button type="button" data-action="toggle-graduated" data-teacher="${teacher.id}" class="rounded-2xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">${teacher.is_graduated ? "إلغاء خريج/مجاز" : "اعتماد خريج/مجاز"}</button>` : ""}
          ${(state.user.role === "admin" || state.user.role === "supervisor") ? `<button type="button" data-action="delete-teacher" data-teacher="${teacher.id}" class="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">حذف</button>` : ""}
        </div>
      </div>
    `;

    let content = "";
    if (state.teacherViewMode === "report") {
      content = `
        <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div class="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            ${progressHtml("الأجزاء", teacher.metrics.partsPercent)}
            ${progressHtml("الحضور", teacher.metrics.attendancePercent)}
            ${progressHtml("الاختبارات", teacher.metrics.testsPercent)}
            ${progressHtml("المهام", teacher.metrics.tasksPercent)}
            ${progressHtml("النهائي", teacher.metrics.finalExamPercent)}
            ${progressHtml("النتيجة النهائية", teacher.metrics.finalResult)}
          </div>
          <div class="space-y-3">
            <div class="rounded-3xl border border-slate-200 p-4 text-sm text-slate-600">
              <div>المشرف: <span class="font-bold text-slate-900">${teacher.supervisor_name || "—"}</span></div>
              <div class="mt-2">المقرئ: <span class="font-bold text-slate-900">${teacher.reader_name || "—"}</span></div>
            </div>
            ${actionButtons}
          </div>
        </div>
      `;
    }

    if (state.teacherViewMode === "attendance") {
      content = `
        <div class="rounded-3xl border border-slate-200 p-4">
          <div class="mb-3 text-sm font-bold text-slate-800">الحضور من اليوم 1 إلى 12</div>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-12">${attendanceDays}</div>
          <div class="mt-4">${actionButtons}</div>
        </div>
      `;
    }

    if (state.teacherViewMode === "tests") {
      content = `
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="rounded-3xl border border-slate-200 p-4">
            <div class="mb-3 text-sm font-bold text-slate-800">الاختبار القبلي</div>
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4">${preDays}</div>
          </div>
          <div class="rounded-3xl border border-slate-200 p-4">
            <div class="mb-3 text-sm font-bold text-slate-800">الاختبار البعدي</div>
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4">${postDays}</div>
          </div>
          <div class="xl:col-span-2">${actionButtons}</div>
        </div>
      `;
    }

    if (state.teacherViewMode === "tasks") {
      content = `
        <div class="rounded-3xl border border-slate-200 p-4">
          <div class="mb-3 text-sm font-bold text-slate-800">المهام الأدائية الثمانية</div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">${taskButtons}</div>
          <div class="mt-4">${actionButtons}</div>
        </div>
      `;
    }

    if (state.teacherViewMode === "final") {
      content = `
        <div class="rounded-3xl border border-slate-200 p-4">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label class="text-sm font-bold text-slate-800">درجة الاختبار النهائي</label>
            <input type="number" min="0" max="100" value="${Number(teacher.final_score || 0)}" data-final-input="${teacher.id}" class="soft-ring w-full rounded-2xl border border-slate-200 px-4 py-3 xl:max-w-xs" />
            <button type="button" data-action="save-final" data-teacher="${teacher.id}" class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700">حفظ</button>
          </div>
          <div class="mt-4">${actionButtons}</div>
        </div>
      `;
    }

    return `
      <article class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-soft fade-in">
        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-extrabold text-white">${index + 1}</span>
            <div>
              <h3 class="text-lg font-extrabold">${teacher.name}</h3>
              <div class="mt-1 flex flex-wrap gap-2">
                ${teacher.is_graduated ? '<span class="badge badge-success">خريج/ة /مجاز/ة</span>' : '<span class="badge badge-neutral">نشط</span>'}
                <span class="badge ${teacher.gender === "female" ? "badge-danger" : "badge-neutral"}">${teacher.gender === "female" ? "معلمة" : "معلم"}</span>
              </div>
            </div>
          </div>
          <div class="text-sm font-bold text-slate-500">${state.teacherViewMode === "report" ? formatPercent(teacher.metrics.finalResult) : ""}</div>
        </div>
        ${content}
      </article>
    `;
  }).join("");
}

function renderUsers() {
  const container = document.getElementById("users-list");
  if (!container) return;
  if (!state.users.length) {
    container.innerHTML = emptyState("لا يوجد مستخدمون.");
    return;
  }

  container.innerHTML = state.users.map((user) => `
    <div class="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
      <div>
        <div class="font-bold">${user.name}</div>
        <div class="text-sm text-slate-500">${user.username}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="badge badge-neutral">${user.role === "admin" ? "مدير" : user.role === "supervisor" ? (user.gender === "female" ? "مشرفة" : "مشرف") : (user.gender === "female" ? "مقرئة" : "مقرئ")}</span>
        ${user.gender ? `<span class="badge ${user.gender === "female" ? "badge-danger" : "badge-neutral"}">${user.gender === "female" ? "نساء" : "رجال"}</span>` : ""}
        ${state.user?.id !== user.id ? `<button type="button" data-action="delete-user" data-user="${user.id}" class="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">حذف</button>` : `<span class="text-xs text-slate-400">الحساب الحالي</span>`}
      </div>
    </div>
  `).join("");
}

function populatePeopleSelectors() {
  const readerSelect = document.getElementById("reader-select");
  const supervisorSelect = document.getElementById("supervisor-select");
  if (readerSelect) {
    const readers = state.user.role === "admin"
      ? state.readers.filter((reader) => !state.genderFilter || reader.gender === state.genderFilter)
      : state.readers.filter((reader) => reader.gender === state.user.gender);

    readerSelect.innerHTML = `<option value="">بدون ربط الآن</option>` + readers.map((reader) => `
      <option value="${reader.id}">${reader.name} — ${reader.gender === "female" ? "نساء" : "رجال"}</option>
    `).join("");
  }

  if (supervisorSelect) {
    supervisorSelect.innerHTML = `<option value="">اختر المشرف / المشرفة</option>` + state.supervisors.map((supervisor) => `
      <option value="${supervisor.id}">${supervisor.name} — ${supervisor.gender === "female" ? "نساء" : "رجال"}</option>
    `).join("");
  }
}

function applyTeacherMutation(teacherId, mutator) {
  [state.teachers, state.adminNamedReports.male, state.adminNamedReports.female].forEach((collection) => {
    const target = collection.find((item) => item.id === teacherId);
    if (target) {
      mutator(target);
      target.metrics = computeTeacherMetricsFromState(target);
    }
  });

  if (state.summary) state.summary = summarizeTeachers(state.teachers);
}

async function loadReferenceUsers() {
  if (state.user.role !== "admin" && state.user.role !== "supervisor") return;
  try {
    const response = await api("users-list");
    state.users = response.users || [];
    state.readers = state.users.filter((user) => user.role === "reader");
    state.supervisors = state.users.filter((user) => user.role === "supervisor");
    renderUsers();
    populatePeopleSelectors();
  } catch (error) {
    const usersList = document.getElementById("users-list");
    if (usersList) usersList.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">${error.message}</div>`;
  }
}

async function loadAdminNamedReports({ showSkeleton = false } = {}) {
  if (state.user?.role !== "admin") return;
  const maleEl = document.getElementById("admin-male-report-table");
  const femaleEl = document.getElementById("admin-female-report-table");
  if (showSkeleton) {
    if (maleEl) maleEl.innerHTML = teacherSkeleton(1);
    if (femaleEl) femaleEl.innerHTML = teacherSkeleton(1);
  }
  const [maleResponse, femaleResponse] = await Promise.all([
    api("teachers-list?gender=male"),
    api("teachers-list?gender=female")
  ]);
  state.adminNamedReports.male = maleResponse.teachers || [];
  state.adminNamedReports.female = femaleResponse.teachers || [];
  renderAdminNamedReports();
  renderAdminSplitSummaries();
  if (state.summary) renderSummaryGrid(state.summary);
}

async function loadDashboardData({ showSkeleton = true } = {}) {
  const summaryGrid = document.getElementById("summary-grid");
  const teachersList = document.getElementById("teachers-list");
  const isReader = state.user?.role === "reader";

  if (showSkeleton) {
    if (!isReader && summaryGrid) summaryGrid.innerHTML = summaryCardsSkeleton(4);
    if (teachersList) teachersList.innerHTML = teacherSkeleton(3);
  }

  const query = state.genderFilter ? `?gender=${encodeURIComponent(state.genderFilter)}` : "";

  if (isReader) {
    const teachersResponse = await api(`teachers-list${query}`);
    state.summary = null;
    state.teachers = teachersResponse.teachers || [];
    renderTeacherViewTabs();
    renderTeacherList();
    return;
  }

  const requests = [api(`reports-summary${query}`), api(`teachers-list${query}`)];
  if (state.user?.role === "admin") requests.push(loadAdminNamedReports({ showSkeleton }));

  const [summaryResponse, teachersResponse] = await Promise.all(requests);
  state.summary = summaryResponse.summary;
  state.teachers = teachersResponse.teachers || [];
  renderSummaryGrid(state.summary);
  renderTeacherViewTabs();
  renderTeacherList();
}

function refreshVisibleViews() {
  preserveViewport(() => {
    if (state.summary) renderSummaryGrid(state.summary);
    renderTeacherViewTabs();
    renderTeacherList();
    renderAdminNamedReports();
    renderAdminSplitSummaries();
  });
}

async function initIndexPage() {
  const statusBox = document.getElementById("status-box");
  const bootstrapForm = document.getElementById("bootstrap-form");
  const loginForm = document.getElementById("login-form");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  if (!statusBox || !bootstrapForm || !loginForm) return;

  if (state.token) {
    try {
      const me = await api("auth-me");
      if (me?.user) {
        window.location.href = "/app.html";
        return;
      }
    } catch {
      localStorage.removeItem("practitioner_token");
      state.token = "";
    }
  }

  try {
    const status = await api("auth-status");
    statusBox.innerHTML = `
      <div class="rounded-2xl ${status.needsBootstrap ? "bg-sky-50 text-sky-800 border-sky-100" : "bg-emerald-50 text-emerald-800 border-emerald-100"} border px-4 py-4 text-center text-sm">
        ${status.needsBootstrap ? "النظام جديد ولم يتم إنشاء أي مستخدم بعد." : "يمكنك تسجيل الدخول الآن."}
      </div>
    `;

    if (status.needsBootstrap) {
      authTitle.textContent = "إنشاء المدير الأول";
      authSubtitle.textContent = "أدخل بيانات المدير الأول فقط.";
      bootstrapForm.classList.remove("hidden-el");
    } else {
      authTitle.textContent = "تسجيل الدخول";
      authSubtitle.textContent = "أدخل اسم المستخدم وكلمة المرور.";
      loginForm.classList.remove("hidden-el");
    }
  } catch (error) {
    statusBox.innerHTML = `<div class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">${error.message}</div>`;
  }

  bootstrapForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    setLoginMessage("جارٍ إنشاء المدير الأول...");
    try {
      await api("auth-bootstrap", { method: "POST", body: JSON.stringify(body) });
      setLoginMessage("تم إنشاء المدير الأول. يمكنك تسجيل الدخول الآن.");
      bootstrapForm.classList.add("hidden-el");
      loginForm.classList.remove("hidden-el");
      authTitle.textContent = "تسجيل الدخول";
      authSubtitle.textContent = "أدخل الحساب الذي أنشأته قبل قليل.";
    } catch (error) {
      setLoginMessage(error.message, true);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    setLoginMessage("جارٍ تسجيل الدخول...");
    try {
      const result = await api("auth-login", { method: "POST", body: JSON.stringify(body) });
      state.token = result.token;
      localStorage.setItem("practitioner_token", result.token);
      window.location.href = "/app.html";
    } catch (error) {
      setLoginMessage(error.message, true);
    }
  });
}

function csvEscape(value) {
  const safe = value == null ? "" : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportAdminCsv(targetKey = "male") {
  const { filtered: list } = getAdminReportPrepared(targetKey);
  if (!list.length) {
    showToast("لا توجد بيانات للتصدير");
    return;
  }

  const header = [
    "م",
    "الاسم",
    "المشرف",
    "المقرئ",
    "نسبة الأجزاء",
    "نسبة الحضور",
    "نسبة الاختبارات",
    "نسبة المهام",
    "درجة النهائي",
    "النتيجة النهائية",
    "الحالة"
  ];

  const rows = [header, ...list.map((teacher, index) => [
    index + 1,
    teacher.name || "",
    teacher.supervisor_name || "",
    teacher.reader_name || "",
    formatPercent(teacher.metrics?.partsPercent),
    formatPercent(teacher.metrics?.attendancePercent),
    formatPercent(teacher.metrics?.testsPercent),
    formatPercent(teacher.metrics?.tasksPercent),
    formatPercent(teacher.metrics?.finalExamPercent),
    formatPercent(teacher.metrics?.finalResult),
    teacher.is_graduated ? "خريج/ة /مجاز/ة" : "نشط"
  ])];

  const filename = targetKey === "female" ? "بيان-المعلمات.csv" : "بيان-المعلمين.csv";
  downloadCsv(filename, rows);
}


async function initAppPage() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;

  if (!state.token) {
    window.location.href = "/";
    return;
  }

  try {
    const me = await api("auth-me");
    state.user = me.user;
  } catch {
    localStorage.removeItem("practitioner_token");
    window.location.href = "/";
    return;
  }

  document.getElementById("role-badge").textContent = currentRoleLabel(state.user);
  document.getElementById("welcome-title").textContent = `مرحبًا ${state.user.name}`;
  document.getElementById("welcome-subtitle").textContent =
    state.user.role === "admin"
      ? "يمكنك إدارة المستخدمين ومراجعة التقارير الكاملة وحذف البيانات عند الحاجة."
      : state.user.role === "supervisor"
        ? "يمكنك إدارة التابعين لك وتسجيل الحضور والاختبارات والمهام والنهائي."
        : "يمكنك إضافة المعلمين التابعين لك وتسجيل الأجزاء فقط، ولن تظهر لك الحالات المجازة.";

  if (state.user.role === "admin") {
    document.getElementById("admin-main-section")?.classList.remove("hidden-el");
    document.getElementById("admin-split-summary-section")?.classList.remove("hidden-el");
    document.getElementById("teacher-list-section")?.classList.add("hidden-el");
    document.getElementById("teacher-view-section")?.classList.add("hidden-el");
    document.getElementById("teacher-management-section")?.classList.add("hidden-el");
    document.getElementById("sidebar-add-teacher-btn")?.classList.add("hidden");
    document.getElementById("summary-circular")?.classList.add("hidden-el");
    document.getElementById("welcome-subtitle").textContent = "يمكنك الاطلاع على المؤشرات العامة وبيانات المعلمين والمعلمات وإدارة المستخدمين من الصفحة الرئيسية.";
  }

  if (state.user.role === "supervisor") {
    document.getElementById("main-summary-filter-wrap")?.classList.add("hidden");
  }

  if (state.user.role === "reader") {
    document.getElementById("reader-select-wrap")?.classList.add("hidden-el");
    document.getElementById("summary-grid")?.closest("section")?.classList.add("hidden-el");
    document.getElementById("summary-circular")?.classList.add("hidden-el");
    document.getElementById("gender-filter")?.closest("div")?.classList.add("hidden-el");
    document.getElementById("teacher-view-section")?.classList.add("hidden-el");
    document.getElementById("teacher-form-title").textContent = state.user.gender === "female" ? "إضافة معلمة تابعة لك" : "إضافة معلم تابع لك";
    document.getElementById("teacher-form-note").textContent = "سيتم ربط الاسم بك مباشرة كمقرئ/مقرئة.";
    document.getElementById("teacher-name-label").textContent = state.user.gender === "female" ? "اسم المعلمة" : "اسم المعلم";
    document.getElementById("teacher-submit-btn").textContent = state.user.gender === "female" ? "إضافة معلمة" : "إضافة معلم";
    document.getElementById("teacher-list-title").textContent = state.user.gender === "female" ? "المعلمات التابعات لك" : "المعلمون التابعون لك";
  } else if (state.user.role !== "admin") {
    document.getElementById("teacher-view-section")?.classList.remove("hidden-el");
  }

  const genderFilterEl = document.getElementById("gender-filter");
  if (genderFilterEl) genderFilterEl.value = state.genderFilter;

  await loadReferenceUsers();
  await loadDashboardData({ showSkeleton: true });

  const teacherSearchEl = document.getElementById("teacher-search");
  const teacherSortEl = document.getElementById("teacher-sort");
  if (teacherSearchEl) teacherSearchEl.value = state.teacherSearch;
  if (teacherSortEl) teacherSortEl.value = state.teacherSort;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("practitioner_token");
    state.token = "";
    window.location.href = "/";
  });

  document.getElementById("sidebar-toggle-btn")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebar-close-btn")?.addEventListener("click", closeSidebar);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  document.getElementById("sidebar-add-teacher-btn")?.addEventListener("click", () => {
    document.getElementById("teacher-management-section")?.classList.toggle("hidden-el");
  });

  document.getElementById("sidebar-refresh-btn")?.addEventListener("click", async () => {
    await loadDashboardData({ showSkeleton: false });
    if (state.user.role === "admin") await loadReferenceUsers();
    showToast("تم تحديث البيانات");
  });





  document.querySelectorAll("[data-export-target]").forEach((button) => {
    button.addEventListener("click", () => exportAdminCsv(button.dataset.exportTarget));
  });

  document.getElementById("admin-main-section")?.addEventListener("click", (event) => {
    const sortButton = event.target.closest("button[data-admin-sort-target]");
    if (sortButton) {
      const targetKey = sortButton.dataset.adminSortTarget;
      state.adminReportFilters[targetKey].sort = sortButton.dataset.sortValue || "name_asc";
      state.adminReportFilters[targetKey].page = 1;
      const linkedSelect = document.getElementById(`admin-${targetKey}-sort`);
      if (linkedSelect) linkedSelect.value = state.adminReportFilters[targetKey].sort;
      renderAdminNamedReports();
      return;
    }

    const pageButton = event.target.closest("button[data-admin-page-target]");
    if (pageButton) {
      const targetKey = pageButton.dataset.adminPageTarget;
      const action = pageButton.dataset.pageAction;
      const prepared = getAdminReportPrepared(targetKey);
      if (action === "prev") state.adminReportFilters[targetKey].page = Math.max(1, prepared.currentPage - 1);
      if (action === "next") state.adminReportFilters[targetKey].page = Math.min(prepared.totalPages, prepared.currentPage + 1);
      if (action === "go") state.adminReportFilters[targetKey].page = Number(pageButton.dataset.pageNumber || 1);
      renderAdminNamedReports();
    }
  });

  document.getElementById("admin-main-section")?.addEventListener("change", (event) => {
    const pageSizeSelect = event.target.closest("select[data-admin-pagesize-target]");
    if (!pageSizeSelect) return;
    const targetKey = pageSizeSelect.dataset.adminPagesizeTarget;
    state.adminReportFilters[targetKey].pageSize = Number(pageSizeSelect.value || 10);
    state.adminReportFilters[targetKey].page = 1;
    renderAdminNamedReports();
  });

  document.getElementById("refresh-btn")?.addEventListener("click", async () => {
    await loadDashboardData({ showSkeleton: false });
    if (state.user.role === "admin") await loadReferenceUsers();
    showToast("تم تحديث البيانات");
  });

  document.getElementById("gender-filter")?.addEventListener("change", async (event) => {
    state.genderFilter = event.target.value;
    populatePeopleSelectors();
    await loadDashboardData({ showSkeleton: false });
  });

  document.getElementById("teacher-search")?.addEventListener("input", (event) => {
    state.teacherSearch = event.target.value;
    preserveViewport(() => renderTeacherList());
  });

  document.getElementById("teacher-sort")?.addEventListener("change", (event) => {
    state.teacherSort = event.target.value;
    preserveViewport(() => renderTeacherList());
  });

  document.getElementById("admin-male-search")?.addEventListener("input", (event) => {
    state.adminReportFilters.male.search = event.target.value;
    state.adminReportFilters.male.page = 1;
    renderAdminNamedReports();
  });

  document.getElementById("admin-male-sort")?.addEventListener("change", (event) => {
    state.adminReportFilters.male.sort = event.target.value;
    state.adminReportFilters.male.page = 1;
    renderAdminNamedReports();
  });

  document.getElementById("admin-female-search")?.addEventListener("input", (event) => {
    state.adminReportFilters.female.search = event.target.value;
    state.adminReportFilters.female.page = 1;
    renderAdminNamedReports();
  });

  document.getElementById("admin-female-sort")?.addEventListener("change", (event) => {
    state.adminReportFilters.female.sort = event.target.value;
    state.adminReportFilters.female.page = 1;
    renderAdminNamedReports();
  });

  document.getElementById("teacher-view-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view-mode]");
    if (!button) return;
    state.teacherViewMode = button.dataset.viewMode;
    preserveViewport(() => {
      renderTeacherViewTabs();
      renderTeacherList();
    });
  });


  document.getElementById("teacher-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      await api("teachers-create", { method: "POST", body: JSON.stringify(body) });
      window.location.reload();
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById("user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    if (body.role === "admin") body.gender = null;

    try {
      await api("users-create", { method: "POST", body: JSON.stringify(body) });
      event.currentTarget.reset();
      await loadReferenceUsers();
      showToast("تم إنشاء المستخدم");
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById("user-role")?.addEventListener("change", (event) => {
    const genderField = document.getElementById("user-gender");
    if (!genderField) return;
    if (event.target.value === "admin") {
      genderField.value = "male";
      genderField.disabled = true;
      genderField.classList.add("opacity-60");
    } else {
      genderField.disabled = false;
      genderField.classList.remove("opacity-60");
    }
  });

  document.getElementById("supervisor-select")?.addEventListener("change", (event) => {
    const supervisor = state.supervisors.find((item) => item.id === event.target.value);
    const readerSelect = document.getElementById("reader-select");
    if (!readerSelect || !supervisor) return populatePeopleSelectors();
    const matchedReaders = state.readers.filter((reader) => reader.gender === supervisor.gender);
    readerSelect.innerHTML = `<option value="">بدون ربط الآن</option>` + matchedReaders.map((reader) => `
      <option value="${reader.id}">${reader.name} — ${reader.gender === "female" ? "نساء" : "رجال"}</option>
    `).join("");
  });

  document.getElementById("teachers-list")?.addEventListener("input", (event) => {
    const pinInput = event.target.closest("input[data-pin-input]");
    if (!pinInput) return;
    pinInput.value = String(pinInput.value || "").replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("teachers-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const teacherId = button.dataset.teacher;
    setButtonBusy(button, true);

    try {
      if (action === "toggle-part") {
        const partNumber = Number(button.dataset.part);
        await api("recitations-toggle", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, part_number: partNumber }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.recitations = teacher.recitations || {};
          teacher.recitations[partNumber] = !teacher.recitations[partNumber];
        });
        refreshVisibleViews();
        showToast("تم تحديث الجزء");
      }

      if (action === "toggle-attendance") {
        const day = Number(button.dataset.day);
        const field = button.dataset.kind;
        await api("attendance-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, day, field }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.attendance = teacher.attendance || {};
          teacher.attendance[day] = teacher.attendance[day] || { present: false, pre_test: false, post_test: false };
          teacher.attendance[day][field] = !teacher.attendance[day][field];
        });
        refreshVisibleViews();
        showToast("تم تحديث اليوم");
      }

      if (action === "toggle-task") {
        const taskNumber = Number(button.dataset.task);
        await api("tasks-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, task_number: taskNumber }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.tasks = teacher.tasks || {};
          teacher.tasks[taskNumber] = !teacher.tasks[taskNumber];
        });
        refreshVisibleViews();
        showToast("تم تحديث المهمة");
      }

      if (action === "save-public-pin") {
        const pinInput = document.querySelector(`[data-pin-input="${teacherId}"]`);
        const pin = String(pinInput?.value || "").trim();

        if (!/^\d{4}$/.test(pin)) {
          throw new Error("رمز الدخول يجب أن يكون 4 أرقام");
        }

        await api("teachers-update", {
          method: "POST",
          body: JSON.stringify({ teacher_id: teacherId, public_pin: pin })
        });

        applyTeacherMutation(teacherId, (teacher) => {
          teacher.public_pin = pin;
        });

        refreshVisibleViews();
        showToast("تم حفظ رمز الدخول");
      }

      if (action === "save-reader") {
        const readerInput = document.querySelector(`[data-reader-input="${teacherId}"]`);
        const nextReaderId = String(readerInput?.value || "").trim();

        await api("teachers-update", {
          method: "POST",
          body: JSON.stringify({ teacher_id: teacherId, reader_id: nextReaderId })
        });

        const selectedReader = nextReaderId
          ? state.readers.find((reader) => reader.id === nextReaderId)
          : null;

        applyTeacherMutation(teacherId, (teacher) => {
          teacher.reader_id = nextReaderId || null;
          teacher.reader_name = selectedReader?.name || null;
        });

        refreshVisibleViews();
        showToast(nextReaderId ? "تم نقل المعلم/المعلمة إلى المقرئ/المقرئة" : "تم إزالة ربط المقرئ/المقرئة");
      }

      if (action === "toggle-graduated") {
        const targetTeacher = state.teachers.find((item) => item.id === teacherId) || state.adminNamedReports.male.find((item) => item.id === teacherId) || state.adminNamedReports.female.find((item) => item.id === teacherId);
        await api("teachers-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, is_graduated: !targetTeacher?.is_graduated }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.is_graduated = !teacher.is_graduated;
        });
        refreshVisibleViews();
        showToast("تم تحديث حالة الإجازة");
      }

      if (action === "delete-teacher") {
        if (!confirm("هل أنت متأكد من حذف المعلم / المعلمة؟")) return;
        await api("teachers-delete", { method: "POST", body: JSON.stringify({ teacher_id: teacherId }) });
        state.teachers = state.teachers.filter((item) => item.id !== teacherId);
        state.adminNamedReports.male = state.adminNamedReports.male.filter((item) => item.id !== teacherId);
        state.adminNamedReports.female = state.adminNamedReports.female.filter((item) => item.id !== teacherId);
        if (state.summary) state.summary = summarizeTeachers(state.teachers);
        refreshVisibleViews();
        showToast("تم حذف السجل");
      }

      if (action === "save-final") {
        const input = document.querySelector(`[data-final-input="${teacherId}"]`);
        const value = Number(input?.value || 0);
        await api("final-exam-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, score: value }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.final_score = value;
        });
        refreshVisibleViews();
        showToast("تم حفظ النهائي");
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  document.getElementById("users-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='delete-user']");
    if (!button) return;
    if (!confirm("هل أنت متأكد من حذف المستخدم؟")) return;

    try {
      await api("users-delete", { method: "POST", body: JSON.stringify({ user_id: button.dataset.user }) });
      await loadReferenceUsers();
      showToast("تم حذف المستخدم");
    } catch (error) {
      showToast(error.message);
    }
  });
}

function publicBlockHtml(group) {
  return `
    <div class="space-y-4 fade-in">
      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
        <div class="text-sm text-slate-500">الإجمالي</div>
        <div class="mt-2 text-3xl font-extrabold">${group.totalTeachers}</div>
      </div>
      <div class="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        ${progressHtml("الأجزاء", group.averageParts)}
        ${progressHtml("الاختبارات", group.averageTests)}
        ${progressHtml("المهام", group.averageTasks)}
        ${progressHtml("النهائي", group.averageFinalExam)}
        ${progressHtml("النتيجة النهائية", group.averageFinalResult)}
      </div>
    </div>
  `;
}

function chipsHtml(numbers = [], prefix = "") {
  if (!numbers.length) {
    return `<span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">مكتمل</span>`;
  }
  return numbers.map((number) => `
    <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">${prefix ? `${prefix} ` : ""}${number}</span>
  `).join("");
}

function initTeacherPublicPage() {
  const form = document.getElementById("teacher-pin-form");
  const input = document.getElementById("teacher-pin-input");
  const messageEl = document.getElementById("teacher-pin-message");
  const resultWrap = document.getElementById("teacher-public-result");
  if (!form || !input || !messageEl || !resultWrap) return;

  const setMessage = (message, isError = false) => {
    messageEl.textContent = message || "";
    messageEl.className = `mt-3 text-sm font-medium ${isError ? "text-rose-600" : "text-slate-500"}`;
  };

  input.addEventListener("input", () => {
    input.value = String(input.value || "").replace(/\D/g, "").slice(0, 4);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = String(input.value || "").replace(/\D/g, "").slice(0, 4);
    input.value = pin;

    if (!/^\d{4}$/.test(pin)) {
      setMessage("أدخل رمزًا مكوّنًا من 4 أرقام.", true);
      return;
    }

    setMessage("جارٍ تحميل بياناتك...");
    resultWrap.innerHTML = teacherSkeleton(1);

    try {
      const result = await api("teacher-public-lookup", {
        method: "POST",
        body: JSON.stringify({ pin })
      });

      const teacher = result.teacher || {};
      const pending = result.pending || {};

      const pendingCards = [
        { label: "الأجزاء المتبقية", count: (pending.missingParts || []).length },
        { label: "أيام حضور غير مكتملة", count: (pending.missingAttendance || []).length },
        { label: "اختبارات قبلية غير مكتملة", count: (pending.missingPreTests || []).length },
        { label: "اختبارات بعدية غير مكتملة", count: (pending.missingPostTests || []).length },
        { label: "المهام المتبقية", count: (pending.missingTasks || []).length },
        { label: "الاختبار النهائي", count: pending.hasFinalExam ? 0 : 1 }
      ];

      resultWrap.innerHTML = `
        <section class="glass-card rounded-[2rem] p-5 md:p-6 fade-in">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl font-extrabold">${teacher.name || "—"}</h2>
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="badge ${teacher.gender === "female" ? "badge-danger" : "badge-neutral"}">${teacher.gender === "female" ? "معلمة" : "معلم"}</span>
                ${teacher.is_graduated ? '<span class="badge badge-success">خريج/ة /مجاز/ة</span>' : '<span class="badge badge-neutral">نشط</span>'}
              </div>
              <div class="mt-3 text-sm text-slate-600">المشرف: <span class="font-bold text-slate-900">${teacher.supervisor_name || "—"}</span></div>
              <div class="mt-1 text-sm text-slate-600">المقرئ: <span class="font-bold text-slate-900">${teacher.reader_name || "—"}</span></div>
            </div>
            <div class="rounded-3xl border border-slate-200 bg-white p-4 text-center">
              <div class="text-xs text-slate-500">النتيجة النهائية</div>
              <div class="mt-2 text-3xl font-extrabold text-slate-900">${formatPercent(teacher.metrics?.finalResult)}</div>
            </div>
          </div>

          <div class="mt-5 grid gap-3 md:grid-cols-2">
            ${progressHtml("الأجزاء", teacher.metrics?.partsPercent)}
            ${progressHtml("الحضور", teacher.metrics?.attendancePercent)}
            ${progressHtml("الاختبارات", teacher.metrics?.testsPercent)}
            ${progressHtml("المهام", teacher.metrics?.tasksPercent)}
            ${progressHtml("النهائي", teacher.metrics?.finalExamPercent)}
            ${progressHtml("النتيجة النهائية", teacher.metrics?.finalResult)}
          </div>
        </section>

        <section class="glass-card rounded-[2rem] p-5 md:p-6">
          <div class="section-title">
            <h2>ما لم يُنجز بعد</h2>
            <span class="text-xs text-slate-500">قائمة البنود المتبقية</span>
          </div>
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            ${pendingCards.map((item) => `
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="text-xs font-semibold text-slate-500">${item.label}</div>
                <div class="mt-2 text-2xl font-extrabold ${item.count ? "text-rose-600" : "text-emerald-600"}">${item.count}</div>
              </div>
            `).join("")}
          </div>

          <div class="mt-5 space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">الأجزاء غير المنجزة</div>
              <div class="flex flex-wrap gap-2">${chipsHtml(pending.missingParts, "جزء")}</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">أيام الحضور غير المسجلة</div>
              <div class="flex flex-wrap gap-2">${chipsHtml(pending.missingAttendance, "يوم")}</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">الاختبارات القبلية غير المنجزة</div>
              <div class="flex flex-wrap gap-2">${chipsHtml(pending.missingPreTests, "يوم")}</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">الاختبارات البعدية غير المنجزة</div>
              <div class="flex flex-wrap gap-2">${chipsHtml(pending.missingPostTests, "يوم")}</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">المهام غير المنجزة</div>
              <div class="flex flex-wrap gap-2">${chipsHtml(pending.missingTasks, "مهمة")}</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="mb-2 text-sm font-bold text-slate-800">الاختبار النهائي</div>
              ${pending.hasFinalExam
                ? '<span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">تم إدخال الدرجة</span>'
                : '<span class="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">لم يتم إدخال الدرجة بعد</span>'}
            </div>
          </div>
        </section>
      `;

      setMessage("تم تحميل بياناتك بنجاح.");
    } catch (error) {
      resultWrap.innerHTML = "";
      setMessage(error.message || "تعذر تحميل البيانات", true);
    }
  });
}

async function initPublicPage() {
  const refreshBtn = document.getElementById("public-refresh-btn");
  if (!refreshBtn) return;

  async function loadPublic() {
    const grid = document.getElementById("public-summary-grid");
    const male = document.getElementById("public-male");
    const female = document.getElementById("public-female");
    const comparison = document.getElementById("public-comparison");

    grid.innerHTML = summaryCardsSkeleton(4);
    male.innerHTML = teacherSkeleton(1);
    female.innerHTML = teacherSkeleton(1);
    comparison.innerHTML = teacherSkeleton(1);

    try {
      const result = await api("public-reports");
      const { overall, male: maleGroup, female: femaleGroup } = result;

      grid.innerHTML = [
        { label: "إجمالي الأسماء", value: overall.totalTeachers, progress: overall.averageFinalResult },
        { label: "المجازون / المجازات", value: overall.graduatedCount, progress: overall.averageParts },
        { label: "متوسط الأداء", value: formatPercent(overall.averageFinalResult), progress: overall.averageFinalResult },
        { label: "متوسط النهائي", value: formatPercent(overall.averageFinalExam), progress: overall.averageFinalExam }
      ].map((item) => `
        <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div class="metric-label">${item.label}</div>
          <div class="mt-3 text-3xl font-extrabold">${item.value}</div>
          <div class="mt-4">${progressHtml("المؤشر", item.progress)}</div>
        </div>
      `).join("");

      male.innerHTML = publicBlockHtml(maleGroup);
      female.innerHTML = publicBlockHtml(femaleGroup);
      comparison.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
            <div class="text-sm text-slate-500">فرق متوسط النتيجة النهائية</div>
            <div class="mt-2 text-3xl font-extrabold">${Math.round((maleGroup.averageFinalResult || 0) - (femaleGroup.averageFinalResult || 0))}٪</div>
          </div>
          <div class="grid gap-3">
            ${circularHtml("الرجال", maleGroup.averageFinalResult)}
            ${circularHtml("النساء", femaleGroup.averageFinalResult)}
          </div>
        </div>
      `;
    } catch (error) {
      const html = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">${error.message}</div>`;
      male.innerHTML = html;
      female.innerHTML = html;
      comparison.innerHTML = html;
    }
  }

  refreshBtn.addEventListener("click", loadPublic);
  await loadPublic();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("login-state")) await initIndexPage();
  if (document.getElementById("logout-btn")) await initAppPage();
  if (document.getElementById("public-refresh-btn")) await initPublicPage();
  if (document.getElementById("teacher-pin-form")) initTeacherPublicPage();
});

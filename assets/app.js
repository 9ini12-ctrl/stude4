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
  adminDrawerView: "summary",
  activityFeed: []
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

const ACTIVITY_STORAGE_KEY = "practitioner_activity_feed";

function isDesktopSidebar() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function readStoredActivities() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredActivities(items) {
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify((items || []).slice(0, 18)));
}

function pushActivity(message) {
  if (!message) return;
  const entry = { id: Date.now() + Math.random(), message, createdAt: new Date().toISOString() };
  const next = [entry, ...readStoredActivities()].slice(0, 18);
  saveStoredActivities(next);
  state.activityFeed = next;
}

function relativeTimeArabic(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

function buildDerivedActivities(teachers = []) {
  const items = [];
  teachers.slice(0, 10).forEach((teacher) => {
    const parts = Object.entries(teacher.recitations || {}).filter(([, done]) => done).map(([part]) => Number(part));
    if (parts.length) {
      items.push({ id: `${teacher.id}-part`, message: `${teacher.name} اجتاز جزء رقم ${Math.max(...parts)}`, createdAt: teacher.created_at || new Date().toISOString() });
    }
    const attendanceDays = Object.entries(teacher.attendance || {}).filter(([, row]) => row?.present).map(([day]) => Number(day));
    if (attendanceDays.length) {
      items.push({ id: `${teacher.id}-attendance`, message: `${teacher.name} سجل حضور اليوم ${Math.max(...attendanceDays)}`, createdAt: teacher.created_at || new Date().toISOString() });
    }
    const tasks = Object.entries(teacher.tasks || {}).filter(([, done]) => done).map(([task]) => Number(task));
    if (tasks.length) {
      items.push({ id: `${teacher.id}-task`, message: `${teacher.name} أنجز المهمة الأدائية رقم ${Math.max(...tasks)}`, createdAt: teacher.created_at || new Date().toISOString() });
    }
  });
  return items.slice(0, 8);
}

function renderActivityFeed() {
  const container = document.getElementById("activity-feed");
  if (!container) return;
  const merged = [...readStoredActivities(), ...buildDerivedActivities(state.teachers)]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((item, index, arr) => arr.findIndex((x) => x.message === item.message) === index)
    .slice(0, 6);

  state.activityFeed = merged;

  if (!merged.length) {
    container.innerHTML = emptyState("ستظهر هنا آخر التحديثات البسيطة عند تسجيل الحضور أو الأجزاء أو إضافة الأسماء.");
    return;
  }

  container.innerHTML = merged.map((item) => `
    <div class="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
      <div class="flex items-start gap-3">
        <span class="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-500"></span>
        <p class="text-sm font-medium leading-7 text-slate-700">${item.message}</p>
      </div>
      <span class="whitespace-nowrap text-xs font-bold text-slate-400">${relativeTimeArabic(item.createdAt)}</span>
    </div>
  `).join("");
}

function renderPublicActivityFeed() {
  const container = document.getElementById("public-activity-feed");
  if (!container) return;
  const items = readStoredActivities().slice(0, 5);
  if (!items.length) {
    container.innerHTML = emptyState("ستظهر هنا آخر التحديثات العامة بعد بدء استخدام المنصة.");
    return;
  }
  container.innerHTML = items.map((item) => `
    <div class="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
      <div class="flex items-start gap-3">
        <span class="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-500"></span>
        <p class="text-sm font-medium leading-7 text-slate-700">${item.message}</p>
      </div>
      <span class="whitespace-nowrap text-xs font-bold text-slate-400">${relativeTimeArabic(item.createdAt)}</span>
    </div>
  `).join("");
}

function teacherNameById(teacherId) {
  return state.teachers.find((item) => item.id === teacherId)?.name
    || state.adminNamedReports.male.find((item) => item.id === teacherId)?.name
    || state.adminNamedReports.female.find((item) => item.id === teacherId)?.name
    || "أحد المعلمين";
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

function renderSummaryGrid(summary) {
  const renderCards = (gridId) => {
    const grid = document.getElementById(gridId);
    if (!grid || !summary) return;
    const cards = [
      { label: "إجمالي الأسماء", value: summary.totalTeachers, progress: summary.averageFinalResult },
      { label: "المجازون / المجازات", value: summary.graduatedCount, progress: summary.averageParts },
      { label: "متوسط الأداء", value: formatPercent(summary.averageFinalResult), progress: summary.averageFinalResult },
      { label: "متوسط النهائي", value: formatPercent(summary.averageFinalExam), progress: summary.averageFinalExam }
    ];

    grid.innerHTML = cards.map((item) => `
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft fade-in">
        <div class="metric-label">${item.label}</div>
        <div class="mt-3 text-3xl font-extrabold">${item.value}</div>
        <div class="mt-4">${progressHtml("المؤشر", item.progress)}</div>
      </div>
    `).join("");
  };

  const renderCircular = (wrapId) => {
    const circularWrap = document.getElementById(wrapId);
    if (!circularWrap || !summary) return;
    circularWrap.innerHTML = `
      ${circularHtml("الأجزاء", summary.averageParts)}
      ${circularHtml("الاختبارات", summary.averageTests)}
      ${circularHtml("المهام", summary.averageTasks)}
    `;
  };

  renderCards("summary-grid");
  renderCards("admin-summary-grid");
  renderCircular("summary-circular");
  renderCircular("admin-summary-circular");
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

function reportTableHtml(teachers, label) {
  if (!teachers.length) return emptyState("لا توجد بيانات.");
  return `
    <div class="space-y-4">
      <div class="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">${label}</div>
      <div class="overflow-x-auto rounded-3xl border border-slate-200">
        <table class="min-w-[1100px] w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="px-4 py-3 text-right font-bold">#</th>
              <th class="px-4 py-3 text-right font-bold">الاسم</th>
              <th class="px-4 py-3 text-right font-bold">المشرف</th>
              <th class="px-4 py-3 text-right font-bold">المقرئ</th>
              <th class="px-4 py-3 text-right font-bold">الأجزاء</th>
              <th class="px-4 py-3 text-right font-bold">الحضور</th>
              <th class="px-4 py-3 text-right font-bold">الاختبارات</th>
              <th class="px-4 py-3 text-right font-bold">المهام</th>
              <th class="px-4 py-3 text-right font-bold">النهائي</th>
              <th class="px-4 py-3 text-right font-bold">النتيجة النهائية</th>
              <th class="px-4 py-3 text-right font-bold">الحالة</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${teachers.map((teacher, index) => `
              <tr>
                <td class="px-4 py-3 font-semibold text-slate-500">${index + 1}</td>
                <td class="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">${teacher.name}</td>
                <td class="px-4 py-3 whitespace-nowrap">${teacher.supervisor_name || "—"}</td>
                <td class="px-4 py-3 whitespace-nowrap">${teacher.reader_name || "—"}</td>
                <td class="px-4 py-3 whitespace-nowrap">${formatPercent(teacher.metrics?.partsPercent)}</td>
                <td class="px-4 py-3 whitespace-nowrap">${formatPercent(teacher.metrics?.attendancePercent)}</td>
                <td class="px-4 py-3 whitespace-nowrap">${formatPercent(teacher.metrics?.testsPercent)}</td>
                <td class="px-4 py-3 whitespace-nowrap">${formatPercent(teacher.metrics?.tasksPercent)}</td>
                <td class="px-4 py-3 whitespace-nowrap">${formatPercent(teacher.metrics?.finalExamPercent)}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${resultTone(teacher.metrics?.finalResult)}">${formatPercent(teacher.metrics?.finalResult)}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">${teacher.is_graduated ? '<span class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">مجاز / مجازة</span>' : '<span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">نشط</span>'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminNamedReports() {
  const maleEl = document.getElementById("admin-male-report-table");
  const femaleEl = document.getElementById("admin-female-report-table");
  if (!maleEl || !femaleEl) return;
  maleEl.innerHTML = reportTableHtml((state.adminNamedReports.male || []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar")), "بيان تفصيلي للمعلمين");
  femaleEl.innerHTML = reportTableHtml((state.adminNamedReports.female || []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar")), "بيان تفصيلي للمعلمات");
}

function openSidebar() {
  if (isDesktopSidebar()) return;
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
  if (isDesktopSidebar()) return;
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("translate-x-full", "pointer-events-none");
  backdrop.classList.add("pointer-events-none", "opacity-0");
  sidebar.setAttribute("aria-hidden", "true");
  toggleBtn?.setAttribute("aria-expanded", "false");
}

function syncSidebarForViewport() {
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  if (!sidebar || !backdrop) return;
  if (isDesktopSidebar()) {
    sidebar.classList.remove("translate-x-full", "pointer-events-none");
    backdrop.classList.add("pointer-events-none", "opacity-0");
    sidebar.setAttribute("aria-hidden", "false");
    toggleBtn?.setAttribute("aria-expanded", "true");
  } else {
    sidebar.classList.add("translate-x-full", "pointer-events-none");
    backdrop.classList.add("pointer-events-none", "opacity-0");
    sidebar.setAttribute("aria-hidden", "true");
    toggleBtn?.setAttribute("aria-expanded", "false");
  }
}

function toggleSidebar() {
  if (isDesktopSidebar()) return;
  const sidebar = document.getElementById("app-sidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("translate-x-full")) {
    openSidebar();
  } else {
    closeSidebar();
  }
}

function openAdminDrawer(view) {
  state.adminDrawerView = view;
  const drawer = document.getElementById("admin-drawer");
  if (!drawer) return;
  drawer.classList.remove("hidden");
  updateAdminDrawerView();
  openSidebar();
}

function closeAdminDrawer() {
  const drawer = document.getElementById("admin-drawer");
  if (!drawer) return;
  drawer.classList.add("hidden");
  state.adminDrawerView = "";
  updateAdminDrawerView();
}

function updateAdminDrawerView() {
  const map = {
    summary: "المؤشرات الرئيسية",
    male: "بيان المعلمين",
    female: "بيان المعلمات",
    users: "إدارة المستخدمين"
  };
  const titleEl = document.getElementById("admin-drawer-title");
  if (titleEl) titleEl.textContent = map[state.adminDrawerView] || "لوحة الإدارة";
  document.querySelectorAll("[data-admin-panel]").forEach((el) => {
    el.classList.toggle("hidden", !state.adminDrawerView || el.dataset.adminPanel !== state.adminDrawerView);
  });
  document.querySelectorAll("[data-admin-drawer-btn]").forEach((btn) => {
    const active = btn.dataset.adminDrawerBtn === state.adminDrawerView;
    btn.className = `w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`;
  });
}

function renderTeacherList() {
  const container = document.getElementById("teachers-list");
  const title = document.getElementById("teacher-list-title");
  const note = document.getElementById("teacher-list-note");
  if (!container) return;

  if (!state.teachers.length) {
    container.innerHTML = emptyState("لا توجد بيانات مطابقة حاليًا.");
    return;
  }

  if (state.user?.role === "admin") {
    title.textContent = "التقارير العامة";
    if (note) note.textContent = "عرض عام فقط بدون تعديل على بيانات المعلمين.";
    container.innerHTML = reportTableHtml(state.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, "ar")), "تقرير عام للأسماء المعروضة");
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

  const teachersSorted = state.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));

  container.innerHTML = teachersSorted.map((teacher, index) => {
    const canManage = state.user.role === "admin" || state.user.role === "supervisor";
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

    const actionButtons = `
      <div class="flex flex-wrap gap-2">
        ${canManage ? `<button type="button" data-action="toggle-graduated" data-teacher="${teacher.id}" class="rounded-2xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">${teacher.is_graduated ? "إلغاء المجاز" : "اعتماد مجاز"}</button>` : ""}
        ${(state.user.role === "admin" || state.user.role === "supervisor") ? `<button type="button" data-action="delete-teacher" data-teacher="${teacher.id}" class="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">حذف</button>` : ""}
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
                ${teacher.is_graduated ? '<span class="badge badge-success">مجاز / مجازة</span>' : '<span class="badge badge-neutral">نشط</span>'}
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
    renderActivityFeed();
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
  renderActivityFeed();
}

function refreshVisibleViews() {
  preserveViewport(() => {
    if (state.summary) renderSummaryGrid(state.summary);
    renderTeacherViewTabs();
    renderTeacherList();
    renderAdminNamedReports();
    updateAdminDrawerView();
    renderActivityFeed();
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

async function exportAdminPdf(targetId = "admin-male-export-area") {
  const area = document.getElementById(targetId);
  if (!area) return;
  if (typeof html2pdf === "undefined") {
    showToast("تعذر تحميل أداة التصدير");
    return;
  }
  await html2pdf().set({
    margin: 8,
    filename: `${targetId}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
  }).from(area).save();
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

  syncSidebarForViewport();
  window.addEventListener("resize", syncSidebarForViewport);

  document.getElementById("role-badge").textContent = currentRoleLabel(state.user);
  document.getElementById("welcome-title").textContent = `مرحبًا ${state.user.name}`;
  document.getElementById("welcome-subtitle").textContent =
    state.user.role === "admin"
      ? "واجهة الإدارة مخصصة للتقارير العامة والمتابعة فقط."
      : state.user.role === "supervisor"
        ? "يمكنك إدارة التابعين لك وتسجيل الحضور والاختبارات والمهام والنهائي."
        : "يمكنك إضافة المعلمين التابعين لك وتسجيل الأجزاء فقط، ولن تظهر لك الحالات المجازة.";

  if (state.user.role === "admin") {
    document.getElementById("admin-sidebar-menu")?.classList.remove("hidden");
    document.getElementById("sidebar-add-teacher-btn")?.classList.add("hidden");
    document.getElementById("teacher-management-section")?.classList.add("hidden-el");
    document.getElementById("teacher-view-section")?.classList.add("hidden-el");
    document.getElementById("welcome-subtitle").textContent = "لوحة الإدارة تعرض المؤشرات والبيانات التفصيلية فقط بدون تعديل مباشر على بيانات المعلمين.";
    state.adminDrawerView = "summary";
    document.getElementById("admin-drawer")?.classList.remove("hidden");
    updateAdminDrawerView();
  }

  if (state.user.role === "supervisor") {
    document.getElementById("main-summary-filter-wrap")?.classList.add("hidden");
  }

  if (state.user.role === "reader") {
    document.getElementById("reader-select-wrap")?.classList.add("hidden-el");
    document.getElementById("summary-grid")?.closest("section")?.classList.add("hidden-el");
    document.getElementById("summary-circular")?.classList.add("hidden-el");
    document.getElementById("main-summary-actions")?.classList.add("hidden-el");
    document.getElementById("teacher-view-section")?.classList.add("hidden-el");
    document.getElementById("teacher-form-title").textContent = state.user.gender === "female" ? "إضافة معلمة تابعة لك" : "إضافة معلم تابع لك";
    document.getElementById("teacher-form-note").textContent = "سيتم ربط الاسم بك مباشرة كمقرئ/مقرئة.";
    document.getElementById("teacher-name-label").textContent = state.user.gender === "female" ? "اسم المعلمة" : "اسم المعلم";
    document.getElementById("teacher-submit-btn").textContent = state.user.gender === "female" ? "إضافة معلمة" : "إضافة معلم";
    document.getElementById("teacher-list-title").textContent = state.user.gender === "female" ? "المعلمات التابعات لك" : "المعلمون التابعون لك";
  } else if (state.user.role !== "admin") {
    document.getElementById("teacher-view-section")?.classList.remove("hidden-el");
  }

  document.getElementById("gender-filter").value = state.genderFilter;
  if (document.getElementById("admin-gender-filter")) document.getElementById("admin-gender-filter").value = state.genderFilter;

  await loadReferenceUsers();
  await loadDashboardData({ showSkeleton: true });
  renderActivityFeed();

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
    renderActivityFeed();
    showToast("تم تحديث البيانات");
  });

  document.querySelectorAll("[data-admin-drawer-btn]").forEach((button) => {
    button.addEventListener("click", () => openAdminDrawer(button.dataset.adminDrawerBtn));
  });

  document.getElementById("admin-drawer-close")?.addEventListener("click", closeSidebar);

  document.getElementById("admin-refresh-btn")?.addEventListener("click", async () => {
    await loadDashboardData({ showSkeleton: false });
    if (state.user.role === "admin") await loadReferenceUsers();
    renderActivityFeed();
    showToast("تم تحديث البيانات");
  });

  document.getElementById("admin-gender-filter")?.addEventListener("change", async (event) => {
    state.genderFilter = event.target.value;
    const mainGenderFilter = document.getElementById("gender-filter");
    if (mainGenderFilter) mainGenderFilter.value = state.genderFilter;
    populatePeopleSelectors();
    await loadDashboardData({ showSkeleton: false });
  });

  document.querySelectorAll("[data-export-target]").forEach((button) => {
    button.addEventListener("click", () => exportAdminPdf(button.dataset.exportTarget));
  });

  document.getElementById("refresh-btn")?.addEventListener("click", async () => {
    await loadDashboardData({ showSkeleton: false });
    if (state.user.role === "admin") await loadReferenceUsers();
    renderActivityFeed();
    showToast("تم تحديث البيانات");
  });

  document.getElementById("gender-filter")?.addEventListener("change", async (event) => {
    state.genderFilter = event.target.value;
    const adminGenderFilter = document.getElementById("admin-gender-filter");
    if (adminGenderFilter) adminGenderFilter.value = state.genderFilter;
    populatePeopleSelectors();
    await loadDashboardData({ showSkeleton: false });
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
      pushActivity(`${state.user.name} أضاف ${state.user.gender === "female" ? "معلمة" : "معلمًا"}: ${body.name}`);
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
      renderActivityFeed();
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

  document.getElementById("teachers-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const teacherId = button.dataset.teacher;
    setButtonBusy(button, true);

    try {
      if (action === "toggle-part") {
        const partNumber = Number(button.dataset.part);
        const wasActive = state.teachers.find((item) => item.id === teacherId)?.recitations?.[partNumber] || false;
        await api("recitations-toggle", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, part_number: partNumber }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.recitations = teacher.recitations || {};
          teacher.recitations[partNumber] = !teacher.recitations[partNumber];
        });
        if (!wasActive) pushActivity(`${teacherNameById(teacherId)} اجتاز جزء رقم ${partNumber}`);
        refreshVisibleViews();
        showToast("تم تحديث الجزء");
      }

      if (action === "toggle-attendance") {
        const day = Number(button.dataset.day);
        const field = button.dataset.kind;
        const wasPresent = state.teachers.find((item) => item.id === teacherId)?.attendance?.[day]?.[field] || false;
        await api("attendance-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, day, field }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.attendance = teacher.attendance || {};
          teacher.attendance[day] = teacher.attendance[day] || { present: false, pre_test: false, post_test: false };
          teacher.attendance[day][field] = !teacher.attendance[day][field];
        });
        if (field === "present" && !wasPresent) pushActivity(`${teacherNameById(teacherId)} سجل حضور اليوم ${day}`);
        refreshVisibleViews();
        showToast("تم تحديث اليوم");
      }

      if (action === "toggle-task") {
        const taskNumber = Number(button.dataset.task);
        const wasDone = state.teachers.find((item) => item.id === teacherId)?.tasks?.[taskNumber] || false;
        await api("tasks-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, task_number: taskNumber }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.tasks = teacher.tasks || {};
          teacher.tasks[taskNumber] = !teacher.tasks[taskNumber];
        });
        if (!wasDone) pushActivity(`${teacherNameById(teacherId)} أنجز المهمة الأدائية رقم ${taskNumber}`);
        refreshVisibleViews();
        showToast("تم تحديث المهمة");
      }

      if (action === "toggle-graduated") {
        const targetTeacher = state.teachers.find((item) => item.id === teacherId) || state.adminNamedReports.male.find((item) => item.id === teacherId) || state.adminNamedReports.female.find((item) => item.id === teacherId);
        await api("teachers-update", { method: "POST", body: JSON.stringify({ teacher_id: teacherId, is_graduated: !targetTeacher?.is_graduated }) });
        applyTeacherMutation(teacherId, (teacher) => {
          teacher.is_graduated = !teacher.is_graduated;
        });
        if (!targetTeacher?.is_graduated) pushActivity(`${teacherNameById(teacherId)} تم اعتماده مجازًا`);
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
        pushActivity(`${teacherNameById(teacherId)} سجل الاختبار النهائي بنسبة ${Math.round(value)}٪`);
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
      renderActivityFeed();
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
      renderPublicActivityFeed();
    } catch (error) {
      const html = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">${error.message}</div>`;
      male.innerHTML = html;
      female.innerHTML = html;
      comparison.innerHTML = html;
      renderPublicActivityFeed();
    }
  }

  refreshBtn.addEventListener("click", loadPublic);
  await loadPublic();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("login-state")) await initIndexPage();
  if (document.getElementById("logout-btn")) await initAppPage();
  if (document.getElementById("public-refresh-btn")) await initPublicPage();
});

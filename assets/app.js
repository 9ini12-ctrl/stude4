const state = {
  token: localStorage.getItem("practitioner_token") || "",
  user: null,
  summary: null,
  teachers: [],
  users: [],
  readers: [],
  supervisors: [],
  selectedTeacherId: null,
  genderFilter: ""
};

function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  return fetch(`/api/${path}`, {
    ...options,
    headers
  }).then(async (response) => {
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
  el.className = `mt-4 text-sm font-medium ${isError ? "text-rose-600" : "text-slate-500"}`;
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
      <div class="rounded-2xl ${status.needsBootstrap ? "bg-sky-50 text-sky-800 border-sky-100" : "bg-emerald-50 text-emerald-800 border-emerald-100"} border px-4 py-4 text-sm">
        ${status.needsBootstrap ? "النظام جديد ولم يتم إنشاء أي مستخدم بعد." : "تم العثور على مستخدمين في النظام ويمكنك تسجيل الدخول الآن."}
      </div>
    `;

    if (status.needsBootstrap) {
      authTitle.textContent = "إنشاء المدير الأول";
      authSubtitle.textContent = "ابدأ بإنشاء أول مدير للنظام، وبعدها ستتمكن من إدارة بقية المستخدمين من داخل اللوحة.";
      bootstrapForm.classList.remove("hidden-el");
    } else {
      authTitle.textContent = "تسجيل الدخول";
      authSubtitle.textContent = "استخدم اسم المستخدم وكلمة المرور للوصول إلى اللوحة حسب دورك وصلاحياتك.";
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
      await api("auth-bootstrap", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setLoginMessage("تم إنشاء المدير الأول. يمكنك تسجيل الدخول الآن.");
      bootstrapForm.classList.add("hidden-el");
      loginForm.classList.remove("hidden-el");
      authTitle.textContent = "تسجيل الدخول";
      authSubtitle.textContent = "استخدم الحساب الذي أنشأته قبل قليل للدخول.";
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
      const result = await api("auth-login", {
        method: "POST",
        body: JSON.stringify(body)
      });
      state.token = result.token;
      localStorage.setItem("practitioner_token", result.token);
      setLoginMessage("تم تسجيل الدخول بنجاح.");
      window.location.href = "/app.html";
    } catch (error) {
      setLoginMessage(error.message, true);
    }
  });
}

function renderSummaryGrid(summary) {
  const grid = document.getElementById("summary-grid");
  const circularWrap = document.getElementById("summary-circular");
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

  circularWrap.innerHTML = `
    ${circularHtml("الأجزاء", summary.averageParts)}
    ${circularHtml("الاختبارات", summary.averageTests)}
    ${circularHtml("المهام", summary.averageTasks)}
  `;
}

function currentRoleLabel(user) {
  if (!user) return "";
  if (user.role === "admin") return "مدير";
  if (user.role === "supervisor") return user.gender === "female" ? "مشرفة" : "مشرف";
  if (user.role === "reader") return user.gender === "female" ? "مقرئة" : "مقرئ";
  return user.role;
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

  if (state.user?.role === "reader") {
    title.textContent = "المعلمون التابعون لك";
    if (note) note.textContent = "يظهر الاسم والأجزاء فقط.";
  } else {
    title.textContent = "المعلمون / المعلمات";
    if (note) note.textContent = "نسب، تقدم، وتحديثات حسب الدور";
  }

  container.innerHTML = state.teachers.map((teacher) => {
    const canManage = state.user.role === "admin" || state.user.role === "supervisor";
    const isReader = state.user.role === "reader";
    const recitationButtons = Array.from({ length: 30 }).map((_, index) => {
      const part = index + 1;
      const isActive = teacher.recitations?.[part] || false;
      return `
        <button data-action="toggle-part" data-teacher="${teacher.id}" data-part="${part}" class="part-btn ${isActive ? "active" : ""} rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold ${isReader ? "" : "pointer-events-none opacity-80"}">
          ${part}
        </button>
      `;
    }).join("");

    if (isReader) {
      return `
        <article class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-soft fade-in">
          <div class="mb-4 text-lg font-extrabold text-slate-900">${teacher.name}</div>
          <div class="rounded-3xl border border-slate-200 p-4">
            <div class="grid grid-cols-5 gap-2 sm:grid-cols-6">${recitationButtons}</div>
          </div>
        </article>
      `;
    }

    const attendanceButtons = Array.from({ length: 12 }).map((_, index) => {
      const day = index + 1;
      const row = teacher.attendance?.[day] || {};
      return `
        <div class="rounded-2xl border border-slate-200 p-2 text-center">
          <div class="text-[11px] font-bold text-slate-500">يوم ${day}</div>
          <div class="mt-2 flex flex-wrap justify-center gap-1">
            <button data-action="toggle-attendance" data-kind="present" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.present ? "active" : ""} rounded-lg border border-slate-200 px-2 py-1 text-[11px] ${canManage ? "" : "pointer-events-none opacity-70"}">حضور</button>
            <button data-action="toggle-attendance" data-kind="pre_test" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.pre_test ? "active" : ""} rounded-lg border border-slate-200 px-2 py-1 text-[11px] ${canManage ? "" : "pointer-events-none opacity-70"}">قبلي</button>
            <button data-action="toggle-attendance" data-kind="post_test" data-teacher="${teacher.id}" data-day="${day}" class="grid-toggle ${row.post_test ? "active" : ""} rounded-lg border border-slate-200 px-2 py-1 text-[11px] ${canManage ? "" : "pointer-events-none opacity-70"}">بعدي</button>
          </div>
        </div>
      `;
    }).join("");

    const taskButtons = Array.from({ length: 8 }).map((_, index) => {
      const task = index + 1;
      const active = teacher.tasks?.[task] || false;
      return `
        <button data-action="toggle-task" data-teacher="${teacher.id}" data-task="${task}" class="grid-toggle ${active ? "active" : ""} rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold ${canManage ? "" : "pointer-events-none opacity-70"}">
          مهمة ${task}
        </button>
      `;
    }).join("");

    return `
      <article class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-soft fade-in">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-extrabold">${teacher.name}</h3>
              ${teacher.is_graduated ? '<span class="badge badge-success">مجاز / مجازة</span>' : '<span class="badge badge-neutral">نشط</span>'}
              <span class="badge ${teacher.gender === "female" ? "badge-danger" : "badge-neutral"}">${teacher.gender === "female" ? "معلمة" : "معلم"}</span>
            </div>
            <div class="text-sm text-slate-500">
              <div>المشرف: <span class="font-semibold text-slate-700">${teacher.supervisor_name || "—"}</span></div>
              <div>المقرئ: <span class="font-semibold text-slate-700">${teacher.reader_name || "—"}</span></div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button data-action="select-teacher" data-teacher="${teacher.id}" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">تفاصيل</button>
            ${canManage ? `<button data-action="toggle-graduated" data-teacher="${teacher.id}" class="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">${teacher.is_graduated ? "إلغاء المجاز" : "اعتماد مجاز"}</button>` : ""}
            ${(state.user.role === "admin" || state.user.role === "supervisor") ? `<button data-action="delete-teacher" data-teacher="${teacher.id}" class="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">حذف</button>` : ""}
          </div>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div class="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            ${progressHtml("الأجزاء", teacher.metrics.partsPercent)}
            ${progressHtml("الحضور", teacher.metrics.attendancePercent)}
            ${progressHtml("الاختبارات", teacher.metrics.testsPercent)}
            ${progressHtml("المهام", teacher.metrics.tasksPercent)}
            ${progressHtml("النهائي", teacher.metrics.finalExamPercent)}
            ${progressHtml("النتيجة النهائية", teacher.metrics.finalResult)}
          </div>

          <div class="space-y-4">
            <div class="rounded-3xl border border-slate-200 p-4">
              <div class="mb-3 text-sm font-bold text-slate-800">الأجزاء (1 - 30)</div>
              <div class="grid grid-cols-5 gap-2 sm:grid-cols-6">${recitationButtons}</div>
            </div>

            ${canManage ? `
              <div class="rounded-3xl border border-slate-200 p-4">
                <div class="mb-3 text-sm font-bold text-slate-800">الحضور والاختبارات اليومية</div>
                <div class="grid gap-2 xl:grid-cols-2">${attendanceButtons}</div>
              </div>

              <div class="rounded-3xl border border-slate-200 p-4">
                <div class="mb-3 text-sm font-bold text-slate-800">المهام الأدائية</div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${taskButtons}</div>

                <div class="mt-4">
                  <label class="mb-2 block text-sm font-semibold">درجة الاختبار النهائي</label>
                  <div class="flex gap-2">
                    <input type="number" min="0" max="100" value="${Number(teacher.final_score || 0)}" data-final-input="${teacher.id}" class="soft-ring w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    <button data-action="save-final" data-teacher="${teacher.id}" class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700">حفظ</button>
                  </div>
                </div>
              </div>
            ` : ""}
          </div>
        </div>
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
        ${state.user?.id !== user.id ? `<button data-action="delete-user" data-user="${user.id}" class="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">حذف</button>` : `<span class="text-xs text-slate-400">الحساب الحالي</span>`}
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

function renderDetailPanel() {
  const panel = document.getElementById("detail-panel");
  if (!panel) return;
  const teacher = state.teachers.find((item) => item.id === state.selectedTeacherId);
  if (!teacher) {
    panel.innerHTML = 'اختر معلمًا أو معلمة من القائمة لعرض التفاصيل.';
    return;
  }

  panel.innerHTML = `
    <div class="space-y-4 fade-in">
      <div>
        <h3 class="text-lg font-extrabold text-slate-900">${teacher.name}</h3>
        <p class="mt-2 text-sm text-slate-500">${teacher.gender === "female" ? "معلمة" : "معلم"} — ${teacher.is_graduated ? "مجاز / مجازة" : "غير مجاز"}</p>
      </div>
      <div class="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        ${progressHtml("الأجزاء", teacher.metrics.partsPercent)}
        ${progressHtml("الحضور", teacher.metrics.attendancePercent)}
        ${progressHtml("الاختبارات", teacher.metrics.testsPercent)}
        ${progressHtml("المهام", teacher.metrics.tasksPercent)}
        ${progressHtml("النهائي", teacher.metrics.finalExamPercent)}
        ${progressHtml("النتيجة النهائية", teacher.metrics.finalResult)}
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-3xl border border-slate-200 p-4">
          <div class="metric-label">المشرف</div>
          <div class="mt-2 font-bold">${teacher.supervisor_name || "—"}</div>
        </div>
        <div class="rounded-3xl border border-slate-200 p-4">
          <div class="metric-label">المقرئ</div>
          <div class="mt-2 font-bold">${teacher.reader_name || "—"}</div>
        </div>
      </div>
    </div>
  `;
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

async function loadDashboardData() {
  const summaryGrid = document.getElementById("summary-grid");
  const teachersList = document.getElementById("teachers-list");
  const isReader = state.user?.role === "reader";

  if (!isReader && summaryGrid) summaryGrid.innerHTML = summaryCardsSkeleton(4);
  if (teachersList) teachersList.innerHTML = teacherSkeleton(3);

  const query = state.genderFilter ? `?gender=${encodeURIComponent(state.genderFilter)}` : "";

  if (isReader) {
    const teachersResponse = await api(`teachers-list${query}`);
    state.summary = null;
    state.teachers = teachersResponse.teachers || [];
    state.selectedTeacherId = state.teachers[0]?.id || null;
    renderTeacherList();
    renderDetailPanel();
    return;
  }

  const [summaryResponse, teachersResponse] = await Promise.all([
    api(`reports-summary${query}`),
    api(`teachers-list${query}`)
  ]);

  state.summary = summaryResponse.summary;
  state.teachers = teachersResponse.teachers || [];
  if (!state.selectedTeacherId && state.teachers.length) {
    state.selectedTeacherId = state.teachers[0].id;
  } else if (state.selectedTeacherId && !state.teachers.some((t) => t.id === state.selectedTeacherId)) {
    state.selectedTeacherId = state.teachers[0]?.id || null;
  }

  renderSummaryGrid(state.summary);
  renderTeacherList();
  renderDetailPanel();
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

  if (["admin", "supervisor", "reader"].includes(state.user.role)) {
    document.getElementById("teacher-management-section")?.classList.remove("hidden-el");
  }
  if (state.user.role === "admin") {
    document.getElementById("users-section")?.classList.remove("hidden-el");
    document.getElementById("supervisor-select-wrap")?.classList.remove("hidden-el");
  }

  if (state.user.role === "reader") {
    document.getElementById("reader-select-wrap")?.classList.add("hidden-el");
    document.getElementById("summary-grid")?.closest("section")?.classList.add("hidden-el");
    document.getElementById("summary-circular")?.classList.add("hidden-el");
    document.getElementById("gender-filter")?.closest("div")?.classList.add("hidden-el");
    document.getElementById("detail-panel")?.closest("section")?.classList.add("hidden-el");
    document.getElementById("teacher-form-title").textContent = state.user.gender === "female" ? "إضافة معلمة تابعة لك" : "إضافة معلم تابع لك";
    document.getElementById("teacher-form-note").textContent = "سيتم ربط الاسم بك مباشرة كمقرئ/مقرئة.";
    document.getElementById("teacher-name-label").textContent = state.user.gender === "female" ? "اسم المعلمة" : "اسم المعلم";
    document.getElementById("teacher-submit-btn").textContent = state.user.gender === "female" ? "إضافة معلمة" : "إضافة معلم";
    document.getElementById("teacher-list-title").textContent = state.user.gender === "female" ? "المعلمات التابعات لك" : "المعلمون التابعون لك";
    const notesSection = document.querySelectorAll("aside .glass-card")[1];
    notesSection?.classList.add("hidden-el");
  }

  document.getElementById("gender-filter").value = state.genderFilter;

  await loadReferenceUsers();
  await loadDashboardData();

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("practitioner_token");
    state.token = "";
    window.location.href = "/";
  });

  document.getElementById("refresh-btn")?.addEventListener("click", async () => {
    await loadDashboardData();
    if (state.user.role === "admin") await loadReferenceUsers();
    showToast("تم تحديث البيانات");
  });

  document.getElementById("gender-filter")?.addEventListener("change", async (event) => {
    state.genderFilter = event.target.value;
    populatePeopleSelectors();
    await loadDashboardData();
  });

  document.getElementById("teacher-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    try {
      await api("teachers-create", {
        method: "POST",
        body: JSON.stringify(body)
      });
      event.currentTarget.reset();
      populatePeopleSelectors();
      await loadDashboardData();
      showToast(state.user?.role === "reader"
        ? (state.user.gender === "female" ? "تمت إضافة المعلمة وربطها بك" : "تمت إضافة المعلم وربطه بك")
        : "تمت إضافة المعلم / المعلمة");
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById("user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    if (body.role === "admin") {
      body.gender = null;
    }

    try {
      await api("users-create", {
        method: "POST",
        body: JSON.stringify(body)
      });
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

  document.getElementById("teachers-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const teacherId = button.dataset.teacher;

    if (action === "select-teacher") {
      state.selectedTeacherId = teacherId;
      renderDetailPanel();
      return;
    }

    try {
      if (action === "toggle-part") {
        await api("recitations-toggle", {
          method: "POST",
          body: JSON.stringify({
            teacher_id: teacherId,
            part_number: Number(button.dataset.part)
          })
        });
        await loadDashboardData();
        showToast("تم تحديث الجزء");
      }

      if (action === "toggle-attendance") {
        await api("attendance-update", {
          method: "POST",
          body: JSON.stringify({
            teacher_id: teacherId,
            day: Number(button.dataset.day),
            field: button.dataset.kind
          })
        });
        await loadDashboardData();
        showToast("تم تحديث اليوم");
      }

      if (action === "toggle-task") {
        await api("tasks-update", {
          method: "POST",
          body: JSON.stringify({
            teacher_id: teacherId,
            task_number: Number(button.dataset.task)
          })
        });
        await loadDashboardData();
        showToast("تم تحديث المهمة");
      }

      if (action === "toggle-graduated") {
        const teacher = state.teachers.find((item) => item.id === teacherId);
        await api("teachers-update", {
          method: "POST",
          body: JSON.stringify({
            teacher_id: teacherId,
            is_graduated: !teacher.is_graduated
          })
        });
        await loadDashboardData();
        showToast("تم تحديث حالة الإجازة");
      }

      if (action === "delete-teacher") {
        if (!confirm("هل أنت متأكد من حذف المعلم / المعلمة؟")) return;
        await api("teachers-delete", {
          method: "POST",
          body: JSON.stringify({ teacher_id: teacherId })
        });
        await loadDashboardData();
        showToast("تم حذف السجل");
      }

      if (action === "save-final") {
        const input = document.querySelector(`[data-final-input="${teacherId}"]`);
        const value = Number(input?.value || 0);
        await api("final-exam-update", {
          method: "POST",
          body: JSON.stringify({
            teacher_id: teacherId,
            score: value
          })
        });
        await loadDashboardData();
        showToast("تم حفظ النهائي");
      }
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById("users-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button || button.dataset.action !== "delete-user") return;
    if (!confirm("هل أنت متأكد من حذف المستخدم؟")) return;

    try {
      await api("users-delete", {
        method: "POST",
        body: JSON.stringify({ user_id: button.dataset.user })
      });
      await loadReferenceUsers();
      showToast("تم حذف المستخدم");
    } catch (error) {
      showToast(error.message);
    }
  });
}

function publicBlockHtml(title, group) {
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

      male.innerHTML = publicBlockHtml("المعلمين", maleGroup);
      female.innerHTML = publicBlockHtml("المعلمات", femaleGroup);
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
  if (document.getElementById("login-state")) {
    await initIndexPage();
  }

  if (document.getElementById("logout-btn")) {
    await initAppPage();
  }

  if (document.getElementById("public-refresh-btn")) {
    await initPublicPage();
  }
});

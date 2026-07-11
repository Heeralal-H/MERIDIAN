/* =========================================================
   MERIDIAN — Hospital Management System
   All data is stored in the browser's localStorage.
   No backend / server needed — just open index.html.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Storage helpers
     --------------------------------------------------------- */
  const DB_KEYS = {
    patients: "meridian_patients",
    doctors: "meridian_doctors",
    appointments: "meridian_appointments",
    wards: "meridian_wards",
    users: "meridian_users",
    session: "meridian_session",
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function nextId(prefix, list) {
    const nums = list
      .map((item) => parseInt(String(item.id).split("-")[1], 10))
      .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
     Seed data (only used the very first time the app runs)
     --------------------------------------------------------- */
  function seedIfEmpty() {
    if (load(DB_KEYS.doctors, null) === null) {
      save(DB_KEYS.doctors, [
        { id: "D-0001", name: "Dr. Ananya Rao", dept: "Cardiology", phone: "9876500011", email: "ananya.rao@meridian.health", experience: 9 },
        { id: "D-0002", name: "Dr. Vikram Sinha", dept: "Orthopedics", phone: "9876500022", email: "vikram.sinha@meridian.health", experience: 6 },
        { id: "D-0003", name: "Dr. Fatima Sheikh", dept: "Pediatrics", phone: "9876500033", email: "fatima.sheikh@meridian.health", experience: 12 },
      ]);
    }
    if (load(DB_KEYS.patients, null) === null) {
      save(DB_KEYS.patients, [
        { id: "P-0001", name: "Ravi Kumar", age: 34, gender: "Male", condition: "Hypertension", blood: "B+", contact: "9812345001", admitted: todayISO() },
        { id: "P-0002", name: "Sneha Iyer", age: 27, gender: "Female", condition: "Fracture - left arm", blood: "O+", contact: "9812345002", admitted: todayISO() },
      ]);
    }
    if (load(DB_KEYS.appointments, null) === null) {
      save(DB_KEYS.appointments, [
        { id: "A-0001", patientId: "P-0001", doctorId: "D-0001", date: todayISO(), time: "10:30", reason: "Routine checkup", status: "Scheduled" },
        { id: "A-0002", patientId: "P-0002", doctorId: "D-0002", date: todayISO(), time: "14:00", reason: "Cast review", status: "Scheduled" },
      ]);
    }
    if (load(DB_KEYS.wards, null) === null) {
      const wards = [
        { name: "General Ward", beds: 12 },
        { name: "ICU", beds: 6 },
        { name: "Maternity", beds: 8 },
        { name: "Pediatric Ward", beds: 8 },
      ].map((w) => ({
        ...w,
        occupied: Array.from({ length: w.beds }, () => Math.random() < 0.35),
      }));
      save(DB_KEYS.wards, wards);
    }
    if (load(DB_KEYS.users, null) === null) {
      save(DB_KEYS.users, [
        { id: "U-0001", username: "admin", password: "admin123", role: "admin", linkedId: null, name: "Admin" },
        { id: "U-0002", username: "ananya", password: "doctor123", role: "doctor", linkedId: "D-0001", name: "Dr. Ananya Rao" },
        { id: "U-0003", username: "ravi", password: "patient123", role: "patient", linkedId: "P-0001", name: "Ravi Kumar" },
      ]);
    }
  }

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  /* ---------------------------------------------------------
     Modal
     --------------------------------------------------------- */
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  function openModal(title, bodyHTML) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalBackdrop.classList.remove("hidden");
  }
  function closeModal() {
    modalBackdrop.classList.add("hidden");
    modalBody.innerHTML = "";
  }
  document.getElementById("modalClose").addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  /* ===========================================================
     AUTH — login, signup, session, role switching
     =========================================================== */
  const loginScreen = document.getElementById("loginScreen");
  const signupScreen = document.getElementById("signupScreen");
  const appShell = document.getElementById("appShell");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  const ROLE_LABELS = { admin: "Front desk / Admin", doctor: "Doctor", patient: "Patient" };

  let selectedLoginRole = "patient";

  document.querySelectorAll("#roleTabs .role-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#roleTabs .role-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      selectedLoginRole = tab.dataset.role;
      loginError.textContent = "";
    });
  });

  function currentSession() {
    return load(DB_KEYS.session, null);
  }

  function showApp() {
    const session = currentSession();
    if (!session) return;
    loginScreen.classList.add("hidden");
    signupScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    buildNav(session.role);
    updateStaffCard(session);
    switchView("dashboard");
    renderAll();
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const users = load(DB_KEYS.users, []);
    const match = users.find((usr) => usr.username === u && usr.password === p && usr.role === selectedLoginRole);
    if (match) {
      save(DB_KEYS.session, { username: match.username, role: match.role, linkedId: match.linkedId, name: match.name });
      loginError.textContent = "";
      loginForm.reset();
      showApp();
    } else {
      loginError.textContent = `No matching ${ROLE_LABELS[selectedLoginRole]} account for those details.`;
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(DB_KEYS.session);
    appShell.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  });

  /* ---------- Signup ---------- */
  const signupForm = document.getElementById("signupForm");
  const signupError = document.getElementById("signupError");
  const patientFields = document.getElementById("su_patientFields");
  const doctorFields = document.getElementById("su_doctorFields");
  let selectedSignupRole = "patient";

  document.getElementById("showSignupBtn").addEventListener("click", () => {
    loginScreen.classList.add("hidden");
    signupScreen.classList.remove("hidden");
    signupError.textContent = "";
  });
  document.getElementById("backToLoginBtn").addEventListener("click", () => {
    signupScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    signupForm.reset();
  });

  document.querySelectorAll("#signupRoleTabs .role-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#signupRoleTabs .role-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      selectedSignupRole = tab.dataset.role;
      patientFields.classList.toggle("hidden", selectedSignupRole !== "patient");
      doctorFields.classList.toggle("hidden", selectedSignupRole !== "doctor");
    });
  });

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    signupError.textContent = "";

    const name = document.getElementById("su_name").value.trim();
    const email = document.getElementById("su_email").value.trim();
    const username = document.getElementById("su_username").value.trim();
    const password = document.getElementById("su_password").value;

    if (!name || !username || !password) {
      signupError.textContent = "Please fill in all required fields.";
      return;
    }

    const users = load(DB_KEYS.users, []);
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      signupError.textContent = "That username is already taken. Please choose another.";
      return;
    }

    let linkedId = null;

    if (selectedSignupRole === "patient") {
      const patients = load(DB_KEYS.patients, []);
      linkedId = nextId("P", patients);
      patients.push({
        id: linkedId,
        name,
        age: parseInt(document.getElementById("su_age").value, 10) || 0,
        gender: document.getElementById("su_gender").value,
        condition: "",
        blood: document.getElementById("su_blood").value,
        contact: document.getElementById("su_contact").value.trim(),
        admitted: todayISO(),
      });
      save(DB_KEYS.patients, patients);
    } else {
      const doctors = load(DB_KEYS.doctors, []);
      linkedId = nextId("D", doctors);
      doctors.push({
        id: linkedId,
        name,
        dept: document.getElementById("su_dept").value.trim() || "General",
        phone: document.getElementById("su_phone").value.trim(),
        email,
        experience: parseInt(document.getElementById("su_exp").value, 10) || 0,
      });
      save(DB_KEYS.doctors, doctors);
    }

    const newUser = {
      id: nextId("U", users),
      username,
      password,
      role: selectedSignupRole,
      linkedId,
      name,
    };
    users.push(newUser);
    save(DB_KEYS.users, users);

    save(DB_KEYS.session, { username: newUser.username, role: newUser.role, linkedId: newUser.linkedId, name: newUser.name });
    signupForm.reset();
    patientFields.classList.remove("hidden");
    doctorFields.classList.add("hidden");
    toast(`Welcome, ${name}! Your account has been created.`);
    showApp();
  });

  /* ===========================================================
     NAVIGATION (role-aware)
     =========================================================== */
  const NAV_ITEMS = [
    { view: "dashboard", label: "Overview", idx: "01", roles: ["admin", "doctor", "patient"] },
    { view: "patients", label: "Patients", idx: "02", roles: ["admin", "doctor"] },
    { view: "doctors", label: "Doctors", idx: "03", roles: ["admin", "patient"] },
    { view: "appointments", label: "Appointments", idx: "04", roles: ["admin", "doctor", "patient"] },
    { view: "wards", label: "Ward beds", idx: "05", roles: ["admin"] },
    { view: "profile", label: "My profile", idx: "06", roles: ["doctor", "patient"] },
  ];

  function buildNav(role) {
    const nav = document.getElementById("navContainer");
    const items = NAV_ITEMS.filter((i) => i.roles.includes(role));
    nav.innerHTML = items.map((i, idx) => `
      <button class="nav-btn ${idx === 0 ? "active" : ""}" data-view="${i.view}">
        <span class="nav-idx">${i.idx}</span> ${i.label}
      </button>
    `).join("");
    nav.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

    // Show/hide role-restricted controls
    document.getElementById("addPatientBtn").classList.toggle("hidden", role !== "admin");
    document.getElementById("addDoctorBtn").classList.toggle("hidden", role !== "admin");
    document.querySelectorAll("#patientsTable [data-edit-patient], #patientsTable [data-del-patient]");
  }

  function switchView(view) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  }
  document.querySelectorAll(".link-btn[data-view]").forEach((el) => {
    el.addEventListener("click", () => switchView(el.dataset.view));
  });

  function updateStaffCard(session) {
    document.getElementById("staffName").textContent = session.name || session.username;
    document.getElementById("staffRole").textContent = ROLE_LABELS[session.role] || session.role;
    document.getElementById("staffAvatar").textContent = (session.name || session.username).charAt(0).toUpperCase();
  }

  /* ===========================================================
     DASHBOARD (role-aware)
     =========================================================== */
  function renderDashboard() {
    const session = currentSession();
    if (!session) return;
    const patients = load(DB_KEYS.patients, []);
    const doctors = load(DB_KEYS.doctors, []);
    const appts = load(DB_KEYS.appointments, []);
    const wards = load(DB_KEYS.wards, []);
    const today = todayISO();

    document.getElementById("todayDate").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    document.getElementById("dashboardGreeting").textContent = `Good to see you, ${(session.name || session.username).split(" ")[0]}`;

    const statGrid = document.getElementById("statGrid");
    const upcomingHeading = document.getElementById("upcomingHeading");
    const secondPanel = document.getElementById("secondPanel");
    const upcomingList = document.getElementById("upcomingList");
    const recentList = document.getElementById("recentPatients");

    let relevantAppts = appts;
    if (session.role === "doctor") relevantAppts = appts.filter((a) => a.doctorId === session.linkedId);
    if (session.role === "patient") relevantAppts = appts.filter((a) => a.patientId === session.linkedId);

    if (session.role === "admin") {
      const totalBeds = wards.reduce((s, w) => s + w.beds, 0);
      const occBeds = wards.reduce((s, w) => s + w.occupied.filter(Boolean).length, 0);
      statGrid.innerHTML = `
        <div class="stat-card"><p class="stat-label">Registered patients</p><p class="stat-value">${patients.length}</p><p class="stat-note">All-time intake</p></div>
        <div class="stat-card"><p class="stat-label">Doctors on staff</p><p class="stat-value">${doctors.length}</p><p class="stat-note">Across all departments</p></div>
        <div class="stat-card"><p class="stat-label">Appointments today</p><p class="stat-value">${appts.filter(a => a.date === today).length}</p><p class="stat-note">of ${appts.length} scheduled total</p></div>
        <div class="stat-card accent"><p class="stat-label">Beds occupied</p><p class="stat-value">${occBeds}/${totalBeds}</p><p class="stat-note">Ward capacity</p></div>
      `;
      secondPanel.classList.remove("hidden");
    } else if (session.role === "doctor") {
      const distinctPatients = new Set(relevantAppts.map((a) => a.patientId)).size;
      statGrid.innerHTML = `
        <div class="stat-card"><p class="stat-label">Your appointments today</p><p class="stat-value">${relevantAppts.filter(a => a.date === today).length}</p><p class="stat-note">of ${relevantAppts.length} total</p></div>
        <div class="stat-card"><p class="stat-label">Patients seen</p><p class="stat-value">${distinctPatients}</p><p class="stat-note">Distinct patients</p></div>
        <div class="stat-card accent"><p class="stat-label">Scheduled</p><p class="stat-value">${relevantAppts.filter(a => a.status === "Scheduled").length}</p><p class="stat-note">Upcoming visits</p></div>
      `;
      secondPanel.classList.add("hidden");
    } else {
      statGrid.innerHTML = `
        <div class="stat-card"><p class="stat-label">Your appointments</p><p class="stat-value">${relevantAppts.length}</p><p class="stat-note">All-time booked</p></div>
        <div class="stat-card"><p class="stat-label">Upcoming</p><p class="stat-value">${relevantAppts.filter(a => a.status === "Scheduled").length}</p><p class="stat-note">Scheduled visits</p></div>
        <div class="stat-card accent"><p class="stat-label">Doctors available</p><p class="stat-value">${doctors.length}</p><p class="stat-note">Book a new visit anytime</p></div>
      `;
      secondPanel.classList.add("hidden");
    }

    upcomingHeading.textContent = session.role === "admin" ? "Upcoming appointments" : "Your upcoming appointments";
    const upcoming = relevantAppts
      .filter((a) => a.status === "Scheduled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 6);
    upcomingList.innerHTML = upcoming.length
      ? upcoming.map((a) => {
          const p = patients.find((x) => x.id === a.patientId);
          const d = doctors.find((x) => x.id === a.doctorId);
          let label;
          if (session.role === "patient") label = `with ${escapeHTML(d ? d.name : "Unknown doctor")}`;
          else if (session.role === "doctor") label = `with ${escapeHTML(p ? p.name : "Unknown patient")}`;
          else label = `${escapeHTML(p ? p.name : "Unknown")} with ${escapeHTML(d ? d.name : "Unknown")}`;
          return `<div class="list-item">
            <div>
              <div class="li-title">${session.role === "patient" ? escapeHTML(d ? d.name : "Doctor") : escapeHTML(p ? p.name : "Patient")}</div>
              <div class="li-sub">${label} &middot; ${a.date} at ${a.time}</div>
            </div>
            <span class="pill pill-scheduled">Scheduled</span>
          </div>`;
        }).join("")
      : `<p class="list-empty">Nothing scheduled right now.</p>`;

    if (session.role === "admin") {
      const recent = [...patients].slice(-5).reverse();
      recentList.innerHTML = recent.length
        ? recent.map((p) => `<div class="list-item">
            <div>
              <div class="li-title">${escapeHTML(p.name)}</div>
              <div class="li-sub">${escapeHTML(p.condition || "—")} &middot; admitted ${p.admitted}</div>
            </div>
            <span class="id-badge">${p.id}</span>
          </div>`).join("")
        : `<p class="list-empty">No patients admitted yet.</p>`;
    }
  }

  /* ===========================================================
     PATIENTS  (admin: full CRUD · doctor: read-only)
     =========================================================== */
  function renderPatients() {
    const session = currentSession();
    if (!session) return;
    const patients = load(DB_KEYS.patients, []);
    const query = document.getElementById("patientSearch").value.trim().toLowerCase();
    const filtered = patients.filter((p) =>
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      (p.condition || "").toLowerCase().includes(query)
    );

    const canEdit = session.role === "admin";
    const tbody = document.getElementById("patientsTable");
    tbody.innerHTML = filtered.map((p) => `
      <tr>
        <td><span class="id-badge">${p.id}</span></td>
        <td>${escapeHTML(p.name)}</td>
        <td>${p.age}</td>
        <td>${escapeHTML(p.gender)}</td>
        <td>${escapeHTML(p.condition || "—")}</td>
        <td>${escapeHTML(p.blood || "—")}</td>
        <td>${escapeHTML(p.contact || "—")}</td>
        <td>${p.admitted}</td>
        <td>
          ${canEdit ? `
          <div class="row-actions">
            <button class="btn btn-ghost btn-small" data-edit-patient="${p.id}">Edit</button>
            <button class="btn btn-danger btn-small" data-del-patient="${p.id}">Remove</button>
          </div>` : ""}
        </td>
      </tr>
    `).join("");

    document.getElementById("patientsEmpty").classList.toggle("hidden", filtered.length !== 0);

    if (canEdit) {
      tbody.querySelectorAll("[data-edit-patient]").forEach((btn) =>
        btn.addEventListener("click", () => openPatientForm(btn.dataset.editPatient)));
      tbody.querySelectorAll("[data-del-patient]").forEach((btn) =>
        btn.addEventListener("click", () => {
          if (!confirm("Remove this patient record? This cannot be undone.")) return;
          const list = load(DB_KEYS.patients, []).filter((p) => p.id !== btn.dataset.delPatient);
          save(DB_KEYS.patients, list);
          toast("Patient record removed.");
          renderAll();
        }));
    }
  }

  function openPatientForm(editId) {
    const patients = load(DB_KEYS.patients, []);
    const existing = editId ? patients.find((p) => p.id === editId) : null;

    openModal(existing ? "Edit patient" : "Admit patient", `
      <form id="patientForm">
        <div class="field">
          <span>Full name</span>
          <input type="text" id="pf_name" required value="${existing ? escapeHTML(existing.name) : ""}">
        </div>
        <div class="field-row">
          <label class="field">
            <span>Age</span>
            <input type="number" id="pf_age" min="0" max="130" required value="${existing ? existing.age : ""}">
          </label>
          <label class="field">
            <span>Gender</span>
            <select id="pf_gender">
              <option ${existing && existing.gender === "Male" ? "selected" : ""}>Male</option>
              <option ${existing && existing.gender === "Female" ? "selected" : ""}>Female</option>
              <option ${existing && existing.gender === "Other" ? "selected" : ""}>Other</option>
            </select>
          </label>
        </div>
        <div class="field">
          <span>Condition / reason for admission</span>
          <input type="text" id="pf_condition" value="${existing ? escapeHTML(existing.condition || "") : ""}">
        </div>
        <div class="field-row">
          <label class="field">
            <span>Blood group</span>
            <select id="pf_blood">
              ${["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg =>
                `<option ${existing && existing.blood === bg ? "selected" : ""}>${bg}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Contact number</span>
            <input type="text" id="pf_contact" value="${existing ? escapeHTML(existing.contact || "") : ""}">
          </label>
        </div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? "Save changes" : "Admit patient"}</button>
      </form>
    `);

    document.getElementById("patientForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const list = load(DB_KEYS.patients, []);
      const record = {
        id: existing ? existing.id : nextId("P", list),
        name: document.getElementById("pf_name").value.trim(),
        age: parseInt(document.getElementById("pf_age").value, 10),
        gender: document.getElementById("pf_gender").value,
        condition: document.getElementById("pf_condition").value.trim(),
        blood: document.getElementById("pf_blood").value,
        contact: document.getElementById("pf_contact").value.trim(),
        admitted: existing ? existing.admitted : todayISO(),
      };
      if (existing) {
        const idx = list.findIndex((p) => p.id === existing.id);
        list[idx] = record;
      } else {
        list.push(record);
      }
      save(DB_KEYS.patients, list);
      closeModal();
      toast(existing ? "Patient record updated." : "Patient admitted.");
      renderAll();
    });
  }

  document.getElementById("addPatientBtn").addEventListener("click", () => openPatientForm(null));
  document.getElementById("patientSearch").addEventListener("input", renderPatients);

  /* ===========================================================
     DOCTORS  (admin: full CRUD · patient: read-only browse)
     =========================================================== */
  function renderDoctors() {
    const session = currentSession();
    if (!session) return;
    const doctors = load(DB_KEYS.doctors, []);
    const query = document.getElementById("doctorSearch").value.trim().toLowerCase();
    const filtered = doctors.filter((d) =>
      !query || d.name.toLowerCase().includes(query) || d.dept.toLowerCase().includes(query));

    const canEdit = session.role === "admin";
    const grid = document.getElementById("doctorsGrid");
    grid.innerHTML = filtered.map((d) => `
      <div class="doctor-card">
        <span class="dept-tag">${escapeHTML(d.dept)}</span>
        <h3>${escapeHTML(d.name)}</h3>
        <p class="doc-meta">${d.experience} yrs experience &middot; ${escapeHTML(d.phone || "—")}</p>
        <p class="doc-meta" style="margin-top:-10px;">${escapeHTML(d.email || "")}</p>
        ${canEdit ? `
        <div class="doc-actions">
          <button class="btn btn-ghost btn-small" data-edit-doctor="${d.id}">Edit</button>
          <button class="btn btn-danger btn-small" data-del-doctor="${d.id}">Remove</button>
        </div>` : ""}
      </div>
    `).join("");

    document.getElementById("doctorsEmpty").classList.toggle("hidden", filtered.length !== 0);

    if (canEdit) {
      grid.querySelectorAll("[data-edit-doctor]").forEach((btn) =>
        btn.addEventListener("click", () => openDoctorForm(btn.dataset.editDoctor)));
      grid.querySelectorAll("[data-del-doctor]").forEach((btn) =>
        btn.addEventListener("click", () => {
          if (!confirm("Remove this doctor profile?")) return;
          const list = load(DB_KEYS.doctors, []).filter((d) => d.id !== btn.dataset.delDoctor);
          save(DB_KEYS.doctors, list);
          toast("Doctor profile removed.");
          renderAll();
        }));
    }
  }

  function openDoctorForm(editId) {
    const doctors = load(DB_KEYS.doctors, []);
    const existing = editId ? doctors.find((d) => d.id === editId) : null;

    openModal(existing ? "Edit doctor" : "Add doctor", `
      <form id="doctorForm">
        <div class="field">
          <span>Full name</span>
          <input type="text" id="df_name" required value="${existing ? escapeHTML(existing.name) : ""}">
        </div>
        <div class="field-row">
          <label class="field">
            <span>Department</span>
            <input type="text" id="df_dept" required value="${existing ? escapeHTML(existing.dept) : ""}">
          </label>
          <label class="field">
            <span>Years of experience</span>
            <input type="number" id="df_exp" min="0" max="60" value="${existing ? existing.experience : 0}">
          </label>
        </div>
        <div class="field">
          <span>Phone</span>
          <input type="text" id="df_phone" value="${existing ? escapeHTML(existing.phone || "") : ""}">
        </div>
        <div class="field">
          <span>Email</span>
          <input type="email" id="df_email" value="${existing ? escapeHTML(existing.email || "") : ""}">
        </div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? "Save changes" : "Add doctor"}</button>
      </form>
    `);

    document.getElementById("doctorForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const list = load(DB_KEYS.doctors, []);
      const record = {
        id: existing ? existing.id : nextId("D", list),
        name: document.getElementById("df_name").value.trim(),
        dept: document.getElementById("df_dept").value.trim(),
        experience: parseInt(document.getElementById("df_exp").value, 10) || 0,
        phone: document.getElementById("df_phone").value.trim(),
        email: document.getElementById("df_email").value.trim(),
      };
      if (existing) {
        const idx = list.findIndex((d) => d.id === existing.id);
        list[idx] = record;
      } else {
        list.push(record);
      }
      save(DB_KEYS.doctors, list);
      closeModal();
      toast(existing ? "Doctor profile updated." : "Doctor added.");
      renderAll();
    });
  }

  document.getElementById("addDoctorBtn").addEventListener("click", () => openDoctorForm(null));
  document.getElementById("doctorSearch").addEventListener("input", renderDoctors);

  /* ===========================================================
     APPOINTMENTS  (filtered + permissioned by role)
     =========================================================== */
  function renderAppointments() {
    const session = currentSession();
    if (!session) return;
    const appts = load(DB_KEYS.appointments, []);
    const patients = load(DB_KEYS.patients, []);
    const doctors = load(DB_KEYS.doctors, []);
    const filter = document.getElementById("apptFilter").value;

    document.getElementById("apptHeading").textContent = session.role === "admin" ? "Appointments" : "My appointments";

    let scoped = appts;
    if (session.role === "doctor") scoped = appts.filter((a) => a.doctorId === session.linkedId);
    if (session.role === "patient") scoped = appts.filter((a) => a.patientId === session.linkedId);

    const filtered = scoped
      .filter((a) => filter === "all" || a.status === filter)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    const tbody = document.getElementById("apptTable");
    tbody.innerHTML = filtered.map((a) => {
      const p = patients.find((x) => x.id === a.patientId);
      const d = doctors.find((x) => x.id === a.doctorId);
      const pillClass = a.status === "Scheduled" ? "pill-scheduled" : a.status === "Completed" ? "pill-completed" : "pill-cancelled";
      const canComplete = a.status === "Scheduled" && (session.role === "admin" || session.role === "doctor");
      const canCancel = a.status === "Scheduled" && (session.role === "admin" || session.role === "doctor" || session.role === "patient");
      const canDelete = session.role === "admin";
      return `
        <tr>
          <td>${escapeHTML(p ? p.name : "Unknown")}</td>
          <td>${escapeHTML(d ? d.name : "Unknown")}</td>
          <td>${a.date}</td>
          <td>${a.time}</td>
          <td>${escapeHTML(a.reason || "—")}</td>
          <td><span class="pill ${pillClass}">${a.status}</span></td>
          <td>
            <div class="row-actions">
              ${canComplete ? `<button class="btn btn-ghost btn-small" data-complete="${a.id}">Complete</button>` : ""}
              ${canCancel ? `<button class="btn btn-danger btn-small" data-cancel="${a.id}">Cancel</button>` : ""}
              ${canDelete ? `<button class="btn btn-danger btn-small" data-del-appt="${a.id}">Delete</button>` : ""}
            </div>
          </td>
        </tr>`;
    }).join("");

    document.getElementById("apptEmpty").classList.toggle("hidden", filtered.length !== 0);

    tbody.querySelectorAll("[data-complete]").forEach((btn) =>
      btn.addEventListener("click", () => setApptStatus(btn.dataset.complete, "Completed")));
    tbody.querySelectorAll("[data-cancel]").forEach((btn) =>
      btn.addEventListener("click", () => setApptStatus(btn.dataset.cancel, "Cancelled")));
    tbody.querySelectorAll("[data-del-appt]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!confirm("Delete this appointment?")) return;
        const list = load(DB_KEYS.appointments, []).filter((a) => a.id !== btn.dataset.delAppt);
        save(DB_KEYS.appointments, list);
        toast("Appointment deleted.");
        renderAll();
      }));
  }

  function setApptStatus(id, status) {
    const list = load(DB_KEYS.appointments, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx > -1) {
      list[idx].status = status;
      save(DB_KEYS.appointments, list);
      toast(`Appointment marked ${status.toLowerCase()}.`);
      renderAll();
    }
  }

  function openApptForm() {
    const session = currentSession();
    const patients = load(DB_KEYS.patients, []);
    const doctors = load(DB_KEYS.doctors, []);

    if (!patients.length || !doctors.length) {
      openModal("Book appointment", `<p class="section-note">You need at least one patient and one doctor before booking an appointment.</p>`);
      return;
    }

    const patientFieldHTML = session.role === "patient"
      ? `<input type="hidden" id="af_patient" value="${session.linkedId}">`
      : `<div class="field">
          <span>Patient</span>
          <select id="af_patient" required>
            ${patients.map((p) => `<option value="${p.id}">${escapeHTML(p.name)} (${p.id})</option>`).join("")}
          </select>
        </div>`;

    const doctorFieldHTML = session.role === "doctor"
      ? `<input type="hidden" id="af_doctor" value="${session.linkedId}">`
      : `<div class="field">
          <span>Doctor</span>
          <select id="af_doctor" required>
            ${doctors.map((d) => `<option value="${d.id}">${escapeHTML(d.name)} — ${escapeHTML(d.dept)}</option>`).join("")}
          </select>
        </div>`;

    openModal("Book appointment", `
      <form id="apptForm">
        ${patientFieldHTML}
        ${doctorFieldHTML}
        <div class="field-row">
          <label class="field">
            <span>Date</span>
            <input type="date" id="af_date" required value="${todayISO()}">
          </label>
          <label class="field">
            <span>Time</span>
            <input type="time" id="af_time" required value="09:00">
          </label>
        </div>
        <div class="field">
          <span>Reason for visit</span>
          <input type="text" id="af_reason" placeholder="e.g. Follow-up consultation">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Book appointment</button>
      </form>
    `);

    document.getElementById("apptForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const list = load(DB_KEYS.appointments, []);
      list.push({
        id: nextId("A", list),
        patientId: document.getElementById("af_patient").value,
        doctorId: document.getElementById("af_doctor").value,
        date: document.getElementById("af_date").value,
        time: document.getElementById("af_time").value,
        reason: document.getElementById("af_reason").value.trim(),
        status: "Scheduled",
      });
      save(DB_KEYS.appointments, list);
      closeModal();
      toast("Appointment booked.");
      renderAll();
    });
  }

  document.getElementById("addApptBtn").addEventListener("click", openApptForm);
  document.getElementById("apptFilter").addEventListener("change", renderAppointments);

  /* ===========================================================
     WARD BEDS (admin only)
     =========================================================== */
  function renderWards() {
    const session = currentSession();
    if (!session || session.role !== "admin") return;
    const wards = load(DB_KEYS.wards, []);
    const container = document.getElementById("wardGroups");
    container.innerHTML = wards.map((w, wardIdx) => {
      const occ = w.occupied.filter(Boolean).length;
      return `
        <div class="ward-block">
          <h3>${escapeHTML(w.name)} <span class="id-badge">${occ}/${w.beds} occupied</span></h3>
          <div class="bed-grid">
            ${w.occupied.map((isOcc, bedIdx) => `
              <button class="bed ${isOcc ? "occupied" : "free"}" data-ward="${wardIdx}" data-bed="${bedIdx}" title="Bed ${bedIdx + 1} — click to toggle">
                B${bedIdx + 1}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".bed").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wards = load(DB_KEYS.wards, []);
        const w = parseInt(btn.dataset.ward, 10);
        const b = parseInt(btn.dataset.bed, 10);
        wards[w].occupied[b] = !wards[w].occupied[b];
        save(DB_KEYS.wards, wards);
        renderAll();
      });
    });
  }

  /* ===========================================================
     PROFILE (doctor / patient)
     =========================================================== */
  function renderProfile() {
    const session = currentSession();
    if (!session || session.role === "admin") return;
    const panel = document.getElementById("profilePanel");

    if (session.role === "doctor") {
      const doctors = load(DB_KEYS.doctors, []);
      const d = doctors.find((x) => x.id === session.linkedId);
      if (!d) { panel.innerHTML = `<p class="section-note">Profile not found.</p>`; return; }
      panel.innerHTML = `
        <div class="profile-row"><span class="pk">Name</span><span class="pv">${escapeHTML(d.name)}</span></div>
        <div class="profile-row"><span class="pk">Username</span><span class="pv">${escapeHTML(session.username)}</span></div>
        <div class="profile-row"><span class="pk">Doctor ID</span><span class="pv">${d.id}</span></div>
        <div class="profile-row"><span class="pk">Department</span><span class="pv">${escapeHTML(d.dept)}</span></div>
        <div class="profile-row"><span class="pk">Experience</span><span class="pv">${d.experience} years</span></div>
        <div class="profile-row"><span class="pk">Phone</span><span class="pv">${escapeHTML(d.phone || "—")}</span></div>
        <div class="profile-row"><span class="pk">Email</span><span class="pv">${escapeHTML(d.email || "—")}</span></div>
        <button class="btn btn-ghost btn-block" style="margin-top:16px;" id="editProfileBtn">Edit profile</button>
      `;
      document.getElementById("editProfileBtn").addEventListener("click", () => openDoctorForm(d.id));
    } else {
      const patients = load(DB_KEYS.patients, []);
      const p = patients.find((x) => x.id === session.linkedId);
      if (!p) { panel.innerHTML = `<p class="section-note">Profile not found.</p>`; return; }
      panel.innerHTML = `
        <div class="profile-row"><span class="pk">Name</span><span class="pv">${escapeHTML(p.name)}</span></div>
        <div class="profile-row"><span class="pk">Username</span><span class="pv">${escapeHTML(session.username)}</span></div>
        <div class="profile-row"><span class="pk">Patient ID</span><span class="pv">${p.id}</span></div>
        <div class="profile-row"><span class="pk">Age</span><span class="pv">${p.age}</span></div>
        <div class="profile-row"><span class="pk">Gender</span><span class="pv">${escapeHTML(p.gender)}</span></div>
        <div class="profile-row"><span class="pk">Blood group</span><span class="pv">${escapeHTML(p.blood || "—")}</span></div>
        <div class="profile-row"><span class="pk">Contact</span><span class="pv">${escapeHTML(p.contact || "—")}</span></div>
        <div class="profile-row"><span class="pk">Condition on file</span><span class="pv">${escapeHTML(p.condition || "—")}</span></div>
        <button class="btn btn-ghost btn-block" style="margin-top:16px;" id="editProfileBtn">Edit profile</button>
      `;
      document.getElementById("editProfileBtn").addEventListener("click", () => openPatientForm(p.id));
    }
  }

  /* ===========================================================
     RENDER ALL + INIT
     =========================================================== */
  function renderAll() {
    renderDashboard();
    renderPatients();
    renderDoctors();
    renderAppointments();
    renderWards();
    renderProfile();
  }

  document.addEventListener("DOMContentLoaded", () => {
    seedIfEmpty();

    const splash = document.getElementById("splashScreen");
    setTimeout(() => {
      if (splash) {
        splash.classList.add("fade-out");
        setTimeout(() => splash.remove(), 500);
      }
      if (currentSession()) {
        showApp();
      } else {
        loginScreen.classList.remove("hidden");
      }
    }, 5000);
  });
})();


const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";

const api = async (path, options = {}) => {
  const response = await fetch(API_BASE + path, {
    credentials: "include",
    ...options
  });

  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.detail || `Request failed (${response.status})`);
  }

  return data;
};

const $ = (s) => document.querySelector(s);

const escapeHtml = (v = "") =>
  String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const examName = slug => ({
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
  "neet": "NEET",
  "cbse": "CBSE"
}[slug] || slug);

let currentPapers = [];
let visiblePapers = [];

async function loadPapers() {
  const q = $("#searchInput").value.trim();
  const exam = $("#examFilter").value;

  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (exam) params.set("exam", exam);

  const grid = $("#paperGrid");

  grid.innerHTML = '<p class="muted">Loading papers...</p>';

  try {
    currentPapers = await api("/api/papers?" + params.toString());

    updateFilterOptions();
    renderPapers();

  } catch (error) {
    $("#resultCount").textContent = "Archive unavailable";

    grid.innerHTML = `
      <div class="empty">
        Could not load papers.
        Please check your backend connection.
        <br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function updateFilterOptions() {
  const subjects = [
    ...new Set(currentPapers.map(p => p.subject).filter(Boolean))
  ];

  const years = [
    ...new Set(currentPapers.map(p => String(p.year)).filter(Boolean))
  ];

  const subjectFilter = $("#subjectFilter");
  const yearFilter = $("#yearFilter");

  const oldSubject = subjectFilter.value;
  const oldYear = yearFilter.value;

  subjectFilter.innerHTML =
    '<option value="">All subjects</option>';

  subjects.sort().forEach(subject => {
    subjectFilter.innerHTML += `
      <option value="${escapeHtml(subject)}">
        ${escapeHtml(subject)}
      </option>
    `;
  });

  yearFilter.innerHTML =
    '<option value="">All years</option>';

  years.sort((a, b) => Number(b) - Number(a)).forEach(year => {
    yearFilter.innerHTML += `
      <option value="${escapeHtml(year)}">
        ${escapeHtml(year)}
      </option>
    `;
  });

  subjectFilter.value = subjects.includes(oldSubject) ? oldSubject : "";
  yearFilter.value = years.includes(oldYear) ? oldYear : "";
}

function renderPapers() {
  const grid = $("#paperGrid");

  const subject = $("#subjectFilter")?.value || "";
  const year = $("#yearFilter")?.value || "";

  const papers = currentPapers.filter(p => {
    const subjectMatch = !subject || p.subject === subject;
    const yearMatch = !year || String(p.year) === year;

    return subjectMatch && yearMatch;
  });

  if ($("#resultCount")) {
    $("#resultCount").textContent = `${papers.length} papers found`;
  }

  if (!papers.length) {
    grid.innerHTML = `
      <div class="empty">
        <h3>No papers found!</h3>
        <p>Try another search or change your filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = papers.map(p => {
    const fileUrl =
      `${API_BASE}/api/papers/${encodeURIComponent(p.id)}/file`;

    return `
      <article class="paper-card">
        <div class="stripe"></div>

        <div class="paper-body">
          <div class="meta">
            <span class="tag">
              ${escapeHtml(examName(p.exam))}
            </span>

            <span>${escapeHtml(p.year)}</span>
          </div>

          <h3>${escapeHtml(p.title || "Question Paper")}</h3>

          <p>
            <strong>${escapeHtml(p.subject || "General")}</strong>
            ${p.session
              ? " · " + escapeHtml(p.session)
              : ""}
            ${p.description
              ? "<br>" + escapeHtml(p.description)
              : ""}
          </p>

          <div class="actions">
            ${p.hasFile ? `
              <a href="#"
                 class="preview-paper"
                 data-paper-id="${escapeHtml(p.id)}">
                Preview PDF ↗
              </a>

              <a class="download"
                 href="${fileUrl}?download=1"
                 download>
                Download ↓
              </a>
            ` : p.sourceUrl ? `
              <a class="download"
                 href="${escapeHtml(p.sourceUrl)}"
                 target="_blank"
                 rel="noopener">
                Open source ↗
              </a>
            ` : `
              <span class="muted">PDF not available</span>
            `}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

$("#searchBtn").addEventListener("click", loadPapers);

$("#searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") loadPapers();
});

$("#examFilter").addEventListener("change", loadPapers);
$("#subjectFilter").addEventListener("change", renderPapers);
$("#yearFilter").addEventListener("change", renderPapers);

$("#clearFilters").addEventListener("click", () => {
  $("#searchInput").value = "";
  $("#examFilter").value = "";
  $("#subjectFilter").value = "";
  $("#yearFilter").value = "";

  loadPapers();
});

async function checkSession() {
  try {
    const data = await api("/api/session");

    if (data.session) {
      showDashboard(data.session.email);
    }
  } catch (error) {
    console.log("No active admin session");
  }
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = new FormData(e.currentTarget);
  const msg = $("#loginMessage");

  msg.textContent = "Signing in…";

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    showDashboard(data.session.email);

  } catch (err) {
    msg.textContent = err.message;
  }
});

async function showDashboard(email) {
  const root = $("#adminRoot");

  root.innerHTML = `
    <div class="admin-wrap">
      <div class="panel">
        <div class="meta">
          <span>SIGNED IN AS ${escapeHtml(email)}</span>
          <button id="logoutBtn">Sign out</button>
        </div>

        <h3>Dashboard</h3>

        <div id="stats" class="stats"></div>

        <div class="admin-actions">
          <button id="newPaperBtn">+ Add paper</button>
          <button class="secondary" id="refreshBtn">Refresh</button>
        </div>

        <div id="editor"></div>
        <div id="adminPapers"></div>
      </div>
    </div>
  `;

  $("#logoutBtn").onclick = async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.reload();
  };

  $("#newPaperBtn").onclick = () => showEditor();
  $("#refreshBtn").onclick = refreshAdmin;

  await refreshAdmin();
}

async function refreshAdmin() {
  try {
    const [stats, papers] = await Promise.all([
      api("/api/admin/dashboard"),
      api("/api/papers")
    ]);

    $("#stats").innerHTML = `
      <div class="stat">
        <strong>${stats.total}</strong>
        <span>Total papers</span>
      </div>

      <div class="stat">
        <strong>${stats.withFile}</strong>
        <span>With PDF files</span>
      </div>

      <div class="stat">
        <strong>${stats.downloads}</strong>
        <span>Total downloads</span>
      </div>
    `;

    $("#adminPapers").innerHTML = `
      <h3>Manage papers</h3>

      <table class="admin-table">
        <thead>
          <tr>
            <th>Paper</th>
            <th>Exam</th>
            <th>Year</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${papers.map(p => `
            <tr>
              <td>${escapeHtml(p.title)}</td>
              <td>${escapeHtml(examName(p.exam))}</td>
              <td>${escapeHtml(p.year)}</td>
              <td>
                <button data-edit="${escapeHtml(p.id)}">Edit</button>
                <button data-delete="${escapeHtml(p.id)}">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    document.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => showEditor(
        papers.find(p => String(p.id) === b.dataset.edit)
      );
    });

    document.querySelectorAll("[data-delete]").forEach(b => {
      b.onclick = () => deletePaper(b.dataset.delete);
    });

  } catch (e) {
    $("#adminPapers").textContent = e.message;
  }
}

function showEditor(p = null) {
  const editor = $("#editor");

  editor.innerHTML = `
    <h3>${p ? "Edit paper" : "Add a paper"}</h3>

    <form id="paperForm" class="paper-form">

      <label>
        Exam
        <select name="exam">
          <option value="jee-main">JEE Main</option>
          <option value="jee-advanced">JEE Advanced</option>
          <option value="neet">NEET</option>
          <option value="cbse">CBSE</option>
        </select>
      </label>

      <label>
        Year
        <input name="year" type="number"
          min="1990" max="2100" required
          value="${p?.year || new Date().getFullYear()}">
      </label>

      <label>
        Subject
        <input name="subject" required maxlength="100"
          value="${escapeHtml(p?.subject || "")}">
      </label>

      <label>
        Session / shift
        <input name="session" maxlength="120"
          value="${escapeHtml(p?.session || "")}">
      </label>

      <label>
        Paper title
        <input name="title" required minlength="3" maxlength="240"
          value="${escapeHtml(p?.title || "")}">
      </label>

      <label>
        Description
        <textarea name="description">${escapeHtml(p?.description || "")}</textarea>
      </label>

      <label>
        Source URL (optional)
        <input name="sourceUrl" type="url"
          value="${escapeHtml(p?.sourceUrl || "")}">
      </label>

      <label>
        PDF file (optional)
        <input name="file" type="file" accept="application/pdf">
      </label>

      ${p?.hasFile ? `
        <label>
          <input name="removeFile" type="checkbox"
            value="true" style="width:auto">
          Remove existing PDF
        </label>
      ` : ""}

      <div class="admin-actions">
        <button type="submit">
          ${p ? "Save changes" : "Create paper"}
        </button>

        <button type="button" class="secondary" id="cancelEdit">
          Cancel
        </button>
      </div>

      <p id="formMessage" class="message"></p>
    </form>
  `;

  const form = $("#paperForm");

  form.elements.exam.value = p?.exam || "jee-main";

  $("#cancelEdit").onclick = () => {
    editor.innerHTML = "";
  };

  form.onsubmit = async e => {
    e.preventDefault();

    const fd = new FormData(form);

    if (fd.get("removeFile") !== "true") {
      fd.delete("removeFile");
    }

    const url = p
      ? `/api/admin/papers/${p.id}`
      : "/api/admin/papers";

    try {
      await api(url, {
        method: p ? "PUT" : "POST",
        body: fd
      });

      editor.innerHTML = "";

      await refreshAdmin();
      await loadPapers();

    } catch (err) {
      $("#formMessage").textContent = err.message;
    }
  };
}

async function deletePaper(id) {
  if (!confirm("Delete this paper permanently?")) return;

  try {
    await api(`/api/admin/papers/${id}`, {
      method: "DELETE"
    });

    await refreshAdmin();
    await loadPapers();

  } catch (e) {
    alert(e.message);
  }
}

// PDF PREVIEW FUNCTIONALITY

const pdfModal = $("#pdfModal");
const pdfFrame = $("#pdfFrame");
const pdfTitle = $("#pdfTitle");
const pdfDownload = $("#pdfDownload");

$("#paperGrid").addEventListener("click", function(event) {
  const button = event.target.closest(".preview-paper");

  if (!button) return;

  event.preventDefault();

  const paper = currentPapers.find(
    p => String(p.id) === button.dataset.paperId
  );

  if (!paper || !paper.hasFile) return;

  const fileUrl =
    `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file`;

  pdfTitle.textContent = paper.title || "Question Paper Preview";
  pdfFrame.src = fileUrl;
  pdfDownload.href = fileUrl + "?download=1";

  pdfModal.classList.add("active");
  pdfModal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
});

function closePdfViewer() {
  pdfModal.classList.remove("active");
  pdfModal.setAttribute("aria-hidden", "true");

  pdfFrame.src = "about:blank";
  document.body.style.overflow = "";
}

$("#closePdf").addEventListener("click", closePdfViewer);

pdfModal.addEventListener("click", function(event) {
  if (event.target === pdfModal) {
    closePdfViewer();
  }
});

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closePdfViewer();
  }
});

// INITIALIZE EDUSPHERE

loadPapers();
checkSession();


// ============================================
// EDUSPHERE - FRONTEND APPLICATION
// ============================================

const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";

const $ = (selector) => document.querySelector(selector);

let allPapers = [];
let currentPapers = [];

// ============================================
// API HELPER
// ============================================

async function api(path, options = {}) {
    const response = await fetch(API_BASE + path, {
        credentials: "include",
        ...options
    });

    const contentType = response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
        data = await response.json();
    }

    if (!response.ok) {
        throw new Error(
            data?.detail || `Request failed (${response.status})`
        );
    }

    return data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

function normalizeExam(value = "") {
    const exam = String(value).trim().toLowerCase();

    const mapping = {
        "jee-main": "jee main",
        "jee main": "jee main",
        "jee-advanced": "jee advanced",
        "jee advanced": "jee advanced",
        "neet": "neet",
        "cbse": "cbse",
        "icse": "icse",
        "isc": "isc"
    };

    return mapping[exam] || exam;
}

function displayExam(value = "") {
    const mapping = {
        "jee main": "JEE Main",
        "jee advanced": "JEE Advanced",
        "neet": "NEET",
        "cbse": "CBSE",
        "icse": "ICSE",
        "isc": "ISC"
    };

    const normalized = normalizeExam(value);

    return mapping[normalized] || value;
}

function getPaperList(data) {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.papers)) return data.papers;

    if (Array.isArray(data?.items)) return data.items;

    if (Array.isArray(data?.results)) return data.results;

    return [];
}

// ============================================
// LOAD ALL PAPERS
// ============================================

async function loadPapers() {
    const grid = $("#paperGrid");

    if (grid) {
        grid.innerHTML = '<p class="muted">Loading papers...</p>';
    }

    try {
        // Fetch the complete list without sending
        // lowercase exam filter values to the backend.
        const data = await api("/api/papers");

        allPapers = getPaperList(data);

        updateFilterOptions();
        applyFilters();

    } catch (error) {
        console.error("Paper loading error:", error);

        if ($("#resultCount")) {
            $("#resultCount").textContent = "Archive unavailable";
        }

        if (grid) {
            grid.innerHTML = `
                <div class="empty">
                    <h3>Unable to load papers</h3>
                    <p>${escapeHtml(error.message)}</p>
                    <button onclick="loadPapers()">Try again</button>
                </div>
            `;
        }
    }
}

// ============================================
// POPULATE SUBJECT AND YEAR FILTERS
// ============================================

function updateFilterOptions() {
    const subjectFilter = $("#subjectFilter");
    const yearFilter = $("#yearFilter");

    if (!subjectFilter || !yearFilter) return;

    const selectedSubject = subjectFilter.value;
    const selectedYear = yearFilter.value;

    const subjects = [
        ...new Set(
            allPapers
                .map(p => String(p.subject || "").trim())
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    const years = [
        ...new Set(
            allPapers
                .map(p => String(p.year || "").trim())
                .filter(Boolean)
        )
    ].sort((a, b) => Number(b) - Number(a));

    subjectFilter.innerHTML =
        '<option value="">All subjects</option>';

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectFilter.appendChild(option);
    });

    yearFilter.innerHTML =
        '<option value="">All years</option>';

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    if (subjects.includes(selectedSubject)) {
        subjectFilter.value = selectedSubject;
    }

    if (years.includes(selectedYear)) {
        yearFilter.value = selectedYear;
    }
}

// ============================================
// SEARCH AND FILTER PAPERS
// ============================================

function applyFilters() {
    const search = ($("#searchInput")?.value || "")
        .trim()
        .toLowerCase();

    const selectedExam = normalizeExam(
        $("#examFilter")?.value || ""
    );

    const selectedSubject =
        $("#subjectFilter")?.value || "";

    const selectedYear =
        $("#yearFilter")?.value || "";

    currentPapers = allPapers.filter(paper => {
        const examMatch =
            !selectedExam ||
            normalizeExam(paper.exam) === selectedExam;

        const subjectMatch =
            !selectedSubject ||
            String(paper.subject || "") === selectedSubject;

        const yearMatch =
            !selectedYear ||
            String(paper.year) === selectedYear;

        const searchableText = [
            paper.title,
            paper.subject,
            paper.exam,
            paper.year,
            paper.description,
            paper.session,
            paper.class_name
        ].join(" ").toLowerCase();

        const searchMatch =
            !search || searchableText.includes(search);

        return (
            examMatch &&
            subjectMatch &&
            yearMatch &&
            searchMatch
        );
    });

    renderPapers();
}

// ============================================
// DISPLAY PAPER CARDS
// ============================================

function renderPapers() {
    const grid = $("#paperGrid");

    if (!grid) return;

    const count = $("#resultCount");

    if (count) {
        count.textContent =
            `${currentPapers.length} papers found`;
    }

    if (currentPapers.length === 0) {
        grid.innerHTML = `
            <div class="empty">
                <h3>No papers found!</h3>
                <p>Try changing your search or filters.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = currentPapers.map(paper => {
        const fileUrl =
            `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file`;

        const exam = displayExam(paper.exam);

        const className = paper.class_name
            ? `Class ${escapeHtml(paper.class_name)}`
            : "";

        let actions = "";

        if (paper.hasFile) {
            actions = `
                <a href="#"
                   class="preview-paper"
                   data-paper-id="${escapeHtml(paper.id)}">
                    Preview PDF ↗
                </a>

                <a class="download"
                   href="${fileUrl}?download=1"
                   target="_blank"
                   rel="noopener">
                    Download ↓
                </a>
            `;
        } else if (paper.sourceUrl) {
            actions = `
                <a class="download"
                   href="${escapeHtml(paper.sourceUrl)}"
                   target="_blank"
                   rel="noopener">
                    Open source ↗
                </a>
            `;
        } else {
            actions = `
                <span class="muted">PDF not available</span>
            `;
        }

        return `
            <article class="paper-card">
                <div class="stripe"></div>

                <div class="paper-body">

                    <div class="meta">
                        <span class="tag">
                            ${escapeHtml(exam)}
                        </span>

                        <span>
                            ${escapeHtml(paper.year || "")}
                        </span>
                    </div>

                    <h3>
                        ${escapeHtml(paper.title || "Question Paper")}
                    </h3>

                    <p>
                        <strong>
                            ${escapeHtml(paper.subject || "General")}
                        </strong>

                        ${className
                            ? ` · ${className}`
                            : ""}

                        ${paper.session
                            ? ` · ${escapeHtml(paper.session)}`
                            : ""}

                        ${paper.description
                            ? `<br>${escapeHtml(paper.description)}`
                            : ""}
                    </p>

                    <div class="actions">
                        ${actions}
                    </div>

                </div>
            </article>
        `;
    }).join("");
}

// ============================================
// SEARCH EVENTS
// ============================================

$("#searchBtn")?.addEventListener("click", applyFilters);

$("#searchInput")?.addEventListener("input", applyFilters);

$("#searchInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        applyFilters();
    }
});

$("#examFilter")?.addEventListener("change", applyFilters);

$("#subjectFilter")?.addEventListener("change", applyFilters);

$("#yearFilter")?.addEventListener("change", applyFilters);

// ============================================
// CLEAR FILTERS
// ============================================

$("#clearFilters")?.addEventListener("click", () => {
    if ($("#searchInput")) $("#searchInput").value = "";
    if ($("#examFilter")) $("#examFilter").value = "";
    if ($("#subjectFilter")) $("#subjectFilter").value = "";
    if ($("#yearFilter")) $("#yearFilter").value = "";

    applyFilters();
});

// ============================================
// PDF PREVIEW
// ============================================

const pdfModal = $("#pdfModal");
const pdfFrame = $("#pdfFrame");
const pdfTitle = $("#pdfTitle");
const pdfDownload = $("#pdfDownload");

$("#paperGrid")?.addEventListener("click", event => {
    const button = event.target.closest(".preview-paper");

    if (!button) return;

    event.preventDefault();

    const paper = allPapers.find(
        p => String(p.id) === button.dataset.paperId
    );

    if (!paper || !paper.hasFile) return;

    const fileUrl =
        `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file`;

    if (pdfTitle) {
        pdfTitle.textContent =
            paper.title || "Question Paper Preview";
    }

    if (pdfFrame) pdfFrame.src = fileUrl;

    if (pdfDownload) {
        pdfDownload.href = fileUrl + "?download=1";
    }

    pdfModal?.classList.add("active");
    pdfModal?.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
});

function closePdfViewer() {
    pdfModal?.classList.remove("active");
    pdfModal?.setAttribute("aria-hidden", "true");

    if (pdfFrame) pdfFrame.src = "about:blank";

    document.body.style.overflow = "";
}

$("#closePdf")?.addEventListener("click", closePdfViewer);

pdfModal?.addEventListener("click", event => {
    if (event.target === pdfModal) {
        closePdfViewer();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closePdfViewer();
    }
});

// ============================================
// ADMIN LOGIN
// ============================================

async function checkSession() {
    try {
        const data = await api("/api/session");

        if (data?.session) {
            showDashboard(data.session.email);
        }
    } catch (error) {
        console.log("No active admin session");
    }
}

$("#loginForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const message = $("#loginMessage");

    if (message) message.textContent = "Signing in...";

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

    } catch (error) {
        if (message) message.textContent = error.message;
    }
});

// ============================================
// ADMIN DASHBOARD
// ============================================

async function showDashboard(email) {
    const root = $("#adminRoot");

    if (!root) return;

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
                    <button class="secondary" id="refreshBtn">
                        Refresh
                    </button>
                </div>

                <div id="editor"></div>
                <div id="adminPapers"></div>

            </div>
        </div>
    `;

    $("#logoutBtn").onclick = async () => {
        try {
            await api("/api/auth/logout", {
                method: "POST"
            });
        } finally {
            location.reload();
        }
    };

    $("#newPaperBtn").onclick = () => showEditor();

    $("#refreshBtn").onclick = refreshAdmin;

    await refreshAdmin();
}

// ============================================
// ADMIN STATISTICS AND PAPER LIST
// ============================================

async function refreshAdmin() {
    const adminPapers = $("#adminPapers");
    const statsElement = $("#stats");

    try {
        const papers = getPaperList(await api("/api/papers"));

        let stats = null;

        // Try the available dashboard endpoints.
        for (const endpoint of [
            "/api/admin/dashboard",
            "/api/dashboard",
            "/api/stats"
        ]) {
            try {
                stats = await api(endpoint);
                break;
            } catch (error) {
                console.log(`Dashboard endpoint unavailable: ${endpoint}`);
            }
        }

        if (statsElement) {
            const total =
                stats?.total ?? stats?.total_papers ?? papers.length;

            const withFile =
                stats?.withFile ?? stats?.with_file ??
                papers.filter(p => p.hasFile).length;

            const downloads =
                stats?.downloads ?? stats?.total_downloads ?? 0;

            statsElement.innerHTML = `
                <div class="stat">
                    <strong>${total}</strong>
                    <span>Total papers</span>
                </div>

                <div class="stat">
                    <strong>${withFile}</strong>
                    <span>With PDF files</span>
                </div>

                <div class="stat">
                    <strong>${downloads}</strong>
                    <span>Total downloads</span>
                </div>
            `;
        }

        if (!adminPapers) return;

        adminPapers.innerHTML = `
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
                    ${papers.map(paper => `
                        <tr>
                            <td>${escapeHtml(paper.title)}</td>
                            <td>${escapeHtml(displayExam(paper.exam))}</td>
                            <td>${escapeHtml(paper.year)}</td>
                            <td>
                                <button data-edit="${escapeHtml(paper.id)}">
                                    Edit
                                </button>

                                <button data-delete="${escapeHtml(paper.id)}">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        document.querySelectorAll("[data-edit]").forEach(button => {
            button.onclick = () => {
                const paper = papers.find(
                    p => String(p.id) === button.dataset.edit
                );

                showEditor(paper);
            };
        });

        document.querySelectorAll("[data-delete]").forEach(button => {
            button.onclick = () => deletePaper(button.dataset.delete);
        });

    } catch (error) {
        if (adminPapers) {
            adminPapers.textContent = error.message;
        }
    }
}

// ============================================
// ADMIN ADD / EDIT PAPER
// ============================================

function showEditor(paper = null) {
    const editor = $("#editor");

    if (!editor) return;

    editor.innerHTML = `
        <h3>${paper ? "Edit paper" : "Add a paper"}</h3>

        <form id="paperForm" class="paper-form">

            <label>
                Exam

                <select name="exam">
                    <option value="JEE Main">JEE Main</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="NEET">NEET</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="ISC">ISC</option>
                </select>
            </label>

            <label>
                Year

                <input
                    name="year"
                    type="number"
                    min="1990"
                    max="2100"
                    required
                    value="${escapeHtml(paper?.year || new Date().getFullYear())}"
                >
            </label>

            <label>
                Subject

                <input
                    name="subject"
                    required
                    maxlength="100"
                    value="${escapeHtml(paper?.subject || "")}"
                >
            </label>

            <label>
                Session / shift

                <input
                    name="session"
                    maxlength="120"
                    value="${escapeHtml(paper?.session || "")}"
                >
            </label>

            <label>
                Paper title

                <input
                    name="title"
                    required
                    minlength="3"
                    maxlength="240"
                    value="${escapeHtml(paper?.title || "")}"
                >
            </label>

            <label>
                Description

                <textarea name="description">${escapeHtml(paper?.description || "")}</textarea>
            </label>

            <label>
                Source URL (optional)

                <input
                    name="sourceUrl"
                    type="url

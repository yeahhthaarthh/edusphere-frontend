
const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";

// ELEMENTS
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const examFilter = document.getElementById("examFilter");
const subjectFilter = document.getElementById("subjectFilter");
const yearFilter = document.getElementById("yearFilter");
const clearFilters = document.getElementById("clearFilters");
const paperGrid = document.getElementById("paperGrid");
const resultCount = document.getElementById("resultCount");

const pdfModal = document.getElementById("pdfModal");
const pdfFrame = document.getElementById("pdfFrame");
const pdfTitle = document.getElementById("pdfTitle");
const pdfDownload = document.getElementById("pdfDownload");
const closePdf = document.getElementById("closePdf");

const adminRoot = document.getElementById("adminRoot");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

let allPapers = [];
let filteredPapers = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-");
}

function getExamName(exam) {
    const names = {
        "jee-main": "JEE Main",
        "jee-advanced": "JEE Advanced",
        "neet": "NEET",
        "cbse": "CBSE",
        "isc-12": "ISC Class 12",
        "isc": "ISC",
        "icse-10": "ICSE Class 10",
        "icse": "ICSE"
    };

    return names[normalize(exam)] || exam || "Other";
}

function getPaperURL(paper) {
    return `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file`;
}

// LOAD PAPERS
async function loadPapers() {
    try {
        resultCount.textContent = "Loading papers...";
        paperGrid.innerHTML = "<p>Loading papers...</p>";

        const response = await fetch(`${API_BASE}/api/papers/`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Handle different API response formats
        allPapers = Array.isArray(data)
            ? data
            : Array.isArray(data.papers)
                ? data.papers
                : Array.isArray(data.items)
                    ? data.items
                    : Array.isArray(data.results)
                        ? data.results
                        : [];

        console.log("EduSphere papers received:", allPapers.length);
        console.log("First paper:", allPapers[0]);

        if (allPapers.length === 0) {
            resultCount.textContent = "0 papers found";
            paperGrid.innerHTML = "<p class='muted'>The archive is currently empty.</p>";
            return;
        }

        populateFilters();
        applyFilters();

    } catch (error) {
        console.error("EduSphere error:", error);
        resultCount.textContent = "Unable to load papers";
        paperGrid.innerHTML = `
            <p class="muted">
                Could not connect to the archive.
                Please try again later.
            </p>
        `;
    }
}

// FILTER OPTIONS
function populateFilters() {
    const subjects = [...new Set(
        allPapers.map(p => p.subject).filter(Boolean)
    )].sort();

    const years = [...new Set(
        allPapers.map(p => p.year).filter(Boolean).map(String)
    )].sort((a, b) => Number(b) - Number(a));

    subjectFilter.innerHTML = '<option value="">All subjects</option>';
    yearFilter.innerHTML = '<option value="">All years</option>';

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectFilter.appendChild(option);
    });

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// FILTER PAPERS
function applyFilters() {
    const exam = normalize(examFilter.value);
    const subject = normalize(subjectFilter.value);
    const year = String(yearFilter.value || "");
    const search = normalize(searchInput.value);

    filteredPapers = allPapers.filter(paper => {

        const matchesExam =
            !exam || normalize(paper.exam) === exam;

        const matchesSubject =
            !subject || normalize(paper.subject) === subject;

        const matchesYear =
            !year || String(paper.year) === year;

        const searchableText = normalize([
            paper.title,
            paper.exam,
            paper.subject,
            paper.year,
            paper.session,
            paper.description
        ].join(" "));

        const matchesSearch =
            !search || searchableText.includes(search);

        return matchesExam && matchesSubject &&
            matchesYear && matchesSearch;
    });

    renderPapers();
}

// DISPLAY PAPERS
function renderPapers() {
    resultCount.textContent = `${filteredPapers.length} papers found`;

    if (!filteredPapers.length) {
        paperGrid.innerHTML = `
            <p class="muted">No papers found. Try changing your filters.</p>
        `;
        return;
    }

    paperGrid.innerHTML = filteredPapers.map(paper => {
        const title = escapeHTML(paper.title);
        const subject = escapeHTML(paper.subject);
        const exam = escapeHTML(getExamName(paper.exam));
        const year = escapeHTML(paper.year);
        const session = escapeHTML(paper.session || "Regular");
        const description = escapeHTML(
            paper.description || "Official question paper"
        );

        const fileURL = getPaperURL(paper);

        return `
            <article class="paper-card">
                <div class="paper-card-content">
                    <span class="paper-tag">${exam}</span>
                    <h3>${title}</h3>
                    <p>${description}</p>

                    <div class="paper-meta">
                        <span>${subject}</span>
                        <span>${year}</span>
                        <span>${session}</span>
                    </div>

                    <div class="paper-actions">
                        <button
                            type="button"
                            class="primary preview-paper"
                            data-id="${escapeHTML(paper.id)}">
                            Preview
                        </button>

                        <a class="primary"
                           href="${fileURL}"
                           target="_blank"
                           rel="noopener">
                            Open / Download
                        </a>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

// PDF PREVIEW
function openPDF(paper) {
    const url = getPaperURL(paper);

    pdfTitle.textContent = paper.title || "Question Paper";
    pdfFrame.src = url;
    pdfDownload.href = url;

    pdfModal.style.display = "flex";
    pdfModal.setAttribute("aria-hidden", "false");
}

function closePDFModal() {
    pdfModal.style.display = "none";
    pdfModal.setAttribute("aria-hidden", "true");
    pdfFrame.src = "about:blank";
}

paperGrid.addEventListener("click", event => {
    const button = event.target.closest(".preview-paper");
    if (!button) return;

    const paper = allPapers.find(
        item => String(item.id) === button.dataset.id
    );

    if (paper) openPDF(paper);
});

closePdf?.addEventListener("click", closePDFModal);

pdfModal?.addEventListener("click", event => {
    if (event.target === pdfModal) closePDFModal();
});

// SEARCH AND FILTER EVENTS
searchBtn?.addEventListener("click", applyFilters);
searchInput?.addEventListener("input", applyFilters);

searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") applyFilters();
});

examFilter?.addEventListener("change", applyFilters);
subjectFilter?.addEventListener("change", applyFilters);
yearFilter?.addEventListener("change", applyFilters);

clearFilters?.addEventListener("click", () => {
    searchInput.value = "";
    examFilter.value = "";
    subjectFilter.value = "";
    yearFilter.value = "";
    applyFilters();
});

// ADMIN SESSION
async function checkSession() {
    try {
        const response = await fetch(`${API_BASE}/api/session/`, {
            credentials: "include"
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.session?.isAdmin) {
            showAdminSession(data.session.email);
        }
    } catch (error) {
        console.error("Session check failed:", error);
    }
}

function showAdminSession(email) {
    if (!adminRoot) return;

    adminRoot.innerHTML = `
        <div class="login-card">
            <div class="login-icon">✳</div>
            <h3>Welcome, admin!</h3>
            <p class="muted">${escapeHTML(email)}</p>
            <button id="logoutButton" class="primary" type="button">
                Sign out
            </button>
        </div>
    `;

    document.getElementById("logoutButton")
        ?.addEventListener("click", logoutAdmin);
}

// ADMIN LOGIN
loginForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = formData.get("email");
    const password = formData.get("password");

    loginMessage.textContent = "Signing in...";

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed");
        }

        loginMessage.textContent = "Login successful";
        showAdminSession(data.session.email);

    } catch (error) {
        loginMessage.textContent = error.message;
    }
});

// ADMIN LOGOUT
async function logoutAdmin() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            credentials: "include"
        });

        location.reload();
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// START
loadPapers();
checkSession();

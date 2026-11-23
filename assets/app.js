
const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";

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
let visibleCount = 12;

const PAGE_SIZE = 100;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

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
        .replace(/[_\s]+/g, "-")
        .replace(/[^\w-]/g, "");
}

function getExamName(exam) {
    const names = {
        "jee-main": "JEE Main",
        "jee-advanced": "JEE Advanced",
        "neet": "NEET",
        "cbse": "CBSE",
        "isc": "ISC",
        "isc-12": "ISC Class 12",
        "icse": "ICSE",
        "icse-10": "ICSE Class 10"
    };

    return names[normalize(exam)] || exam || "Other";
}

function getPaperURL(paper) {
    return `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file`;
}

function getClassName(paper) {
    return String(
        paper.class_name ??
        paper.className ??
        paper.class ??
        ""
    ).trim();
}

function getSubjectCategory(subject) {
    const value = normalize(subject);

    if (/physics/.test(value)) return "Physics";
    if (/chemistry/.test(value)) return "Chemistry";
    if (/mathematics|maths|math/.test(value)) return "Mathematics";
    if (/biology|botany|zoology/.test(value)) return "Biology";

    return "Other";
}

// --------------------------------------------------
// ADD CLASS FILTER AND LOAD MORE BUTTON
// --------------------------------------------------

let classFilter;

function setupExtraControls() {
    const filterControls = document.querySelector(".filter-controls");

    if (filterControls && !document.getElementById("classFilter")) {
        const label = document.createElement("label");
        label.innerHTML = `
            Class
            <select id="classFilter">
                <option value="">All classes</option>
            </select>
        `;

        filterControls.appendChild(label);
    }

    classFilter = document.getElementById("classFilter");

    if (paperGrid && !document.getElementById("loadMoreButton")) {
        const button = document.createElement("button");

        button.id = "loadMoreButton";
        button.type = "button";
        button.className = "primary";
        button.textContent = "Load more papers";
        button.style.display = "none";
        button.style.margin = "24px auto";
        button.style.padding = "12px 26px";

        paperGrid.insertAdjacentElement("afterend", button);

        button.addEventListener("click", () => {
            visibleCount += 12;
            renderPapers();
        });
    }

    classFilter?.addEventListener("change", applyFilters);
}

// --------------------------------------------------
// LOAD ALL PAPERS USING PAGINATION
// --------------------------------------------------

async function loadPapers() {
    try {
        resultCount.textContent = "Loading archive...";
        paperGrid.innerHTML = "<p>Loading papers...</p>";

        allPapers = [];

        let offset = 0;
        let batch = [];
        let safetyCounter = 0;

        do {
            const url =
                `${API_BASE}/api/papers/?limit=${PAGE_SIZE}&offset=${offset}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            batch = Array.isArray(data)
                ? data
                : data.papers || data.items || data.results || [];

            if (!Array.isArray(batch)) batch = [];

            allPapers.push(...batch);

            offset += batch.length;
            safetyCounter++;

            if (batch.length === 0) break;

        } while (
            batch.length === PAGE_SIZE &&
            safetyCounter < 50
        );

        // Remove duplicate records by ID
        const unique = new Map();

        allPapers.forEach(paper => {
            if (paper.id !== undefined) {
                unique.set(String(paper.id), paper);
            }
        });

        allPapers = [...unique.values()];

        console.log("Total archive records:", allPapers.length);

        setupExtraControls();
        populateFilters();
        applyFilters();

    } catch (error) {
        console.error("Archive loading error:", error);

        resultCount.textContent = "Unable to load archive";

        paperGrid.innerHTML = `
            <p class="muted">
                Could not connect to the archive.
                Please refresh and try again.
            </p>
        `;
    }
}

// --------------------------------------------------
// DYNAMIC FILTER OPTIONS
// --------------------------------------------------

function populateFilters() {
    updateClassOptions();
    updateYearOptions();
    updateSubjectOptions();
}

function updateClassOptions() {
    if (!classFilter) return;

    const selected = classFilter.value;

    const classes = [...new Set(
        allPapers
            .map(getClassName)
            .filter(Boolean)
    )].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

    classFilter.innerHTML =
        '<option value="">All classes</option>';

    classes.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = /^10$/.test(value)
            ? "Class 10"
            : /^12$/.test(value)
                ? "Class 12"
                : `Class ${value}`;

        classFilter.appendChild(option);
    });

    if (classes.includes(selected)) {
        classFilter.value = selected;
    }
}

function updateYearOptions() {
    const selected = yearFilter.value;

    const years = [...new Set(
        allPapers
            .map(paper => String(paper.year ?? "").trim())
            .filter(year => /^\d{4}$/.test(year))
    )].sort((a, b) => Number(b) - Number(a));

    yearFilter.innerHTML =
        '<option value="">All years</option>';

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    if (years.includes(selected)) {
        yearFilter.value = selected;
    }
}

function updateSubjectOptions() {
    const selectedExam = normalize(examFilter.value);
    const selectedSubject = subjectFilter.value;

    const relevantPapers = allPapers.filter(paper => {
        return !selectedExam ||
            normalize(paper.exam) === selectedExam;
    });

    const subjects = [...new Set(
        relevantPapers
            .map(paper => paper.subject)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    subjectFilter.innerHTML = "";

    subjectFilter.add(
        new Option("All subjects", "")
    );

    const categories = [
        "Physics",
        "Chemistry",
        "Mathematics",
        "Biology",
        "Other"
    ];

    const isCompetitive =
        ["jee-main", "jee-advanced", "neet"].includes(selectedExam);

    if (isCompetitive) {
        categories.forEach(category => {
            const matching = subjects.filter(subject =>
                getSubjectCategory(subject) === category
            );

            if (!matching.length) return;

            const group = document.createElement("optgroup");
            group.label = category;

            matching.forEach(subject => {
                group.appendChild(new Option(subject, subject));
            });

            subjectFilter.appendChild(group);
        });
    } else {
        subjects.forEach(subject => {
            subjectFilter.add(new Option(subject, subject));
        });
    }

    if (subjects.includes(selectedSubject)) {
        subjectFilter.value = selectedSubject;
    }
}

// --------------------------------------------------
// FILTER PAPERS
// --------------------------------------------------

function applyFilters() {
    const exam = normalize(examFilter.value);
    const subject = normalize(subjectFilter.value);
    const year = String(yearFilter.value || "");
    const selectedClass = classFilter?.value || "";
    const search = normalize(searchInput.value);

    filteredPapers = allPapers.filter(paper => {
        const matchesExam =
            !exam || normalize(paper.exam) === exam;

        const matchesSubject =
            !subject || normalize(paper.subject) === subject;

        const matchesYear =
            !year || String(paper.year) === year;

        const matchesClass =
            !selectedClass || getClassName(paper) === selectedClass;

        const searchableText = normalize([
            paper.title,
            paper.exam,
            paper.subject,
            paper.year,
            paper.session,
            paper.description,
            paper.class_name,
            paper.subject_code
        ].join(" "));

        const matchesSearch =
            !search || searchableText.includes(search);

        return matchesExam &&
            matchesSubject &&
            matchesYear &&
            matchesClass &&
            matchesSearch;
    });

    visibleCount = 12;
    renderPapers();
}

// --------------------------------------------------
// DISPLAY PAPERS
// --------------------------------------------------

function renderPapers() {
    resultCount.textContent =
        `${filteredPapers.length} papers found`;

    const visiblePapers =
        filteredPapers.slice(0, visibleCount);

    const loadMoreButton =
        document.getElementById("loadMoreButton");

    if (!filteredPapers.length) {
        paperGrid.innerHTML = `
            <p class="muted">
                No papers found. Try another search or filter.
            </p>
        `;

        if (loadMoreButton) {
            loadMoreButton.style.display = "none";
        }

        return;
    }

    paperGrid.innerHTML = visiblePapers.map(paper => {
        const title = escapeHTML(paper.title);
        const subject = escapeHTML(paper.subject);
        const exam = escapeHTML(getExamName(paper.exam));
        const year = escapeHTML(paper.year);
        const className = escapeHTML(getClassName(paper));
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
                        ${className ? `<span>Class ${className}</span>` : ""}
                        <span>${session}</span>
                    </div>

                    <div class="paper-actions">
                        <button
                            type="button"
                            class="primary preview-paper"
                            data-id="${escapeHTML(paper.id)}">
                            Preview
                        </button>

                        <a
                            class="primary"
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

    if (loadMoreButton) {
        loadMoreButton.style.display =
            visibleCount < filteredPapers.length ? "block" : "none";

        loadMoreButton.textContent =
            `Load more (${filteredPapers.length - visiblePapers.length} remaining)`;
    }
}

// --------------------------------------------------
// PREVIEW: OPEN IN NEW TAB
// --------------------------------------------------

paperGrid.addEventListener("click", event => {
    const button = event.target.closest(".preview-paper");

    if (!button) return;

    const paper = allPapers.find(
        item => String(item.id) === button.dataset.id
    );

    if (!paper) return;

    // Open the archive file endpoint in a new browser tab.
    // The backend must serve PDFs inline for browser preview.
    window.open(getPaperURL(paper), "_blank", "noopener");
});

// Keep old modal controls safe if they are present.
function closePDFModal() {
    if (!pdfModal) return;

    pdfModal.style.display = "none";
    pdfModal.setAttribute("aria-hidden", "true");

    if (pdfFrame) pdfFrame.src = "about:blank";
}

closePdf?.addEventListener("click", closePDFModal);

pdfModal?.addEventListener("click", event => {
    if (event.target === pdfModal) closePDFModal();
});

// --------------------------------------------------
// SEARCH AND FILTER EVENTS
// --------------------------------------------------

searchBtn?.addEventListener("click", applyFilters);

searchInput?.addEventListener("input", applyFilters);

searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") applyFilters();
});

examFilter?.addEventListener("change", () => {
    updateSubjectOptions();
    applyFilters();
});

subjectFilter?.addEventListener("change", applyFilters);
yearFilter?.addEventListener("change", applyFilters);

clearFilters?.addEventListener("click", () => {
    searchInput.value = "";
    examFilter.value = "";
    subjectFilter.value = "";
    yearFilter.value = "";

    if (classFilter) classFilter.value = "";

    updateSubjectOptions();
    applyFilters();
});

// --------------------------------------------------
// ADMIN SESSION
// --------------------------------------------------

async function checkSession() {
    try {
        const response = await fetch(
            `${API_BASE}/api/session/`,
            { credentials: "include" }
        );

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

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

loginForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(loginForm);

    const email = formData.get("email");
    const password = formData.get("password");

    loginMessage.textContent = "Signing in...";

    try {
        const response = await fetch(
            `${API_BASE}/api/auth/login`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            }
        );

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

// --------------------------------------------------
// ADMIN LOGOUT
// --------------------------------------------------

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

// --------------------------------------------------
// START
// --------------------------------------------------

setupExtraControls();
loadPapers();
checkSession();

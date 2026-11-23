
/* =========================================
   EDUSPHERE - COMPLETE FRONTEND APP
   Backend: FastAPI + Supabase
   ========================================= */

const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";

const PAGE_SIZE = 100;
const INITIAL_DISPLAY = 12;
const DISPLAY_STEP = 12;

let allPapers = [];
let filteredPapers = [];
let visibleCount = INITIAL_DISPLAY;
let selectedExam = "";
let selectedSubject = "";
let selectedYear = "";
let selectedClass = "";
let searchTerm = "";
let isLoading = false;

const $ = (id) => document.getElementById(id);

const examFilter = $("examFilter");
const subjectFilter = $("subjectFilter");
const yearFilter = $("yearFilter");
const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const clearFilters = $("clearFilters");
const paperGrid = $("paperGrid");
const resultCount = $("resultCount");

/* ---------- HELPERS ---------- */

function clean(value) {
    return String(value ?? "").trim();
}

function normalize(value) {
    return clean(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getExam(paper) {
    return normalize(paper.exam);
}

function getYear(paper) {
    return clean(paper.year);
}

function getClass(paper) {
    return clean(
        paper.class_name ??
        paper.className ??
        paper.class ??
        ""
    );
}

function getSubject(paper) {
    return clean(paper.subject || "General");
}

function getPaperURL(paper) {
    return `${API_BASE}/api/papers/${encodeURIComponent(paper.id)}/file/`;
}

/* ---------- CLASS FILTER ---------- */

function setupClassFilter() {
    if ($("classFilter")) return;

    const classSelect = document.createElement("select");
    classSelect.id = "classFilter";
    classSelect.innerHTML = '<option value="">All Classes</option>';

    const filters = document.querySelector(".filter-controls");

    if (filters) {
        filters.appendChild(classSelect);
    } else if (examFilter?.parentElement) {
        examFilter.parentElement.appendChild(classSelect);
    }

    classSelect.addEventListener("change", () => {
        selectedClass = classSelect.value;
        applyFilters();
    });
}

/* ---------- FETCH COMPLETE ARCHIVE ---------- */

async function fetchPaperBatch(offset) {
    const url =
        `${API_BASE}/api/papers/?limit=${PAGE_SIZE}&offset=${offset}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Supports both a direct array and common paginated responses.
    if (Array.isArray(data)) return data;

    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.papers)) return data.papers;

    throw new Error("Unexpected API response format");
}

async function loadPapers() {
    if (isLoading) return;

    isLoading = true;

    if (paperGrid) {
        paperGrid.innerHTML = "<p>Loading complete archive...</p>";
    }

    try {
        const collected = new Map();
        let offset = 0;
        let pagesLoaded = 0;
        const MAX_PAGES = 200;

        while (pagesLoaded < MAX_PAGES) {
            const batch = await fetchPaperBatch(offset);

            if (!batch.length) break;

            let newRecords = 0;

            for (const paper of batch) {
                if (paper && paper.id !== undefined && paper.id !== null) {
                    const id = String(paper.id);

                    if (!collected.has(id)) {
                        collected.set(id, paper);
                        newRecords++;
                    }
                }
            }

            pagesLoaded++;

            // Stop if the API repeats a batch or gives no new records.
            if (newRecords === 0) break;

            // Move by the number actually returned, not by an assumed count.
            offset += batch.length;

            // A short batch means we reached the end.
            if (batch.length < PAGE_SIZE) break;
        }

        allPapers = Array.from(collected.values());

        // Sort newest first, then highest ID first.
        allPapers.sort((a, b) => {
            const yearDifference =
                Number(b.year || 0) - Number(a.year || 0);

            if (yearDifference !== 0) return yearDifference;

            return Number(b.id || 0) - Number(a.id || 0);
        });

        setupClassFilter();
        populateYearFilter();
        populateClassFilter();
        populateSubjectFilter();

        applyFilters();

        console.log("EduSphere archive loaded:", allPapers.length);
        console.log("Pages fetched:", pagesLoaded);

    } catch (error) {
        console.error("Archive loading error:", error);

        if (paperGrid) {
            paperGrid.innerHTML = `
                <div class="archive-error">
                    <h3>Unable to load archive</h3>
                    <p>${escapeHTML(error.message)}</p>
                    <button type="button" id="retryArchive">
                        Try Again
                    </button>
                </div>
            `;

            $("retryArchive")?.addEventListener("click", loadPapers);
        }

        if (resultCount) {
            resultCount.textContent = "Archive loading failed";
        }
    } finally {
        isLoading = false;
    }
}

/* ---------- FILTER OPTIONS ---------- */

function populateYearFilter() {
    if (!yearFilter) return;

    const currentValue = yearFilter.value;

    const years = [...new Set(
        allPapers
            .map(getYear)
            .filter(Boolean)
    )].sort((a, b) => Number(b) - Number(a));

    yearFilter.innerHTML =
        '<option value="">All Years</option>';

    years.forEach((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    if (years.includes(currentValue)) {
        yearFilter.value = currentValue;
    }
}

function populateClassFilter() {
    const classSelect = $("classFilter");
    if (!classSelect) return;

    const currentValue = classSelect.value;

    const classes = [...new Set(
        allPapers.map(getClass).filter(Boolean)
    )].sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true });
    });

    classSelect.innerHTML =
        '<option value="">All Classes</option>';

    classes.forEach((className) => {
        const option = document.createElement("option");
        option.value = className;
        option.textContent =
            /^class/i.test(className)
                ? className
                : `Class ${className}`;

        classSelect.appendChild(option);
    });

    if (classes.includes(currentValue)) {
        classSelect.value = currentValue;
    }
}

/* ---------- SUBJECT GROUPS ---------- */

function getSubjectCategory(subject) {
    const value = normalize(subject);

    if (
        value.includes("physics") ||
        value === "phy"
    ) return "Physics";

    if (
        value.includes("chemistry") ||
        value === "chem"
    ) return "Chemistry";

    if (
        value.includes("math") ||
        value.includes("mathematics")
    ) return "Mathematics";

    if (
        value.includes("biology") ||
        value.includes("botany") ||
        value.includes("zoology")
    ) return "Biology";

    return "Other";
}

function populateSubjectFilter() {
    if (!subjectFilter) return;

    const currentValue = subjectFilter.value;
    const exam = normalize(examFilter?.value);

    let papers = allPapers;

    if (exam) {
        papers = papers.filter(
            paper => getExam(paper) === exam
        );
    }

    const subjects = [...new Set(
        papers.map(getSubject).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    subjectFilter.innerHTML =
        '<option value="">All Subjects</option>';

    const competitive =
        exam.includes("jee") || exam.includes("neet");

    if (competitive) {
        const groups = {
            "Physics": [],
            "Chemistry": [],
            "Mathematics": [],
            "Biology": [],
            "Other": []
        };

        subjects.forEach((subject) => {
            groups[getSubjectCategory(subject)].push(subject);
        });

        Object.entries(groups).forEach(([groupName, values]) => {
            if (!values.length) return;

            const group = document.createElement("optgroup");
            group.label = groupName;

            values.forEach((subject) => {
                const option = document.createElement("option");
                option.value = subject;
                option.textContent = subject;
                group.appendChild(option);
            });

            subjectFilter.appendChild(group);
        });
    } else {
        subjects.forEach((subject) => {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            subjectFilter.appendChild(option);
        });
    }

    if (subjects.includes(currentValue)) {
        subjectFilter.value = currentValue;
    } else {
        subjectFilter.value = "";
    }

    selectedSubject = subjectFilter.value;
}

/* ---------- SEARCH AND FILTERING ---------- */

function applyFilters() {
    selectedExam = normalize(examFilter?.value);
    selectedSubject = subjectFilter?.value || "";
    selectedYear = yearFilter?.value || "";
    selectedClass = $("classFilter")?.value || "";
    searchTerm = normalize(searchInput?.value);

    const searchWords = searchTerm
        .split(/\s+/)
        .filter(Boolean);

    filteredPapers = allPapers.filter((paper) => {
        if (
            selectedExam &&
            getExam(paper) !== selectedExam
        ) return false;

        if (
            selectedSubject &&
            getSubject(paper) !== selectedSubject
        ) return false;

        if (
            selectedYear &&
            getYear(paper) !== selectedYear
        ) return false;

        if (
            selectedClass &&
            getClass(paper) !== selectedClass
        ) return false;

        if (searchWords.length) {
            const searchableText = normalize([
                paper.title,
                paper.exam,
                paper.subject,
                paper.year,
                paper.session,
                paper.description,
                paper.class_name,
                paper.subject_code,
                paper.id
            ].join(" "));

            const matches = searchWords.every(word =>
                searchableText.includes(word)
            );

            if (!matches) return false;
        }

        return true;
    });

    visibleCount = INITIAL_DISPLAY;
    renderPapers();
}

/* ---------- PAPER CARDS ---------- */

function renderPapers() {
    if (!paperGrid) return;

    const visiblePapers = filteredPapers.slice(0, visibleCount);

    if (resultCount) {
        resultCount.textContent =
            `Showing ${visiblePapers.length} of ${filteredPapers.length} papers`;
    }

    if (!filteredPapers.length) {
        paperGrid.innerHTML = `
            <div class="no-results">
                <h3>No papers found</h3>
                <p>Try changing your search or filters.</p>
            </div>
        `;
        updateLoadMoreButton();
        return;
    }

    paperGrid.innerHTML = visiblePapers.map((paper) => {
        const title = escapeHTML(
            paper.title || `${paper.exam || ""} ${paper.subject || ""}`
        );

        const exam = escapeHTML(paper.exam || "Exam");
        const subject = escapeHTML(getSubject(paper));
        const year = escapeHTML(getYear(paper));
        const session = escapeHTML(paper.session || "");
        const className = escapeHTML(getClass(paper));
        const description = escapeHTML(
            paper.description || "Previous year question paper"
        );

        const classLabel = className
            ? `<span>Class ${className.replace(/^class\s*/i, "")}</span>`
            : "";

        return `
            <article class="paper-card">
                <div class="paper-info">
                    <div class="paper-tags">
                        <span>${exam}</span>
                        <span>${year}</span>
                        ${classLabel}
                    </div>

                    <h3>${title}</h3>

                    <p class="paper-subject">${subject}</p>
                    <p class="paper-description">${description}</p>

                    ${session
                        ? `<p class="paper-session">${session}</p>`
                        : ""}
                </div>

                <div class="paper-actions">
                    <button
                        type="button"
                        class="preview-button"
                        data-preview="${escapeHTML(paper.id)}">
                        Preview
                    </button>

                    <a
                        class="download-button"
                        href="${getPaperURL(paper)}"
                        target="_blank"
                        rel="noopener noreferrer">
                        PDF / Download
                    </a>
                </div>
            </article>
        `;
    }).join("");

    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    let button = $("loadMoreButton");

    if (!button) {
        button = document.createElement("button");
        button.id = "loadMoreButton";
        button.type = "button";
        button.textContent = "Load More Papers";

        paperGrid.insertAdjacentElement("afterend", button);

        button.addEventListener("click", () => {
            visibleCount += DISPLAY_STEP;
            renderPapers();
        });
    }

    button.style.display =
        visibleCount < filteredPapers.length
            ? "block"
            : "none";
}

/* ---------- PDF PREVIEW MODAL ---------- */

function openPreview(paper) {
    const modal = $("pdfModal");
    const frame = $("pdfFrame");
    const title = $("pdfTitle");
    const download = $("pdfDownload");

    if (!modal || !frame) {
        window.open(getPaperURL(paper), "_blank", "noopener");
        return;
    }

    if (title) {
        title.textContent = paper.title || "Paper Preview";
    }

    const url = getPaperURL(paper);

    frame.src = url;

    if (download) {
        download.href = url;
        download.target = "_blank";
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closePreview() {
    const modal = $("pdfModal");
    const frame = $("pdfFrame");

    if (!modal) return;

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");

    if (frame) frame.src = "about:blank";

    document.body.style.overflow = "";
}

/* ---------- ADMIN LOGIN / SESSION ---------- */

async function checkSession() {
    try {
        const response = await fetch(`${API_BASE}/api/session/`, {
            credentials: "include",
            cache: "no-store"
        });

        if (!response.ok) return;

        const data = await response.json();

        const loggedIn = Boolean(
            data.authenticated ||
            data.logged_in ||
            data.loggedIn ||
            data.admin
        );

        if ($("adminRoot")) {
            $("adminRoot").style.display =
                loggedIn ? "block" : "none";
        }

        if ($("adminNav")) {
            $("adminNav").style.display =
                loggedIn ? "block" : "none";
        }
    } catch (error) {
        console.warn("Admin session check failed:", error);
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const form = $("loginForm");
    const message = $("loginMessage");

    if (!form) return;

    const emailInput =
        form.querySelector('[type="email"]') ||
        form.querySelector('[name="email"]');

    const passwordInput =
        form.querySelector('[type="password"]') ||
        form.querySelector('[name="password"]');

    if (!emailInput || !passwordInput) return;

    if (message) message.textContent = "Signing in...";

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                email: emailInput.value,
                password: passwordInput.value
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || data.message || "Login failed");
        }

        if (message) {
            message.textContent = "Login successful";
        }

        form.reset();
        await checkSession();

    } catch (error) {
        if (message) message.textContent = error.message;
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.warn("Logout request failed:", error);
    }

    if ($("adminRoot")) $("adminRoot").style.display = "none";
    if ($("adminNav")) $("adminNav").style.display = "none";
}

/* ---------- EVENT LISTENERS ---------- */

function setupEvents() {
    examFilter?.addEventListener("change", () => {
        populateSubjectFilter();
        applyFilters();
    });

    subjectFilter?.addEventListener("change", applyFilters);
    yearFilter?.addEventListener("change", applyFilters);
    $("classFilter")?.addEventListener("change", applyFilters);

    searchInput?.addEventListener("input", applyFilters);

    searchBtn?.addEventListener("click", applyFilters);

    searchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyFilters();
        }
    });

    clearFilters?.addEventListener("click", () => {
        if (examFilter) examFilter.value = "";
        if (subjectFilter) subjectFilter.value = "";
        if (yearFilter) yearFilter.value = "";
        if ($("classFilter")) $("classFilter").value = "";
        if (searchInput) searchInput.value = "";

        populateSubjectFilter();
        applyFilters();
    });

    paperGrid?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-preview]");
        if (!button) return;

        const paper = allPapers.find(
            item => String(item.id) === button.dataset.preview
        );

        if (paper) openPreview(paper);
    });

    $("closePdf")?.addEventListener("click", closePreview);

    $("pdfModal")?.addEventListener("click", (event) => {
        if (event.target === $("pdfModal")) {
            closePreview();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closePreview();
    });

    $("loginForm")?.addEventListener("submit", handleLogin);

    $("logoutButton")?.addEventListener("click", handleLogout);
}

/* ---------- START APP ---------- */

document.addEventListener("DOMContentLoaded", () => {
    setupClassFilter();
    setupEvents();
    loadPapers();
    checkSession();
});

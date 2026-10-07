// Popup entry point: decides which view to show and connects the views to
// the API. The views (ui/*.js) handle their own DOM; this file owns the
// shared state (session + saved jobs) and the error handling.
import * as api from "./lib/api.js";
import * as storage from "./lib/storage.js";
import { showToast, todayLocal, downloadFile } from "./ui/dom.js";
import { initAuthView, showAuthView, hideAuthView } from "./ui/authView.js";
import { initCurrentJobView, scanPage, refreshSavedState } from "./ui/currentJobView.js";
import * as savedJobsView from "./ui/savedJobsView.js";
import { renderSettings } from "./ui/settingsView.js";

const mainView = document.querySelector("#main-view");
const userBar = document.querySelector("#user-bar");
const userEmail = document.querySelector("#user-email");
const savedCount = document.querySelector("#saved-count");
const tabButtons = mainView.querySelectorAll("[data-tab]");
const exportButton = document.querySelector("#export-btn");

const state = {
    jobs: [],
    // true once the saved jobs list has loaded successfully
    jobsLoaded: false,
    visibleFields: []
};

// ---------- helpers ----------

// Compares job URLs ignoring a trailing slash or #hash.
function sameUrl(a, b) {
    const clean = url => (url || "").replace(/#.*$/, "").replace(/\/+$/, "");
    return clean(a) === clean(b);
}

function findSavedJob(job) {
    return state.jobs.find(saved => saved.source === job.source && sameUrl(saved.jobUrl, job.jobUrl)) || null;
}

function updateCount() {
    savedCount.textContent = state.jobs.length ? `(${state.jobs.length})` : "";
}

// Replaces / adds / removes one job in state and redraws what depends on it.
function setJobs(jobs) {
    state.jobs = jobs;
    updateCount();
    savedJobsView.render();
    refreshSavedState();
}

function replaceJob(updated) {
    setJobs(state.jobs.map(job => (job.id === updated.id ? updated : job)));
}

// One place that decides what to do with an API error.
async function handleError(error) {
    if (error.status === 401) {
        await logout("Your session has expired. Please log in again.");
        return;
    }
    showToast(error.message || "Something went wrong.", "error");
}

// ---------- tabs ----------

function showTab(name) {
    tabButtons.forEach(button => button.classList.toggle("active", button.dataset.tab === name));
    for (const panel of mainView.querySelectorAll(".tab-panel")) {
        panel.hidden = panel.id !== `tab-${name}`;
    }
}

// ---------- saved jobs ----------

// Returns false when the session turned out to be invalid (user logged out).
async function loadSavedJobs() {
    savedJobsView.showLoading();

    try {
        setJobs(await api.getJobs());
        state.jobsLoaded = true;
    } catch (error) {
        state.jobsLoaded = false;
        if (error.status === 401) {
            await handleError(error);
            return false;
        }
        savedJobsView.showError(error.message);
    }
    return true;
}

async function changeStatus(job, status) {
    const changes = { status };
    // Moving to "Applied" for the first time records today's date.
    if (status === "Applied" && !job.dateApplied) {
        changes.dateApplied = todayLocal();
    }

    try {
        replaceJob(await api.updateJob(job.id, changes));
        showToast(`Status changed to ${status}.`, "success");
    } catch (error) {
        savedJobsView.render(); // put the dropdown back to the stored value
        await handleError(error);
    }
}

async function updateJob(job, changes) {
    try {
        const updated = await api.updateJob(job.id, changes);
        savedJobsView.closeEditor();
        replaceJob(updated);
        showToast("Job updated.", "success");
    } catch (error) {
        savedJobsView.render();
        await handleError(error);
    }
}

async function deleteJob(job) {
    try {
        await api.deleteJob(job.id);
        setJobs(state.jobs.filter(saved => saved.id !== job.id));
        showToast("Job deleted.", "success");
    } catch (error) {
        if (error.status === 404) {
            // Already gone on the server: just drop it from the list.
            setJobs(state.jobs.filter(saved => saved.id !== job.id));
        }
        savedJobsView.render();
        await handleError(error);
    }
}

// ---------- Excel export ----------

// Downloads all saved jobs as Job_Applications_YYYY-MM-DD.xlsx.
// The file is built by the backend from the database (GET /api/jobs/export).
async function exportJobs() {
    // Only trust "no jobs" if the list really loaded. If loading failed
    // (e.g. server offline), ask the server so the user sees the real error.
    if (state.jobsLoaded && state.jobs.length === 0) {
        showToast("You have no saved jobs to export yet.", "info");
        return;
    }

    exportButton.disabled = true;
    exportButton.textContent = "Exporting…";

    try {
        const file = await api.exportJobs();
        // todayLocal() uses the user's own date, e.g. Job_Applications_2026-10-07.xlsx
        downloadFile(file, `Job_Applications_${todayLocal()}.xlsx`);
        showToast("Excel file downloaded.", "success");
    } catch (error) {
        // 401 -> back to login; offline / server errors -> friendly toast
        await handleError(error);
    } finally {
        exportButton.disabled = false;
        exportButton.textContent = "Export to Excel";
    }
}

// ---------- session ----------

async function showMainView(session) {
    api.setAuthToken(session.token);
    hideAuthView();

    userEmail.textContent = session.user.email;
    userBar.hidden = false;
    mainView.hidden = false;
    showTab("current");

    // Load the list first so the current page can show "Already saved".
    if (await loadSavedJobs()) {
        await scanPage();
    }
}

async function logout(message = "") {
    await storage.clearSession();
    api.setAuthToken(null);
    state.jobs = [];
    state.jobsLoaded = false;

    mainView.hidden = true;
    userBar.hidden = true;
    showAuthView(message);
}

async function start() {
    state.visibleFields = await storage.getVisibleFields();

    initAuthView({
        onLoggedIn: async session => {
            await storage.saveSession(session);
            await showMainView(session);
        }
    });

    initCurrentJobView({
        findSavedJob,
        onSaved: job => setJobs([job, ...state.jobs.filter(saved => saved.id !== job.id)]),
        onError: handleError,
        onShowSaved: id => {
            showTab("saved");
            savedJobsView.highlightJob(id);
        }
    });

    savedJobsView.initSavedJobsView({
        getJobs: () => state.jobs,
        getVisibleFields: () => state.visibleFields,
        onStatusChange: changeStatus,
        onUpdate: updateJob,
        onDelete: deleteJob
    });

    renderSettings(state.visibleFields, async keys => {
        state.visibleFields = keys;
        await storage.saveVisibleFields(keys);
        savedJobsView.render();
    });

    tabButtons.forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
    document.querySelector("#logout-btn").addEventListener("click", () => logout());
    exportButton.addEventListener("click", exportJobs);

    const session = await storage.getSession();
    if (session && session.token) {
        await showMainView(session);
    } else {
        showAuthView();
    }
}

start().catch(error => {
    console.error(error);
    showToast("Job Tracker failed to start. Try reopening the popup.", "error");
});

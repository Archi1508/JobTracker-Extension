// "This page" tab: shows the job found on the active tab, lets the user
// correct the extracted values, and saves it.
import * as api from "../lib/api.js";
import { extractJobFromActiveTab } from "../lib/extractor.js";
import { STATUSES, WORK_MODES, SOURCE_LABELS } from "../lib/config.js";
import { fillSelect, safeHttpUrl, showToast, todayLocal } from "./dom.js";

const stateText = document.querySelector("#current-state");
const form = document.querySelector("#current-form");
const sourceBadge = document.querySelector("#current-source");
const urlLink = document.querySelector("#current-url");
const titleInput = document.querySelector("#current-title");
const companyInput = document.querySelector("#current-company");
const locationInput = document.querySelector("#current-location");
const statusSelect = document.querySelector("#current-status");
const workModeSelect = document.querySelector("#current-work-mode");
const saveButton = document.querySelector("#save-btn");
const viewExistingButton = document.querySelector("#view-existing-btn");
const rescanButton = document.querySelector("#rescan-btn");

// The extracted job ({ source, jobUrl, ... }) or null.
let currentJob = null;
// Id of the saved copy of this job, once we know it.
let savedJobId = null;
// Callbacks provided by popup.js
let handlers = {};

function showState(message) {
    stateText.textContent = message;
    stateText.hidden = false;
    form.hidden = true;
}

// Switches the form between "ready to save" and "already saved".
function setSaved(jobId, label) {
    savedJobId = jobId;
    saveButton.disabled = jobId !== null;
    saveButton.textContent = jobId !== null ? label : "Save job";
    viewExistingButton.hidden = jobId === null;
}

function showJob(source, job) {
    currentJob = { ...job, source };

    sourceBadge.textContent = SOURCE_LABELS[source] || source;
    const href = safeHttpUrl(job.jobUrl);
    urlLink.textContent = href ? new URL(href).hostname : "";
    urlLink.href = href || "#";

    titleInput.value = job.title;
    companyInput.value = job.company;
    locationInput.value = job.location;
    statusSelect.value = "Saved";
    workModeSelect.value = job.workMode || "";

    stateText.hidden = true;
    form.hidden = false;
    setSaved(null);
}

// Reads the active tab and fills the form.
export async function scanPage() {
    showState("Reading this page…");
    currentJob = null;

    const result = await extractJobFromActiveTab();

    if (!result.ok) {
        showState(result.message);
        return;
    }

    showJob(result.source, result.job);
    // If this job is already in the saved list, say so straight away.
    const existing = handlers.findSavedJob ? handlers.findSavedJob(currentJob) : null;
    if (existing) {
        setSaved(existing.id, "Already saved");
    }
}

// Called by popup.js when the saved list changes (e.g. the job was deleted).
// Only touches the button when the saved/not-saved state actually changed,
// so "Saved ✓" right after saving is not replaced by "Already saved".
export function refreshSavedState() {
    if (!currentJob || !handlers.findSavedJob) {
        return;
    }
    const existing = handlers.findSavedJob(currentJob);
    const existingId = existing ? existing.id : null;

    if (existingId !== savedJobId) {
        setSaved(existingId, "Already saved");
    }
}

async function saveCurrentJob(event) {
    event.preventDefault();

    if (!currentJob) {
        return;
    }

    const title = titleInput.value.trim();
    if (!title) {
        showToast("Please enter a job title.", "error");
        titleInput.focus();
        return;
    }

    const job = {
        title: title,
        company: companyInput.value.trim(),
        location: locationInput.value.trim(),
        workMode: workModeSelect.value,
        status: statusSelect.value,
        jobUrl: currentJob.jobUrl,
        source: currentJob.source
    };
    if (job.status === "Applied") {
        job.dateApplied = todayLocal();
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    try {
        const saved = await api.createJob(job);
        setSaved(saved.id, "Saved ✓");
        showToast("Job saved!", "success");
        handlers.onSaved(saved);
    } catch (error) {
        if (error.status === 409) {
            setSaved(error.data.existingJobId ?? null, "Already saved");
            showToast("This job is already saved.", "info");
            return;
        }
        setSaved(null);
        handlers.onError(error);
    }
}

// handlers: { onSaved(job), onError(error), onShowSaved(id), findSavedJob(job) }
export function initCurrentJobView(callbacks) {
    handlers = callbacks;

    fillSelect(statusSelect, STATUSES);
    fillSelect(workModeSelect, [{ value: "", label: "Not specified" }, ...WORK_MODES]);

    form.addEventListener("submit", saveCurrentJob);
    rescanButton.addEventListener("click", scanPage);
    viewExistingButton.addEventListener("click", () => {
        if (savedJobId !== null) {
            handlers.onShowSaved(savedJobId);
        }
    });
}

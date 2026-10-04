import { extractJob } from "./adapters/fakeJobAdapter.js";
import { extractLinkedInJob } from "./adapters/linkedinAdapter.js";
import { extractIndeedJob } from "./adapters/indeedAdapter.js";
import { extractNaukriJob } from "./adapters/naukriAdapter.js";
import { extractWellfoundJob } from "./adapters/wellfoundAdapter.js";
import { extractInternshalaJob } from "./adapters/internshalaAdapter.js";

// The backend's jobs endpoint. The only place this address is written.
const API_URL = "http://localhost:5000/api/jobs";

// Which adapter to run for each website detectUrl() can return.
// "unknown" uses the fake adapter, which only finds a job on test-job.html.
const adapters = {
    linkedin: extractLinkedInJob,
    indeed: extractIndeedJob,
    naukri: extractNaukriJob,
    wellfound: extractWellfoundJob,
    internshala: extractInternshalaJob,
    unknown: extractJob
};

const getJobDetails = document.querySelector("#btn");

// Popup elements we fill in after extraction.
const message = document.querySelector("#message");
const jobDetails = document.querySelector("#job-details");
const jobTitle = document.querySelector("#job-title");
const jobCompany = document.querySelector("#job-company");
const jobLocation = document.querySelector("#job-location");
const jobWebsite = document.querySelector("#job-website");
const saveButton = document.querySelector("#save-btn");
const saveStatus = document.querySelector("#save-status");
const savedEmpty = document.querySelector("#saved-empty");
const savedJobsList = document.querySelector("#saved-jobs");

// The job currently shown in the popup (null = nothing to save).
let currentJob = null;

// Shows an error/info message and hides the job details box.
function showMessage(text) {
    message.textContent = text;
    jobDetails.hidden = true;
    currentJob = null;
}

// Fills the job details box and shows it.
function showJob(job) {
    message.textContent = "";
    saveStatus.textContent = "";
    currentJob = job;

    jobTitle.textContent = job.title;
    jobCompany.textContent = job.company || "Not found";
    jobLocation.textContent = job.location || "Not found";
    jobWebsite.textContent = job.website;

    jobDetails.hidden = false;
}

// Shows the result of saving, in green (success) or red (error).
function showSaveStatus(text, type) {
    saveStatus.textContent = text;
    saveStatus.className = type;
}

// Builds one <li> per saved job inside <ul id="saved-jobs">.
function renderSavedJobs(jobs) {
    // Remove the old list items before drawing the new ones.
    savedJobsList.textContent = "";

    savedEmpty.textContent = "No saved jobs yet.";
    savedEmpty.hidden = jobs.length > 0;

    // Newest first. slice() makes a copy so reverse() doesn't change "jobs".
    const newestFirst = jobs.slice().reverse();

    for (const job of newestFirst) {
        const item = document.createElement("li");

        // Job title as a link to the original job page.
        const link = document.createElement("a");
        link.textContent = job.title;
        link.href = job.url;
        link.target = "_blank";

        // "Company · Location · website" in small grey text.
        // filter(Boolean) drops missing or empty values, so we never show
        // "undefined" or empty separators like "Acme ·  · linkedin".
        const meta = document.createElement("div");
        meta.className = "saved-meta";
        meta.textContent = [job.company, job.location, job.website]
            .filter(Boolean)
            .join(" · ");

        const status = document.createElement("div");
        status.className = "saved-meta";
        status.textContent = "Status: " + job.status;

        item.append(link, meta, status);
        savedJobsList.append(item);
    }
}

// Shows a problem in place of the saved jobs list.
function showSavedJobsError(text) {
    savedJobsList.textContent = "";
    savedEmpty.textContent = text;
    savedEmpty.hidden = false;
}

// Asks the backend for all saved jobs (GET /api/jobs) and shows them.
async function loadSavedJobs() {
    try {
        // fetch() returns a Promise of a Response; await waits for the
        // status and headers to arrive.
        const response = await fetch(API_URL);

        // fetch() only throws on network failures. A 404 or 500 is still a
        // "successful" fetch, so we check ok (true only for 200-299).
        if (!response.ok) {
            showSavedJobsError("Could not load saved jobs (server error " + response.status + ").");
            return;
        }

        // The body arrives separately, so reading it as JSON is another await.
        const data = await response.json();
        renderSavedJobs(data.jobs);
    } catch (error) {
        // We get here when the request never got an answer, e.g. the server is off.
        console.log("Loading saved jobs failed:", error);
        showSavedJobsError("Could not reach the server. Is the backend running?");
    }
}

// Show the saved jobs as soon as the popup opens.
loadSavedJobs();

getJobDetails.addEventListener("click", () => {
    getCurrentTab();
});

saveButton.addEventListener("click", () => {
    saveJob();
});

// Sends currentJob to the backend (POST /api/jobs).
async function saveJob() {

    if (!currentJob) {
        showSaveStatus("No job to save. Click Get Job Details first.", "error");
        return;
    }

    // Stop double clicks from saving the same job twice.
    saveButton.disabled = true;
    showSaveStatus("Saving...", "");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            // Tells Express the body is JSON, so express.json() reads it.
            headers: {
                "Content-Type": "application/json"
            },
            // fetch can only send text, so turn the object into a JSON string.
            body: JSON.stringify(currentJob)
        });

        // Our backend answers with JSON for both success and errors,
        // so we read the body first and then decide what it means.
        const data = await response.json();

        if (!response.ok) {
            // 400 from validateJob comes with a list of errors.
            const details = data.errors ? data.errors.join(", ") : data.message;
            showSaveStatus("Could not save: " + details, "error");
            return;
        }

        console.log("Saved job:", data.job);
        showSaveStatus("Job saved!", "success");

        // Re-read the list from the server so the popup shows what the
        // backend really stored (including its id and status).
        await loadSavedJobs();
    } catch (error) {
        console.log("Saving failed:", error);
        showSaveStatus("Could not reach the server. Is the backend running?", "error");
    } finally {
        // finally runs after try or catch, even after "return",
        // so the button is always switched back on.
        saveButton.disabled = false;
    }
}

async function getCurrentTab() {

    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    const tab = tabs[0];
    console.log(tab.url);

    const website = detectUrl(tab.url);
    console.log("Detected website:", website);

    const adapter = adapters[website];

    if (!adapter) {
        console.log("Job extraction for " + website + " is not supported yet.");
        showMessage("Job extraction for " + website + " is not supported yet.");
        return;
    }

    let script;

    try {
        script = await chrome.scripting.executeScript({
            target: {
                tabId: tab.id
            },
            func: adapter
        });
    } catch (error) {
        console.log("executeScript failed:", error);
        showMessage("Could not read this page.");
        return;
    }

    const job = script[0].result;

    if (!job || !job.title) {
        showMessage("Could not extract job details from this page.");
        return;
    }

    job.url = tab.url;
    job.website = website;

    console.log(job);
    showJob(job);
}

import { extractJob } from "./adapters/fakeJobAdapter.js";
import { extractLinkedInJob } from "./adapters/linkedinAdapter.js";
import { extractIndeedJob } from "./adapters/indeedAdapter.js";
import { extractNaukriJob } from "./adapters/naukriAdapter.js";
import { extractWellfoundJob } from "./adapters/wellfoundAdapter.js";
import { extractInternshalaJob } from "./adapters/internshalaAdapter.js";

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
        const meta = document.createElement("div");
        meta.className = "saved-meta";
        meta.textContent = job.company + " · " + job.location + " · " + job.website;

        item.append(link, meta);
        savedJobsList.append(item);
    }
}

// Reads the saved jobs from storage and shows them.
async function loadSavedJobs() {
    try {
        const data = await chrome.storage.local.get("jobs");
        renderSavedJobs(data.jobs || []);
    } catch (error) {
        console.log("Loading saved jobs failed:", error);
        savedEmpty.textContent = "Could not load saved jobs.";
        savedEmpty.hidden = false;
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

// Adds currentJob to the "jobs" array in chrome.storage.local.
async function saveJob() {

    if (!currentJob) {
        showSaveStatus("No job to save. Click Get Job Details first.", "error");
        return;
    }

    try {
        // Read the existing list (or start an empty one).
        const data = await chrome.storage.local.get("jobs");
        const jobs = data.jobs || [];

        // Add the new job to the end and write the whole list back.
        jobs.push(currentJob);
        await chrome.storage.local.set({ jobs: jobs });

        console.log("Saved jobs:", jobs);
        showSaveStatus("Job saved! (" + jobs.length + " saved in total)", "success");
        renderSavedJobs(jobs);
    } catch (error) {
        console.log("Saving failed:", error);
        showSaveStatus("Could not save the job. Please try again.", "error");
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

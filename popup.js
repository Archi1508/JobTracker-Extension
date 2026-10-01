import { extractJob } from "./adapters/fakeJobAdapter.js";
import { extractLinkedInJob } from "./adapters/linkedinAdapter.js";
import { extractIndeedJob } from "./adapters/indeedAdapter.js";
import { extractNaukriJob } from "./adapters/naukriAdapter.js";
import { extractWellfoundJob } from "./adapters/wellfoundAdapter.js";
import { extractInternshalaJob } from "./adapters/internshalaAdapter.js";

// Which adapter to run for each website detectUrl() can return.
// null = no adapter written for that website yet.
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

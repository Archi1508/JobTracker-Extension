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

getJobDetails.addEventListener("click", () => {
    getCurrentTab();
});

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
        return;
    }

    const script = await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        func: adapter
    });

    console.log(script[0].result.title);
    console.log(script[0].result.company);
    console.log(script[0].result.location);
}

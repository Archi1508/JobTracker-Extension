import { extractJob } from "./adapters/fakeJobAdapter.js";

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
    const script = await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        func: extractJob
    });

    console.log(script[0].result.title);
    console.log(script[0].result.company);
    console.log(script[0].result.location);
}

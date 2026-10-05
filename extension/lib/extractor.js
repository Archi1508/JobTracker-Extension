// Popup side of job extraction: injects the detector, helpers, adapters and
// content.js into the active tab and turns the result into either a job or
// a user-facing message.
//
// Scripts are injected only when the popup is opened (activeTab
// permission), so the extension never runs on pages the user isn't looking at.

const PAGE_SCRIPTS = [
    "utils/websiteDetector.js",
    "utils/extractionHelpers.js",
    "adapters/linkedinAdapter.js",
    "adapters/indeedAdapter.js",
    "adapters/wellfoundAdapter.js",
    "adapters/internshalaAdapter.js",
    "adapters/naukriAdapter.js",
    "adapters/genericAdapter.js",
    "content.js" // must be last: its result is returned to us
];

export const EXTRACTION_MESSAGES = {
    unsupported: "This website is not currently supported.",
    not_found: "Could not detect job details on this page. Open a single job posting and try again.",
    error: "Something went wrong while reading this page. Try reloading it.",
    restricted: "Job Tracker can't read this page (browser or extension pages are off-limits).",
    no_tab: "No active tab found."
};

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
}

// Returns { ok: true, source, job } or { ok: false, message, source? }.
export async function extractJobFromActiveTab() {
    const tab = await getActiveTab();

    if (!tab || tab.id === undefined) {
        return { ok: false, message: EXTRACTION_MESSAGES.no_tab };
    }

    const isWebPage = /^https?:/i.test(tab.url || "");
    if (!isWebPage) {
        return { ok: false, message: EXTRACTION_MESSAGES.restricted };
    }

    let results;
    try {
        results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: PAGE_SCRIPTS
        });
    } catch (error) {
        // e.g. the Chrome Web Store or a page that is still loading.
        console.warn("executeScript failed:", error);
        return { ok: false, message: EXTRACTION_MESSAGES.restricted };
    }

    const result = results && results[0] ? results[0].result : null;

    if (!result) {
        return { ok: false, message: EXTRACTION_MESSAGES.error };
    }
    if (!result.ok) {
        return { ok: false, source: result.source, message: EXTRACTION_MESSAGES[result.reason] || EXTRACTION_MESSAGES.error };
    }

    return result;
}

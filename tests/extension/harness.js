// Runs the extension's page scripts against an HTML string, exactly in the
// order lib/extractor.js injects them, and returns content.js's result.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const extensionDir = fileURLToPath(new URL("../../extension/", import.meta.url));

// Same list as PAGE_SCRIPTS in extension/lib/extractor.js
const PAGE_SCRIPTS = [
    "utils/websiteDetector.js",
    "utils/extractionHelpers.js",
    "adapters/linkedinAdapter.js",
    "adapters/indeedAdapter.js",
    "adapters/wellfoundAdapter.js",
    "adapters/internshalaAdapter.js",
    "adapters/naukriAdapter.js",
    "adapters/genericAdapter.js",
    "content.js"
];

const sources = PAGE_SCRIPTS.map(file => readFileSync(extensionDir + file, "utf8"));

// times = how often to inject the scripts into the same page (the popup's
// "Scan page again" button re-injects them).
export function extract(html, url, times = 1) {
    const dom = new JSDOM(html, { url, runScripts: "outside-only" });
    let result;

    for (let i = 0; i < times; i++) {
        for (const source of sources) {
            result = dom.window.eval(source);
        }
    }

    // Copy out of the jsdom realm so assert.deepEqual compares plain objects.
    return JSON.parse(JSON.stringify(result));
}

// A window with only the detector loaded, for detectWebsite tests.
export function loadDetector() {
    const dom = new JSDOM("", { runScripts: "outside-only" });
    dom.window.eval(sources[0]);
    return dom.window.JobTracker.detectWebsite;
}

export function jsonLd(posting) {
    return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", ...posting })}</script>`;
}

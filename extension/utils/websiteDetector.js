// Website detection: URL -> "linkedin" | "indeed" | ... | "unknown".
//
// Loaded in two places:
//   - popup.html (a normal <script>) so the popup knows the site up front
//   - injected into the job page together with the adapters (see lib/extractor.js)
// Wrapped in a function so injecting it twice into the same page is harmless.
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });

    // Matched against the hostname only, so "linkedin.com" inside a query
    // string (e.g. google.com/search?q=linkedin.com) does not count.
    const SITES = [
        { name: "linkedin", pattern: /(^|\.)linkedin\.com$/ },
        // Indeed has regional domains: in.indeed.com, indeed.co.uk, indeed.de ...
        { name: "indeed", pattern: /(^|\.)indeed\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/ },
        { name: "wellfound", pattern: /(^|\.)wellfound\.com$/ },
        { name: "internshala", pattern: /(^|\.)internshala\.com$/ },
        { name: "naukri", pattern: /(^|\.)naukri\.com$/ }
    ];

    JobTracker.detectWebsite = function detectWebsite(url) {
        let hostname;

        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                return "unknown";
            }
            hostname = parsed.hostname.toLowerCase();
        } catch {
            return "unknown"; // not a URL at all
        }

        const site = SITES.find(site => site.pattern.test(hostname));
        return site ? site.name : "unknown";
    };
})();

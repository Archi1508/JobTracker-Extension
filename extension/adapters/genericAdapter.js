// Generic adapter for websites without a dedicated adapter.
// Only uses JSON-LD JobPosting data, which many company career pages
// (Greenhouse, Lever, Workday ...) publish for Google Jobs. If the page has
// none, the popup reports the website as not supported.
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { readJobPosting } = JobTracker.helpers;

    JobTracker.adapters.generic = function extractGenericJob(doc, url) {
        const posting = readJobPosting(doc);

        if (!posting) {
            return null;
        }

        const parsed = new URL(url);
        parsed.hash = "";

        return { ...posting, jobUrl: parsed.toString() };
    };
})();

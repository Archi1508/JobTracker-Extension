// Runs inside the job page, injected by the popup (lib/extractor.js) right
// after utils/ and adapters/. The value of the last expression in this file
// is what chrome.scripting.executeScript hands back to the popup, so this
// file must end with a plain, JSON-friendly object.
//
// Result shapes:
//   { ok: true,  source, job }
//   { ok: false, source, reason: "unsupported" | "not_found" | "error" }
(function () {
    const JobTracker = globalThis.JobTracker;
    const url = window.location.href;
    const website = JobTracker.detectWebsite(url);

    // Known site -> its adapter. Unknown site -> generic JSON-LD adapter.
    const adapter = JobTracker.adapters[website] || JobTracker.adapters.generic;
    const source = website === "unknown" ? "other" : website;

    let job;
    try {
        job = adapter(document, url);
    } catch (error) {
        // An adapter bug must never break the page or the popup.
        console.warn("[Job Tracker] extraction failed:", error);
        return { ok: false, source: source, reason: "error" };
    }

    if (!job || !job.title) {
        return {
            ok: false,
            source: source,
            reason: website === "unknown" ? "unsupported" : "not_found"
        };
    }

    return {
        ok: true,
        source: source,
        job: {
            title: job.title,
            company: job.company || "",
            location: job.location || "",
            workMode: job.workMode || "",
            jobUrl: job.jobUrl || url
        }
    };
})();

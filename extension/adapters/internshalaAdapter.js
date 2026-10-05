// Internshala adapter (jobs and internships).
// "Similar jobs" cards further down repeat the same markup, so we only
// search inside the main job box: .detail_view (when it exists).
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { firstText, readJobPosting, detectWorkMode, fillMissing, urlWithoutQuery } = JobTracker.helpers;

    JobTracker.adapters.internshala = function extractInternshalaJob(doc, url) {
        const main = doc.querySelector(".detail_view") || doc;

        let job = {
            // The page has exactly one <h1>: the job title.
            title: firstText(doc, ["h1", ".detail_view .profile", ".heading_4_5.profile"]),
            // The company name links to the company page, e.g. /company/talentxo-1721219524
            company: firstText(main, ['a[href^="/company/"]', ".company_name a", ".company_name"]),
            // e.g. "Pune" or "Mumbai, Pune (Hybrid)"
            location: firstText(main, ["#location_names", ".location_link", ".locations"])
        };

        job = fillMissing(job, readJobPosting(doc));
        job.workMode = job.workMode || detectWorkMode(job.location || "");

        return { ...job, jobUrl: urlWithoutQuery(url) };
    };
})();

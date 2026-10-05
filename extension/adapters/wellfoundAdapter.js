// Wellfound (formerly AngelList Talent) adapter.
// Job pages look like wellfound.com/jobs/1234567-technical-project-manager
// and their heading reads "Technical Project Manager at Certa".
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { firstText, readJobPosting, detectWorkMode, fillMissing, urlWithoutQuery } = JobTracker.helpers;

    // "Technical Project Manager at Certa" -> { title, company }.
    // Splits at the LAST " at " so titles like "Head of Data at Scale at Acme"
    // keep their own " at ".
    function splitHeading(heading) {
        const index = heading.lastIndexOf(" at ");

        if (index === -1) {
            return { title: heading, company: "" };
        }

        return {
            title: heading.slice(0, index).trim(),
            company: heading.slice(index + 4).trim()
        };
    }

    JobTracker.adapters.wellfound = function extractWellfoundJob(doc, url) {
        const heading = firstText(doc, ["main h1", "h1"]);
        const { title, company } = splitHeading(heading);

        let job = {
            title: title,
            company: company || firstText(doc, ['a[href^="/company/"] h2', 'a[href^="/company/"]']),
            // The location has its own test id.
            location: firstText(doc, ['[data-testid="location-display"]'])
        };

        job = fillMissing(job, readJobPosting(doc));
        job.workMode = job.workMode || detectWorkMode(job.location || "");

        return { ...job, jobUrl: urlWithoutQuery(url) };
    };
})();

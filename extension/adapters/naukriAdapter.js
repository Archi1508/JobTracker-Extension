// Naukri adapter (naukri.com/job-listings-...).
// All values live inside <section id="job_header">. Naukri's class names
// are generated (styles_jhc__location__W_pVs), so where a class is needed
// we match only its stable part with [class*="..."].
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { firstText, readJobPosting, detectWorkMode, fillMissing, urlWithoutQuery } = JobTracker.helpers;

    JobTracker.adapters.naukri = function extractNaukriJob(doc, url) {
        const header = doc.querySelector("#job_header, [class*='jd-header']") || doc;

        let job = {
            // The only <h1> in the job header is the job title.
            title: firstText(header, ["h1"]),
            // The company name links to its careers page, e.g. /infosys-jobs-careers-11244
            company: firstText(header, ['a[href*="-jobs-careers-"]', "[class*='jd-header-comp-name'] a"]),
            // The location is the <span> right after the location pin icon.
            location: firstText(header, [".ni-icon-location + span", "[class*='location'] a", "[class*='location']"])
        };

        job = fillMissing(job, readJobPosting(doc));
        job.workMode = job.workMode || detectWorkMode(job.location || "");

        return { ...job, jobUrl: urlWithoutQuery(url) };
    };
})();

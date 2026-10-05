// Indeed adapter.
// Handles the /viewjob page, the right-hand panel on /jobs search pages,
// and falls back to the job card in the results list or JSON-LD data.
// data-testid attributes are testing hooks, not generated class names, so
// they are tried first.
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { textOf, firstText, readJobPosting, detectWorkMode, fillMissing } = JobTracker.helpers;

    // Reads the job key from the page URL:
    //   /viewjob?jk=abc123            -> "abc123"
    //   /jobs?q=developer&vjk=abc123  -> "abc123"
    function getJobKey(url) {
        const params = new URL(url).searchParams;
        const key = params.get("jk") || params.get("vjk") || "";
        return /^[a-zA-Z0-9]+$/.test(key) ? key : "";
    }

    // Indeed adds hidden text "- job post" to the title for screen readers.
    function cleanTitle(title) {
        return title.replace(/\s*-\s*job post$/i, "").trim();
    }

    function fromDetails(doc) {
        return {
            title: cleanTitle(firstText(doc, [
                '[data-testid="jobsearch-JobInfoHeader-title"]',
                "h1.jobsearch-JobInfoHeader-title",
                ".jobsearch-JobInfoHeader-title"
            ])),
            company: firstText(doc, [
                '[data-testid="inlineHeader-companyName"]',
                '[data-company-name="true"]',
                ".jobsearch-CompanyInfoContainer a"
            ]),
            location: firstText(doc, [
                '[data-testid="inlineHeader-companyLocation"]',
                '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
                '[data-testid="job-location"]'
            ])
        };
    }

    // Starting at the title link, walk up until we reach the card that also
    // contains the company name.
    function findJobCard(titleLink) {
        let element = titleLink;

        for (let i = 0; i < 6 && element; i++) {
            if (element.querySelector('[data-testid="company-name"]')) {
                return element;
            }
            element = element.parentElement;
        }

        return null;
    }

    function fromResultCard(doc, jobKey) {
        if (!jobKey) {
            return null;
        }

        const titleLink = doc.querySelector(`a[data-jk="${jobKey}"]`);
        const card = findJobCard(titleLink);

        if (!card) {
            return null;
        }

        return {
            title: cleanTitle(textOf(titleLink)),
            company: textOf(card.querySelector('[data-testid="company-name"]')),
            location: textOf(card.querySelector('[data-testid="text-location"]'))
        };
    }

    JobTracker.adapters.indeed = function extractIndeedJob(doc, url) {
        const jobKey = getJobKey(url);

        let job = fromDetails(doc);
        if (!job.title) {
            job = fillMissing(fromResultCard(doc, jobKey) || job, job);
        }
        job = fillMissing(job, readJobPosting(doc));
        job.workMode = job.workMode || detectWorkMode(job.location || "");

        return {
            ...job,
            // Keep the regional domain (in.indeed.com, uk.indeed.com ...).
            jobUrl: jobKey ? `${new URL(url).origin}/viewjob?jk=${jobKey}` : url
        };
    };
})();

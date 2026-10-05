// LinkedIn adapter.
// Handles three layouts:
//   1. Public (logged-out) /jobs/view/<id> page
//   2. Logged-in job page / right-hand panel on search (unified top card)
//   3. Anything else that links to /jobs/view/<id>: walk up from the link
// then falls back to the JSON-LD JobPosting data.
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });
    const { textOf, firstText, readJobPosting, detectWorkMode, fillMissing } = JobTracker.helpers;

    // Reads the job id from the page URL:
    //   /jobs/search-results/?currentJobId=4446736293  -> "4446736293"
    //   /jobs/view/4446736293/                         -> "4446736293"
    //   /jobs/view/backend-developer-at-acme-4446736293 -> "4446736293"
    function getJobId(url) {
        const parsed = new URL(url);

        const idFromSearch = parsed.searchParams.get("currentJobId");
        if (idFromSearch && /^\d+$/.test(idFromSearch)) {
            return idFromSearch;
        }

        const match = parsed.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/);
        return match ? match[1] : "";
    }

    // Layout 1: public page. These class names are readable, not generated.
    function fromPublicPage(doc) {
        return {
            title: firstText(doc, ["h1.top-card-layout__title", "h1.topcard__title"]),
            company: firstText(doc, [".topcard__org-name-link", ".topcard__flavor a"]),
            location: firstText(doc, [".topcard__flavor--bullet"])
        };
    }

    // Layout 2: logged-in "unified top card" (current and older class names).
    function fromUnifiedTopCard(doc) {
        const topCard = doc.querySelector(
            ".job-details-jobs-unified-top-card__container--two-pane, .jobs-unified-top-card, .job-details-jobs-unified-top-card"
        );

        if (!topCard) {
            return { title: "" };
        }

        return {
            title: firstText(topCard, [
                ".job-details-jobs-unified-top-card__job-title h1",
                ".job-details-jobs-unified-top-card__job-title",
                ".jobs-unified-top-card__job-title",
                "h1"
            ]),
            company: firstText(topCard, [
                ".job-details-jobs-unified-top-card__company-name a",
                ".job-details-jobs-unified-top-card__company-name",
                ".jobs-unified-top-card__company-name"
            ]),
            location: firstText(topCard, [
                ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
                ".job-details-jobs-unified-top-card__bullet",
                ".jobs-unified-top-card__bullet"
            ]),
            // The "Remote / Hybrid / On-site" pill under the title.
            workMode: detectWorkMode(textOf(topCard.querySelector(
                ".job-details-preferences-and-skills, .job-details-fit-level-preferences"
            )))
        };
    }

    // Starting at the title link, walk up through its parents until we
    // reach one that also contains a company link: the "job card".
    function findJobCard(titleLink) {
        let element = titleLink;

        for (let i = 0; i < 6 && element; i++) {
            if (element.querySelector('a[href*="/company/"]')) {
                return element;
            }
            element = element.parentElement;
        }

        return null;
    }

    // The first company link that has text (the logo link has no text).
    function findCompany(card) {
        for (const link of card.querySelectorAll('a[href*="/company/"]')) {
            const text = textOf(link);
            if (text) {
                return text;
            }
        }
        return "";
    }

    // Location sits on a line like "Noida, Uttar Pradesh, India · 2 weeks ago · 100 applicants".
    function findLocation(card, title, company) {
        const lines = (card.innerText || card.textContent || "").split("\n");

        for (const line of lines) {
            if (!line.includes("·")) {
                continue;
            }
            for (const part of line.split("·")) {
                const text = part.trim();
                if (text && text !== title && text !== company) {
                    return text;
                }
            }
        }

        return "";
    }

    // Layout 3: find the title link by the job id in its href.
    function fromJobLink(doc, jobId) {
        if (!jobId) {
            return null;
        }

        for (const link of doc.querySelectorAll(`a[href*="/jobs/view/${jobId}"]`)) {
            const card = findJobCard(link);
            const title = textOf(link);

            if (card && title) {
                const company = findCompany(card);
                return { title, company, location: findLocation(card, title, company) };
            }
        }

        return null;
    }

    JobTracker.adapters.linkedin = function extractLinkedInJob(doc, url) {
        const jobId = getJobId(url);

        let job = fromPublicPage(doc);
        if (!job.title) {
            job = fillMissing(fromUnifiedTopCard(doc), job);
        }
        if (!job.title) {
            job = fillMissing(fromJobLink(doc, jobId) || job, job);
        }
        job = fillMissing(job, readJobPosting(doc));

        return {
            ...job,
            // One URL per job, no matter which page it was opened from.
            jobUrl: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : url
        };
    };
})();

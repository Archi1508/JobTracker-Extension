export function extractLinkedInJob() {

    // Returns the first line of an element's visible text,
    // or "" if the element does not exist.
    function firstLine(element) {
        if (!element) {
            return "";
        }

        return element.innerText.trim().split("\n")[0].trim();
    }

    // Returns the first line of text of the first element matching
    // the selector, or "" if nothing matches.
    function getText(selector) {
        return firstLine(document.querySelector(selector));
    }

    // Reads the job id from the page URL:
    //   /jobs/search-results/?currentJobId=4446736293  -> "4446736293"
    //   /jobs/view/4446736293/                         -> "4446736293"
    function getJobId() {
        const url = new URL(window.location.href);

        const idFromSearch = url.searchParams.get("currentJobId");
        if (idFromSearch) {
            return idFromSearch;
        }

        if (url.pathname.includes("/jobs/view/")) {
            const match = url.pathname.match(/(\d+)\/?$/);
            if (match) {
                return match[1];
            }
        }

        return "";
    }

    // Starting at the title link, walk up through its parents until we
    // reach one that also contains a company link. That parent is the
    // "job card" holding title, company and location together.
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
        const links = card.querySelectorAll('a[href*="/company/"]');

        for (const link of links) {
            const text = firstLine(link);
            if (text) {
                return text;
            }
        }

        return "";
    }

    // LinkedIn shows location on a line like:
    //   "Noida, Uttar Pradesh, India · 2 weeks ago · 100 applicants"
    // So: find the first line containing "·" and take the first part
    // that is not the title or company.
    function findLocation(card, title, company) {
        const lines = card.innerText.split("\n");

        for (const line of lines) {
            if (line.includes("·")) {
                const parts = line.split("·");

                for (const part of parts) {
                    const text = part.trim();
                    if (text && text !== title && text !== company) {
                        return text;
                    }
                }
            }
        }

        return "";
    }

    // 1. Public (logged-out) /jobs/view/ page.
    //    These class names are readable, not generated.
    let title = getText("h1.top-card-layout__title");
    let company = getText(".topcard__org-name-link");
    let location = getText(".topcard__flavor--bullet");

    // 2. Logged-in pages: find the title link by the job id in its href.
    const jobId = getJobId();

    if (!title && jobId) {
        const titleLinks = document.querySelectorAll('a[href*="/jobs/view/' + jobId + '"]');

        for (const link of titleLinks) {
            const card = findJobCard(link);

            if (card) {
                title = firstLine(link);
                company = findCompany(card);
                location = findLocation(card, title, company);
                break;
            }
        }
    }

    return {
        title: title,
        company: company,
        location: location
    };
}

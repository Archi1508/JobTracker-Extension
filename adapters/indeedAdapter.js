export function extractIndeedJob() {

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

    // Reads the job key from the page URL:
    //   /viewjob?jk=abc123            -> "abc123"
    //   /jobs?q=developer&vjk=abc123  -> "abc123"
    function getJobKey() {
        const url = new URL(window.location.href);

        const keyFromViewJob = url.searchParams.get("jk");
        if (keyFromViewJob) {
            return keyFromViewJob;
        }

        const keyFromSearch = url.searchParams.get("vjk");
        if (keyFromSearch) {
            return keyFromSearch;
        }

        return "";
    }

    // Starting at the title link, walk up through its parents until we
    // reach one that also contains the company name. That parent is the
    // "job card" holding title, company and location together.
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

    // 1. Job details: the /viewjob page, or the right-hand panel on the
    //    search page. data-testid attributes are testing hooks, not
    //    generated class names.
    let title = getText('[data-testid="jobsearch-JobInfoHeader-title"]');
    let company = getText('[data-testid="inlineHeader-companyName"], [data-company-name="true"]');
    let location = getText('[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]');

    // Indeed adds hidden text "- job post" to the title for screen readers.
    title = title.replace(/\s*-\s*job post$/i, "");

    // 2. Fallback: the job card in the search results list,
    //    found by the job key stored in the title link's data-jk attribute.
    const jobKey = getJobKey();

    if (!title && jobKey) {
        const titleLink = document.querySelector('a[data-jk="' + jobKey + '"]');
        const card = findJobCard(titleLink);

        if (card) {
            title = firstLine(titleLink);
            company = firstLine(card.querySelector('[data-testid="company-name"]'));
            location = firstLine(card.querySelector('[data-testid="text-location"]'));
        }
    }

    return {
        title: title,
        company: company,
        location: location
    };
}

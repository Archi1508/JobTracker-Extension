export function extractJob() {

    // Returns the first line of an element's visible text,
    // or "" if the element does not exist.
    function firstLine(element) {
        if (!element) {
            return "";
        }

        return element.innerText.trim().split("\n")[0].trim();
    }

    // These classes only exist on test-job.html. On any other page
    // querySelector returns null, and firstLine turns that into "".
    const title = firstLine(document.querySelector(".job-title"));

    const company = firstLine(document.querySelector(".company-name"));

    const location = firstLine(document.querySelector(".job-location"));

    return {
        title: title,
        company: company,
        location: location
    };
}

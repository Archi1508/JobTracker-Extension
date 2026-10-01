export function extractWellfoundJob() {

    // Returns the first line of an element's visible text,
    // or "" if the element does not exist.
    function firstLine(element) {
        if (!element) {
            return "";
        }

        return element.innerText.trim().split("\n")[0].trim();
    }

    // The heading holds both values, e.g. "Technical Project Manager at Certa"
    const rawTitle = firstLine(
        document.querySelector("h1")
    );

    let title = rawTitle;
    let company = "";

    // Split the heading at " at " into [title, company].
    const parts = rawTitle.split(" at ");

    if (parts.length >= 2) {
        title = parts[0].trim();
        company = parts.slice(1).join(" at ").trim();
    }

    // The location has its own test id.
    const location = firstLine(
        document.querySelector('[data-testid="location-display"]')
    );

    return {
        title: title,
        company: company,
        location: location
    };
}

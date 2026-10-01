export function extractInternshalaJob() {

    // Returns the first line of an element's visible text,
    // or "" if the element does not exist.
    function firstLine(element) {
        if (!element) {
            return "";
        }

        return element.innerText.trim().split("\n")[0].trim();
    }

    // The page has exactly one <h1>: the job title.
    const title = firstLine(
        document.querySelector("h1")
    );

    // "Similar jobs" cards further down repeat the same markup,
    // so we only search inside the main job box: .detail_view

    // The company name is a link to the company page,
    // e.g. <a href="/company/talentxo-1721219524">TalentXO</a>
    const company = firstLine(
        document.querySelector('.detail_view a[href^="/company/"]')
    );

    // The location paragraph, e.g. "Pune" or "Mumbai, Pune (Hybrid)"
    const location = firstLine(
        document.querySelector(".detail_view #location_names")
    );

    return {
        title: title,
        company: company,
        location: location
    };
}

export function extractNaukriJob() {

    // Returns the visible text of the first element matching the
    // selector, or "" if nothing matches.
    function getText(selector) {
        const element = document.querySelector(selector);

        if (element) {
            return element.innerText.trim();
        }

        return "";
    }

    // All three values live inside <section id="job_header"> on a
    // Naukri job page (naukri.com/job-listings-...).

    // The only <h1> in the job header is the job title.
    const title = getText("#job_header h1");

    // The company name is a link to the company's careers page,
    // e.g. https://www.naukri.com/infosys-jobs-careers-11244
    const company = getText('#job_header a[href*="-jobs-careers-"]');

    // The location is the <span> right after the location pin icon.
    const location = getText("#job_header .ni-icon-location + span");

    return {
        title: title,
        company: company,
        location: location
    };
}

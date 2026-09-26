export function extractJob() {

    const title = document.querySelector(".job-title").innerText;

    const company = document.querySelector(".company-name").innerText;

    const location = document.querySelector(".job-location").innerText;

    return {
        title: title,
        company: company,
        location: location
    };
}
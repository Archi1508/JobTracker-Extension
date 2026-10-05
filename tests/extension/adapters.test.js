// Adapter tests. The HTML below is trimmed-down markup modelled on each
// site's real job pages (only the parts the adapters read). Real sites
// change often, so these tests prove the adapter logic and fallbacks, not
// that today's live site still matches - see README "Manual testing".
import { test } from "node:test";
import assert from "node:assert/strict";
import { extract, loadDetector, jsonLd } from "./harness.js";

// ---------- website detection ----------

test("detectWebsite recognises supported sites by hostname", () => {
    const detect = loadDetector();

    assert.equal(detect("https://www.linkedin.com/jobs/view/123/"), "linkedin");
    assert.equal(detect("https://in.indeed.com/viewjob?jk=abc"), "indeed");
    assert.equal(detect("https://uk.indeed.com/jobs?q=dev"), "indeed");
    assert.equal(detect("https://www.indeed.co.uk/viewjob?jk=abc"), "indeed");
    assert.equal(detect("https://wellfound.com/jobs/123-dev"), "wellfound");
    assert.equal(detect("https://internshala.com/job/detail/x"), "internshala");
    assert.equal(detect("https://www.naukri.com/job-listings-x"), "naukri");
});

test("detectWebsite returns unknown for other sites and tricky URLs", () => {
    const detect = loadDetector();

    assert.equal(detect("https://example.com/careers"), "unknown");
    assert.equal(detect("https://www.google.com/search?q=linkedin.com"), "unknown");
    assert.equal(detect("https://notlinkedin.com/jobs"), "unknown");
    assert.equal(detect("https://linkedin.com.evil.io/jobs"), "unknown");
    assert.equal(detect("chrome://extensions"), "unknown");
    assert.equal(detect("not a url"), "unknown");
    assert.equal(detect(undefined), "unknown");
});

// ---------- LinkedIn ----------

test("LinkedIn: public (logged-out) job page", () => {
    const html = `
        <h1 class="top-card-layout__title">Backend Engineer</h1>
        <a class="topcard__org-name-link" href="https://www.linkedin.com/company/acme">Acme Corp</a>
        <span class="topcard__flavor topcard__flavor--bullet">Pune, Maharashtra, India</span>`;

    const result = extract(html, "https://www.linkedin.com/jobs/view/backend-engineer-at-acme-4446736293?trk=public");

    assert.deepEqual(result, {
        ok: true,
        source: "linkedin",
        job: {
            title: "Backend Engineer",
            company: "Acme Corp",
            location: "Pune, Maharashtra, India",
            workMode: "",
            jobUrl: "https://www.linkedin.com/jobs/view/4446736293/"
        }
    });
});

test("LinkedIn: logged-in unified top card on the search page", () => {
    const html = `
        <div class="job-details-jobs-unified-top-card__container--two-pane">
            <div class="job-details-jobs-unified-top-card__company-name"><a href="/company/globex/">Globex</a></div>
            <div class="job-details-jobs-unified-top-card__job-title"><h1><a href="/jobs/view/111/">Data Analyst</a></h1></div>
            <div class="job-details-jobs-unified-top-card__primary-description-container">
                <span class="tvm__text">Bengaluru, Karnataka, India</span><span class="tvm__text"> · 3 days ago</span>
            </div>
            <div class="job-details-preferences-and-skills">Hybrid</div>
        </div>`;

    const result = extract(html, "https://www.linkedin.com/jobs/search/?currentJobId=111&keywords=data");

    assert.equal(result.ok, true);
    assert.equal(result.job.title, "Data Analyst");
    assert.equal(result.job.company, "Globex");
    assert.equal(result.job.location, "Bengaluru, Karnataka, India");
    assert.equal(result.job.workMode, "Hybrid");
    assert.equal(result.job.jobUrl, "https://www.linkedin.com/jobs/view/111/");
});

test("LinkedIn: unknown layout falls back to the job link + card walk", () => {
    const html = `
        <div class="random-x9f">
            <a href="/company/initech/"><img alt=""></a>
            <a href="/company/initech/">Initech</a>
            <div><a href="/jobs/view/222/?ref=x">Frontend Developer</a></div>
            <div>Noida, Uttar Pradesh, India · 2 weeks ago · 100 applicants</div>
        </div>`;

    const result = extract(html, "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=222");

    assert.equal(result.job.title, "Frontend Developer");
    assert.equal(result.job.company, "Initech");
    assert.equal(result.job.location, "Noida, Uttar Pradesh, India");
});

test("LinkedIn: page that is not a job (feed) reports not_found", () => {
    const result = extract("<h1>Home</h1><div class='feed'>posts</div>", "https://www.linkedin.com/feed/");
    assert.deepEqual(result, { ok: false, source: "linkedin", reason: "not_found" });
});

// ---------- Indeed ----------

test("Indeed: /viewjob page with data-testid hooks", () => {
    const html = `
        <h1 data-testid="jobsearch-JobInfoHeader-title"><span>Software Developer<span> - job post</span></span></h1>
        <div data-testid="inlineHeader-companyName"><a>Infosys</a></div>
        <div data-testid="inlineHeader-companyLocation"><div>Remote in Hyderabad, Telangana</div></div>`;

    const result = extract(html, "https://in.indeed.com/viewjob?jk=a1b2c3&from=serp&vjs=3");

    assert.equal(result.job.title, "Software Developer");
    assert.equal(result.job.company, "Infosys");
    assert.equal(result.job.location, "Remote in Hyderabad, Telangana");
    assert.equal(result.job.workMode, "Remote");
    assert.equal(result.job.jobUrl, "https://in.indeed.com/viewjob?jk=a1b2c3");
});

test("Indeed: search page falls back to the result card for vjk", () => {
    const html = `
        <ul><li><div class="cardOutline">
            <h2><a data-jk="zz99" href="/rc/clk?jk=zz99"><span>QA Engineer</span></a></h2>
            <span data-testid="company-name">Wipro</span>
            <div data-testid="text-location">Chennai, Tamil Nadu</div>
        </div></li></ul>`;

    const result = extract(html, "https://in.indeed.com/jobs?q=qa&vjk=zz99");

    assert.equal(result.job.title, "QA Engineer");
    assert.equal(result.job.company, "Wipro");
    assert.equal(result.job.location, "Chennai, Tamil Nadu");
    assert.equal(result.job.jobUrl, "https://in.indeed.com/viewjob?jk=zz99");
});

test("Indeed: unsafe job key from the URL is ignored", () => {
    const result = extract("<p>nothing</p>", 'https://in.indeed.com/jobs?vjk=x"]),a[href');
    assert.equal(result.ok, false);
    assert.equal(result.reason, "not_found");
});

// ---------- Wellfound ----------

test("Wellfound: 'Title at Company' heading and location test id", () => {
    const html = `
        <main><h1>Head of Data at Scale at Certa</h1>
        <div data-testid="location-display">Remote • Bengaluru</div></main>`;

    const result = extract(html, "https://wellfound.com/jobs/3012345-head-of-data?utm_source=x");

    assert.equal(result.job.title, "Head of Data at Scale");
    assert.equal(result.job.company, "Certa");
    assert.equal(result.job.location, "Remote • Bengaluru");
    assert.equal(result.job.workMode, "Remote");
    assert.equal(result.job.jobUrl, "https://wellfound.com/jobs/3012345-head-of-data");
});

// ---------- Internshala ----------

test("Internshala: only reads the main .detail_view box, not similar jobs", () => {
    const html = `
        <h1>Web Development Internship</h1>
        <div class="detail_view">
            <a href="/company/talentxo-1721219524">TalentXO</a>
            <p id="location_names"><span><a>Mumbai, Pune (Hybrid)</a></span></p>
        </div>
        <div class="similar_jobs">
            <a href="/company/other-1">Other Co</a>
            <p id="location_names_2">Delhi</p>
        </div>`;

    const result = extract(html, "https://internshala.com/internship/detail/web-development-internship-in-pune-at-talentxo1727?ref=list");

    assert.equal(result.job.title, "Web Development Internship");
    assert.equal(result.job.company, "TalentXO");
    assert.equal(result.job.location, "Mumbai, Pune (Hybrid)");
    assert.equal(result.job.workMode, "Hybrid");
    assert.equal(result.job.jobUrl, "https://internshala.com/internship/detail/web-development-internship-in-pune-at-talentxo1727");
});

// ---------- Naukri ----------

test("Naukri: job header section", () => {
    const html = `
        <section id="job_header">
            <h1 title="Java Developer">Java Developer</h1>
            <div><a href="https://www.naukri.com/infosys-jobs-careers-11244" title="Infosys Careers">Infosys</a></div>
            <div><i class="ni-icon-location"></i><span><a>Bengaluru</a>, <a>Pune</a></span></div>
        </section>`;

    const result = extract(html, "https://www.naukri.com/job-listings-java-developer-infosys-bengaluru-3-to-5-years-011025012345?src=jobsearchDesk&sid=1");

    assert.equal(result.job.title, "Java Developer");
    assert.equal(result.job.company, "Infosys");
    assert.equal(result.job.location, "Bengaluru, Pune");
    assert.equal(result.job.jobUrl, "https://www.naukri.com/job-listings-java-developer-infosys-bengaluru-3-to-5-years-011025012345");
});

// ---------- fallbacks & robustness ----------

test("Every site falls back to JSON-LD when its selectors find nothing", () => {
    const html = `<div class="redesigned-2027"></div>${jsonLd({
        title: "Site Reliability Engineer",
        hiringOrganization: { "@type": "Organization", name: "Hooli &amp; Co" },
        jobLocation: { "@type": "Place", address: { addressLocality: "Gurugram", addressRegion: "HR", addressCountry: "IN" } }
    })}`;

    const urls = [
        "https://www.linkedin.com/jobs/view/333/",
        "https://in.indeed.com/viewjob?jk=k333",
        "https://wellfound.com/jobs/333-sre",
        "https://internshala.com/job/detail/sre-333",
        "https://www.naukri.com/job-listings-sre-333"
    ];

    for (const url of urls) {
        const result = extract(html, url);
        assert.equal(result.ok, true, url);
        assert.equal(result.job.title, "Site Reliability Engineer", url);
        assert.equal(result.job.company, "Hooli & Co", url);
        assert.equal(result.job.location, "Gurugram, HR, IN", url);
    }
});

test("Selectors fill what they find and JSON-LD fills only the gaps", () => {
    const html = `
        <section id="job_header"><h1>React Developer</h1></section>
        ${jsonLd({ title: "Ignored title", hiringOrganization: "TCS", jobLocationType: "TELECOMMUTE" })}`;

    const result = extract(html, "https://www.naukri.com/job-listings-react-1");

    assert.equal(result.job.title, "React Developer");
    assert.equal(result.job.company, "TCS");
    assert.equal(result.job.location, "Remote");
    assert.equal(result.job.workMode, "Remote");
});

test("Broken JSON-LD and missing elements never throw", () => {
    const html = `<script type="application/ld+json">{ not json</script><div></div>`;

    for (const url of ["https://www.linkedin.com/jobs/view/1/", "https://wellfound.com/jobs/1", "https://www.naukri.com/x"]) {
        const result = extract(html, url);
        assert.equal(result.ok, false);
        assert.equal(result.reason, "not_found");
    }
});

test("JSON-LD inside @graph is found", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{ "@type": "WebPage" }, { "@type": "JobPosting", title: "Designer", hiringOrganization: { name: "Pied Piper" } }]
    })}</script>`;

    const result = extract(html, "https://jobs.lever.co/piedpiper/123");
    assert.equal(result.source, "other");
    assert.equal(result.job.title, "Designer");
});

// ---------- unknown websites ----------

test("Unknown website with JSON-LD is extracted by the generic adapter", () => {
    const html = jsonLd({ title: "Platform Engineer", hiringOrganization: { name: "Stripe" }, jobLocation: { address: "Dublin, Ireland" } });

    const result = extract(html, "https://boards.greenhouse.io/stripe/jobs/42#apply");

    assert.deepEqual(result, {
        ok: true,
        source: "other",
        job: {
            title: "Platform Engineer",
            company: "Stripe",
            location: "Dublin, Ireland",
            workMode: "",
            jobUrl: "https://boards.greenhouse.io/stripe/jobs/42"
        }
    });
});

test("Unknown website without job data is reported as unsupported", () => {
    const result = extract("<h1>My blog</h1>", "https://example.com/post");
    assert.deepEqual(result, { ok: false, source: "other", reason: "unsupported" });
});

test("Page scripts can be injected twice into the same page", () => {
    // Clicking "Scan page again" re-injects every file; it must not throw.
    const html = `<h1 class="top-card-layout__title">Twice</h1>`;
    assert.equal(extract(html, "https://www.linkedin.com/jobs/view/5/", 2).job.title, "Twice");
});

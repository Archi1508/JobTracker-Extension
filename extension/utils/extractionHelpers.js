// Small DOM helpers shared by every adapter. Injected into the job page
// before the adapters (see lib/extractor.js).
//
// Every helper is "safe": a missing element gives "" instead of throwing,
// so one broken selector never crashes the whole extraction.
(function () {
    const JobTracker = (globalThis.JobTracker = globalThis.JobTracker || { adapters: {} });

    // Visible text of an element, first line only, whitespace collapsed.
    // innerText respects CSS (hidden text is skipped); textContent is the
    // fallback for environments without layout (like the unit tests).
    function textOf(element) {
        if (!element) {
            return "";
        }

        const raw = typeof element.innerText === "string" ? element.innerText : element.textContent;
        const firstLine = (raw || "")
            .split("\n")
            .map(line => line.trim())
            .find(line => line !== "");

        return (firstLine || "").replace(/\s+/g, " ");
    }

    // Tries each selector in order and returns the first non-empty text.
    // Lets adapters list a stable selector first and older ones as fallbacks.
    function firstText(root, selectors) {
        for (const selector of selectors) {
            try {
                const text = textOf(root.querySelector(selector));
                if (text) {
                    return text;
                }
            } catch {
                // An invalid selector should never stop extraction.
            }
        }
        return "";
    }

    // <meta property="og:title" content="..."> -> "..."
    function metaContent(doc, property) {
        const meta = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
        return meta ? (meta.getAttribute("content") || "").trim() : "";
    }

    // Turns "&amp;" etc. into real characters. A <textarea> never runs
    // scripts or loads images, so this is safe for untrusted text.
    function decodeEntities(doc, text) {
        const textarea = doc.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    }

    function asArray(value) {
        if (Array.isArray(value)) {
            return value;
        }
        return value === undefined || value === null ? [] : [value];
    }

    function cleanText(doc, value) {
        return typeof value === "string" ? decodeEntities(doc, value).replace(/\s+/g, " ").trim() : "";
    }

    // "Bengaluru, Karnataka, IN" from a schema.org Place.
    function placeToText(doc, place) {
        const address = place && place.address;

        if (!address) {
            return "";
        }
        if (typeof address === "string") {
            return cleanText(doc, address);
        }

        const parts = [address.addressLocality, address.addressRegion, address.addressCountry]
            .map(part => (part && typeof part === "object" ? part.name : part))
            .map(part => cleanText(doc, part))
            .filter(Boolean);

        return [...new Set(parts)].join(", ");
    }

    // Many job sites embed structured data for Google Jobs:
    //   <script type="application/ld+json">{"@type": "JobPosting", ...}</script>
    // It changes far less often than the visible HTML, which makes it the
    // most reliable fallback. Returns null when the page has none.
    function readJobPosting(doc) {
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

        for (const script of scripts) {
            let data;
            try {
                data = JSON.parse(script.textContent);
            } catch {
                continue; // broken JSON on the page: skip it
            }

            const candidates = asArray(data).flatMap(item => [item, ...asArray(item && item["@graph"])]);
            const posting = candidates.find(item => item && asArray(item["@type"]).includes("JobPosting"));

            if (!posting) {
                continue;
            }

            const organization = asArray(posting.hiringOrganization)[0];
            const locations = asArray(posting.jobLocation).map(place => placeToText(doc, place)).filter(Boolean);
            const isRemote = asArray(posting.jobLocationType).includes("TELECOMMUTE");

            return {
                title: cleanText(doc, posting.title),
                company: cleanText(doc, typeof organization === "string" ? organization : organization && organization.name),
                location: locations.join(" | ") || (isRemote ? "Remote" : ""),
                workMode: isRemote ? "Remote" : ""
            };
        }

        return null;
    }

    // "Remote" / "Hybrid" / "On-site" when the text clearly says so, else "".
    function detectWorkMode(text) {
        if (/\bhybrid\b/i.test(text)) {
            return "Hybrid";
        }
        if (/\bremote\b|work from home|\bwfh\b/i.test(text)) {
            return "Remote";
        }
        if (/\bon-?site\b|in[- ]office/i.test(text)) {
            return "On-site";
        }
        return "";
    }

    // Fills every empty field of "job" from "fallback" (if there is one).
    function fillMissing(job, fallback) {
        if (!fallback) {
            return job;
        }

        const result = { ...job };
        for (const key of Object.keys(fallback)) {
            if (!result[key] && fallback[key]) {
                result[key] = fallback[key];
            }
        }
        return result;
    }

    // Page URL without query string or hash: the canonical form for sites
    // whose job id is in the path (Naukri, Internshala, Wellfound).
    function urlWithoutQuery(url) {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    }

    JobTracker.helpers = {
        textOf,
        firstText,
        metaContent,
        readJobPosting,
        detectWorkMode,
        fillMissing,
        urlWithoutQuery
    };
})();

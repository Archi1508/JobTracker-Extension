// Tests for the Saved jobs search box (extension/ui/savedJobsView.js).
// Loads the real popup.html into jsdom, then drives the real view module:
// type into #search-input, re-render, and look at which job cards are shown.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const popupHtml = readFileSync(new URL("../../extension/popup.html", import.meta.url), "utf8");

// Sources are stored as lowercase codes, exactly like in the database.
// Titles/companies deliberately don't contain any platform name.
const JOBS = [
    { id: 1, title: "Backend Developer", company: "Acme", source: "linkedin", status: "Saved" },
    { id: 2, title: "Data Analyst", company: "Globex", source: "indeed", status: "Applied" },
    { id: 3, title: "Product Designer", company: "Initech", source: "wellfound", status: "Saved" },
    { id: 4, title: "QA Engineer", company: "Umbrella", source: "naukri", status: "Interview" },
    { id: 5, title: "Marketing Intern", company: "Hooli", source: "internshala", status: "Saved" },
    { id: 6, title: "Platform Engineer", company: "Stripe", source: "other", status: "Saved" }
];

let view;
let searchInput;

before(async () => {
    const dom = new JSDOM(popupHtml);

    // The view module uses these browser globals when it is imported.
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.CSS = { escape: value => value };

    view = await import("../../extension/ui/savedJobsView.js");
    view.initSavedJobsView({
        getJobs: () => JOBS,
        getVisibleFields: () => ["source"],
        onStatusChange() {},
        onUpdate() {},
        onDelete() {}
    });

    searchInput = document.querySelector("#search-input");
});

// Types `query` into the search box and returns the ids of the shown cards.
function search(query) {
    searchInput.value = query;
    view.render();
    return [...document.querySelectorAll("#saved-list .job-card")].map(card => Number(card.dataset.id));
}

test("search by platform name as shown in the UI", () => {
    assert.deepEqual(search("LinkedIn"), [1]);
    assert.deepEqual(search("Indeed"), [2]);
    assert.deepEqual(search("Wellfound"), [3]);
    assert.deepEqual(search("Naukri"), [4]);
    assert.deepEqual(search("Internshala"), [5]);
    assert.deepEqual(search("Other"), [6]);
});

test("platform search ignores case and matches partial names", () => {
    assert.deepEqual(search("linkedin"), [1]);
    assert.deepEqual(search("NAUKRI"), [4]);
    assert.deepEqual(search("  wellf "), [3]);
});

test("title and company search still work as before", () => {
    assert.deepEqual(search("data analyst"), [2]);
    assert.deepEqual(search("Umbrella"), [4]);
    assert.deepEqual(search("engineer"), [4, 6]);
});

test("empty search shows all jobs; no match shows the message", () => {
    assert.deepEqual(search(""), [1, 2, 3, 4, 5, 6]);

    assert.deepEqual(search("monster.com"), []);
    assert.equal(document.querySelector("#saved-state").textContent, "No jobs match your search.");
});

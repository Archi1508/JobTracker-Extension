// End-to-end test: real Chrome + real extension + real backend.
//
// Requirements:
//   - the backend running on http://localhost:5000 (cd backend && npm start)
//   - Google Chrome or Chromium installed (set CHROME_PATH if it isn't found)
// Run: npm run test:e2e
//
// What it does:
//   1. Copies extension/ to a temp folder and adds "<all_urls>" to
//      host_permissions (test only: lets scripts be injected without the
//      user clicking the toolbar icon, which a test cannot do).
//   2. Opens a fake LinkedIn job page (served by request interception).
//   3. Opens popup.html in a tab and points its "active tab" at the job page.
//   4. Registers, extracts, saves, detects duplicates, changes status, edits,
//      toggles settings, searches, reopens, goes offline, deletes, logs out.
//   5. Deletes the test account.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSION_DIR = fileURLToPath(new URL("../../extension/", import.meta.url));
const API = "http://localhost:5000/api";

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
].filter(Boolean);

const JOB_URL = "https://www.linkedin.com/jobs/view/backend-developer-at-acme-9876543210/?trk=e2e";
const JOB_HTML = `<!doctype html><html><head><title>Job</title></head><body>
    <h1 class="top-card-layout__title">Backend Developer <span style="display:none">hidden text</span></h1>
    <a class="topcard__org-name-link" href="/company/acme">  Acme Corp  </a>
    <span class="topcard__flavor--bullet">Pune, Maharashtra, India</span>
</body></html>`;

const results = [];
function check(name, condition, detail = "") {
    results.push(Boolean(condition));
    console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition || !detail ? "" : `  (${detail})`}`);
}

async function backendIsUp() {
    try {
        return (await fetch(`${API}/health`)).ok;
    } catch {
        return false;
    }
}

// Makes chrome.tabs.query({ active: true }) inside the popup return the tab
// whose URL matches `pattern`, as if the user had clicked the icon there.
function pointActiveTabAt(page, pattern) {
    return page.evaluate(urlPattern => {
        const original = chrome.tabs.query.__original || chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = async query => (query.active ? original({ url: urlPattern }) : original(query));
        chrome.tabs.query.__original = original;
    }, pattern);
}

const text = (page, selector) => page.$eval(selector, element => element.textContent.trim());
const waitForToast = (page, message) =>
    page.waitForFunction(m => document.querySelector("#toast").textContent === m, {}, message);

async function main() {
    const chromePath = CHROME_CANDIDATES.find(candidate => fs.existsSync(candidate));
    if (!chromePath) {
        throw new Error("Chrome not found. Set CHROME_PATH to your Chrome/Chromium executable.");
    }
    if (!(await backendIsUp())) {
        throw new Error("Backend is not running on http://localhost:5000 (cd backend && npm start).");
    }

    // Test copy of the extension with broader host permissions.
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-tracker-e2e-"));
    const extensionCopy = path.join(tempDir, "extension");
    fs.cpSync(EXTENSION_DIR, extensionCopy, { recursive: true });
    const manifestPath = path.join(extensionCopy, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.host_permissions.push("<all_urls>");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        pipe: true,
        enableExtensions: true,
        userDataDir: path.join(tempDir, "profile"),
        args: ["--no-first-run", "--no-default-browser-check"]
    });

    let token = null;

    try {
        const extensionId = await browser.installExtension(extensionCopy);

        const jobPage = await browser.newPage();
        await jobPage.setRequestInterception(true);
        jobPage.on("request", request => request.respond({ status: 200, contentType: "text/html", body: JOB_HTML }));
        await jobPage.goto(JOB_URL);

        const popup = await browser.newPage();
        const consoleErrors = [];
        popup.on("pageerror", error => consoleErrors.push(String(error)));
        popup.on("console", message => message.type() === "error" && consoleErrors.push(message.text()));
        await popup.evaluateOnNewDocument(() => {
            const original = chrome.tabs.query.bind(chrome.tabs);
            chrome.tabs.query = async query => (query.active ? original({ url: "https://www.linkedin.com/*" }) : original(query));
            chrome.tabs.query.__original = original;
        });
        await popup.setViewport({ width: 400, height: 600 });
        await popup.goto(`chrome-extension://${extensionId}/popup.html`);
        await popup.bringToFront();

        // ----- auth -----
        await popup.waitForSelector("#auth-view:not([hidden])");
        check("login screen shown when logged out", await popup.$eval("#user-bar", e => getComputedStyle(e).display === "none"));

        await popup.click('[data-mode="register"]');
        await popup.type("#auth-email", "not-an-email");
        await popup.type("#auth-password", "password123");
        await popup.click("#auth-submit");
        check("client-side validation", (await text(popup, "#auth-error")).includes("valid email"));

        const email = `e2e-${Date.now()}@example.com`;
        await popup.$eval("#auth-email", e => (e.value = ""));
        await popup.type("#auth-email", email);
        await popup.click("#auth-submit");
        await popup.waitForSelector("#main-view:not([hidden])");
        token = (await popup.evaluate(() => chrome.storage.local.get("session"))).session.token;
        check("register logs in", Boolean(token));

        // ----- extraction -----
        await popup.waitForSelector("#current-form:not([hidden])");
        const extracted = await popup.evaluate(() => ({
            title: document.querySelector("#current-title").value,
            company: document.querySelector("#current-company").value,
            location: document.querySelector("#current-location").value,
            source: document.querySelector("#current-source").textContent
        }));
        check("job extracted in real Chrome", extracted.title === "Backend Developer" && extracted.company === "Acme Corp"
            && extracted.location === "Pune, Maharashtra, India" && extracted.source === "LinkedIn", JSON.stringify(extracted));

        // ----- save + duplicates -----
        await popup.click("#save-btn");
        await waitForToast(popup, "Job saved!");
        check("job saved", (await text(popup, "#save-btn")) === "Saved ✓" && (await text(popup, "#saved-count")) === "(1)");

        await popup.click("#rescan-btn");
        await popup.waitForFunction(() => document.querySelector("#save-btn").textContent === "Already saved");
        check("rescan recognises the saved job", true);

        const duplicate = await popup.evaluate(async () => {
            const api = await import("./lib/api.js");
            try {
                await api.createJob({ title: "x", jobUrl: "https://www.linkedin.com/jobs/view/9876543210", source: "linkedin" });
                return "created";
            } catch (error) {
                return `${error.status} ${error.message}`;
            }
        });
        check("duplicate save returns friendly 409", duplicate === "409 This job is already saved.", duplicate);

        // ----- saved jobs: status, edit, settings, search -----
        await popup.click("#view-existing-btn");
        await popup.waitForSelector("#tab-saved:not([hidden]) .job-card");

        await popup.select(".status-select", "Applied");
        await waitForToast(popup, "Status changed to Applied.");
        check("status change records date applied", (await text(popup, ".details")).includes("Date applied"));

        await popup.$$eval(".job-actions .link-btn", buttons => buttons.find(b => b.textContent === "Edit").click());
        await popup.waitForSelector(".edit-form");
        await popup.type('.edit-form input[name="salary"]', "18 LPA");
        await popup.type('.edit-form textarea[name="notes"]', "<img src=x onerror=alert(1)> call recruiter");
        await popup.click('.edit-form button[type="submit"]');
        await waitForToast(popup, "Job updated.");
        check("edit saves tracker fields", (await text(popup, ".details")).includes("18 LPA"));

        await popup.click('[data-tab="settings"]');
        await popup.click('#field-toggles input[data-key="notes"]');
        await popup.click('[data-tab="saved"]');
        const notes = await popup.$eval(".details dd.notes", e => ({ text: e.textContent, images: e.querySelectorAll("img").length }));
        check("settings show notes; HTML is shown as text (no XSS)", notes.images === 0 && notes.text.startsWith("<img"));

        await popup.type("#search-input", "no-such-job");
        check("search with no match", (await text(popup, "#saved-state")) === "No jobs match your search.");
        await popup.$eval("#search-input", e => { e.value = ""; e.dispatchEvent(new Event("input")); });

        // ----- persistence -----
        await popup.reload();
        await popup.waitForSelector("#main-view:not([hidden])");
        await popup.waitForSelector(".job-card");
        check("session and data survive reopening the popup", (await popup.$eval(".status-select", e => e.value)) === "Applied");

        // ----- backend unavailable -----
        await popup.setOfflineMode(true);
        await popup.reload();
        await popup.waitForFunction(() => document.querySelector("#saved-state").textContent.includes("Cannot connect"));
        check("backend unavailable message", true);
        await popup.setOfflineMode(false);
        await popup.reload();
        await popup.waitForSelector(".job-card");

        // ----- delete -----
        await popup.click('[data-tab="saved"]');
        await popup.click(".danger-link");
        check("delete asks for confirmation", (await text(popup, ".danger-link")) === "Confirm delete?");
        await popup.click(".danger-link");
        await waitForToast(popup, "Job deleted.");
        check("job deleted", (await text(popup, "#saved-state")).startsWith("No saved jobs yet"));

        // ----- unsupported website -----
        await jobPage.close();
        const otherPage = await browser.newPage();
        await otherPage.setRequestInterception(true);
        otherPage.on("request", request => request.respond({ status: 200, contentType: "text/html", body: "<h1>My blog</h1>" }));
        await otherPage.goto("https://example.com/blog");
        await popup.bringToFront();
        await pointActiveTabAt(popup, "https://example.com/*");
        await popup.click('[data-tab="current"]');
        await popup.click("#rescan-btn");
        await popup.waitForFunction(() => !document.querySelector("#current-state").textContent.includes("Reading"));
        check("unsupported website message", (await text(popup, "#current-state")) === "This website is not currently supported.");

        // ----- logout -----
        await popup.click("#logout-btn");
        await popup.waitForSelector("#auth-view:not([hidden])");
        check("logout returns to the login screen", true);

        // Chrome logs the deliberate 409 and the offline fetch failures as console errors.
        const unexpected = consoleErrors.filter(error => !/409|Failed to fetch|ERR_INTERNET_DISCONNECTED/.test(error));
        check("no unexpected errors in the popup", unexpected.length === 0, unexpected.join(" | "));
    } finally {
        await browser.close();
        if (token) {
            await fetch(`${API}/auth/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        }
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    }
}

main()
    .catch(error => {
        console.error("E2E run failed:", error.message);
        results.push(false);
    })
    .finally(() => {
        const passed = results.filter(Boolean).length;
        console.log(`\n${passed}/${results.length} checks passed`);
        process.exitCode = passed === results.length ? 0 : 1;
    });

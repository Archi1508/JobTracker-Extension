// "Saved jobs" tab: search/filter, status dropdown, inline edit, delete.
import { STATUSES, WORK_MODES, SOURCE_LABELS, TRACKER_FIELDS } from "../lib/config.js";
import { el, fillSelect, formatDate, safeHttpUrl, toDateInputValue } from "./dom.js";

const list = document.querySelector("#saved-list");
const stateText = document.querySelector("#saved-state");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");

// Everything the view needs, provided by popup.js:
//   getJobs(), getVisibleFields(), onStatusChange(job, status),
//   onUpdate(job, changes), onDelete(job)
let ctx = {};
// Id of the job whose edit form is open (only one at a time).
let editingId = null;

function showState(message) {
    stateText.textContent = message;
    stateText.hidden = !message;
}

// ---------- read-only card ----------

// Text to show for one tracker field, or "" when empty.
function fieldText(job, key) {
    const value = job[key];

    if (key === "source") {
        return SOURCE_LABELS[value] || value;
    }
    if (key === "dateApplied" || key === "interviewDate") {
        return formatDate(value, true);
    }
    if (key === "savedAt") {
        return formatDate(value);
    }
    return value || "";
}

function renderDetails(job) {
    const visible = ctx.getVisibleFields();
    const rows = TRACKER_FIELDS
        .filter(field => visible.includes(field.key))
        .map(field => ({ label: field.label, text: fieldText(job, field.key), key: field.key }))
        .filter(row => row.text);

    if (rows.length === 0) {
        return null;
    }

    return el("dl", { className: "details" },
        rows.map(row => [
            el("dt", {}, row.label),
            el("dd", { className: row.key === "notes" ? "notes" : "" }, row.text)
        ])
    );
}

function renderStatusSelect(job) {
    const select = el("select", {
        className: `status-select status-${job.status.toLowerCase()}`,
        "aria-label": "Application status",
        onchange: () => ctx.onStatusChange(job, select.value)
    });
    fillSelect(select, STATUSES);
    select.value = job.status;
    return select;
}

function renderDeleteButton(job) {
    // Two-step delete: first click asks, second click (within 4s) deletes.
    const button = el("button", { type: "button", className: "danger-link" }, "Delete");
    let armed = false;
    let timer = null;

    button.addEventListener("click", () => {
        if (!armed) {
            armed = true;
            button.textContent = "Confirm delete?";
            timer = setTimeout(() => {
                armed = false;
                button.textContent = "Delete";
            }, 4000);
            return;
        }
        clearTimeout(timer);
        button.disabled = true;
        ctx.onDelete(job);
    });

    return button;
}

function renderCard(job) {
    const href = safeHttpUrl(job.jobUrl);
    const title = href
        ? el("a", { href, target: "_blank", rel: "noopener noreferrer", className: "job-title" }, job.title)
        : el("span", { className: "job-title" }, job.title);

    return el("li", { className: "job-card", dataset: { id: String(job.id) } },
        el("div", { className: "job-head" },
            el("div", {},
                title,
                job.company ? el("div", { className: "muted" }, job.company) : null
            ),
            renderStatusSelect(job)
        ),
        renderDetails(job),
        el("div", { className: "job-actions" },
            el("button", { type: "button", className: "link-btn", onclick: () => openEditor(job.id) }, "Edit"),
            renderDeleteButton(job)
        )
    );
}

// ---------- edit form ----------

function renderInput(field, job) {
    const value = job[field.key];

    if (field.type === "textarea") {
        return el("textarea", { name: field.key, rows: 3, maxLength: 5000, value: value || "" });
    }
    if (field.type === "date") {
        return el("input", { type: "date", name: field.key, value: toDateInputValue(value) });
    }
    if (field.type === "workMode") {
        const select = el("select", { name: field.key });
        fillSelect(select, [{ value: "", label: "Not specified" }, ...WORK_MODES]);
        select.value = value || "";
        return select;
    }
    return el("input", { name: field.key, maxLength: 200, value: value || "" });
}

function renderEditor(job) {
    const editable = TRACKER_FIELDS.filter(field => field.type !== "readonly");

    const form = el("form", { className: "edit-form" },
        el("label", {}, "Title", el("input", { name: "title", required: true, maxLength: 300, value: job.title })),
        el("label", {}, "Company", el("input", { name: "company", maxLength: 200, value: job.company || "" })),
        editable.map(field => el("label", {}, field.label, renderInput(field, job))),
        el("div", { className: "actions" },
            el("button", { type: "submit", className: "primary" }, "Save changes"),
            el("button", { type: "button", onclick: closeEditor }, "Cancel")
        )
    );

    form.addEventListener("submit", event => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(form));
        if (!data.title.trim()) {
            form.elements.title.focus();
            return;
        }

        // Send only the fields that actually changed.
        const changes = {};
        for (const [key, value] of Object.entries(data)) {
            const before = key === "dateApplied" || key === "interviewDate"
                ? toDateInputValue(job[key])
                : (job[key] || "");
            if (value.trim() !== before) {
                changes[key] = value.trim();
            }
        }

        if (Object.keys(changes).length === 0) {
            closeEditor();
            return;
        }

        form.querySelector("button[type=submit]").disabled = true;
        ctx.onUpdate(job, changes);
    });

    return el("li", { className: "job-card editing", dataset: { id: String(job.id) } },
        el("div", { className: "muted small" }, "Editing"),
        form
    );
}

function openEditor(id) {
    editingId = id;
    render();
}

export function closeEditor() {
    editingId = null;
    render();
}

// ---------- list ----------

function matchesSearch(job, query) {
    if (!query) {
        return true;
    }
    return [job.title, job.company, job.location, job.notes]
        .some(value => (value || "").toLowerCase().includes(query));
}

function updateFilterCounts(jobs) {
    const selected = statusFilter.value;
    const count = status => jobs.filter(job => job.status === status).length;

    fillSelect(statusFilter, [
        { value: "", label: `All statuses (${jobs.length})` },
        ...STATUSES.map(status => ({ value: status, label: `${status} (${count(status)})` }))
    ]);
    statusFilter.value = selected;
}

// Redraws the list from ctx.getJobs(). Cheap enough to call after every change.
export function render() {
    const jobs = ctx.getJobs();
    updateFilterCounts(jobs);

    const query = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const shown = jobs.filter(job => (!status || job.status === status) && matchesSearch(job, query));

    list.textContent = "";

    if (jobs.length === 0) {
        showState("No saved jobs yet. Open a job posting and click Save job.");
        return;
    }
    if (shown.length === 0) {
        showState("No jobs match your search.");
        return;
    }

    showState("");
    for (const job of shown) {
        list.append(job.id === editingId ? renderEditor(job) : renderCard(job));
    }
}

export function showLoading() {
    list.textContent = "";
    showState("Loading saved jobs…");
}

export function showError(message) {
    list.textContent = "";
    showState(message);
}

// Clears search/filter and scrolls to (and briefly highlights) one job.
export function highlightJob(id) {
    searchInput.value = "";
    statusFilter.value = "";
    render();

    const card = list.querySelector(`[data-id="${CSS.escape(String(id))}"]`);
    if (card) {
        card.scrollIntoView({ block: "center" });
        card.classList.add("highlight");
        setTimeout(() => card.classList.remove("highlight"), 2000);
    }
}

export function initSavedJobsView(context) {
    ctx = context;
    searchInput.addEventListener("input", render);
    statusFilter.addEventListener("change", render);
}

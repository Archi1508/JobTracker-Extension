// DOM helpers for the popup.
//
// Security rule for the whole popup: job data comes from other websites,
// so it is only ever inserted with textContent / value (never innerHTML),
// and links only accept http(s) URLs.

// el("button", { className: "primary", onclick: fn }, "Save")
// Creates an element, sets properties, and appends children (strings
// become text nodes, so they can never be interpreted as HTML).
export function el(tag, props = {}, ...children) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) {
            continue;
        }
        if (key === "dataset") {
            Object.assign(element.dataset, value);
        } else if (key.startsWith("on") && typeof value === "function") {
            element.addEventListener(key.slice(2), value);
        } else if (key in element) {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    }

    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        element.append(child instanceof Node ? child : String(child));
    }

    return element;
}

// Returns the URL if it is http(s), otherwise null (blocks javascript: links).
export function safeHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch {
        return null;
    }
}

// ISO date -> "5 Oct 2026" (or "" for no date).
// Date-only fields (dateApplied, interviewDate) are stored as midnight UTC,
// so pass utc = true for them, otherwise users west of UTC see the day before.
export function formatDate(iso, utc = false) {
    if (!iso) {
        return "";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: utc ? "UTC" : undefined
    });
}

// Today as "YYYY-MM-DD" in the user's own time zone.
export function todayLocal() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// ISO date -> "2026-10-05" for <input type="date">.
export function toDateInputValue(iso) {
    return iso ? String(iso).slice(0, 10) : "";
}

// Builds <option>s for a <select>. "items" are strings or { value, label }.
export function fillSelect(select, items) {
    select.textContent = "";
    for (const item of items) {
        const { value, label } = typeof item === "string" ? { value: item, label: item } : item;
        select.append(el("option", { value }, label));
    }
}

let toastTimer = null;

// Shows a short message at the top of the popup.
// type: "success" | "error" | "info"
export function showToast(message, type = "info") {
    const toast = document.querySelector("#toast");

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.hidden = false;

    clearTimeout(toastTimer);
    // Errors stay longer so there is time to read them.
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, type === "error" ? 6000 : 3000);
}

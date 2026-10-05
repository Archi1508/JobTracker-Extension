// Settings tab: choose which tracker fields ("headings") appear on saved
// job cards. Stored with chrome.storage.sync (see lib/storage.js).
import { TRACKER_FIELDS } from "../lib/config.js";
import { el } from "./dom.js";

const container = document.querySelector("#field-toggles");

// visibleFields: array of field keys; onChange(newKeys) saves and re-renders.
export function renderSettings(visibleFields, onChange) {
    container.textContent = "";

    for (const field of TRACKER_FIELDS) {
        const checkbox = el("input", {
            type: "checkbox",
            checked: visibleFields.includes(field.key),
            onchange: () => {
                const keys = [...container.querySelectorAll("input:checked")].map(input => input.dataset.key);
                onChange(keys);
            }
        });
        checkbox.dataset.key = field.key;

        container.append(el("label", { className: "toggle" }, checkbox, field.label));
    }
}

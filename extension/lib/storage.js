// Small wrappers around chrome.storage so the rest of the popup doesn't
// need to know key names.
//   - local: the login session (stays on this computer)
//   - sync:  display preferences (follow the user's Chrome profile)

import { TRACKER_FIELDS } from "./config.js";

const SESSION_KEY = "session";
const VISIBLE_FIELDS_KEY = "visibleFields";

// { token, user: { id, email } } or null
export async function getSession() {
    const stored = await chrome.storage.local.get(SESSION_KEY);
    return stored[SESSION_KEY] || null;
}

export function saveSession(session) {
    return chrome.storage.local.set({ [SESSION_KEY]: session });
}

export function clearSession() {
    return chrome.storage.local.remove(SESSION_KEY);
}

// Which tracker fields show on saved job cards: array of field keys.
export async function getVisibleFields() {
    const stored = await chrome.storage.sync.get(VISIBLE_FIELDS_KEY);

    if (Array.isArray(stored[VISIBLE_FIELDS_KEY])) {
        return stored[VISIBLE_FIELDS_KEY];
    }

    return TRACKER_FIELDS.filter(field => field.defaultVisible).map(field => field.key);
}

export function saveVisibleFields(keys) {
    return chrome.storage.sync.set({ [VISIBLE_FIELDS_KEY]: keys });
}

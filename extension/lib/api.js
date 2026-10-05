// The only file that talks to the backend. The UI calls these functions
// and never uses fetch() directly.
//
// Every function either returns data or throws an ApiError whose message
// is already safe and friendly enough to show to the user.

import { API_BASE_URL } from "./config.js";

export class ApiError extends Error {
    constructor(status, message, data = {}) {
        super(message);
        this.status = status; // HTTP status, or 0 when the server was unreachable
        this.data = data;     // the parsed JSON body (e.g. existingJobId on 409)
    }
}

// Login token; set by the popup after login or when restored from storage.
let authToken = null;

export function setAuthToken(token) {
    authToken = token;
}

// Turns an error response into a message a user understands.
function messageFor(status, data) {
    if (status === 400) {
        const details = Array.isArray(data.errors) ? ` (${data.errors.join("; ")})` : "";
        return (data.message || "Invalid data") + "." + details;
    }
    if (status === 401) {
        return data.message || "Please log in again.";
    }
    if (status === 404) {
        return "This job no longer exists. It may have been deleted.";
    }
    if (status === 409) {
        return data.message || "This job is already saved.";
    }
    if (status === 429) {
        return data.message || "Too many attempts. Please wait and try again.";
    }
    if (status >= 500) {
        return "The server had a problem. Please try again in a moment.";
    }
    return data.message || `Request failed (${status}).`;
}

// Sends one request and returns the parsed JSON body.
async function request(method, path, body) {
    const headers = {};

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    let response;
    try {
        response = await fetch(API_BASE_URL + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch {
        // fetch() only throws when no answer arrived (server off, no network).
        throw new ApiError(0, "Cannot connect to server. Is the backend running?");
    }

    // Our API always answers with JSON, but a proxy or crash page might not.
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new ApiError(response.status, messageFor(response.status, data), data);
    }

    return data;
}

// ---------- auth ----------

export function register(email, password) {
    return request("POST", "/auth/register", { email, password });
}

export function login(email, password) {
    return request("POST", "/auth/login", { email, password });
}

export async function getCurrentUser() {
    return (await request("GET", "/auth/me")).user;
}

// ---------- jobs ----------

export async function getJobs() {
    return (await request("GET", "/jobs")).jobs;
}

export async function getJob(id) {
    return (await request("GET", `/jobs/${encodeURIComponent(id)}`)).job;
}

export async function createJob(job) {
    return (await request("POST", "/jobs", job)).job;
}

export async function updateJob(id, changes) {
    return (await request("PATCH", `/jobs/${encodeURIComponent(id)}`, changes)).job;
}

export async function deleteJob(id) {
    return (await request("DELETE", `/jobs/${encodeURIComponent(id)}`)).job;
}

export async function checkHealth() {
    return request("GET", "/health");
}

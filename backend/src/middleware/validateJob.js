// true if value is a string with at least one non-space character
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
}

// true if value is a valid http:// or https:// URL
function isValidUrl(value) {
    if (typeof value !== "string") {
        return false;
    }

    try {
        const parsed = new URL(value); // throws if the text is not a URL
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

// Middleware: checks req.body before it reaches createJob.
export function validateJob(req, res, next) {
    const body = req.body || {};
    const errors = [];

    // Required: must be present and non-empty.
    const requiredFields = ["title", "website"];

    for (const field of requiredFields) {
        if (!isNonEmptyString(body[field])) {
            errors.push(field + " is required and must be a non-empty string");
        }
    }

    // Optional: may be missing or "" (adapters return "" when they can't
    // find a value), but if sent they must be text.
    const optionalFields = ["company", "location"];

    for (const field of optionalFields) {
        if (body[field] !== undefined && typeof body[field] !== "string") {
            errors.push(field + " must be a string if provided");
        }
    }

    if (!isValidUrl(body.url)) {
        errors.push("url is required and must be a valid http(s) URL");
    }

    if (errors.length > 0) {
        // Stop here: send 400 and do NOT call next(), so the controller never runs.
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors
        });
    }

    // Everything is valid: pass the request on to the next function (createJob).
    next();
}

// The only statuses a job can have.
const STATUSES = ["Saved", "Applied", "Interview", "Rejected", "Offer"];

// Middleware: checks req.body.status before it reaches updateJobStatus.
export function validateStatus(req, res, next) {
    const status = (req.body || {}).status;

    // includes() is true only for an exact match, so a missing status,
    // a typo, a number or "applied" (wrong case) are all rejected.
    if (!STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: ["status must be one of: " + STATUSES.join(", ")]
        });
    }

    next();
}

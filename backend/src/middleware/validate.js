// Turns zod issues into short readable strings, e.g. "title: is required".
function formatIssues(issues) {
    return issues.map(issue => {
        const field = issue.path.join(".");
        return field ? `${field}: ${issue.message}` : issue.message;
    });
}

// Middleware factory: validates req[property] against a zod schema.
// On success the parsed (trimmed / converted) data is stored on
// req.validated[property], so controllers only ever see clean data.
// (req.query is read-only in Express 5, so we don't overwrite req.body/query.)
export function validate(schema, message = "Invalid request data", property = "body") {
    return (req, res, next) => {
        const result = schema.safeParse(req[property] ?? {});

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: message,
                errors: formatIssues(result.error.issues)
            });
        }

        req.validated = { ...req.validated, [property]: result.data };
        next();
    };
}

// Middleware: rejects ids that are not positive whole numbers ("abc", "-1", "1.5").
export function validateIdParam(req, res, next) {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid job id"
        });
    }

    req.jobId = id;
    next();
}

import { z } from "zod";

export const JOB_STATUSES = ["Saved", "Applied", "Assessment", "Interview", "Rejected", "Offer"];
export const JOB_SOURCES = ["linkedin", "indeed", "wellfound", "internshala", "naukri", "other"];
export const WORK_MODES = ["Remote", "Hybrid", "On-site"];

// Optional text field.
//   missing    -> undefined (leave unchanged)
//   "" or null -> null      (clear the value)
//   "text"     -> "text" (trimmed)
function optionalText(maxLength) {
    return z.string()
        .trim()
        .max(maxLength, `must be at most ${maxLength} characters`)
        .nullable()
        .optional()
        .transform(value => (value === "" ? null : value));
}

// Optional date, sent as "2026-10-05" or a full ISO string. Same
// missing / empty / value rules as optionalText.
const optionalDate = z.string()
    .trim()
    .nullable()
    .optional()
    .transform((value, ctx) => {
        if (value === undefined) {
            return undefined;
        }
        if (value === null || value === "") {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            ctx.addIssue({ code: "custom", message: "must be a valid date" });
            return z.NEVER;
        }

        return date;
    });

const httpUrl = z.string()
    .trim()
    .max(2000, "must be at most 2000 characters")
    .refine(value => {
        try {
            const { protocol } = new URL(value);
            return protocol === "http:" || protocol === "https:";
        } catch {
            return false;
        }
    }, "must be a valid http(s) URL");

// Fields the user can edit after saving (the "tracker" columns).
const editableFields = {
    title: z.string().trim().min(1, "is required").max(300, "must be at most 300 characters"),
    company: optionalText(200),
    location: optionalText(200),
    status: z.enum(JOB_STATUSES, { error: `must be one of: ${JOB_STATUSES.join(", ")}` }),
    salary: optionalText(100),
    workMode: z.enum(WORK_MODES, { error: `must be one of: ${WORK_MODES.join(", ")}` })
        .nullable()
        .optional()
        .or(z.literal("").transform(() => null)),
    notes: optionalText(5000),
    resumeUsed: optionalText(200),
    referral: optionalText(200),
    dateApplied: optionalDate,
    interviewDate: optionalDate
};

// POST /api/jobs
export const createJobSchema = z.object({
    ...editableFields,
    status: editableFields.status.optional(),
    jobUrl: httpUrl,
    source: z.enum(JOB_SOURCES, { error: `must be one of: ${JOB_SOURCES.join(", ")}` })
});

// PATCH /api/jobs/:id — every field optional, but at least one required.
// jobUrl and source identify the job, so they cannot be changed.
export const updateJobSchema = z.object(editableFields)
    .partial()
    .refine(data => Object.values(data).some(value => value !== undefined), {
        message: "Provide at least one field to update"
    });

// GET /api/jobs?status=Applied
export const listJobsQuerySchema = z.object({
    status: z.enum(JOB_STATUSES, { error: `must be one of: ${JOB_STATUSES.join(", ")}` }).optional()
});

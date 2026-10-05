// Shared constants for the popup. Keep in sync with the backend
// (backend/src/validation/jobSchemas.js).

// Where the backend runs. If you change it, also update
// "host_permissions" in manifest.json.
export const API_BASE_URL = "http://localhost:5000/api";

export const STATUSES = ["Saved", "Applied", "Assessment", "Interview", "Rejected", "Offer"];

export const WORK_MODES = ["Remote", "Hybrid", "On-site"];

export const SOURCE_LABELS = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    wellfound: "Wellfound",
    internshala: "Internshala",
    naukri: "Naukri",
    other: "Other"
};

// The tracker fields ("headings") a saved job can have beyond title/company.
// - "type" decides which input the edit form uses
// - "defaultVisible" decides whether it shows on saved job cards until the
//   user changes it in Settings
export const TRACKER_FIELDS = [
    { key: "location", label: "Location", type: "text", defaultVisible: true },
    { key: "workMode", label: "Work mode", type: "workMode", defaultVisible: true },
    { key: "salary", label: "Salary", type: "text", defaultVisible: true },
    { key: "dateApplied", label: "Date applied", type: "date", defaultVisible: true },
    { key: "interviewDate", label: "Interview date", type: "date", defaultVisible: true },
    { key: "resumeUsed", label: "Resume used", type: "text", defaultVisible: false },
    { key: "referral", label: "Referral", type: "text", defaultVisible: false },
    { key: "notes", label: "Notes", type: "textarea", defaultVisible: false },
    { key: "source", label: "Source", type: "readonly", defaultVisible: true },
    { key: "savedAt", label: "Saved on", type: "readonly", defaultVisible: false }
];

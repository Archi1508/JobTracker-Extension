import ExcelJS from "exceljs";

// Readable names for the "source" values stored in the database.
const PLATFORM_NAMES = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    wellfound: "Wellfound",
    internshala: "Internshala",
    naukri: "Naukri",
    other: "Other"
};

// One entry per Excel column:
//   header = text in the first row
//   key    = name used to fill the row (see jobToRow below)
//   width  = column width in characters
const COLUMNS = [
    { header: "Job Title", key: "title", width: 34 },
    { header: "Company", key: "company", width: 24 },
    { header: "Location", key: "location", width: 24 },
    { header: "Work Mode", key: "workMode", width: 12 },
    { header: "Application Status", key: "status", width: 18 },
    { header: "Platform", key: "platform", width: 13 },
    { header: "Job URL", key: "jobUrl", width: 45 },
    { header: "Salary", key: "salary", width: 14 },
    { header: "Date Applied", key: "dateApplied", width: 14 },
    { header: "Interview Date", key: "interviewDate", width: 15 },
    { header: "Resume Used", key: "resumeUsed", width: 18 },
    { header: "Referral", key: "referral", width: 18 },
    { header: "Notes", key: "notes", width: 45 },
    { header: "Date Added", key: "savedAt", width: 14 },
    { header: "Last Updated", key: "updatedAt", width: 14 }
];

const DATE_COLUMNS = ["dateApplied", "interviewDate", "savedAt", "updatedAt"];

// Turns one job from the database into one row of cell values.
// Empty values (null / undefined / "") become null, which leaves the
// Excel cell blank instead of showing "null".
function jobToRow(job) {
    const row = {
        title: job.title,
        company: job.company || null,
        location: job.location || null,
        workMode: job.workMode || null,
        status: job.status,
        platform: PLATFORM_NAMES[job.source] || job.source,
        // { text, hyperlink } makes the cell a clickable link in Excel.
        jobUrl: job.jobUrl ? { text: job.jobUrl, hyperlink: job.jobUrl } : null,
        salary: job.salary || null,
        resumeUsed: job.resumeUsed || null,
        referral: job.referral || null,
        notes: job.notes || null
    };

    // Real Date objects become real Excel dates (sortable, filterable).
    for (const key of DATE_COLUMNS) {
        row[key] = job[key] ? new Date(job[key]) : null;
    }

    return row;
}

// Builds an .xlsx file from a list of jobs and returns it as a Buffer
// (the raw bytes of the file), ready to send in an HTTP response.
// Note: text is always written as plain text, never as a formula, so a
// job title like "=HYPERLINK(...)" copied from a website can't run in Excel.
export async function buildJobsWorkbook(jobs) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Job Application Tracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Job Applications", {
        // Keep the header row visible while scrolling.
        views: [{ state: "frozen", ySplit: 1 }]
    });

    sheet.columns = COLUMNS;

    for (const job of jobs) {
        sheet.addRow(jobToRow(job));
    }

    // Header row: bold white text on a blue background.
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2457D6" } };
    header.alignment = { vertical: "middle" };

    // Show dates as 2026-10-07 instead of a raw number.
    for (const key of DATE_COLUMNS) {
        sheet.getColumn(key).numFmt = "yyyy-mm-dd";
    }

    // Long notes wrap inside their cell instead of running across the sheet.
    sheet.getColumn("notes").alignment = { wrapText: true, vertical: "top" };

    // Links look like links.
    sheet.getColumn("jobUrl").font = { color: { argb: "FF2457D6" }, underline: true };
    header.getCell("jobUrl").font = header.font;

    // Filter dropdowns on every header cell (only useful when there are rows).
    if (jobs.length > 0) {
        sheet.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };
    }

    return workbook.xlsx.writeBuffer();
}

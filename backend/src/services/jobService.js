import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeJobUrl } from "../utils/normalizeUrl.js";

// Prisma error codes we translate into HTTP errors.
const UNIQUE_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";

function isPrismaError(error, code) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function jobNotFound() {
    return new HttpError(404, "Job not found");
}

// Every query below filters by userId, so a user can only ever see or
// change their own jobs. Another user's job id behaves like a missing job.

export function listJobs(userId, { status } = {}) {
    return prisma.job.findMany({
        where: { userId, status },
        orderBy: { savedAt: "desc" }
    });
}

export async function getJob(userId, id) {
    const job = await prisma.job.findFirst({ where: { id, userId } });

    if (!job) {
        throw jobNotFound();
    }

    return job;
}

// Moving to "Applied" without a date fills in today, which is almost
// always what the user means.
function withDefaultDateApplied(data, existingDateApplied) {
    if (data.status === "Applied" && data.dateApplied === undefined && !existingDateApplied) {
        return { ...data, dateApplied: new Date() };
    }
    return data;
}

export async function createJob(userId, data) {
    const jobUrl = normalizeJobUrl(data.jobUrl);

    try {
        return await prisma.job.create({
            data: withDefaultDateApplied({ ...data, jobUrl, userId }, null)
        });
    } catch (error) {
        // The @@unique([userId, source, jobUrl]) constraint decides what a
        // duplicate is; the database enforces it even for parallel requests.
        if (isPrismaError(error, UNIQUE_VIOLATION)) {
            const existing = await prisma.job.findFirst({
                where: { userId, source: data.source, jobUrl },
                select: { id: true }
            });

            throw new HttpError(409, "This job is already saved.", {
                existingJobId: existing ? existing.id : null
            });
        }
        throw error;
    }
}

export async function updateJob(userId, id, data) {
    const existing = await getJob(userId, id);

    return prisma.job.update({
        where: { id: existing.id },
        data: withDefaultDateApplied(data, existing.dateApplied)
    });
}

export async function deleteJob(userId, id) {
    try {
        // where { id, userId } only matches the user's own job.
        return await prisma.job.delete({ where: { id, userId } });
    } catch (error) {
        if (isPrismaError(error, RECORD_NOT_FOUND)) {
            throw jobNotFound();
        }
        throw error;
    }
}

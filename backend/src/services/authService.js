import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const BCRYPT_ROUNDS = 10;

// Compared against when the email does not exist, so a login attempt takes
// the same time whether or not the account exists (no account guessing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

// Only these user fields ever leave the server (never passwordHash).
function publicUser(user) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function createToken(user) {
    // "sub" (subject) is the standard JWT field for "who this token is for".
    return jwt.sign({ sub: String(user.id) }, env.jwtSecret, {
        algorithm: "HS256",
        expiresIn: env.jwtExpiresIn
    });
}

export async function register(email, password) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
        const user = await prisma.user.create({ data: { email, passwordHash } });
        return { token: createToken(user), user: publicUser(user) };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new HttpError(409, "An account with this email already exists.");
        }
        throw error;
    }
}

export async function login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordMatches) {
        // Same message for both cases: don't reveal which part was wrong.
        throw new HttpError(401, "Invalid email or password.");
    }

    return { token: createToken(user), user: publicUser(user) };
}

export async function getUser(id) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        throw new HttpError(401, "Your account no longer exists. Please log in again.");
    }

    return publicUser(user);
}

// Deletes the account. Its jobs are removed too (ON DELETE CASCADE).
export async function deleteUser(id) {
    await prisma.user.deleteMany({ where: { id } });
}

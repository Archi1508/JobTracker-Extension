import * as authService from "../services/authService.js";

// POST /api/auth/register
export async function register(req, res) {
    const { email, password } = req.validated.body;
    const result = await authService.register(email, password);
    res.status(201).json({ success: true, ...result });
}

// POST /api/auth/login
export async function login(req, res) {
    const { email, password } = req.validated.body;
    const result = await authService.login(email, password);
    res.status(200).json({ success: true, ...result });
}

// GET /api/auth/me
export async function me(req, res) {
    const user = await authService.getUser(req.user.id);
    res.status(200).json({ success: true, user: user });
}

// DELETE /api/auth/me
export async function deleteMe(req, res) {
    await authService.deleteUser(req.user.id);
    res.status(200).json({ success: true, message: "Account deleted" });
}

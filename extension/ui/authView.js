// Login / create-account form.
import * as api from "../lib/api.js";

const view = document.querySelector("#auth-view");
const form = document.querySelector("#auth-form");
const emailInput = document.querySelector("#auth-email");
const passwordInput = document.querySelector("#auth-password");
const submitButton = document.querySelector("#auth-submit");
const errorText = document.querySelector("#auth-error");
const hint = document.querySelector("#auth-hint");
const modeTabs = view.querySelectorAll("[data-mode]");

let mode = "login"; // or "register"

function setMode(newMode) {
    mode = newMode;
    modeTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
    submitButton.textContent = mode === "login" ? "Log in" : "Create account";
    passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
    hint.hidden = mode === "login";
    showError("");
}

function showError(message) {
    errorText.textContent = message;
    errorText.hidden = !message;
}

// Checks the form before calling the server, for faster feedback.
function validate(email, password) {
    if (!email || !emailInput.checkValidity()) {
        return "Please enter a valid email address.";
    }
    if (!password) {
        return "Please enter your password.";
    }
    if (mode === "register" && password.length < 8) {
        return "Password must be at least 8 characters.";
    }
    return "";
}

// onLoggedIn({ token, user }) is called after a successful login/register.
export function initAuthView({ onLoggedIn }) {
    modeTabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const problem = validate(email, password);

        if (problem) {
            showError(problem);
            return;
        }

        submitButton.disabled = true;
        showError("");

        try {
            const result = mode === "login"
                ? await api.login(email, password)
                : await api.register(email, password);

            passwordInput.value = "";
            await onLoggedIn({ token: result.token, user: result.user });
        } catch (error) {
            showError(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });
}

export function showAuthView(message = "") {
    view.hidden = false;
    setMode("login");
    showError(message);
    emailInput.focus();
}

export function hideAuthView() {
    view.hidden = true;
}

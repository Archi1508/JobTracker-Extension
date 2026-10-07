// Tests for the login form (extension/ui/authView.js): which message and
// buttons appear for an unknown email vs. a wrong password.
// Loads the real popup.html into jsdom and fakes the server with fetch().
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const popupHtml = readFileSync(new URL("../../extension/popup.html", import.meta.url), "utf8");

let dom;
let $;
let loggedIn;

// Makes the fake server answer the next request with this status + body.
function serverAnswers(status, body) {
    globalThis.fetch = async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    });
}

// Fills the form and submits it, then waits for the async handler to finish.
async function submitLogin(email, password) {
    $("#auth-email").value = email;
    $("#auth-password").value = password;
    $("#auth-form").dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

    for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

before(async () => {
    dom = new JSDOM(popupHtml);
    globalThis.document = dom.window.document;
    $ = selector => dom.window.document.querySelector(selector);

    const authView = await import("../../extension/ui/authView.js");
    authView.initAuthView({ onLoggedIn: async session => { loggedIn = session; } });
    authView.showAuthView();
});

beforeEach(() => {
    loggedIn = null;
});

test("unregistered email: shows 'Account not found' and a Create account button", async () => {
    serverAnswers(401, {
        success: false,
        message: "Account not found. Please create an account.",
        code: "ACCOUNT_NOT_FOUND"
    });

    await submitLogin("new.person@example.com", "some-password");

    assert.equal($("#auth-error").textContent, "Account not found. Please create an account.");
    assert.equal($("#auth-error").hidden, false);
    assert.equal($("#auth-create-account").hidden, false);
    assert.equal(loggedIn, null);
});

test("Create account button opens the register form and keeps the email", async () => {
    $("#auth-create-account").click();

    assert.equal($("#auth-submit").textContent, "Create account");
    assert.ok($('[data-mode="register"]').classList.contains("active"));
    assert.equal($("#auth-email").value, "new.person@example.com");
    assert.equal($("#auth-error").hidden, true);
    assert.equal($("#auth-create-account").hidden, true);

    // Back to the login tab for the next tests.
    $('[data-mode="login"]').click();
});

test("registered email + wrong password: generic message, no Create account button", async () => {
    serverAnswers(401, { success: false, message: "Invalid email or password." });

    await submitLogin("me@example.com", "wrong-password");

    assert.equal($("#auth-error").textContent, "Invalid email or password.");
    assert.equal($("#auth-create-account").hidden, true);
    assert.equal(loggedIn, null);
});

test("correct login still logs in and hides old errors", async () => {
    serverAnswers(200, { success: true, token: "abc", user: { id: 1, email: "me@example.com" } });

    await submitLogin("me@example.com", "right-password");

    assert.deepEqual(loggedIn, { token: "abc", user: { id: 1, email: "me@example.com" } });
    assert.equal($("#auth-error").hidden, true);
    assert.equal($("#auth-create-account").hidden, true);
});

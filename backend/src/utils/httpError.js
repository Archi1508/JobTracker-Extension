// An error that already knows which HTTP status and message to send.
// Services throw it; the error handler middleware turns it into a response.
export class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra; // optional extra fields for the JSON response
    }
}

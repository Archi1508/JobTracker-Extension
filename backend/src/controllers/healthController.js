// Controller: decides WHAT to send back for a request.
export function getHealth(req, res) {
    res.status(200).json({
        success: true,
        message: "Job Tracker API is running"
    });
}

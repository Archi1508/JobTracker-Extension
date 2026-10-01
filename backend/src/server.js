import app from "./app.js";

// PORT comes from the .env file; 5000 is the fallback.
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Job Tracker API running on http://localhost:${PORT}`);
});

const url = window.location.href;

const website = detectUrl(url);

console.log("Current URL:", url);

console.log("Detected website:", website);

if (website === "unknown") {
    console.log("Website not supported");
}

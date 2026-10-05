// Query parameters that only track where a click came from. Removing them
// means the same job saved from two different links gets the same jobUrl,
// which is what duplicate protection compares.
const TRACKING_PARAMS = [
    "trk", "trackingId", "refId", "eBP", "lipi", "midToken", "midSig",
    "from", "src", "sid", "xid", "tk", "advn", "fccid", "vjs", "ref", "referrer",
    "fbclid", "gclid"
];

function isTrackingParam(name) {
    return name.startsWith("utm_") || TRACKING_PARAMS.includes(name);
}

// Returns a canonical form of a job URL:
//   - lower-case host, no "#hash"
//   - tracking query parameters removed, remaining ones sorted
//   - no trailing slash on the path
export function normalizeJobUrl(rawUrl) {
    const url = new URL(rawUrl);

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    for (const name of [...url.searchParams.keys()]) {
        if (isTrackingParam(name)) {
            url.searchParams.delete(name);
        }
    }

    url.searchParams.sort();

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
}

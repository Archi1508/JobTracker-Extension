export function detectWebsite(url) {
    if (url.includes("linkedin.com")) {
    return "linkedin";
    }
    if(url.includes("indeed.com")){
        return "indeed";
    }
        if (url.includes("internshala.com")) {
    return "internshala";
    }
    if(url.includes("naukri.com")){
        return "naukri";
    }
}

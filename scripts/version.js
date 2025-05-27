// REPO :

// TODO : change repo name.
const repo_name = "template";


// CONSTS :
const website_url = `https://user.github.io/${repo_name}/`;
const deployments_url = `https://github.com/user/${repo_name}/deployments`;
const apiUrl = `https://api.github.com/repos/user/${repo_name}/commits`;


// METHODS : ..............

function version(){
    fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
    if (Array.isArray(data) && data.length > 0) {
      console.log("Dernier commit :", data[0].commit.message);
    } else {
      console.log("Aucun commit trouvé.");
    }
    })
    .catch(error => console.error("Erreur lors de la récupération des commits :", error));
}

function check(){
    if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(website_url, "_blank");
        window.open(deployments_url, "_blank");
    } else {
        const { exec } = require("child_process");
        const platform = process.platform;
        if (platform === "win32") {
            exec(`start ${website_url}`);
            exec(`start ${deployments_url}`);
        } else if (platform === "darwin") {
            exec(`open ${website_url}`);
            exec(`open ${deployments_url}`);
        } else {
            exec(`xdg-open ${website_url}`);
            exec(`xdg-open ${deployments_url}`);
        }
    }
}

function page_load(){
    console.log("PAGE LOAD : OK.");
    console.log("REPO : " + repo_name);
    version();
}

// CALLS : ........

if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    page_load();
} else {
    check();
}
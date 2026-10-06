let settings = null;

async function load_settings() {
    const response = await fetch("settings.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    settings = await response.json();
}

function customize() {
    const { mainColor, subColor, textColor, navbarStyle } = settings.theme;
    const root = document.documentElement.style;
    const name = settings.repo.name.toUpperCase();

    root.setProperty("--main-color", mainColor);
    root.setProperty("--sub-color", subColor);
    root.setProperty("--text-color", textColor);
    root.setProperty("--navbar-style", navbarStyle);

    document.title = name;
    const siteName = document.getElementById("site-name");
    if (siteName) siteName.textContent = name;
}

async function show_version() {
    const { owner, name } = settings.repo;
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=1`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const [commit] = await response.json();
        console.log(commit
            ? `Version ${settings.version} (commit ${commit.sha.slice(0, 7)} : ${commit.commit.message})`
            : "Aucun commit trouvé.");
    } catch (error) {
        console.error("Erreur lors de la récupération des commits :", error.message);
    }
}

// PC FUNCTIONS : ........

function open_urls() {
    const path = require("path");
    const { owner, name } = JSON.parse(
        require("fs").readFileSync(path.join(__dirname, "settings.json"), "utf8")
    ).repo;
    const urls = [
        `https://${owner}.github.io/${name}/`,
        `https://github.com/${owner}/${name}/deployments`
    ];
    const opener = { win32: "start", darwin: "open" }[process.platform] || "xdg-open";
    urls.forEach(url => require("child_process").exec(`${opener} "${url}"`));
}

// CALLS : ........

async function main() {
    try {
        await load_settings();
        customize();        // thème d'abord, sans attendre GitHub
        await show_version();
    } catch (error) {
        console.error("Erreur lors de la récupération de settings.json :", error.message);
    }
}

if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    main();
} else {
    open_urls();
}
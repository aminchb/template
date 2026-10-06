// RELEASE :
// Navigateur -> applique le thème et affiche version / commit / todo en console.
// PC (Node)  -> demande version, commit, todo, met à jour settings.json,
//               push git (avec retry si user.email manque), ouvre les pages GitHub.
//
// Usage PC : node release.js

// ============================================================
// NAVIGATEUR
// ============================================================

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
    const { owner, name, version, commit, todo } = settings.repo;
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=1`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const [last] = await response.json();
        console.log(last
            ? `version : ${version} (commit ${last.sha.slice(0, 7)} : ${last.commit.message})`
            : "Aucun commit trouvé.");
    } catch (error) {
        console.error("Erreur lors de la récupération des commits :", error.message);
    }
}

async function main() {
    try {
        await load_settings();
        customize();
        await show_version();
    } catch (error) {
        console.error("Erreur d'initialisation :", error.message);
    }
}

// ============================================================
// PC (NODE)
// ============================================================

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

let rl = null;

function ask(question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

// 1.0.0 -> 1.0.1
function bump(version) {
    const [major, minor, patch] = version.split(".");
    return `${major}.${minor}.${Number(patch) + 1}`;
}

// y / Enter : incrémente | n : garde l'ancienne (si valide) | autre : nouvelle version x.y.z
async function ask_version(current) {
    const valid = VERSION_PATTERN.test(current);
    const next = valid ? bump(current) : "1.0.0";

    while (true) {
        const answer = await ask(`incrémenter version : (${valid ? current : "null"}) -> (${next}) (y/n/input) `);
        const lower = answer.toLowerCase();

        if (lower === "" || lower === "y") return next;
        if (lower === "n") {
            if (valid) return current;
            console.log("Aucune version précédente : saisis une version x.y.z ou y.");
        } else if (VERSION_PATTERN.test(answer)) {
            return answer;
        } else {
            console.log("Format invalide (x.y.z attendu).");
        }
    }
}

// y / Enter : garde la valeur actuelle | autre : nouvelle valeur
// "-" : vide la valeur (autorisé seulement si allowEmpty)
async function ask_keep(label, current, allowEmpty) {
    while (true) {
        const answer = await ask(`${label}: "${current}" (y/input${allowEmpty ? ", - pour vider" : ""}) `);
        const lower = answer.toLowerCase();

        if (lower === "" || lower === "y") {
            if (current || allowEmpty) return current;
            console.log(`${label} ne peut pas être vide.`);
        } else if (answer === "-" && allowEmpty) {
            return "";
        } else {
            return answer;
        }
    }
}

const git = (...args) =>
    require("child_process").execFileSync("git", args, { encoding: "utf8", stdio: "pipe" }).trim();

function git_release(message) {
    git("add", "-A");
    try {
        git("diff", "--cached", "--quiet");   // code 0 = rien à commiter
    } catch {
        git("commit", "-m", message);
    }
    git("push");
}

const git_error = error => (error.stderr || error.message || "").toString().trim();

function open_urls({ owner, name }) {
    const opener = { win32: 'start ""', darwin: "open" }[process.platform] || "xdg-open";
    [`https://github.com/${owner}/${name}/deployments`,`https://${owner}.github.io/${name}/`]
        .forEach(url => require("child_process").exec(`${opener} "${url}"`));
}

async function release() {
    const fs = require("fs");
    const file = require("path").join(__dirname, "settings.json");
    const original = fs.readFileSync(file, "utf8");
    const data = JSON.parse(original);
    const repo = data.repo;

    if (!repo || !repo.owner || !repo.name) throw new Error("settings.repo.owner / name manquant.");

    rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });

    try {
        // --- Questions (rien n'est écrit tant que tout n'est pas répondu) ---
        repo.version = await ask_version(String(repo.version ?? ""));
        repo.commit = await ask_keep("commit", String(repo.commit ?? ""), false);
        repo.todo = await ask_keep("todo", String(repo.todo ?? ""), true);

        // --- Écriture + git (restauration du fichier si git échoue) ---
        const message = `v${repo.version} : ${repo.commit}`;
        const headBefore = git("rev-parse", "HEAD");
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

        try {
            git_release(message);
        } catch (error) {
            console.error("Git a échoué :", git_error(error));
            const email = await ask("user.email git (nouvelle tentative) : ");
            try {
                if (!email) throw new Error("email vide");
                git("config", "user.email", email);
                git_release(message);
            } catch (retryError) {
                if (git("rev-parse", "HEAD") === headBefore) {
                    fs.writeFileSync(file, original);
                    console.error("settings.json restauré.");
                } else {
                    console.error("Un commit local existe mais le push a échoué : relance `git push`.");
                }
                throw new Error(git_error(retryError));
            }
        }
    } finally {
        rl.close();
    }

    open_urls(repo);
    console.log("Release terminée.");
}

// ============================================================
// CALLS
// ============================================================

if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    main();
} else {
    release().catch(error => {
        console.error("Erreur :", error.message);
        process.exit(1);
    });
}
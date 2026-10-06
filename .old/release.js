// VERSION / RELEASE :
// Navigateur -> affiche la version courante en console (settings.json + dernier commit GitHub).
// PC (Node)   -> valide les entrées, incrémente version + commentaire dans settings.json,
//                push git, puis ouvre la page GitHub Pages et la page de déploiements GitHub.
//
// Usage PC :
//   node release.js
//
// ou directement :
//   node release.js <version> "<commentaire>"
//
// Exemples :
//   node release.js
//   node release.js 1.0.2 "Fix navbar bug"


const SETTINGS_PATH = "settings.json";


// ============================================================
// METHODS (NAVIGATEUR)
// ============================================================

function applyTheme(theme) {
    const root = document.documentElement;

    root.style.setProperty("--main-color", theme.mainColor);
    root.style.setProperty("--sub-color", theme.subColor);
    root.style.setProperty("--text-color", theme.textColor);
    root.style.setProperty("--navbar-style", theme.navbarStyle);
}


function applyRepoInfo(repo) {
    const displayName = repo.name.toUpperCase();

    document.title = displayName;

    const siteName = document.getElementById("site-name");

    if (siteName) {
        siteName.textContent = displayName;
    }
}


function buildUrls(repo) {
    return {
        website_url: `https://${repo.owner}.github.io/${repo.name}/`,
        deployments_url: `https://github.com/${repo.owner}/${repo.name}/deployments`,
        apiUrl: `https://api.github.com/repos/${repo.owner}/${repo.name}/commits`
    };
}


function logVersion(settings, apiUrl) {
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API : HTTP ${response.status}`);
            }

            return response.json();
        })
        .then(data => {
            if (Array.isArray(data) && data.length > 0) {

                const shortSha = data[0].sha.slice(0, 7);

                console.log(
                    `Version : ${settings.version} ` +
                    `(commit ${shortSha} : "${data[0].commit.message}")`
                );

                if (settings.comment) {
                    console.log(
                        `Commentaire de release : ${settings.comment}`
                    );
                }

            } else {
                console.log("Aucun commit trouvé.");
            }
        })
        .catch(error => {
            console.error(
                "Erreur lors de la récupération des commits :",
                error.message
            );
        });
}


function page_load() {
    console.log("PAGE LOAD : OK.");

    fetch(SETTINGS_PATH)
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Impossible de charger ${SETTINGS_PATH} : HTTP ${response.status}`
                );
            }

            return response.json();
        })
        .then(settings => {

            // Vérification minimale de settings.json
            if (!settings || typeof settings !== "object") {
                throw new Error("settings.json est invalide.");
            }

            if (!settings.repo || typeof settings.repo !== "object") {
                throw new Error("settings.repo est absent ou invalide.");
            }

            if (!settings.theme || typeof settings.theme !== "object") {
                throw new Error("settings.theme est absent ou invalide.");
            }

            console.log("REPO : " + settings.repo.name);

            applyTheme(settings.theme);
            applyRepoInfo(settings.repo);

            const { apiUrl } = buildUrls(settings.repo);

            logVersion(settings, apiUrl);
        })
        .catch(error => {
            console.error(
                "Erreur lors du chargement de settings.json :",
                error.message
            );
        });
}


// ============================================================
// METHODS (PC / NODE)
// ============================================================


// Format strict : x.y.z
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;


function isValidVersion(version) {
    return (
        typeof version === "string" &&
        VERSION_PATTERN.test(version.trim())
    );
}


function isValidComment(commentaire) {
    return (
        typeof commentaire === "string" &&
        commentaire.trim().length > 0
    );
}


function incrementPatch(version) {
    if (!isValidVersion(version)) {
        return null;
    }

    const parts = version
        .trim()
        .split(".")
        .map(Number);

    parts[2] += 1;

    return parts.join(".");
}


function ask(rl, question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer.trim());
        });
    });
}


// Pose la question tant que la réponse n'est pas valide.
async function askUntilValid(
    rl,
    question,
    isValid,
    invalidMessage
) {
    while (true) {

        const answer = await ask(rl, question);

        if (isValid(answer)) {
            return answer;
        }

        console.log(invalidMessage);
    }
}


// ============================================================
// RELEASE PROMPT
// ============================================================

async function promptRelease(currentVersion) {

    const readline = require("readline");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });


    // --------------------------------------------------------
    // VERSION
    // --------------------------------------------------------

    // Une version est considérée valide uniquement si elle
    // respecte exactement x.y.z.
    const hasValidCurrent = isValidVersion(currentVersion);

    // Ce qui sera affiché à l'utilisateur.
    const displayCurrent = hasValidCurrent
        ? currentVersion.trim()
        : "null";


    // Si aucune version valide n'existe :
    // null -> 1.0.0
    //
    // Sinon :
    // 1.0.1 -> 1.0.2
    const suggested = hasValidCurrent
        ? incrementPatch(currentVersion)
        : "1.0.0";


    let version;


    while (true) {

        const answer = await ask(
            rl,
            `version: (${displayCurrent}) -> (${suggested}) ? (y/n) `
        );

        const normalized = answer.toLowerCase();


        // ----------------------------------------------------
        // ENTER / Y / YES
        // ----------------------------------------------------

        if (
            normalized === "" ||
            normalized === "y" ||
            normalized === "yes"
        ) {
            version = suggested;
            break;
        }


        // ----------------------------------------------------
        // N / NO
        // ----------------------------------------------------

        if (
            normalized === "n" ||
            normalized === "no"
        ) {
            version = await askUntilValid(
                rl,
                "Nouvelle version (format x.y.z, ex: 1.0.1) : ",
                isValidVersion,
                "Format invalide. Utilise x.y.z (ex: 1.0.1)."
            );

            break;
        }


        // ----------------------------------------------------
        // VERSION DIRECTEMENT SAISIE
        // ----------------------------------------------------

        if (isValidVersion(answer)) {
            version = answer;
            break;
        }


        // ----------------------------------------------------
        // ENTRÉE INVALIDE
        // ----------------------------------------------------

        console.log(
            `Entrée "${answer}" non reconnue.`
        );

        console.log(
            "Réponds par y/n ou entre directement une version x.y.z."
        );
    }


    // Double vérification de sécurité.
    if (!isValidVersion(version)) {
        rl.close();

        throw new Error(
            `Version invalide après validation : "${version}"`
        );
    }


    // --------------------------------------------------------
    // COMMENTAIRE
    // --------------------------------------------------------

    const commentaire = await askUntilValid(
        rl,
        "comment : ",
        isValidComment,
        "Le commentaire ne peut pas être vide, null ou composé uniquement d'espaces."
    );


    // Double vérification de sécurité.
    if (!isValidComment(commentaire)) {
        rl.close();

        throw new Error(
            "Commentaire invalide après validation."
        );
    }


    rl.close();


    return {
        version: version.trim(),
        commentaire: commentaire.trim()
    };
}


// ============================================================
// SETTINGS.JSON
// ============================================================

function readSettings(settingsPath) {

    const fs = require("fs");

    if (!fs.existsSync(settingsPath)) {
        throw new Error(
            `Fichier introuvable : ${settingsPath}`
        );
    }


    let content;

    try {
        content = fs.readFileSync(
            settingsPath,
            "utf8"
        );
    } catch (error) {
        throw new Error(
            `Impossible de lire ${settingsPath} : ${error.message}`
        );
    }


    let settings;

    try {
        settings = JSON.parse(content);
    } catch (error) {
        throw new Error(
            `${settingsPath} contient un JSON invalide : ${error.message}`
        );
    }


    if (!settings || typeof settings !== "object") {
        throw new Error(
            `${settingsPath} doit contenir un objet JSON.`
        );
    }


    return settings;
}


function updateSettings(
    settingsPath,
    version,
    commentaire
) {

    const fs = require("fs");


    // --------------------------------------------------------
    // VALIDATION AVANT MODIFICATION
    // --------------------------------------------------------

    if (!isValidVersion(version)) {
        throw new Error(
            `Impossible de modifier settings.json : version invalide "${version}".`
        );
    }


    if (!isValidComment(commentaire)) {
        throw new Error(
            "Impossible de modifier settings.json : commentaire invalide."
        );
    }


    // --------------------------------------------------------
    // LECTURE
    // --------------------------------------------------------

    const settings = readSettings(settingsPath);


    // --------------------------------------------------------
    // MODIFICATION EN MÉMOIRE
    // --------------------------------------------------------

    settings.version = version.trim();
    settings.comment = commentaire.trim();


    // --------------------------------------------------------
    // ÉCRITURE
    // --------------------------------------------------------

    try {

        fs.writeFileSync(
            settingsPath,
            JSON.stringify(settings, null, 2) + "\n",
            "utf8"
        );

    } catch (error) {

        throw new Error(
            `Impossible d'écrire ${settingsPath} : ${error.message}`
        );
    }


    // --------------------------------------------------------
    // VÉRIFICATION APRÈS ÉCRITURE
    // --------------------------------------------------------

    const savedSettings = readSettings(settingsPath);


    if (savedSettings.version !== version.trim()) {
        throw new Error(
            "Vérification échouée : la version enregistrée ne correspond pas."
        );
    }


    if (savedSettings.comment !== commentaire.trim()) {
        throw new Error(
            "Vérification échouée : le commentaire enregistré ne correspond pas."
        );
    }


    console.log(
        `settings.json mis à jour : version=${savedSettings.version}, comment="${savedSettings.comment}"`
    );


    return savedSettings;
}


// ============================================================
// GIT
// ============================================================

function run(cmd, args) {

    const { execFileSync } = require("child_process");

    try {

        execFileSync(
            cmd,
            args,
            {
                stdio: "inherit"
            }
        );

    } catch (error) {

        throw new Error(
            `La commande "${cmd} ${args.join(" ")}" a échoué.`
        );
    }
}


function gitRelease(version, commentaire) {

    const commitMessage =
        `${version} : ${commentaire}`;


    // --------------------------------------------------------
    // GIT ADD
    // --------------------------------------------------------

    console.log("\n[1/3] git add");

    run("git", [
        "add",
        "."
    ]);


    // --------------------------------------------------------
    // GIT COMMIT
    // --------------------------------------------------------

    console.log("\n[2/3] git commit");

    run("git", [
        "commit",
        "-m",
        commitMessage
    ]);


    // --------------------------------------------------------
    // GIT PUSH
    // --------------------------------------------------------

    console.log("\n[3/3] git push");

    run("git", [
        "push"
    ]);


    console.log(
        `\nRelease "${commitMessage}" poussée avec succès.`
    );
}


// ============================================================
// OPEN URLS
// ============================================================

function openUrls(repo) {

    if (
        !repo ||
        typeof repo.owner !== "string" ||
        repo.owner.trim() === "" ||
        typeof repo.name !== "string" ||
        repo.name.trim() === ""
    ) {
        throw new Error(
            "Impossible d'ouvrir les URLs : repo.owner ou repo.name est invalide."
        );
    }


    const {
        website_url,
        deployments_url
    } = buildUrls(repo);


    const { exec } = require("child_process");

    const platform = process.platform;


    const opener =
        platform === "win32"
            ? "start"
            : platform === "darwin"
                ? "open"
                : "xdg-open";


    console.log("\nOuverture de :");
    console.log(`- ${website_url}`);
    console.log(`- ${deployments_url}`);


    exec(
        `${opener} "${website_url}"`,
        error => {
            if (error) {
                console.error(
                    "Impossible d'ouvrir la page GitHub Pages :",
                    error.message
                );
            }
        }
    );


    exec(
        `${opener} "${deployments_url}"`,
        error => {
            if (error) {
                console.error(
                    "Impossible d'ouvrir la page des déploiements :",
                    error.message
                );
            }
        }
    );
}


// ============================================================
// MAIN
// ============================================================

async function check() {

    const path = require("path");


    // --------------------------------------------------------
    // LOCALISATION DE SETTINGS.JSON
    // --------------------------------------------------------

    const settingsPath = path.join(
        __dirname,
        SETTINGS_PATH
    );


    console.log("=================================");
    console.log("        RELEASE SCRIPT");
    console.log("=================================\n");


    // --------------------------------------------------------
    // LECTURE ET VALIDATION DU SETTINGS
    // --------------------------------------------------------

    let currentSettings;

    try {

        currentSettings = readSettings(
            settingsPath
        );

    } catch (error) {

        console.error(
            "Erreur settings.json :",
            error.message
        );

        process.exit(1);
    }


    // --------------------------------------------------------
    // VALIDATION DU REPO AVANT DE COMMENCER
    // --------------------------------------------------------

    if (
        !currentSettings.repo ||
        typeof currentSettings.repo !== "object"
    ) {
        console.error(
            "Erreur : settings.repo est absent ou invalide."
        );

        process.exit(1);
    }


    if (
        typeof currentSettings.repo.owner !== "string" ||
        currentSettings.repo.owner.trim() === ""
    ) {
        console.error(
            "Erreur : settings.repo.owner est absent ou vide."
        );

        process.exit(1);
    }


    if (
        typeof currentSettings.repo.name !== "string" ||
        currentSettings.repo.name.trim() === ""
    ) {
        console.error(
            "Erreur : settings.repo.name est absent ou vide."
        );

        process.exit(1);
    }


    // --------------------------------------------------------
    // ARGUMENTS CLI
    // --------------------------------------------------------

    const [
        ,
        ,
        versionArg,
        commentaireArg
    ] = process.argv;


    let version = versionArg;
    let commentaire = commentaireArg;


    // --------------------------------------------------------
    // MODE INTERACTIF
    // --------------------------------------------------------

    if (!version || !commentaire) {

        try {

            ({
                version,
                commentaire
            } = await promptRelease(
                currentSettings.version
            ));

        } catch (error) {

            console.error(
                "\nErreur pendant la saisie :",
                error.message
            );

            process.exit(1);
        }
    }


    // --------------------------------------------------------
    // VALIDATION FINALE AVANT TOUTE MODIFICATION
    // --------------------------------------------------------

    if (!isValidVersion(version)) {

        console.error(
            `Version invalide : "${version}"`
        );

        console.error(
            "Format attendu : x.y.z"
        );

        process.exit(1);
    }


    if (!isValidComment(commentaire)) {

        console.error(
            "Commentaire invalide : il ne peut pas être vide."
        );

        process.exit(1);
    }


    version = version.trim();
    commentaire = commentaire.trim();


    console.log("\n---------------------------------");
    console.log("Release validée :");
    console.log(`Version    : ${version}`);
    console.log(`Commentaire: ${commentaire}`);
    console.log("---------------------------------\n");


    // --------------------------------------------------------
    // ÉTAPE 1 : SETTINGS.JSON
    // --------------------------------------------------------

    let settings;

    try {

        console.log("[ÉTAPE 1/3] Mise à jour de settings.json...");

        settings = updateSettings(
            settingsPath,
            version,
            commentaire
        );

        console.log(
            "✓ settings.json validé.\n"
        );

    } catch (error) {

        console.error(
            "✗ Échec de la mise à jour de settings.json :",
            error.message
        );

        process.exit(1);
    }


    // --------------------------------------------------------
    // ÉTAPE 2 : GIT
    // --------------------------------------------------------

    try {

        console.log("[ÉTAPE 2/3] Publication Git...");

        gitRelease(
            version,
            commentaire
        );

        console.log(
            "✓ Git terminé avec succès.\n"
        );

    } catch (error) {

        console.error(
            "✗ Échec Git :",
            error.message
        );

        console.error(
            "\nLes pages ne seront pas ouvertes."
        );

        process.exit(1);
    }


    // --------------------------------------------------------
    // ÉTAPE 3 : OUVERTURE DES PAGES
    // --------------------------------------------------------

    try {

        console.log("[ÉTAPE 3/3] Ouverture des pages...");

        openUrls(
            settings.repo
        );

        console.log(
            "✓ Release terminée avec succès."
        );

    } catch (error) {

        console.error(
            "✗ Impossible d'ouvrir les pages :",
            error.message
        );

        process.exit(1);
    }
}


// ============================================================
// CALLS
// ============================================================

if (
    typeof window !== "undefined" &&
    typeof window.document !== "undefined"
) {

    page_load();

} else {

    check().catch(error => {

        console.error(
            "Erreur inattendue :",
            error.message
        );

        process.exit(1);
    });
}
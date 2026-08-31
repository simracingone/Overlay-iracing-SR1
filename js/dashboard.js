/* ==========================================================================
   Tableau de bord iRacing - Icônes Dynamiques SVG pour INT, LAST & BEST
   ========================================================================== */

"use strict";

const URL_WEBSOCKET = "ws://127.0.0.1:8000/ws";

let connexionSocket = null;
let temporisateurReconnexion = null;
let enCoursDeConnexion = false;
window.driverIcons = {};

/* --- Chargement des icônes pilotes --- */

async function chargerDriverIcons() {
    try {
        const response = await fetch("data/drivers.json?v=" + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        window.driverIcons = data.drivers || {};
    } catch (erreur) {
        console.error("Erreur chargement drivers.json :", erreur);
    }
}

chargerDriverIcons();
setInterval(chargerDriverIcons, 30000);

/* --- Connexion WebSocket --- */

function connecterDashboard() {
    if (enCoursDeConnexion) return;

    if (
        connexionSocket &&
        (connexionSocket.readyState === WebSocket.OPEN ||
            connexionSocket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    enCoursDeConnexion = true;
    connexionSocket = new WebSocket(URL_WEBSOCKET);

    connexionSocket.onopen = () => {
        enCoursDeConnexion = false;
        console.log("%c🟢 Dashboard connecté", "color:#00ff88;font-weight:bold;");
    };

    connexionSocket.onmessage = (evenement) => {
        try {
            const donnees = JSON.parse(evenement.data);
            if (!donnees || !Array.isArray(donnees.Leaderboard)) return;
            afficherClassement(donnees);
        } catch (erreur) {
            console.error("Erreur réception données :", erreur);
        }
    };

    connexionSocket.onerror = (erreur) => {
        console.error("Erreur WebSocket :", erreur);
    };

    connexionSocket.onclose = () => {
        enCoursDeConnexion = false;
        connexionSocket = null;

        if (temporisateurReconnexion === null) {
            temporisateurReconnexion = setTimeout(() => {
                temporisateurReconnexion = null;
                connecterDashboard();
            }, 1000);
        }
    };
}

/* --- Utilitaires --- */

function echapperHtml(valeur) {
    if (valeur === null || valeur === undefined) return "";
    return String(valeur)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obtenirInfoMarque(nomVoiture) {
    const nomBrut = nomVoiture || "";
    const nomNettoye = nomBrut.toLowerCase().replace(/[\s-]/g, "");

    const marques = [
        ["porsche", "Porsche"], ["ferrari", "Ferrari"], ["bmw", "BMW"],
        ["mercedes", "Mercedes"], ["audi", "Audi"], ["astonmartin", "Aston Martin"],
        ["mclaren", "McLaren"], ["lamborghini", "Lamborghini"], ["cadillac", "Cadillac"],
        ["acura", "Acura"], ["radical", "Radical"], ["ligier", "Ligier"],
        ["dallara", "Dallara"], ["lexus", "Lexus"], ["caterham", "Caterham"],
        ["ruf", "RUF"], ["ford", "Ford"], ["toyota", "Toyota"], ["honda", "Honda"]
    ];

    for (const [id, nom] of marques) {
        if (nomNettoye.includes(id)) return { id, nom };
    }

    if (nomBrut && nomBrut !== "---") {
        const premierMot = nomBrut.split(" ")[0];
        return {
            id: premierMot.toLowerCase().replace(/[^a-z0-9]/g, ""),
            nom: premierMot
        };
    }

    return { id: "", nom: "---" };
}

function obtenirHtmlDrapeau(pays) {
    const paysNettoye = String(pays || "").trim();
    if (!paysNettoye) return `<span class="gain-neutre">--</span>`;

    return `
        <img class="drapeau-pays" src="assets/flag/${encodeURIComponent(paysNettoye)}.png"
             alt="${echapperHtml(paysNettoye)}"
             onerror="this.style.display='none';">
    `;
}

function obtenirInfoLicence(chaineLicence) {
    const elements = String(chaineLicence || "R").trim().split(/\s+/);
    return {
        licence: (elements[0] || "R").charAt(0).toUpperCase(),
        sr: elements[1] || ""
    };
}

function obtenirHtmlGain(position, gain) {
    if (position >= 999) return `<span class="gain-neutre">-</span>`;
    const gainNumerique = Number(gain) || 0;
    if (gainNumerique > 0) return `<span class="gain-positif">▲${gainNumerique}</span>`;
    if (gainNumerique < 0) return `<span class="gain-negatif">▼${Math.abs(gainNumerique)}</span>`;
    return `<span class="gain-neutre">0</span>`;
}

function convertirChronoEnSecondes(tempsChrono) {
    if (!tempsChrono || tempsChrono.includes("-")) return Infinity;
    const parties = tempsChrono.split(":");
    if (parties.length === 2) {
        return parseFloat(parties[0]) * 60 + parseFloat(parties[1]);
    }
    return parseFloat(parties[0]) || Infinity;
}

/* --- Micro-Icônes SVG ultra-légères --- */

const ICO_FLAMME = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#00ff88"><path d="M12 23a7.5 7.5 0 0 1-7.5-7.5c0-4.14 4.09-8.78 6.55-11.23a1.4 1.4 0 0 1 2.22 0C15.73 6.72 19.5 11.36 19.5 15.5A7.5 7.5 0 0 1 12 23z"/></svg>`;
const ICO_WARNING = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#ffcc00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
const ICO_FLECHE = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#6c7a89"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>`;

const ICO_COURONNE = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#d946ef"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>`;
const ICO_CIBLE = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#00ff88"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v3h-2zm0 8h2v3h-2zm-5-4h3v2H6zm8 0h3v2h-3z"/></svg>`;
const ICO_HORLOGE = `<svg class="micro-icone" viewBox="0 0 24 24" fill="#ffffff"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;

/* --- Fonctions de génération des cellules avec Icône --- */

function obtenirHtmlInt(valeurInt) {
    if (!valeurInt || valeurInt === "---") return `<div class="cellule-avec-icone int-large">${ICO_FLECHE} <span>---</span></div>`;
    
    const valeurChiffre = parseFloat(String(valeurInt).replace("+", "").replace("s", ""));
    
    if (isNaN(valeurChiffre)) {
        return `<div class="cellule-avec-icone int-large">${ICO_FLECHE} <span>${echapperHtml(valeurInt)}</span></div>`;
    }
    
    if (valeurChiffre < 1.0) {
        return `<div class="cellule-avec-icone int-serre" title="Combat rapproché !">${ICO_FLAMME} <span>${echapperHtml(valeurInt)}</span></div>`;
    }
    
    if (valeurChiffre <= 3.0) {
        return `<div class="cellule-avec-icone int-moyen">${ICO_WARNING} <span>${echapperHtml(valeurInt)}</span></div>`;
    }
    
    return `<div class="cellule-avec-icone int-large">${ICO_FLECHE} <span>${echapperHtml(valeurInt)}</span></div>`;
}

function obtenirHtmlChrono(tempsChrono, meilleurChronoCategorie) {
    if (!tempsChrono || tempsChrono.includes("-")) {
        return `<div class="cellule-avec-icone chrono-normal"><span>--:--.---</span></div>`;
    }

    const sec = convertirChronoEnSecondes(tempsChrono);

    // Comparaison avec le meilleur temps propre à la catégorie du pilote
    if (sec !== Infinity && sec === meilleurChronoCategorie) {
        return `<div class="cellule-avec-icone chrono-violet" title="Meilleur tour de la catégorie !">${ICO_COURONNE} <span>${echapperHtml(tempsChrono)}</span></div>`;
    }

    if (sec !== Infinity) {
        return `<div class="cellule-avec-icone chrono-vert">${ICO_CIBLE} <span>${echapperHtml(tempsChrono)}</span></div>`;
    }

    return `<div class="cellule-avec-icone chrono-normal">${ICO_HORLOGE} <span>${echapperHtml(tempsChrono)}</span></div>`;
}

/* --- Affichage Classement --- */

function afficherClassement(donnees) {
    const conteneur = document.getElementById("leaderboard-dynamic-container") || 
                      document.getElementById("conteneur-dynamique-classement");

    if (!conteneur || !donnees || !Array.isArray(donnees.Leaderboard)) return;

    const classes = {};

    // 1. Regroupement par catégorie ET calcul du meilleur temps propre à chaque catégorie
    donnees.Leaderboard.forEach((pilote) => {
        const idClasse = pilote.CarClassID !== undefined && pilote.CarClassID !== null 
            ? pilote.CarClassID 
            : 0;

        if (!classes[idClasse]) {
            classes[idClasse] = {
                nom: pilote.CarClassShortName || "---",
                pilotes: [],
                meilleurChrono: Infinity // Initialisation du meilleur tour de cette catégorie
            };
        }

        classes[idClasse].pilotes.push(pilote);

        // Mise à jour du meilleur tour pour la catégorie concernée
        const secBest = convertirChronoEnSecondes(pilote.BestLapTime);
        if (secBest < classes[idClasse].meilleurChrono) {
            classes[idClasse].meilleurChrono = secBest;
        }
    });

    let html = `
        <div class="en-tete-globale">
            <div>POS</div>
            <div>N°</div>
            <div></div>
            <div>MARQUE</div>
            <div>NAT</div>
            <div class="col-nom">PILOTE / VOITURE</div>
            <div>AVATAR</div>
            <div>+/-</div>
            <div>iR</div>
            <div>LIC</div>
            <div>SR</div>
            <div>GAP</div>
            <div>INT</div>
            <div>LAST</div>
            <div>BEST</div>
        </div>
    `;

    Object.keys(classes).forEach((idClasse, idx) => {
        const categorie = classes[idClasse];
        const indiceCouleur = idx % 5;

        let pilotesAffiches = [];
        const indexJoueur = categorie.pilotes.findIndex((pilote) => pilote.IsPlayer);

        if (categorie.pilotes.length <= 7 || indexJoueur === -1) {
            pilotesAffiches = categorie.pilotes.slice(0, 7);
        } else {
            const top3 = categorie.pilotes.slice(0, 3);
            const debutAutour = Math.max(0, indexJoueur - 3);
            const finAutour = Math.min(categorie.pilotes.length, indexJoueur + 4);
            const autourJoueur = categorie.pilotes.slice(debutAutour, finAutour);
            pilotesAffiches = Array.from(new Set([...top3, ...autourJoueur]));
        }

        html += `
            <section class="capsule-classe">
                <header class="titre-categorie cat-theme-${indiceCouleur}">
                    ${echapperHtml(categorie.nom)}
                </header>

                <div class="grille-classement">
        `;

        pilotesAffiches.forEach((pilote) => {
            const idPilote = String(pilote.UserID || "");
            const nomIcone = (window.driverIcons && window.driverIcons[idPilote]?.icon)
                ? window.driverIcons[idPilote].icon
                : (pilote.DriverIcon || "");

            const marque = obtenirInfoMarque(pilote.CarName);
            const urlImageMarque = marque.id ? `assets/brands/${marque.id}.png?v=1.0` : "";
            const licence = obtenirInfoLicence(pilote.LicString);
            const position = Number(pilote.Position);
            const affichagePosition = position >= 999 ? "-" : echapperHtml(pilote.Position);
            const htmlGain = obtenirHtmlGain(position, pilote.Gain);
            const htmlDrapeau = obtenirHtmlDrapeau(pilote.Country);
            const estJoueur = Boolean(pilote.IsPlayer);

            // Génération des chronos en transmettant le meilleur temps de LA catégorie (categorie.meilleurChrono)
            const htmlInt = obtenirHtmlInt(pilote.GapInt);
            const htmlLast = obtenirHtmlChrono(pilote.LastLapTime, categorie.meilleurChrono);
            const htmlBest = obtenirHtmlChrono(pilote.BestLapTime, categorie.meilleurChrono);

            html += `
                <div class="ligne-classement ${estJoueur ? "est-joueur" : ""}">
                    <div class="col-position">${affichagePosition}</div>
                    <div class="col-numero">${echapperHtml(pilote.CarNumber ?? "---")}</div>
                    <div class="col-barre-categorie cat-barre-${indiceCouleur}"></div>

                    <div class="col-marque">
                        ${urlImageMarque ? `
                            <img src="${urlImageMarque}" alt="${echapperHtml(marque.nom)}" class="icone-marque" onerror="this.style.display='none';">
                        ` : ''}
                    </div>

                    <div class="conteneur-drapeau">${htmlDrapeau}</div>

                    <div class="col-nom">
                        <div class="empilement-nom">
                            <span class="nom-pilote">${estJoueur ? "👉 " : ""}${echapperHtml(pilote.UserName || "---")}</span>
                            <span class="nom-modele-voiture">${echapperHtml(pilote.CarName || "---")}</span>
                        </div>
                    </div>

                    <div class="cellule-icone-pilote">
                        ${nomIcone ? `
                            <img src="data/icons/${echapperHtml(nomIcone)}.png" class="icone-pilote" alt="" onerror="this.style.display='none';">
                        ` : ''}
                    </div>

                    <div class="col-gain">${htmlGain}</div>
                    <div class="col-irating"><span class="badge-irating">${echapperHtml(pilote.IR_Display || "---")}</span></div>
                    <div class="col-licence"><span class="badge-licence licence-${echapperHtml(licence.licence)}">${echapperHtml(licence.licence)}</span></div>
                    <div class="col-sr"><span class="badge-sr">${echapperHtml(licence.sr)}</span></div>
                    <div class="col-ecart ecart-general">${echapperHtml(pilote.Gap ?? "---")}</div>
                    
                    <!-- Colonnes dynamiques enrichies d'icônes SVG -->
                    <div class="col-ecart">${htmlInt}</div>
                    <div class="col-temps">${htmlLast}</div>
                    <div class="col-temps">${htmlBest}</div>
                </div>
            `;
        });

        html += `
                </div>
            </section>
        `;
    });

    conteneur.innerHTML = html;
}

/* --- Initialisation --- */

document.addEventListener("DOMContentLoaded", () => {
    connecterDashboard();
});
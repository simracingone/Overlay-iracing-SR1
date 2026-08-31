/* ==========================================================================
   GESTIONNAIRE DES PILOTES
   Version : 1.2
   Date : 20/08/2026

   Modifications :
   - Correction de la recherche pilote
   - Recherche compatible avec databaseSearch et searchDatabase
   - Ajout des classes de licence R/D/C/B/A
   - IR affiché avec IR_Display du SDK
   - SR extrait de LicString
   - Couleurs de licence compatibles avec le classement
   - Ajout des icônes Bootstrap directement dans les boutons
   - Suppression des pseudo-icônes nécessaires dans le CSS
   - Conservation du système de base JSON
   - Conservation du système ajout / modification / suppression
   - Conservation des chemins :
       data/icons/
       ../assets/flag/
       ../assets/brands/
   ========================================================================== */


/* ==========================================================================
   1. ÉTAT
   ========================================================================== */

let database={drivers:{}};
let sessionDrivers=[];
let selectedDriver=null;
let refreshTimer=null;

let editorState={
    id:null,
    newDriver:false,
    originalIcon:"default"
};


/* ==========================================================================
   2. API
   ========================================================================== */

const API="http://127.0.0.1:8000";


/* ==========================================================================
   3. ICÔNES PILOTES
   ========================================================================== */

const ICONS={
    default:{
        nom:"Défaut",
        fichier:"default.png"
    },
    alien:{
        nom:"Alien",
        fichier:"alien.png"
    },
    clean:{
        nom:"Propre",
        fichier:"clean.png"
    },
    crasher:{
        nom:"Crash",
        fichier:"crasher.png"
    },
    danger:{
        nom:"Dangereux",
        fichier:"danger.png"
    },
    defensive:{
        nom:"Défensif",
        fichier:"defensive.png"
    },
    ennemi:{
        nom:"Ennemi perso",
        fichier:"ennemi.png"
    },
    intelligent:{
        nom:"Intelligent",
        fichier:"intelligent.png"
    },
    respect:{
        nom:"Respect",
        fichier:"respect.png"
    },
    spinner:{
        nom:"Spinner",
        fichier:"spinner.png"
    },
    team:{
        nom:"Ma team",
        fichier:"team.png"
    },
    top10:{
        nom:"Top 10",
        fichier:"top10.png"
    },
    ami:{
        nom:"Ami",
        fichier:"ami.png"
    }
};


/* ==========================================================================
   4. MARQUES
   ========================================================================== */

const BRANDS=[
    ["porsche","Porsche"],
    ["ferrari","Ferrari"],
    ["bmw","BMW"],
    ["mercedes","Mercedes"],
    ["audi","Audi"],
    ["astonmartin","Aston Martin"],
    ["mclaren","McLaren"],
    ["lamborghini","Lamborghini"],
    ["cadillac","Cadillac"],
    ["acura","Acura"],
    ["radical","Radical"],
    ["ligier","Ligier"],
    ["dallara","Dallara"],
    ["lexus","Lexus"],
    ["caterham","Caterham"],
    ["ruf","RUF"],
    ["pontiac","Pontiac"],
    ["kia","Kia"],
    ["chevrolet","Chevrolet"],
    ["chevy","Chevrolet"],
    ["ford","Ford"],
    ["toyota","Toyota"],
    ["buick","Buick"],
    ["dodge","Dodge"],
    ["plymouth","Plymouth"],
    ["holden","Holden"],
    ["worldofoutlaws","World of Outlaws"],
    ["outlaw","World of Outlaws"],
    ["usac","USAC"],
    ["lucasoil","Lucas Oil"],
    ["dirt","Dirt"],
    ["legend","Legends"],
    ["subaru","Subaru"],
    ["volkswagen","Volkswagen"],
    ["vw","Volkswagen"],
    ["hyundai","Hyundai"],
    ["honda","Honda"],
    ["nissan","Nissan"],
    ["williams","Williams"],
    ["tatuus","Tatuus"],
    ["ray","Ray FF"],
    ["skipbarber","Skip Barber"]
];


/* ==========================================================================
   5. UTILITAIRES
   ========================================================================== */

const $=id=>document.getElementById(id);


const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
}[m]));


/* ==========================================================================
   6. RECHERCHE
   ========================================================================== */

function obtenirRecherche(){
    const champs=[
        $("databaseSearch"),
        $("searchDatabase")
    ];

    for(const champ of champs){
        if(champ){
            const valeur=String(champ.value||"").trim().toLowerCase();

            if(valeur){
                return valeur;
            }
        }
    }

    return "";
}


function connecterRecherche(champ){
    if(!champ)return;

    champ.addEventListener("input",()=>{
        afficherDrivers();
        afficherSessionDrivers();
    });
}


/* ==========================================================================
   7. ICÔNE PILOTE
   ========================================================================== */

const iconData=n=>ICONS[n]||ICONS.default;


function getDriverIcon(id){
    return iconData(
        database.drivers[id]?.icon||"default"
    );
}


/* ==========================================================================
   8. MARQUE AUTOMOBILE
   ========================================================================== */

function trouverMarque(carName){
    const raw=String(carName||"").trim();
    const clean=raw.toLowerCase().replace(/[\s-]/g,"");

    for(const [id,name] of BRANDS){
        if(clean.includes(id)){
            return{
                id,
                name
            };
        }
    }

    if(raw&&raw!=="---"){
        const first=raw.split(" ")[0];

        return{
            id:first.toLowerCase().replace(/[^a-z0-9]/g,""),
            name:first
        };
    }

    return{
        id:"",
        name:""
    };
}


/* ==========================================================================
   9. DONNÉES IRACING
   ========================================================================== */

function obtenirIR(p){
    return p.IR_Display||
        p.IRating_Display||
        p.iRating||
        p.IR||
        "---";
}


function obtenirLicence(p){
    const raw=String(
        p.LicString||
        p.license||
        ""
    ).trim();

    if(!raw){
        return "---";
    }

    const valeur=raw.split(/\s+/)[0]||"---";

    if(valeur==="---"){
        return "---";
    }

    return valeur.charAt(0).toUpperCase();
}


function obtenirClasseLicence(p){
    const licence=obtenirLicence(p);

    if(licence==="R"){
        return "lic-R";
    }

    if(licence==="D"){
        return "lic-D";
    }

    if(licence==="C"){
        return "lic-C";
    }

    if(licence==="B"){
        return "lic-B";
    }

    if(licence==="A"){
        return "lic-A";
    }

    return "";
}


function obtenirSR(p){
    const raw=String(
        p.LicString||
        p.license||
        ""
    ).trim();

    if(!raw){
        return "---";
    }

    const morceaux=raw.split(/\s+/);

    return morceaux[1]||"---";
}


function obtenirPays(p){
    return String(
        p.Country||
        p.country||
        ""
    ).trim();
}


/* ==========================================================================
   10. CHEMINS DES IMAGES
   ========================================================================== */

function cheminDrapeau(country){
    if(!country){
        return "../assets/flag/default.png";
    }

    return `../assets/flag/${encodeURIComponent(country)}.png`;
}


function cheminMarque(brandId){
    if(!brandId){
        return "../assets/brands/default.png";
    }

    return `../assets/brands/${encodeURIComponent(brandId)}.png`;
}


function cheminIcone(fichier){
    return `icons/${encodeURIComponent(fichier)}`;
}


/* ==========================================================================
   11. CHARGEMENT DE LA BASE
   ========================================================================== */

async function chargerDatabase(){
    try{

        if(window.overlayState?.drivers?.load){

            database=
                await window.overlayState.drivers.load();

        }else{

            const r=
                await fetch(
                    "drivers.json?v="+Date.now()
                );

            if(!r.ok){
                throw Error(
                    "drivers.json "+r.status
                );
            }

            database=
                await r.json();
        }

        database||={drivers:{}};
        database.drivers||={};

        afficherDrivers();
        afficherSessionDrivers();

    }catch(e){

        console.error(
            "[GESTIONNAIRE PILOTES] JSON :",
            e
        );

        database={
            drivers:{}
        };

        afficherDrivers();
    }
}


/* ==========================================================================
   12. SAUVEGARDE
   ========================================================================== */

async function sauvegarder(){

    try{

        if(window.overlayState?.drivers?.save){

            return await window.overlayState.drivers.save(
                database
            );
        }

        console.error(
            "[GESTIONNAIRE PILOTES] API de sauvegarde absente du preload"
        );

        return{
            success:false
        };

    }catch(e){

        console.error(
            "[GESTIONNAIRE PILOTES] SAUVEGARDE :",
            e
        );

        return{
            success:false
        };
    }
}


/* ==========================================================================
   13. AFFICHAGE BASE PILOTES
   ========================================================================== */

function afficherDrivers(){

    const list=$("driverList");

    if(!list)return;

    const search=obtenirRecherche();

    const filter=
        $("filter")?.value||
        "all";


    let drivers=
        Object.entries(
            database.drivers
        ).map(([userId,d])=>({
            userId,
            ...d
        }));


    drivers=
        drivers.filter(d=>{

            const known=
                !!d.icon&&
                d.icon!=="default";


            if(
                filter==="known"&&
                !known
            ){
                return false;
            }


            if(
                filter==="unknown"&&
                known
            ){
                return false;
            }


            const nom=
                String(d.name||"")
                .toLowerCase();

            const id=
                String(d.userId||"")
                .toLowerCase();


            return !search||
                nom.includes(search)||
                id.includes(search);
        });


    const total=
        Object.keys(
            database.drivers
        ).length;


    if($("totalDrivers")){
        $("totalDrivers").textContent=
            total;
    }


    if($("databaseCount")){
        $("databaseCount").textContent=
            total;
    }


    if(!drivers.length){

        list.innerHTML=
            '<div class="empty">AUCUN PILOTE TROUVÉ</div>';

        return;
    }


    list.innerHTML=
        drivers.map((d,i)=>{

            const ic=
                getDriverIcon(
                    d.userId
                );


            return `
            <div
                class="driver-row"
                data-id="${esc(d.userId)}"
            >

                <div class="position">
                    ${String(i+1).padStart(2,"0")}
                </div>


                <div class="driver">

                    <div class="driver-icon">

                        <img
                            src="${cheminIcone(ic.fichier)}"
                            alt="${esc(ic.nom)}"
                            onerror="this.src='icons/default.png'"
                        >

                    </div>


                    <div class="driver-info">

                        <div class="driver-name">
                            ${esc(d.name||"Pilote inconnu")}
                        </div>

                        <div class="driver-car">
                            ID iRACING // ${esc(d.userId)}
                        </div>

                    </div>

                </div>


                <div class="icon-cell">

                    <button
                        type="button"
                        class="session-add edit-driver"
                        data-id="${esc(d.userId)}"
                    >
                        <i class="bi bi-pencil-square"></i>
                        <span>MODIFIER</span>
                    </button>

                </div>

            </div>
            `;

        }).join("");


    list
        .querySelectorAll(".edit-driver")
        .forEach(button=>{

            button.onclick=()=>{
                ouvrirEdition(
                    button.dataset.id
                );
            };

        });
}


/* ==========================================================================
   14. CHARGEMENT SESSION SDK
   ========================================================================== */

async function chargerSession(){

    try{

        const r=
            await fetch(
                `${API}/data?t=${Date.now()}`
            );


        if(!r.ok){
            throw Error(
                "API "+r.status
            );
        }


        const data=
            await r.json();


        if(
            !Array.isArray(
                data.Leaderboard
            )
        ){

            sessionDrivers=[];

        }else{

            sessionDrivers=
                data.Leaderboard

                    .filter(
                        p=>p&&p.UserID!=null
                    )

                    .map(p=>({

                        ...p,

                        userId:
                            String(p.UserID),

                        name:
                            p.UserName||
                            "Pilote inconnu",

                        position:
                            Number.isFinite(
                                Number(p.Position)
                            )
                            ?Number(p.Position)
                            :999,

                        carNumber:
                            p.CarNumber||
                            "",

                        isPlayer:
                            p.IsPlayer===true

                    }))

                    .sort(
                        (a,b)=>
                            a.position-b.position
                    );
        }


        afficherSessionDrivers();

    }catch(e){

        console.error(
            "[GESTIONNAIRE PILOTES] SESSION :",
            e
        );
    }
}


/* ==========================================================================
   15. AFFICHAGE SESSION
   ========================================================================== */

function afficherSessionDrivers(){

    const list=
        $("sessionDriverList");

    if(!list)return;


    const search=
        obtenirRecherche();


    let drivers=
        sessionDrivers.filter(d=>{

            const nom=
                String(d.name||"")
                .toLowerCase();

            const id=
                String(d.userId||"")
                .toLowerCase();

            return !search||
                nom.includes(search)||
                id.includes(search);
        });


    if($("sessionCount")){
        $("sessionCount").textContent=
            sessionDrivers.length;
    }


    if($("sessionDrivers")){
        $("sessionDrivers").textContent=
            sessionDrivers.length;
    }


    if(!drivers.length){

        list.innerHTML=
            '<div class="empty">AUCUN PILOTE TROUVÉ</div>';

        return;
    }


    list.innerHTML=
        drivers.map(d=>{

            const saved=
                database.drivers[
                    d.userId
                ];


            const ic=
                getDriverIcon(
                    d.userId
                );


            const country=
                obtenirPays(d);


            const brand=
                trouverMarque(
                    d.CarName||
                    d.carName||
                    ""
                );


            const carName=
                d.CarName||
                d.carName||
                "---";


            const ir=
                obtenirIR(d);


            const licence=
                obtenirLicence(d);


            const licenceClass=
                obtenirClasseLicence(d);


            const sr=
                obtenirSR(d);


            const position=
                d.position<999
                ?String(d.position).padStart(2,"0")
                :"--";


            const brandSrc=
                cheminMarque(
                    brand.id
                );


            const flagSrc=
                cheminDrapeau(
                    country
                );


            return `
            <div
                class="session-driver-row ${saved?"known":"unknown"}"
                data-id="${esc(d.userId)}"
            >

                <div class="session-position">
                    ${position}
                </div>


                <img
                    class="session-flag"
                    src="${flagSrc}"
                    alt="${esc(country)}"
                    title="${esc(country)}"
                    onerror="
                        if(this.dataset.fallback!=='1'){
                            this.dataset.fallback='1';
                            this.src='../assets/flag/default.png';
                        }else{
                            this.style.visibility='hidden';
                        }
                    "
                >


                <div class="session-driver-main">

                    <div class="session-driver-name">
                        ${d.isPlayer?"👉 ":""}${esc(d.name)}
                    </div>

                </div>


                <img
                    class="car-brand"
                    src="${brandSrc}"
                    alt="${esc(brand.name)}"
                    title="${esc(brand.name)}"
                    onerror="
                        if(this.dataset.fallback!=='1'){
                            this.dataset.fallback='1';
                            this.src='../assets/brands/default.png';
                        }else{
                            this.style.visibility='hidden';
                        }
                    "
                >


                <div
                    class="session-car"
                    title="${esc(carName)}"
                >
                    ${esc(carName)}
                </div>


                <!-- IR -->

                <div class="stat stat-ir">
                    ${esc(ir)}
                </div>


                <!-- LICENCE -->

                <div
                    class="stat stat-lic ${licenceClass}"
                >
                    ${esc(licence)}
                </div>


                <!-- SR -->

                <div
                    class="stat stat-sr ${licenceClass}"
                >
                    ${esc(sr)}
                </div>


                <!-- ICÔNE PILOTE / AJOUTER -->

                <div class="driver-badge">

                    ${
                        saved

                        ?

                        `
                        <img
                            src="${cheminIcone(ic.fichier)}"
                            alt="${esc(ic.nom)}"
                            title="${esc(ic.nom)}"
                            onerror="this.src='icons/default.png'"
                        >
                        `

                        :

                        `
                        <button
                            type="button"
                            class="session-add add-session"
                            data-id="${esc(d.userId)}"
                        >
                            <i class="bi bi-person-plus-fill"></i>
                            <span>AJOUTER</span>
                        </button>
                        `
                    }

                </div>

            </div>
            `;

        }).join("");


    list
        .querySelectorAll(".add-session")
        .forEach(button=>{

            button.onclick=()=>{
                ajouterPilote(
                    button.dataset.id
                );
            };

        });
}


/* ==========================================================================
   16. AJOUTER UN PILOTE
   ========================================================================== */

function ajouterPilote(id){

    const d=
        sessionDrivers.find(
            x=>x.userId===String(id)
        );


    if(!d)return;


    if(database.drivers[id]){

        ouvrirEdition(id);

        return;
    }


    database.drivers[id]={
        name:d.name,
        icon:"default"
    };


    afficherDrivers();
    afficherSessionDrivers();


    ouvrirEdition(
        id,
        true
    );
}


/* ==========================================================================
   17. ÉDITION PILOTE
   ========================================================================== */

function ouvrirEdition(
    id,
    isNew=false
){

    const d=
        database.drivers[id];


    if(!d)return;


    selectedDriver=id;


    editorState={
        id,
        newDriver:isNew,
        originalIcon:
            d.icon||
            "default"
    };


    const editor=
        $("iconEditor");


    if(!editor)return;


    editor.innerHTML=`

        <div class="editor-title">
            ${isNew
                ?"AJOUTER UN PILOTE"
                :"MODIFIER LE PILOTE"
            }
        </div>


        <div class="editor-driver-name">
            ${esc(d.name)}
        </div>


        <div class="editor-userid">
            ID iRACING // ${esc(id)}
        </div>


        <div class="editor-section-title">
            CHOISIR UNE ICÔNE
        </div>


        <div class="icon-grid">

            ${
                Object.entries(ICONS)
                .map(([key,ic])=>`

                    <div
                        class="icon-choice ${
                            d.icon===key
                            ?"active"
                            :""
                        }"
                        data-icon="${esc(key)}"
                    >

                        <div class="icon-choice-image">

                            <img
                                src="${cheminIcone(ic.fichier)}"
                                alt="${esc(ic.nom)}"
                                onerror="this.src='icons/default.png'"
                            >

                        </div>


                        <div class="icon-choice-name">
                            ${esc(ic.nom)}
                        </div>

                    </div>

                `)
                .join("")
            }

        </div>


        <div class="editor-actions">

            ${
                isNew

                ?

                `
                <button
                    type="button"
                    class="cancel-button"
                    id="cancelDriver"
                >
                    <i class="bi bi-x-circle"></i>
                    <span>ANNULER</span>
                </button>


                <button
                    type="button"
                    class="save-button"
                    id="saveDriver"
                >
                    <i class="bi bi-check-circle-fill"></i>
                    <span>ENREGISTRER</span>
                </button>
                `

                :

                `
                <button
                    type="button"
                    class="delete-button"
                    id="deleteDriver"
                >
                    <i class="bi bi-trash3-fill"></i>
                    <span>SUPPRIMER</span>
                </button>


                <div class="editor-actions-right">

                    <button
                        type="button"
                        class="cancel-button"
                        id="cancelDriver"
                    >
                        <i class="bi bi-x-circle"></i>
                        <span>ANNULER</span>
                    </button>


                    <button
                        type="button"
                        class="save-button"
                        id="saveDriver"
                    >
                        <i class="bi bi-check-circle-fill"></i>
                        <span>ENREGISTRER</span>
                    </button>

                </div>
                `
            }

        </div>
    `;


    /* ----------------------------------------------------------------------
       SÉLECTION ICÔNE
       ---------------------------------------------------------------------- */

    editor
        .querySelectorAll(".icon-choice")
        .forEach(el=>{

            el.onclick=()=>{

                d.icon=
                    el.dataset.icon;


                editor
                    .querySelectorAll(".icon-choice")
                    .forEach(x=>
                        x.classList.remove(
                            "active"
                        )
                    );


                el.classList.add(
                    "active"
                );
            };

        });


    /* ----------------------------------------------------------------------
       ENREGISTRER
       ---------------------------------------------------------------------- */

    $("saveDriver").onclick=
        async()=>{

            const result=
                await sauvegarder();


            if(result?.success===false){
                return;
            }


            afficherDrivers();
            afficherSessionDrivers();


            editor.innerHTML="";


            editorState={
                id:null,
                newDriver:false,
                originalIcon:"default"
            };


            selectedDriver=null;
        };


    /* ----------------------------------------------------------------------
       ANNULER
       ---------------------------------------------------------------------- */

    $("cancelDriver").onclick=()=>{
        annulerEdition();
    };


    /* ----------------------------------------------------------------------
       SUPPRIMER
       ---------------------------------------------------------------------- */

    if($("deleteDriver")){

        $("deleteDriver").onclick=
            async()=>{

                if(
                    !confirm(
                        `Supprimer ${d.name} de la base ?`
                    )
                ){
                    return;
                }


                delete database.drivers[id];


                const result=
                    await sauvegarder();


                if(result?.success===false){

                    database.drivers[id]={
                        ...d
                    };

                    return;
                }


                afficherDrivers();
                afficherSessionDrivers();


                editor.innerHTML="";


                editorState={
                    id:null,
                    newDriver:false,
                    originalIcon:"default"
                };


                selectedDriver=null;
            };
    }


    editor.scrollIntoView({
        behavior:"smooth",
        block:"nearest"
    });
}


/* ==========================================================================
   18. ANNULER UNE ÉDITION
   ========================================================================== */

function annulerEdition(){

    const id=
        editorState.id;


    if(!id){

        $("iconEditor").innerHTML="";

        return;
    }


    /* ----------------------------------------------------------------------
       NOUVEAU PILOTE

       Si l'utilisateur annule avant d'enregistrer,
       le pilote est complètement retiré de la mémoire.
       ---------------------------------------------------------------------- */

    if(editorState.newDriver){

        delete database.drivers[id];


        afficherDrivers();
        afficherSessionDrivers();


        $("iconEditor").innerHTML="";


        editorState={
            id:null,
            newDriver:false,
            originalIcon:"default"
        };


        selectedDriver=null;

        return;
    }


    /* ----------------------------------------------------------------------
       PILOTE EXISTANT

       On restaure uniquement l'icône originale.
       ---------------------------------------------------------------------- */

    if(database.drivers[id]){

        database.drivers[id].icon=
            editorState.originalIcon;
    }


    afficherDrivers();
    afficherSessionDrivers();


    $("iconEditor").innerHTML="";


    editorState={
        id:null,
        newDriver:false,
        originalIcon:"default"
    };


    selectedDriver=null;
}


/* ==========================================================================
   19. SESSION
   ========================================================================== */

function demarrerSession(){

    chargerSession();


    clearInterval(
        refreshTimer
    );


    refreshTimer=
        setInterval(
            chargerSession,
            1000
        );
}


/* ==========================================================================
   20. AJOUT MANUEL
   ========================================================================== */

function ajouterPiloteManuellement(){

    const id=
        prompt(
            "ID iRacing du pilote :"
        );


    if(!id)return;


    const userId=
        String(id).trim();


    if(!userId)return;


    if(database.drivers[userId]){

        ouvrirEdition(
            userId
        );

        return;
    }


    const name=
        prompt(
            "Nom du pilote :"
        );


    if(!name)return;


    database.drivers[userId]={
        name:name.trim(),
        icon:"default"
    };


    afficherDrivers();
    afficherSessionDrivers();


    ouvrirEdition(
        userId,
        true
    );
}


/* ==========================================================================
   21. INITIALISATION
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        chargerDatabase();


        demarrerSession();


        /* Recherche principale */

        connecterRecherche(
            $("databaseSearch")
        );


        /* Ancien / second champ de recherche */

        if(
            $("searchDatabase")&&
            $("searchDatabase")!==$("databaseSearch")
        ){

            connecterRecherche(
                $("searchDatabase")
            );
        }


        /* Filtre */

        $("filter")?.addEventListener(
            "change",
            afficherDrivers
        );


        /* Bouton Ajouter */

        $("addDriverButton")?.addEventListener(
            "click",
            ajouterPiloteManuellement
        );

    }
);
/* ═══════════════════════════════════════════
   tarot.js — Tarot français (3 à 5 joueurs)
   Utilise BoardScore.create() de core.js

   ── Règles de comptage ──
   Les bouts (Excuse, Petit, 21 d'atout) déterminent le seuil :
     3 bouts → 36 pts  |  2 bouts → 41 pts
     1 bout  → 51 pts  |  0 bout  → 56 pts

   Valeur des cartes (compter par paires = tête + petite) :
     Bout / Roi   : 4,5 pts    Dame    : 3,5 pts
     Cavalier     : 2,5 pts    Valet   : 1,5 pts
     Petite carte : 0,5 pt     Total   : 91 pts

   Score de base  = (25 + |écart au seuil|) × multiplicateur
   Distribution   = chaque défenseur paie/reçoit ce montant
                    (en 5J avec allié : preneur compte double)

   Primes (par joueur) :
     Petit au bout : ±10 × contrat
     Poignée       : ±20 / ±30 / ±40 (simple / double / triple)
     Chelem        : ±200 ou ±400
   ═══════════════════════════════════════════ */

/* ── Constantes ── */
const CONTRATS = [
    { key: 'petite',      label: 'Petite',      mult: 1 },
    { key: 'garde',       label: 'Garde',       mult: 2 },
    { key: 'gardeSans',   label: 'Garde sans',  mult: 4 },
    { key: 'gardeContre', label: 'G. contre',   mult: 6 },
];

const THRESHOLDS = { 0: 56, 1: 51, 2: 41, 3: 36 };

const POIGNEES = [
    { key: 'simple', label: 'Simple',  pts: 20, note: '10 atouts' },
    { key: 'double', label: 'Double',  pts: 30, note: '13 atouts' },
    { key: 'triple', label: 'Triple',  pts: 40, note: '15 atouts' },
];

const CARD_VALUES = [
    { key: 'bouts',     label: 'Bouts (Excuse/Petit/21)', max: 3,  val: 4.5 },
    { key: 'rois',      label: 'Rois',                   max: 4,  val: 4.5 },
    { key: 'dames',     label: 'Dames',                  max: 4,  val: 3.5 },
    { key: 'cavaliers', label: 'Cavaliers',              max: 4,  val: 2.5 },
    { key: 'valets',    label: 'Valets',                 max: 4,  val: 1.5 },
    { key: 'petites',   label: 'Petites cartes',         max: 56, val: 0.5 },
];


/* ── État temporaire de la modale de score ── */
let tempPreneur     = null;
let tempAlly        = null;    // 5 joueurs uniquement
let tempSolo        = false;   // true = preneur joue seul (roi qu'il possède lui-même)
let tempRoiAppele   = null;    // 'coeur' | 'carreau' | 'trefle' | 'pique'
let tempContrat     = null;
let tempBouts       = null;
let tempPoints      = 0;
let tempPetitAuBout = null;    // null / 'preneur' / 'defense'
let tempPoignee     = null;    // null / 'simple' / 'double' / 'triple'
let tempChelem      = null;    // null / 'unannounced' / 'announced_success' / 'announced_fail'
let calcOpen        = false;
let calcCounts      = { bouts: 0, rois: 0, dames: 0, cavaliers: 0, valets: 0, petites: 0 };

/* ── État temporaire nouvelle partie ── */
let ngDealerIdx    = 0;
let ngRoundLimit    = null;
let ngIsCustomMode  = false;   // true si l'utilisateur a explicitement choisi "Perso"
let ngCustomRounds  = 15;


/* ═══════════════════════════════════════════
   INSTANCE DU JEU
   ═══════════════════════════════════════════ */
const game = BoardScore.create({
    key: 'tarot',
    emptyEmoji: '🃏',
    highestWins: true,

    defaultState: {
        players:    [],
        round:      1,
        history:    [],
        dealerIdx:  0,
        roundLimit: null,
        gameEnded:  false,
    },

    /* ── Badge : "Donne N/total" ── */
    buildBadgeText(state, scored) {
        const suffix = state.roundLimit ? '/' + state.roundLimit : '';
        return (scored ? '✅ ' : '⏳ ') + 'Donne ' + state.round + suffix;
    },

    /* ── Dealer : avance après chaque donne ── */
    onNextRound(state) {
        if (state.players.length > 0) {
            state.dealerIdx = (state.dealerIdx + 1) % state.players.length;
        }
    },

    /* ── Historique custom ── */
    buildHistoryItem(h) {
        const c = CONTRATS.find(x => x.key === h.contrat);
        const sign = h.success ? '✅' : '❌';
        const diff = h.points - THRESHOLDS[h.bouts];
        const diffStr = (diff >= 0 ? '+' : '') + diff;

        const header =
            '<div class="history-item-header">' +
            '<span class="history-round-num">Donne ' + h.round + '</span>' +
            '<span class="h-tag">' + sign + ' ' + (c ? c.label + ' ×' + c.mult : '') + '</span>' +
            '</div>' +
            '<div class="h-preneur-line">' +
            '<span>⚔️ ' + h.preneur +
            (h.roiAppele ? ' (🤴 roi ' + { coeur: '♥', carreau: '♦', trefle: '♣', pique: '♠' }[h.roiAppele] + ')' : '') +
            (h.solo ? ' — seul contre 4' : (h.ally ? ' + 🤝 ' + h.ally : '')) + '</span>' +
            '<span class="h-pts-detail">' + h.points + ' pts (' + diffStr + ')</span>' +
            '</div>';

        const scores =
            '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const cls  = pts > 0 ? 'bonus' : (pts < 0 ? 'penalty' : '');
                const pre  = pts > 0 ? '+' : '';
                return '<span class="h-score"><strong>' + name + '</strong>: ' +
                    '<span class="val ' + cls + '">' + pre + pts + '</span></span>';
            }).join('') +
            '</div>';

        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── Rendu spécifique : bandeau donneur + limite 5 joueurs ── */
    onRender(state) {
        renderDealerBar(state);
        // Griser le formulaire d'ajout si déjà 5 joueurs
        const addForm = document.querySelector('.add-player-form');
        if (addForm) {
            const full = state.players.length >= 5;
            addForm.style.opacity = full ? '0.35' : '1';
            const btn = addForm.querySelector('.btn-add');
            const inp = addForm.querySelector('input');
            if (btn) btn.disabled = full;
            if (inp) inp.disabled = full;
        }
    },

    /* ── Nouvelle partie ── */
    onOpenNewGameModal(state) {
        ngDealerIdx    = state.dealerIdx || 0;
        ngRoundLimit   = state.roundLimit;
        const presets   = [10, 20, 30, null];
        ngIsCustomMode  = ngRoundLimit !== undefined && !presets.includes(ngRoundLimit);
        ngCustomRounds  = ngIsCustomMode ? ngRoundLimit : 15;
        renderNgDealerList();
        renderNgRoundLimit();
    },
    onSelectPlayerMode(mode) {
        renderNgDealerList();
    },
    onToggleKeepPlayer() {
        ngDealerIdx = 0;
        renderNgDealerList();
    },
    onNgPlayersChanged() {
        ngDealerIdx = 0;
        renderNgDealerList();
    },
    onConfirmNewGame(state) {
        state.roundLimit = ngRoundLimit;
        state.dealerIdx  = ngDealerIdx;
        state.gameEnded  = false;
    },

    /* ── Fin de partie (limite de donnes ou bouton Terminer) ── */
    checkGameEnd(state) {
        if (state.gameEnded) return true;
        if (!state.roundLimit) return false;
        return state.round > state.roundLimit;
    },
});


/* ═══════════════════════════════════════════
   BANDEAU DONNEUR
   ═══════════════════════════════════════════ */
function renderDealerBar(state) {
    const bar  = BoardScore.$('dealerBar');
    const pill = BoardScore.$('dealerCurrentPill');
    const next = BoardScore.$('dealerNextName');
    if (!bar || !pill || !next) return;

    if (state.players.length < 3) { bar.style.display = 'none'; return; }

    const dealer     = state.players[state.dealerIdx % state.players.length];
    const nextIdx    = (state.dealerIdx + 1) % state.players.length;
    const nextDealer = state.players[nextIdx];

    bar.style.display  = 'flex';
    pill.textContent   = dealer.name;
    pill.style.background = dealer.color;
    next.textContent   = nextDealer.name;
    next.style.color   = nextDealer.color;
}


/* ═══════════════════════════════════════════
   SCORE MODAL — ouverture
   ═══════════════════════════════════════════ */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length < 3) {
        alert('Il faut au moins 3 joueurs pour jouer au Tarot !');
        return;
    }
    if (state.players.length > 5) {
        alert('Le Tarot se joue à 3, 4 ou 5 joueurs maximum !');
        return;
    }

    /* Pré-remplissage si la donne est déjà saisie */
    const existing = state.history.find(h => h.round === state.round);
    if (existing) {
        tempPreneur     = existing.preneur;
        tempAlly        = existing.ally        || null;
        tempSolo        = existing.solo        || false;
        tempRoiAppele   = existing.roiAppele   || null;
        tempContrat     = existing.contrat;
        tempBouts       = existing.bouts;
        tempPoints      = existing.points;
        tempPetitAuBout = existing.petitAuBout || null;
        tempPoignee     = existing.poignee     || null;
        tempChelem      = existing.chelem      || null;
    } else {
        tempPreneur = null;  tempAlly    = null;
        tempSolo    = false; tempRoiAppele = null;
        tempContrat = null;  tempBouts   = null;
        tempPoints  = 0;
        tempPetitAuBout = null;  tempPoignee = null;  tempChelem = null;
    }

    calcOpen  = false;
    calcCounts = { bouts: 0, rois: 0, dames: 0, cavaliers: 0, valets: 0, petites: 0 };

    renderScoreModal();
    BoardScore.$('scoreModal').classList.add('open');
}


/* ═══════════════════════════════════════════
   SCORE MODAL — rendu complet
   ═══════════════════════════════════════════ */
function renderScoreModal() {
    const state = game.getState();
    const n     = state.players.length;
    BoardScore.$('modalSub').textContent = 'Donne ' + state.round;

    let html = '';

    /* ── Bloc 1 : Preneur ── */
    html +=
        '<div class="modal-block">' +
        '<div class="block-label">⚔️ Qui est le preneur ?</div>' +
        '<div class="picker-list">' +
        state.players.map(p =>
            '<button class="picker-btn ' + (tempPreneur === p.name ? 'selected' : '') +
            '" onclick="selectPreneur(\'' + esc(p.name) + '\')">' +
            '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name +
            '</button>'
        ).join('') +
        '</div></div>';

    /* ── Bloc 2 : Allié / Appel de roi (5 joueurs seulement) ── */
    if (n === 5 && tempPreneur) {
        const ROIS = [
            { key: 'coeur',   label: '♥ Cœur' },
            { key: 'carreau', label: '♦ Carreau' },
            { key: 'trefle',  label: '♣ Trèfle' },
            { key: 'pique',   label: '♠ Pique' },
        ];
        html +=
            '<div class="modal-block">' +
            '<div class="block-label">🤴 Appel de roi (à 5 joueurs)</div>' +
            '<div class="roi-appel-row">' +
            ROIS.map(r =>
                '<button class="roi-btn ' + (tempRoiAppele === r.key ? 'active' : '') +
                '" onclick="selectRoi(\'' + r.key + '\')">' + r.label + '</button>'
            ).join('') +
            '</div>' +
            '<div class="solo-row">' +
            '<label class="solo-label">' +
            '<input type="checkbox" id="soloCheck" ' + (tempSolo ? 'checked' : '') +
            ' onchange="toggleSolo()">' +
            ' &nbsp;Je possède ce roi — je joue <strong>seul contre 4</strong>' +
            '</label>' +
            '</div>' +
            (!tempSolo
                    ? '<div class="block-label" style="margin-top:10px">🤝 Qui est l\'allié ?</div>' +
                    '<div class="picker-list">' +
                    state.players.filter(p => p.name !== tempPreneur).map(p =>
                        '<button class="picker-btn ' + (tempAlly === p.name ? 'selected' : '') +
                        '" onclick="selectAlly(\'' + esc(p.name) + '\')">' +
                        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name +
                        '</button>'
                    ).join('') +
                    '</div>'
                    : '<div class="solo-info">⚔️ Pas d\'allié — le preneur encaisse/gagne × 4</div>'
            ) +
            '</div>';
    }

    /* ── Bloc 3 : Contrat ── */
    html +=
        '<div class="modal-block">' +
        '<div class="block-label">📢 Contrat</div>' +
        '<div class="contrat-cards">' +
        CONTRATS.map(c =>
            '<button class="contrat-card ' + (tempContrat === c.key ? 'active' : '') +
            '" onclick="selectContrat(\'' + c.key + '\')">' +
            '<div class="cc-label">' + c.label + '</div>' +
            '<div class="cc-mult">×' + c.mult + '</div>' +
            '</button>'
        ).join('') +
        '</div></div>';

    /* ── Bloc 4 : Bouts + Points ── */
    const seuil   = tempBouts !== null ? THRESHOLDS[tempBouts] : null;
    const ecart   = seuil !== null ? tempPoints - seuil : null;
    const success = ecart !== null ? ecart >= 0 : null;

    html += '<div class="modal-block">';

    /* Sélecteur bouts */
    html +=
        '<div class="block-label">🃏 Bouts du preneur</div>' +
        '<div class="bout-picker">' +
        [0, 1, 2, 3].map(b =>
            '<button class="bout-btn ' + (tempBouts === b ? 'active' : '') +
            '" onclick="selectBouts(' + b + ')">' +
            '<div class="bb-num">' + b + '</div>' +
            '<div class="bb-seuil">≥ ' + THRESHOLDS[b] + '</div>' +
            '</button>'
        ).join('') +
        '</div>';

    /* Points réalisés */
    html +=
        '<div class="block-label" style="margin-top:14px">' +
        '🎯 Points réalisés' +
        (seuil !== null
            ? ' <span class="seuil-badge">seuil : ' + seuil + ' pts</span>'
            : '') +
        '</div>' +
        '<div class="points-input-row">' +
        '<div class="score-stepper" onclick="stepPoints(-1)">−</div>' +
        '<input type="number" id="pointsInput" value="' + tempPoints +
        '" min="0" max="91" oninput="onPointsInput()" />' +
        '<div class="score-stepper" onclick="stepPoints(1)">+</div>' +
        '<div class="calc-toggle ' + (calcOpen ? 'active' : '') +
        '" onclick="togglePointsCalc()" title="Compteur de cartes">🧮</div>' +
        '</div>';

    /* Résultat écart */
    if (ecart !== null) {
        const cls = success ? 'ecart-success' : 'ecart-fail';
        const pre = ecart >= 0 ? '+' : '';
        html +=
            '<div class="ecart-display ' + cls + '" id="ecartDisplay">' +
            (success ? '✅ Gagné' : '❌ Chute') +
            ' — écart : ' + pre + ecart + ' pts' +
            '</div>';
    } else {
        html += '<div class="ecart-display" id="ecartDisplay" style="display:none"></div>';
    }

    /* Calculatrice */
    if (calcOpen) html += buildCalcPanel();

    html += '</div>'; // end modal-block

    /* ── Bloc 5 : Primes ── */
    html +=
        '<div class="modal-block">' +
        '<div class="block-label">🌟 Primes</div>';

    /* Petit au bout */
    html +=
        '<div class="prime-row">' +
        '<span class="prime-label">🃏 Petit au bout</span>' +
        '<div class="prime-btns">' +
        mkPrimeBtn('setPetitAuBout(null)',        tempPetitAuBout === null,     '—')        +
        mkPrimeBtn('setPetitAuBout(\'preneur\')', tempPetitAuBout === 'preneur','⚔️ Preneur')+
        mkPrimeBtn('setPetitAuBout(\'defense\')', tempPetitAuBout === 'defense','🛡 Défense') +
        '</div></div>';

    /* Poignée */
    html +=
        '<div class="prime-row">' +
        '<span class="prime-label">✋ Poignée</span>' +
        '<div class="prime-btns">' +
        mkPrimeBtn('setPoignee(null)', tempPoignee === null, '—');
    POIGNEES.forEach(pg => {
        html += mkPrimeBtn(
            'setPoignee(\'' + pg.key + '\')',
            tempPoignee === pg.key,
            pg.label + ' +' + pg.pts,
            pg.note
        );
    });
    html += '</div></div>';

    /* Chelem */
    html +=
        '<div class="prime-row">' +
        '<span class="prime-label">👑 Chelem</span>' +
        '<div class="prime-btns">' +
        mkPrimeBtn('setChelem(null)',                  tempChelem === null,               '—')               +
        mkPrimeBtn('setChelem(\'unannounced\')',        tempChelem === 'unannounced',       'Réussi +200')     +
        mkPrimeBtn('setChelem(\'announced_success\')', tempChelem === 'announced_success', 'Annoncé ✅ +400') +
        mkPrimeBtn('setChelem(\'announced_fail\')',    tempChelem === 'announced_fail',    'Annoncé ❌ −200') +
        '</div></div>';

    html += '</div>'; // end primes block

    /* ── Bloc 6 : Aperçu résultat ── */
    const computed = computeScores();
    html += '<div class="score-preview" id="scorePreview">';
    if (computed) {
        html += '<div class="sp-title">Résultat de la donne</div>';
        html += state.players.map(p => {
            const pts = computed.scores[p.name] || 0;
            const cls = pts > 0 ? 'sp-gain' : (pts < 0 ? 'sp-loss' : 'sp-zero');
            const pre = pts > 0 ? '+' : '';
            const tag = p.name === tempPreneur
                ? ' <span class="sp-tag sp-atk">⚔️</span>'
                : (p.name === tempAlly ? ' <span class="sp-tag sp-ally">🤝</span>' : '');
            return '<div class="sp-row">' +
                '<span class="sp-dot" style="background:' + p.color + '"></span>' +
                '<span class="sp-name">' + p.name + tag + '</span>' +
                '<span class="sp-pts ' + cls + '">' + pre + pts + '</span>' +
                '</div>';
        }).join('');
    } else {
        html += '<div class="sp-placeholder">Remplis les champs pour voir le résultat</div>';
    }
    html += '</div>';

    BoardScore.$('scoreForm').innerHTML = html;
}

/* Helper pour les boutons primes */
function mkPrimeBtn(onclick, active, label, title) {
    return '<button class="prime-btn ' + (active ? 'active' : '') + '"' +
        (title ? ' title="' + title + '"' : '') +
        ' onclick="' + onclick + '">' + label + '</button>';
}

/* Escape apostrophes pour les onclick inline */
function esc(str) {
    return str.replace(/'/g, "\\'");
}


/* ═══════════════════════════════════════════
   CALCULATRICE DE CARTES
   ═══════════════════════════════════════════ */
function buildCalcPanel() {
    const totalExact = (
        calcCounts.bouts * 4.5 +
        calcCounts.rois  * 4.5 +
        calcCounts.dames * 3.5 +
        calcCounts.cavaliers * 2.5 +
        calcCounts.valets * 1.5 +
        calcCounts.petites * 0.5
    );
    const totalDisplay = totalExact % 1 === 0 ? totalExact : totalExact.toFixed(1);
    const total = Math.round(totalExact); // arrondi uniquement pour applyCalc

    let html = '<div class="calc-panel">';
    CARD_VALUES.forEach(cv => {
        const v = calcCounts[cv.key] || 0;
        html +=
            '<div class="calc-row">' +
            '<span class="calc-label">' + cv.label + '</span>' +
            '<div class="calc-counter">' +
            '<div class="calc-step" onclick="calcStep(\'' + cv.key + '\',-1,' + cv.max + ')">−</div>' +
            '<span class="calc-count" id="calc_' + cv.key + '">' + v + '</span>' +
            '<div class="calc-step" onclick="calcStep(\'' + cv.key + '\',1,' + cv.max + ')">+</div>' +
            '<span class="calc-pts">× ' + cv.val + '</span>' +
            '</div></div>';
    });

    html +=
        '<div class="calc-total">Total : <strong>' + totalDisplay + ' pts</strong></div>' +
        '<button class="calc-apply" onclick="applyCalc()">✅ Appliquer (' + totalDisplay + ' pts)</button>' +
        '</div>';

    return html;
}

function togglePointsCalc() {
    /* Snapshot avant fermeture/ouverture */
    const inp = BoardScore.$('pointsInput');
    if (inp) tempPoints = Math.max(0, Math.min(91, parseInt(inp.value) || 0));
    calcOpen = !calcOpen;
    renderScoreModal();
}

function calcStep(key, delta, max) {
    const cur = calcCounts[key] || 0;
    calcCounts[key] = Math.max(0, Math.min(max, cur + delta));

    /* Bouts : sync avec tempBouts */
    if (key === 'bouts') {
        tempBouts = calcCounts.bouts;
    }

    /* Mettre à jour les éléments du calc sans rerender complet */
    const el = BoardScore.$('calc_' + key);
    if (el) el.textContent = calcCounts[key];

    /* Recalc total */
    const calcExact = (
        calcCounts.bouts * 4.5 + calcCounts.rois * 4.5 +
        calcCounts.dames * 3.5 + calcCounts.cavaliers * 2.5 +
        calcCounts.valets * 1.5 + calcCounts.petites * 0.5
    );
    const calcDisplay = calcExact % 1 === 0 ? calcExact : calcExact.toFixed(1);

    /* Update total affiché */
    const totalEl = document.querySelector('.calc-total');
    if (totalEl) totalEl.innerHTML = 'Total : <strong>' + calcDisplay + ' pts</strong>';
    const applyEl = document.querySelector('.calc-apply');
    if (applyEl) applyEl.textContent = '✅ Appliquer (' + calcDisplay + ' pts)';

    /* Si bouts a changé : besoin de rerender pour mettre à jour bout-picker et seuil */
    if (key === 'bouts') {
        const inp = BoardScore.$('pointsInput');
        if (inp) tempPoints = parseInt(inp.value) || 0;
        renderScoreModal();
    } else {
        updateEcartAndPreview();
    }
}

function applyCalc() {
    const applyExact = (
        calcCounts.bouts * 4.5 + calcCounts.rois * 4.5 +
        calcCounts.dames * 3.5 + calcCounts.cavaliers * 2.5 +
        calcCounts.valets * 1.5 + calcCounts.petites * 0.5
    );
    tempPoints = applyExact; // conserver la valeur exacte avec éventuel .5
    tempBouts  = calcCounts.bouts;
    calcOpen   = false;
    renderScoreModal();
}


/* ═══════════════════════════════════════════
   SÉLECTEURS DE LA MODALE
   ═══════════════════════════════════════════ */
function selectPreneur(name) {
    tempPreneur = name;
    if (tempAlly === name) tempAlly = null;
    renderScoreModal();
}

function selectAlly(name) {
    tempAlly = name;
    renderScoreModal();
}

function selectRoi(key) {
    tempRoiAppele = tempRoiAppele === key ? null : key;
    renderScoreModal();
}

function toggleSolo() {
    tempSolo = !tempSolo;
    if (tempSolo) tempAlly = null;
    renderScoreModal();
}

function selectContrat(key) {
    tempContrat = key;
    renderScoreModal();
}

function selectBouts(n) {
    tempBouts = n;
    calcCounts.bouts = n;
    renderScoreModal();
}

function setPetitAuBout(val) {
    tempPetitAuBout = val;
    renderScoreModal();
}

function setPoignee(val) {
    tempPoignee = val;
    renderScoreModal();
}

function setChelem(val) {
    tempChelem = val;
    renderScoreModal();
}

function stepPoints(delta) {
    const inp = BoardScore.$('pointsInput');
    if (inp) tempPoints = parseInt(inp.value) || 0;
    tempPoints = Math.max(0, Math.min(91, tempPoints + delta));
    if (inp) inp.value = tempPoints;
    updateEcartAndPreview();
}

function onPointsInput() {
    const inp = BoardScore.$('pointsInput');
    if (inp) tempPoints = Math.max(0, Math.min(91, parseInt(inp.value) || 0));
    updateEcartAndPreview();
}

/* Mise à jour légère (sans rerender complet) */
function updateEcartAndPreview() {
    const seuil   = tempBouts !== null ? THRESHOLDS[tempBouts] : null;
    const ecart   = seuil !== null ? tempPoints - seuil : null;
    const success = ecart !== null ? ecart >= 0 : null;

    /* Ecart display */
    const el = BoardScore.$('ecartDisplay');
    if (el && ecart !== null) {
        el.style.display = '';
        el.className = 'ecart-display ' + (success ? 'ecart-success' : 'ecart-fail');
        el.textContent =
            (success ? '✅ Gagné' : '❌ Chute') +
            ' — écart : ' + (ecart >= 0 ? '+' : '') + ecart + ' pts';
    }

    /* Score preview */
    const prev = BoardScore.$('scorePreview');
    if (!prev) return;
    const computed = computeScores();
    if (!computed) { return; }

    const state = game.getState();
    let html = '<div class="sp-title">Résultat de la donne</div>';
    html += state.players.map(p => {
        const pts = computed.scores[p.name] || 0;
        const cls = pts > 0 ? 'sp-gain' : (pts < 0 ? 'sp-loss' : 'sp-zero');
        const pre = pts > 0 ? '+' : '';
        const tag = p.name === tempPreneur
            ? ' <span class="sp-tag sp-atk">⚔️</span>'
            : (p.name === tempAlly ? ' <span class="sp-tag sp-ally">🤝</span>' : '');
        return '<div class="sp-row">' +
            '<span class="sp-dot" style="background:' + p.color + '"></span>' +
            '<span class="sp-name">' + p.name + tag + '</span>' +
            '<span class="sp-pts ' + cls + '">' + pre + pts + '</span>' +
            '</div>';
    }).join('');
    prev.innerHTML = html;
}


/* ═══════════════════════════════════════════
   CALCUL DES SCORES
   ═══════════════════════════════════════════ */
function computeScores() {
    const state = game.getState();
    if (!tempPreneur || !tempContrat || tempBouts === null) return null;

    const contrat   = CONTRATS.find(c => c.key === tempContrat);
    const mult      = contrat.mult;
    const threshold = THRESHOLDS[tempBouts];
    const diff      = tempPoints - threshold;
    const success   = diff >= 0;

    /* Échange par joueur (montant que chaque défenseur donne/reçoit) */
    let exchange = (25 + Math.abs(diff)) * mult;
    if (!success) exchange = -exchange;

    /* Petit au bout : ±10 × multiplicateur par joueur */
    if (tempPetitAuBout === 'preneur') exchange += 10 * mult;
    else if (tempPetitAuBout === 'defense') exchange -= 10 * mult;

    /* Poignée : montant fixe, va au camp gagnant */
    const pg = POIGNEES.find(p => p.key === tempPoignee);
    if (pg) exchange += success ? pg.pts : -pg.pts;

    /* Chelem : ±200 / ±400 par joueur */
    if (tempChelem === 'announced_success') exchange += 400;
    else if (tempChelem === 'announced_fail') exchange -= 200;
    else if (tempChelem === 'unannounced' && success) exchange += 200;

    exchange = Math.round(exchange);

    /* Distribution */
    const n         = state.players.length;
    const isSolo5   = n === 5 && tempSolo;   // preneur possède son roi
    const isAlly    = n === 5 && !tempSolo && tempAlly !== null && tempAlly !== tempPreneur;
    const defenders = state.players.filter(p =>
        p.name !== tempPreneur && !(isAlly && p.name === tempAlly)
    );

    const scores = {};

    if (isAlly) {
        /* Preneur + allié : preneur × 2, allié × 1, défenseurs × −1 */
        scores[tempPreneur] = exchange * 2;
        scores[tempAlly]    = exchange;
    } else {
        /* Preneur seul (4J normal ou 5J solo) : reçoit/paie × nb défenseurs */
        scores[tempPreneur] = exchange * defenders.length;
    }
    defenders.forEach(p => { scores[p.name] = -exchange; });

    return { scores, exchange, success, threshold, diff, mult };
}


/* ═══════════════════════════════════════════
   CONFIRMATION DE LA DONNE
   ═══════════════════════════════════════════ */
function confirmScores() {
    /* Validation */
    const hint = BoardScore.$('scoreFormHint');
    function showHint(msg) {
        hint.textContent = msg;
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 2500);
    }

    if (!tempPreneur) return showHint('⚠️ Sélectionne le preneur !');
    if (!tempContrat) return showHint('⚠️ Sélectionne le contrat !');
    if (tempBouts === null) return showHint('⚠️ Sélectionne le nombre de bouts !');

    /* Sync input points */
    const inp = BoardScore.$('pointsInput');
    if (inp) tempPoints = Math.max(0, Math.min(91, parseInt(inp.value) || 0));

    const computed = computeScores();
    if (!computed) return;

    const state = game.getState();
    const existingIdx = state.history.findIndex(h => h.round === state.round);

    /* Mettre à jour les scores */
    state.players.forEach(p => {
        const newPts = computed.scores[p.name] || 0;
        if (existingIdx !== -1) {
            const oldPts = state.history[existingIdx].scores[p.name] || 0;
            p.score += (newPts - oldPts);
        } else {
            p.score += newPts;
        }
    });

    const entry = {
        round:      state.round,
        preneur:    tempPreneur,
        ally:       tempAlly,
        solo:       tempSolo,
        roiAppele:  tempRoiAppele,
        contrat:    tempContrat,
        bouts:      tempBouts,
        points:     tempPoints,
        success:    computed.success,
        petitAuBout: tempPetitAuBout,
        poignee:    tempPoignee,
        chelem:     tempChelem,
        scores:     computed.scores,
    };

    if (existingIdx !== -1) state.history[existingIdx] = entry;
    else state.history.push(entry);

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();
}



/* ═══════════════════════════════════════════
   NOUVELLE PARTIE — Sélecteur de premier donneur
   ═══════════════════════════════════════════ */
function renderNgDealerList() {
    const section = BoardScore.$('ng-dealer-section');
    if (!section) return;

    /* Récupérer la liste des joueurs selon le mode (garder ou nouveaux) */
    let players = [];
    const mode = game.getNgMode();
    if (mode === 'same') {
        const keepSet = game.getNgKeepSet();
        players = game.getState().players.filter((_, i) => keepSet.has(i));
    } else {
        const ngList = game.getNgNewPlayers();
        try {
            const roster = JSON.parse(localStorage.getItem('boardscore_players')) || [];
            players = ngList.map((name, i) => {
                const rp = roster.find(r => r.name.toLowerCase() === name.toLowerCase());
                return { name, color: rp ? rp.color : BoardScore.COLORS[i % BoardScore.COLORS.length] };
            });
        } catch(e) { players = ngList.map((name, i) => ({ name, color: BoardScore.COLORS[i % BoardScore.COLORS.length] })); }
    }

    if (players.length === 0) {
        section.innerHTML = '<div class="newgame-section-title">🃏 Premier donneur</div>' +
            '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0">Ajoute des joueurs d\'abord</div>';
        return;
    }

    // Griser le formulaire d'ajout si on a atteint 5 joueurs (mode "new")
    const addNewForm = document.querySelector('.add-newplayer-form');
    if (addNewForm) {
        const full = players.length >= 5;
        addNewForm.style.opacity = full ? '0.35' : '1';
        const addBtn = addNewForm.querySelector('.btn-add-sm');
        const addInp = addNewForm.querySelector('input');
        if (addBtn) addBtn.disabled = full;
        if (addInp) addInp.disabled = full;
        if (full && addInp) addInp.placeholder = '5 joueurs maximum';
    }

    if (ngDealerIdx >= players.length) ngDealerIdx = 0;

    section.innerHTML =
        '<div class="newgame-section-title">🃏 Premier donneur</div>' +
        '<div class="picker-list">' +
        players.map((p, i) =>
            '<button class="picker-btn ' + (ngDealerIdx === i ? 'selected' : '') +
            '" onclick="ngSelectDealer(' + i + ')">' +
            '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name +
            '</button>'
        ).join('') +
        '</div>';
}

function ngSelectDealer(i) {
    ngDealerIdx = i;
    renderNgDealerList();
}

/* ═══════════════════════════════════════════
   NOUVELLE PARTIE — Nombre de donnes
   ═══════════════════════════════════════════ */
function renderNgRoundLimit() {
    const section = BoardScore.$('ng-limit-section');
    if (!section) return;

    const modes = [
        { val: 10,       label: '10',   sub: 'Courte' },
        { val: 20,       label: '20',   sub: 'Standard' },
        { val: 30,       label: '30',   sub: 'Longue' },
        { val: null,     label: '∞',    sub: 'Sans limite' },
        { val: 'custom', label: 'Perso', sub: 'Nombre libre' },
    ];

    section.innerHTML =
        '<div class="newgame-section-title">🃏 Nombre de donnes</div>' +
        '<div class="limit-cards">' +
        modes.map(m => {
            let active;
            if (m.val === 'custom') {
                active = ngIsCustomMode;
            } else {
                active = !ngIsCustomMode && m.val === ngRoundLimit;
            }
            const onclickVal = m.val === 'custom' ? "'custom'"
                : m.val === null ? 'null' : m.val;
            return '<button class="limit-card ' + (active ? 'active' : '') +
                '" onclick="selectNgRoundMode(' + onclickVal + ')">' +
                '<div class="lc-label">' + m.label + '</div>' +
                '<div class="lc-sub">' + m.sub + '</div>' +
                '</button>';
        }).join('') +
        '</div>' +
        (ngIsCustomMode
            ? '<div class="custom-limit-wrap">' +
            '<input type="number" id="ngCustomRoundsInput" value="' + ngCustomRounds +
            '" min="5" step="1" oninput="onNgCustomRoundsInput()" />' +
            '<span class="custom-limit-unit">donnes (min. 5)</span></div>'
            : '');
}

function selectNgRoundMode(val) {
    if (val === 'custom') {
        ngIsCustomMode = true;
        ngRoundLimit   = ngCustomRounds >= 5 ? ngCustomRounds : 15;
    } else {
        ngIsCustomMode = false;
        ngRoundLimit   = val;   // null (∞) ou nombre
    }
    renderNgRoundLimit();
}

function onNgCustomRoundsInput() {
    const inp = BoardScore.$('ngCustomRoundsInput');
    const v = parseInt(inp?.value) || 0;
    // Clamp : minimum 5, on corrige le champ visuellement
    const clamped = Math.max(5, v);
    ngCustomRounds = clamped;
    ngRoundLimit   = clamped;
    // Si l'utilisateur a tapé < 5, corriger l'input directement
    if (v < 5 && inp) inp.value = clamped;
}


/* ═══════════════════════════════════════════
   TERMINER MANUELLEMENT
   ═══════════════════════════════════════════ */
window.endGame = () => {
    const state = game.getState();
    if (state.players.length === 0) { alert('Aucun joueur !'); return; }
    if (!state.history.length) { alert('Aucune donne enregistrée.'); return; }
    state.gameEnded = true;
    game.save();
    game.showWinner();
};


/* ── INIT ── */
/* ── Surcharges pour limiter à 5 joueurs dans la modale nouvelle partie ── */
const _coreNgAddPlayer     = window.ngAddPlayer;
const _coreNgAddFromRoster = window.ngAddFromRoster || (() => {});

window.ngAddPlayer = () => {
    if (game.getNgNewPlayers().length >= 5) {
        const inp = BoardScore.$('ngNewPlayerInput');
        if (inp) { inp.style.borderColor = 'var(--red)'; setTimeout(() => inp.style.borderColor = '', 800); }
        return;
    }
    _coreNgAddPlayer();
};

window.ngAddFromRoster = (name) => {
    if (game.getNgNewPlayers().length >= 5) return;
    game.ngAddFromRoster(name);
};

game.init();
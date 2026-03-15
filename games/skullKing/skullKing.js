/* ═══════════════════════════════════════════
   skullking.js — Skull King
   Utilise BoardScore.create() de core.js

   ── Règles de scoring ──
   Le jeu se joue en 10 manches. Manche N = N cartes distribuées.

   Mode Skull King (classique) :
     Mise = 0, réussie        : +10 × N cartes
     Mise = 0, ratée          : −10 × N cartes
     Mise ≥ 1, exacte         : +20 × mise + bonus
     Mise ≥ 1, pas exacte     : −10 × |écart|

   Mode Rascal :
     Potentiel = 10 × N cartes (identique pour tous)
     Coup direct (écart = 0) :   ×10 par carte + bonus
     Frappe à revers (écart = 1) : ×5 par carte + ½ bonus
     Échec cuisant (écart ≥ 2) : 0
     Option Boulet de canon :
       Exact → ×15 par carte + bonus  |  Raté → 0

   Points bonus (uniquement si mise réussie ou Chevrotine) :
     14 couleur (vert/jaune/violet)  : +10 par carte
     14 noir (Drapeau pirate)        : +20 par carte
     Sirène capturée par Pirate      : +20 par sirène
     Pirate capturé par Skull King   : +30 par pirate
     Skull King capturé par Sirène   : +40
   ═══════════════════════════════════════════ */

const TOTAL_ROUNDS = 10;

/* ── État temporaire de la modale de score ── */
// tempData[name] = { mise, result, bonus14c, bonus14n, bonusSiren, bonusPirate, bonusSK, boulet, bonusOpen }
let tempData = {};

/* ── État temporaire nouvelle partie ── */
let ngScoreMode = 'skullking'; // 'skullking' | 'rascal'


/* ═══════════════════════════════════════════
   INSTANCE
   ═══════════════════════════════════════════ */
const game = BoardScore.create({
    key:          'skullking',
    emptyEmoji:   '☠️',
    highestWins:  true,

    defaultState: {
        players:   [],
        round:     1,
        history:   [],
        scoreMode: 'skullking',
    },

    /* ── Badge : "Manche N/10" ── */
    buildBadgeText(state, scored) {
        return (scored ? '✅ ' : '⏳ ') + 'Manche ' + state.round + '/' + TOTAL_ROUNDS;
    },

    /* ── Historique ── */
    buildHistoryItem(h) {
        const header =
            '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + ' — ' + h.round + ' carte' + (h.round > 1 ? 's' : '') + '</span>' +
            '</div>';

        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, d]) => {
                const sign = d.pts >= 0 ? '+' : '';
                const cls  = d.pts > 0 ? 'bonus' : (d.pts < 0 ? 'penalty' : '');
                const correct = d.mise === d.result;
                const miseStr = d.mise + '/' + d.result;
                const tag = correct ? '✅' : '❌';
                return '<span class="h-score sk-hscore">' +
                    '<strong>' + name + '</strong>' +
                    '<span class="sk-mise-tag">' + tag + ' ' + miseStr + '</span>' +
                    '<span class="val ' + cls + '">' + sign + d.pts + '</span>' +
                    '</span>';
            }).join('') +
            '</div>';

        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── Nouvelle partie ── */
    onOpenNewGameModal() {
        ngScoreMode = game.getState().scoreMode || 'skullking';
        renderNgScoreMode();
    },
    onConfirmNewGame(state) {
        state.scoreMode = ngScoreMode;
    },

    /* ── Fin de partie : 10 manches jouées ── */
    checkGameEnd(state) {
        return state.round > TOTAL_ROUNDS;
    },
});


/* ═══════════════════════════════════════════
   CALCUL DES SCORES
   ═══════════════════════════════════════════ */
function computeBonus(d) {
    return d.bonus14c * 10 + d.bonus14n * 20 + d.bonusSiren * 20 + d.bonusPirate * 30 + (d.bonusSK ? 40 : 0);
}

function computePlayerScore(d, round, scoreMode) {
    const mise   = d.mise;
    const result = d.result;
    const ecart  = Math.abs(result - mise);
    const bonus  = computeBonus(d);

    if (scoreMode === 'skullking') {
        if (mise === 0) {
            return result === 0 ? 10 * round : -(10 * round);
        }
        if (ecart === 0) return 20 * mise + bonus;
        return -(10 * ecart);
    }

    /* Rascal */
    const isBoulet = d.boulet;
    if (ecart === 0) {
        const basePts = isBoulet ? 15 * round : 10 * round;
        return basePts + bonus;
    }
    if (ecart === 1 && !isBoulet) {
        return Math.floor(5 * round + bonus / 2);
    }
    return 0;
}


/* ═══════════════════════════════════════════
   SCORE MODAL
   ═══════════════════════════════════════════ */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length < 2) {
        alert('Il faut au moins 2 joueurs pour jouer à Skull King !');
        return;
    }

    /* Pré-remplissage si la manche est déjà saisie */
    const existing = state.history.find(h => h.round === state.round);
    state.players.forEach(p => {
        if (existing && existing.scores[p.name]) {
            const d = existing.scores[p.name];
            tempData[p.name] = { ...d, bonusOpen: false };
        } else {
            tempData[p.name] = { mise: 0, result: 0, bonus14c: 0, bonus14n: 0, bonusSiren: 0, bonusPirate: 0, bonusSK: false, boulet: false, bonusOpen: false };
        }
    });

    renderScoreModal();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderScoreModal() {
    const state    = game.getState();
    const round    = state.round;
    const mode     = state.scoreMode;
    const isRascal = mode === 'rascal';

    BoardScore.$('modalSub').textContent = 'Manche ' + round + ' — ' + round + ' carte' + (round > 1 ? 's' : '') + ' distribuée' + (round > 1 ? 's' : '');

    let html = '';

    state.players.forEach(p => {
        const d   = tempData[p.name];
        const pts = computePlayerScore(d, round, mode);
        const cls = pts > 0 ? 'sp-gain' : (pts < 0 ? 'sp-loss' : 'sp-zero');
        const pre = pts > 0 ? '+' : '';
        const ecart = Math.abs(d.result - d.mise);

        /* État de précision */
        let precisionTag = '';
        if (isRascal) {
            if (ecart === 0)       precisionTag = '<span class="sk-prec direct">Coup direct</span>';
            else if (ecart === 1)  precisionTag = d.boulet
                ? '<span class="sk-prec fail">Boulet raté</span>'
                : '<span class="sk-prec revers">Frappe à revers</span>';
            else                   precisionTag = '<span class="sk-prec fail">Échec cuisant</span>';
        } else {
            if (d.mise === 0)      precisionTag = d.result === 0 ? '<span class="sk-prec direct">✅ Réussi</span>' : '<span class="sk-prec fail">❌ Raté</span>';
            else                   precisionTag = ecart === 0 ? '<span class="sk-prec direct">✅ Exact</span>' : '<span class="sk-prec fail">❌ Écart ' + ecart + '</span>';
        }

        html +=
            '<div class="sk-player-row">' +
            /* En-tête joueur + score live */
            '<div class="sk-player-header">' +
            '<div class="sk-avatar" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="sk-player-info">' +
            '<div class="sk-player-name">' + p.name + '</div>' +
            '<div class="sk-player-total">Total : ' + p.score + '</div>' +
            '</div>' +
            '<div class="sk-live-score ' + cls + '">' + pre + pts + '</div>' +
            '</div>' +

            /* Mise + Résultat */
            '<div class="sk-inputs-row">' +
            /* Mise */
            '<div class="sk-input-group">' +
            '<div class="sk-input-label">Mise</div>' +
            '<div class="sk-stepper-wrap">' +
            '<div class="score-stepper" onclick="skStep(\'' + p.name + '\',\'mise\',-1,' + round + ')">−</div>' +
            '<input type="number" id="mise_' + p.name + '" value="' + d.mise + '" min="0" max="' + round + '" oninput="skInput(\'' + p.name + '\',\'mise\',this.value,' + round + ')" />' +
            '<div class="score-stepper" onclick="skStep(\'' + p.name + '\',\'mise\',1,' + round + ')">+</div>' +
            '</div>' +
            '</div>' +

            /* Résultat */
            '<div class="sk-input-group">' +
            '<div class="sk-input-label">Plis gagnés</div>' +
            '<div class="sk-stepper-wrap">' +
            '<div class="score-stepper" onclick="skStep(\'' + p.name + '\',\'result\',-1,' + round + ')">−</div>' +
            '<input type="number" id="result_' + p.name + '" value="' + d.result + '" min="0" max="' + round + '" oninput="skInput(\'' + p.name + '\',\'result\',this.value,' + round + ')" />' +
            '<div class="score-stepper" onclick="skStep(\'' + p.name + '\',\'result\',1,' + round + ')">+</div>' +
            '</div>' +
            '</div>' +
            '</div>' +

            /* Tag de précision + Rascal Boulet */
            '<div class="sk-precision-row">' +
            precisionTag +
            (isRascal
                ? '<div class="sk-boulet-toggle' + (d.boulet ? ' active' : '') + '" onclick="skToggleBoulet(\'' + p.name + '\')">' +
                '💣 Boulet de canon' +
                '</div>'
                : '') +
            '</div>' +

            /* Toggle bonus */
            '<div class="sk-bonus-toggle' + (d.bonusOpen ? ' open' : '') + '" onclick="skToggleBonus(\'' + p.name + '\')">' +
            '🌟 Points bonus' +
            (computeBonus(d) > 0 ? ' <span class="sk-bonus-badge">+' + computeBonus(d) + '</span>' : '') +
            '</div>' +

            /* Bonus section */
            (d.bonusOpen ? buildBonusSection(p.name, d) : '') +

            '</div>'; // sk-player-row
    });

    BoardScore.$('scoreForm').innerHTML = html;
}

function buildBonusSection(name, d) {
    const esc = name.replace(/'/g, "\\'");
    return '<div class="sk-bonus-section">' +

        /* 14 couleur */
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">14 vert/jaune/violet</span>' +
        '<span class="sk-bonus-pts">+10 / carte</span>' +
        '<div class="sk-bonus-counter">' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonus14c\',-1)">−</div>' +
        '<span id="b14c_' + name + '">' + d.bonus14c + '</span>' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonus14c\',1)">+</div>' +
        '</div></div>' +

        /* 14 noir */
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">14 noir (Drapeau pirate)</span>' +
        '<span class="sk-bonus-pts">+20 / carte</span>' +
        '<div class="sk-bonus-counter">' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonus14n\',-1)">−</div>' +
        '<span id="b14n_' + name + '">' + d.bonus14n + '</span>' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonus14n\',1)">+</div>' +
        '</div></div>' +

        /* Sirène capturée */
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">Sirène capturée (par Pirate)</span>' +
        '<span class="sk-bonus-pts">+20 / sirène</span>' +
        '<div class="sk-bonus-counter">' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonusSiren\',-1)">−</div>' +
        '<span id="bsiren_' + name + '">' + d.bonusSiren + '</span>' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonusSiren\',1)">+</div>' +
        '</div></div>' +

        /* Pirate capturé */
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">Pirate capturé (par Skull King)</span>' +
        '<span class="sk-bonus-pts">+30 / pirate</span>' +
        '<div class="sk-bonus-counter">' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonusPirate\',-1)">−</div>' +
        '<span id="bpirate_' + name + '">' + d.bonusPirate + '</span>' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'bonusPirate\',1)">+</div>' +
        '</div></div>' +

        /* Skull King capturé */
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">Skull King capturé (par Sirène)</span>' +
        '<span class="sk-bonus-pts">+40</span>' +
        '<div class="sk-bonus-check' + (d.bonusSK ? ' active' : '') + '" onclick="skToggleSK(\'' + esc + '\')">' +
        (d.bonusSK ? '✅' : '⬜') +
        '</div></div>' +

        '</div>'; // sk-bonus-section
}

/* ── Handlers ── */
function skStep(name, field, delta, max) {
    const d = tempData[name];
    d[field] = Math.max(0, Math.min(max, d[field] + delta));
    updatePlayerRow(name);
}

function skInput(name, field, val, max) {
    const d = tempData[name];
    d[field] = Math.max(0, Math.min(max, parseInt(val) || 0));
    updatePlayerRow(name);
}

function skToggleBoulet(name) {
    tempData[name].boulet = !tempData[name].boulet;
    updatePlayerRow(name);
}

function skToggleBonus(name) {
    tempData[name].bonusOpen = !tempData[name].bonusOpen;
    renderScoreModal();
}

function skBonus(name, field, delta) {
    const d = tempData[name];
    d[field] = Math.max(0, d[field] + delta);
    updatePlayerRow(name);
}

function skToggleSK(name) {
    tempData[name].bonusSK = !tempData[name].bonusSK;
    updatePlayerRow(name);
}

/* Mise à jour légère d'une ligne joueur (sans rerender complet) */
function updatePlayerRow(name) {
    const state = game.getState();
    const round = state.round;
    const mode  = state.scoreMode;
    const d     = tempData[name];
    const ecart = Math.abs(d.result - d.mise);
    const pts   = computePlayerScore(d, round, mode);
    const cls   = pts > 0 ? 'sp-gain' : (pts < 0 ? 'sp-loss' : 'sp-zero');
    const pre   = pts > 0 ? '+' : '';
    const isRascal = mode === 'rascal';

    /* Score live */
    const scoreEl = document.querySelector('[data-sk-score="' + name + '"]');

    /* Mise à jour des inputs si nécessaire */
    const miseInp   = BoardScore.$('mise_' + name);
    const resultInp = BoardScore.$('result_' + name);
    if (miseInp && parseInt(miseInp.value) !== d.mise) miseInp.value = d.mise;
    if (resultInp && parseInt(resultInp.value) !== d.result) resultInp.value = d.result;

    /* Rerender complet de la ligne pour mettre à jour tag précision, bonus badge, boulet */
    renderScoreModal();
}


/* ═══════════════════════════════════════════
   CONFIRMATION DE LA MANCHE
   ═══════════════════════════════════════════ */
function confirmScores() {
    const state = game.getState();
    const round = state.round;
    const mode  = state.scoreMode;

    const scores = {};
    state.players.forEach(p => {
        const d   = tempData[p.name];
        const pts = computePlayerScore(d, round, mode);
        scores[p.name] = { mise: d.mise, result: d.result, pts };
    });

    /* Mettre à jour les scores */
    const existingIdx = state.history.findIndex(h => h.round === round);

    state.players.forEach(p => {
        const newPts = scores[p.name].pts;
        if (existingIdx !== -1) {
            const oldPts = state.history[existingIdx].scores[p.name]?.pts || 0;
            p.score += (newPts - oldPts);
        } else {
            p.score += newPts;
        }
    });

    const entry = { round, scores };
    if (existingIdx !== -1) state.history[existingIdx] = entry;
    else state.history.push(entry);

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();
}


/* ═══════════════════════════════════════════
   NOUVELLE PARTIE — Mode de scoring
   ═══════════════════════════════════════════ */
function renderNgScoreMode() {
    const section = BoardScore.$('ng-limit-section');
    if (!section) return;

    section.innerHTML =
        '<div class="newgame-section-title">⚓ Mode de scoring</div>' +
        '<div class="choice-cards">' +
        '<div class="choice-card ' + (ngScoreMode === 'skullking' ? 'selected' : '') + '" onclick="selectNgMode(\'skullking\')">' +
        '<div class="cc-icon">☠️</div>' +
        '<div class="cc-title">Skull King</div>' +
        '<div class="cc-sub">Classique — risque/récompense élevé</div>' +
        '</div>' +
        '<div class="choice-card ' + (ngScoreMode === 'rascal' ? 'selected' : '') + '" onclick="selectNgMode(\'rascal\')">' +
        '<div class="cc-icon">🎯</div>' +
        '<div class="cc-title">Rascal</div>' +
        '<div class="cc-sub">Plus équilibré — potentiel identique pour tous</div>' +
        '</div>' +
        '</div>';
}

function selectNgMode(mode) {
    ngScoreMode = mode;
    renderNgScoreMode();
}


/* ── INIT ── */
game.init();
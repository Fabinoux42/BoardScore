/* ═══════════════════════════════════════════
   skullking.js — Skull King
   Utilise BoardScore.create() de core.js

   ── Règles de scoring ──
   Le jeu se joue en 10 manches. Manche N = N cartes.
   Avec 8 joueurs : rounds 9 et 10 = 8 cartes max (deck = 70 cartes).

   Mode Skull King (classique) :
     Mise = 0, réussie        : +10 × cardCount
     Mise = 0, ratée          : −10 × cardCount
     Mise ≥ 1, exacte         : +20 × mise + bonus
     Mise ≥ 1, pas exacte     : −10 × |écart|

   Mode Rascal :
     Potentiel = 10 × cardCount (identique pour tous)
     Coup direct (écart = 0) :   ×10 par carte + bonus
     Frappe à revers (écart = 1) : ×5 par carte + ½ bonus
     Échec cuisant (écart ≥ 2) : 0
     Option Boulet de canon :
       Exact → ×15 par carte + bonus  |  Raté → 0

   Points bonus (si mise exacte) :
     14 couleur (vert/jaune/violet)  : +10 par carte
     14 noir (Drapeau pirate)        : +20 par carte
     Sirène capturée par Pirate      : +20 par sirène
     Pirate capturé par Skull King   : +30 par pirate
     Skull King capturé par Sirène   : +40
     Alliance Butin réussie          : +20 par alliance

   Règles avancées optionnelles :
     Kraken  : un pli détruit — personne ne le remporte
     Baleine : les spéciales n'ont plus d'effet, la plus haute valeur gagne
     Butin   : alliance +20 si les deux joueurs ont misé juste

   2 joueurs : jeu normal, Barbe Grise joue en fantôme (pas de score)
   ═══════════════════════════════════════════ */

const TOTAL_ROUNDS = 10;
// Deck total : 56 couleurs + 5 pirates + 1 tigresse + 1 SK + 2 sirènes + 5 fuites = 70
const DECK_SIZE = 70;

/* ── Calcul du nombre de cartes réel pour un round et un nb de joueurs ── */
function getCardCount(round, nbPlayers) {
    if (nbPlayers <= 0) return round;
    // Avec 8 joueurs, rounds 9 et 10 seraient 72/80 cartes > 70 → cap à 8
    const maxByDeck = Math.floor(DECK_SIZE / nbPlayers);
    return Math.min(round, maxByDeck);
}

/* ── État temporaire de la modale de score ── */
// tempData[name] = { mise, result, bonus14c, bonus14n, bonusSiren, bonusPirate, bonusSK, bonusButin, boulet, bonusOpen }
let tempData = {};

/* ── État temporaire nouvelle partie ── */
let ngScoreMode    = 'skullking';
let ngAdvancedKraken = false;
let ngAdvancedBaleine = false;
let ngAdvancedButin    = false;
let ngAdvancedPirates  = false;


/* ═══════════════════════════════════════════
   INSTANCE
   ═══════════════════════════════════════════ */
const game = BoardScore.create({
    key:          'skullking',
    emptyEmoji:   '☠️',
    highestWins:  true,

    defaultState: {
        players:          [],
        round:            1,
        history:          [],
        scoreMode:        'skullking',
        advancedKraken:   false,
        advancedBaleine:  false,
        advancedButin:    false,
        advancedPirates:  false,
    },

    /* ── Badge : "Manche N/10 (X cartes)" ── */
    buildBadgeText(state, scored) {
        const cc = getCardCount(state.round, state.players.length);
        const cardInfo = cc !== state.round ? ' (' + cc + ' cartes)' : '';
        return (scored ? '✅ ' : '⏳ ') + 'Manche ' + state.round + '/' + TOTAL_ROUNDS + cardInfo;
    },

    /* ── Historique ── */
    buildHistoryItem(h) {
        const cc = h.cardCount || h.round;
        const header =
            '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + ' — ' + cc + ' carte' + (cc > 1 ? 's' : '') + '</span>' +
            '</div>';

        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, d]) => {
                const sign = d.pts >= 0 ? '+' : '';
                const cls  = d.pts > 0 ? 'bonus' : (d.pts < 0 ? 'penalty' : '');
                const correct = d.mise === d.result;
                const tag = correct ? '✅' : '❌';
                return '<span class="h-score sk-hscore">' +
                    '<strong>' + name + '</strong>' +
                    '<span class="sk-mise-tag">' + tag + ' ' + d.mise + '/' + d.result + '</span>' +
                    '<span class="val ' + cls + '">' + sign + d.pts + '</span>' +
                    '</span>';
            }).join('') +
            '</div>';

        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── Rendu : limiter ajout joueurs (2 mini, 8 maxi) + note 2J ── */
    onRender(state) {
        const n = state.players.length;
        const addForm = document.querySelector('.add-player-form');
        if (addForm) {
            const full = n >= 8;
            addForm.style.opacity = full ? '0.35' : '1';
            const btn = addForm.querySelector('.btn-add');
            const inp = addForm.querySelector('input');
            if (btn) btn.disabled = full;
            if (inp) {
                inp.disabled = full;
                if (full) inp.placeholder = '8 joueurs maximum';
            }
        }
        // Note Barbe Grise en mode 2 joueurs
        let noteEl = document.getElementById('sk-two-player-note');
        if (n === 2) {
            if (!noteEl) {
                noteEl = document.createElement('div');
                noteEl.id = 'sk-two-player-note';
                noteEl.className = 'sk-two-player-note';
                noteEl.innerHTML = '👻 Mode 2 joueurs actif — jouez avec <strong>Barbe Grise</strong> comme troisième joueur fantôme (il joue en 2ème position, ne mise pas et ne marque pas de points).';
                const playersList = document.getElementById('playersList');
                if (playersList) playersList.insertAdjacentElement('afterend', noteEl);
            }
        } else {
            if (noteEl) noteEl.remove();
        }
    },

    /* ── Nouvelle partie ── */
    onOpenNewGameModal(state) {
        ngScoreMode      = state.scoreMode      || 'skullking';
        ngAdvancedKraken  = state.advancedKraken  || false;
        ngAdvancedBaleine = state.advancedBaleine || false;
        ngAdvancedButin   = state.advancedButin   || false;
        ngAdvancedPirates = state.advancedPirates || false;
        renderNgScoreMode();
    },
    onSelectPlayerMode() { renderNgScoreMode(); },
    onToggleKeepPlayer()  { renderNgScoreMode(); },
    onNgPlayersChanged()  { renderNgScoreMode(); },
    onConfirmNewGame(state) {
        state.scoreMode       = ngScoreMode;
        state.advancedKraken  = ngAdvancedKraken;
        state.advancedBaleine = ngAdvancedBaleine;
        state.advancedButin   = ngAdvancedButin;
        state.advancedPirates = ngAdvancedPirates;
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
    return d.bonus14c * 10 + d.bonus14n * 20 + d.bonusSiren * 20
        + d.bonusPirate * 30 + (d.bonusSK ? 40 : 0) + (d.bonusButin || 0) * 20;
}

/* Rascal : pari indépendant du calcul principal (gagné si mise exacte, perdu sinon) */
function computeRascalBonus(d, ecart) {
    const bet = d.bonusRascal || 0;
    if (bet === 0) return 0;
    return ecart === 0 ? bet : -bet;
}

function computePlayerScore(d, cardCount, scoreMode) {
    const mise   = d.mise + (d.harryDelta || 0);  // Harry ajuste la mise effective
    const result = d.result;
    const ecart  = Math.abs(result - mise);
    const bonus  = computeBonus(d);
    const rascal = computeRascalBonus(d, ecart);

    if (scoreMode === 'skullking') {
        if (mise === 0) {
            return (result === 0 ? 10 * cardCount : -(10 * cardCount)) + rascal;
        }
        if (ecart === 0) return 20 * mise + bonus + rascal;
        return -(10 * ecart) + rascal;
    }

    /* Mode Rascal */
    const isBoulet = d.boulet;
    if (ecart === 0) {
        const basePts = isBoulet ? 15 * cardCount : 10 * cardCount;
        return basePts + bonus + rascal;
    }
    if (ecart === 1 && !isBoulet) {
        return Math.floor(5 * cardCount + bonus / 2) + rascal;
    }
    return rascal;  // Rascal peut encore gagner/perdre même en échec cuisant
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

    const cardCount = getCardCount(state.round, state.players.length);

    /* Pré-remplissage si la manche est déjà saisie */
    const existing = state.history.find(h => h.round === state.round);
    state.players.forEach(p => {
        if (existing && existing.scores[p.name]) {
            const _ex = existing.scores[p.name];
            tempData[p.name] = { ..._ex, bonusRascal: _ex.bonusRascal||0, harryDelta: _ex.harryDelta||0, bonusOpen: false };
        } else {
            tempData[p.name] = {
                mise: 0, result: 0,
                bonus14c: 0, bonus14n: 0, bonusSiren: 0, bonusPirate: 0,
                bonusSK: false, bonusButin: 0,
                bonusRascal: 0, harryDelta: 0,
                boulet: false, bonusOpen: false
            };
        }
    });

    renderScoreModal();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderScoreModal() {
    const state     = game.getState();
    const round     = state.round;
    const mode      = state.scoreMode;
    const isRascal  = mode === 'rascal';
    const cardCount = getCardCount(round, state.players.length);
    const hasButin  = state.advancedButin;
    const hasKraken = state.advancedKraken;
    const hasBaleine = state.advancedBaleine;

    // Sous-titre
    let subText = 'Manche ' + round + ' — ' + cardCount + ' carte' + (cardCount > 1 ? 's' : '') + ' distribuée' + (cardCount > 1 ? 's' : '');
    const activeRules = [];
    if (hasKraken)  activeRules.push('🦑 Kraken');
    if (hasBaleine) activeRules.push('🐋 Baleine blanche');
    if (activeRules.length) subText += ' · ' + activeRules.join(' · ');
    BoardScore.$('modalSub').textContent = subText;

    // Calcul du total résultats déjà saisis (pour contrainte)
    function otherResultsTotal(excludeName) {
        return state.players.reduce((s, p) => s + (p.name !== excludeName ? (tempData[p.name]?.result || 0) : 0), 0);
    }

    let html = '';

    state.players.forEach(p => {
        const d   = tempData[p.name];
        const pts = computePlayerScore(d, cardCount, mode);
        const cls = pts > 0 ? 'sp-gain' : (pts < 0 ? 'sp-loss' : 'sp-zero');
        const pre = pts > 0 ? '+' : '';
        const ecart = Math.abs(d.result - d.mise);

        // Max résultat pour ce joueur (contrainte globale)
        const maxResult = cardCount - otherResultsTotal(p.name);

        /* Tag de précision */
        let precisionTag = '';
        if (isRascal) {
            if (ecart === 0)       precisionTag = '<span class="sk-prec direct">Coup direct</span>';
            else if (ecart === 1)  precisionTag = d.boulet
                ? '<span class="sk-prec fail">Boulet raté</span>'
                : '<span class="sk-prec revers">Frappe à revers</span>';
            else                   precisionTag = '<span class="sk-prec fail">Échec cuisant</span>';
        } else {
            if (d.mise === 0) precisionTag = d.result === 0
                ? '<span class="sk-prec direct">✅ Réussi</span>'
                : '<span class="sk-prec fail">❌ Raté</span>';
            else precisionTag = ecart === 0
                ? '<span class="sk-prec direct">✅ Exact</span>'
                : '<span class="sk-prec fail">❌ Écart ' + ecart + '</span>';
        }

        const pName = p.name.replace(/'/g, "\\'");

        html +=
            '<div class="sk-player-row">' +
            '<div class="sk-player-header">' +
            '<div class="sk-avatar" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="sk-player-info">' +
            '<div class="sk-player-name">' + p.name + '</div>' +
            '<div class="sk-player-total">Total : ' + p.score + '</div>' +
            '</div>' +
            '<div class="sk-live-score ' + cls + '">' + pre + pts + '</div>' +
            '</div>' +

            '<div class="sk-inputs-row">' +
            /* Mise */
            '<div class="sk-input-group">' +
            '<div class="sk-input-label">Mise</div>' +
            '<div class="sk-stepper-wrap">' +
            '<div class="score-stepper" onclick="skStep(\'' + pName + '\',\'mise\',-1,' + cardCount + ',0)">−</div>' +
            '<input type="number" id="mise_' + p.name + '" value="' + d.mise + '" min="0" max="' + cardCount + '" oninput="skInput(\'' + pName + '\',\'mise\',this.value,' + cardCount + ',0)" />' +
            '<div class="score-stepper" onclick="skStep(\'' + pName + '\',\'mise\',1,' + cardCount + ',0)">+</div>' +
            '</div></div>' +
            /* Résultat */
            '<div class="sk-input-group">' +
            '<div class="sk-input-label">Plis gagnés</div>' +
            '<div class="sk-stepper-wrap">' +
            '<div class="score-stepper" onclick="skStep(\'' + pName + '\',\'result\',-1,' + maxResult + ',' + cardCount + ')">−</div>' +
            '<input type="number" id="result_' + p.name + '" value="' + d.result + '" min="0" max="' + maxResult + '" oninput="skInput(\'' + pName + '\',\'result\',this.value,' + maxResult + ',' + cardCount + ')" />' +
            '<div class="score-stepper" onclick="skStep(\'' + pName + '\',\'result\',1,' + maxResult + ',' + cardCount + ')">+</div>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="sk-precision-row">' +
            precisionTag +
            (isRascal
                ? '<div class="sk-boulet-toggle' + (d.boulet ? ' active' : '') + '" onclick="skToggleBoulet(\'' + pName + '\')">💣 Boulet de canon</div>'
                : '') +
            '</div>' +

            '<div class="sk-bonus-toggle' + (d.bonusOpen ? ' open' : '') + '" onclick="skToggleBonus(\'' + pName + '\')">' +
            '🌟 Points bonus' +
            (computeBonus(d) > 0 ? ' <span class="sk-bonus-badge">+' + computeBonus(d) + '</span>' : '') +
            '</div>' +
            (d.bonusOpen ? buildBonusSection(p.name, d, hasButin, state.advancedPirates) : '') +
            '</div>';
    });

    BoardScore.$('scoreForm').innerHTML = html;
}

function buildBonusSection(name, d, hasButin, hasPirates) {
    const esc = name.replace(/'/g, "\\'");
    let html = '<div class="sk-bonus-section">';

    html +=
        mkBonusCounter(esc, 'bonus14c',   '14 vert/jaune/violet',               '+10 / carte', d.bonus14c) +
        mkBonusCounter(esc, 'bonus14n',   '14 noir (Drapeau pirate)',            '+20',         d.bonus14n) +
        mkBonusCounter(esc, 'bonusSiren', 'Sirène capturée (par Pirate)',        '+20 / sirène', d.bonusSiren) +
        mkBonusCounter(esc, 'bonusPirate','Pirate capturé (par Skull King)',     '+30 / pirate', d.bonusPirate) +
        '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">Skull King capturé (par Sirène)</span>' +
        '<span class="sk-bonus-pts">+40</span>' +
        '<div class="sk-bonus-check' + (d.bonusSK ? ' active' : '') + '" onclick="skToggleSK(\'' + esc + '\')">' +
        (d.bonusSK ? '✅' : '⬜') + '</div></div>';

    if (hasButin) {
        html += mkBonusCounter(esc, 'bonusButin', 'Alliance Butin réussie (×2 joueurs)',  '+20 / alliance', d.bonusButin || 0);
    }

    if (hasPirates) {
        // ── Rascal le Flambeur : pari bonus ──
        const rBet = d.bonusRascal || 0;
        html += '<div class="sk-bonus-row sk-pirate-power">'+
            '<span class="sk-bonus-label">🎲 <strong>Rascal</strong> — Pari</span>'+
            '<div class="sk-rascal-btns">'+
            mkRascalBtn(esc, 0,  rBet)+
            mkRascalBtn(esc, 10, rBet)+
            mkRascalBtn(esc, 20, rBet)+
            '</div></div>';
        // ── Harry le Géant : ajustement mise ──
        const hDelta = d.harryDelta || 0;
        html += '<div class="sk-bonus-row sk-pirate-power">'+
            '<span class="sk-bonus-label">💪 <strong>Harry</strong> — Ajuster mise</span>'+
            '<div class="sk-harry-btns">'+
            mkHarryBtn(esc, -1, hDelta)+
            mkHarryBtn(esc,  0, hDelta)+
            mkHarryBtn(esc,  1, hDelta)+
            '</div></div>';
    }

    html += '</div>';
    return html;
}

function mkRascalBtn(esc, val, current) {
    const a = current === val;
    const lbl = val === 0 ? '—' : (val > 0 ? '+' + val : val);
    return '<button class="sk-rascal-btn' + (a ? ' active' : '') + '" onclick="skSetRascal(\'' + esc + '\',' + val + ')">' + lbl + '</button>';
}
function mkHarryBtn(esc, delta, current) {
    const a = current === delta;
    const lbl = delta === 0 ? '0' : (delta > 0 ? '+1' : '−1');
    return '<button class="sk-harry-btn' + (a ? ' active' : '') + '" onclick="skSetHarry(\'' + esc + '\',' + delta + ')">' + lbl + '</button>';
}
function mkBonusCounter(esc, field, label, pts, val) {
    return '<div class="sk-bonus-row">' +
        '<span class="sk-bonus-label">' + label + '</span>' +
        '<span class="sk-bonus-pts">' + pts + '</span>' +
        '<div class="sk-bonus-counter">' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'' + field + '\',-1)">−</div>' +
        '<span>' + val + '</span>' +
        '<div class="sk-bonus-step" onclick="skBonus(\'' + esc + '\',\'' + field + '\',1)">+</div>' +
        '</div></div>';
}

/* ── Handlers ── */
function skStep(name, field, delta, max, cardCount) {
    const d = tempData[name];
    const newVal = Math.max(0, Math.min(max, (d[field] || 0) + delta));
    d[field] = newVal;
    renderScoreModal();
}

function skInput(name, field, val, max, cardCount) {
    const d = tempData[name];
    d[field] = Math.max(0, Math.min(max, parseInt(val) || 0));
    renderScoreModal();
}

function skToggleBoulet(name) {
    tempData[name].boulet = !tempData[name].boulet;
    renderScoreModal();
}
function skToggleBonus(name) {
    tempData[name].bonusOpen = !tempData[name].bonusOpen;
    renderScoreModal();
}
function skBonus(name, field, delta) {
    const d = tempData[name];
    d[field] = Math.max(0, (d[field] || 0) + delta);
    renderScoreModal();
}
function skToggleSK(name) {
    tempData[name].bonusSK = !tempData[name].bonusSK;
    renderScoreModal();
}
function skSetRascal(name, val) {
    tempData[name].bonusRascal = (tempData[name].bonusRascal === val) ? 0 : val;
    renderScoreModal();
}
function skSetHarry(name, delta) {
    tempData[name].harryDelta = delta;
    renderScoreModal();
}


/* ═══════════════════════════════════════════
   CONFIRMATION DE LA MANCHE
   ═══════════════════════════════════════════ */
function confirmScores() {
    const state     = game.getState();
    const round     = state.round;
    const mode      = state.scoreMode;
    const cardCount = getCardCount(round, state.players.length);

    const scores = {};
    state.players.forEach(p => {
        const d   = tempData[p.name];
        const pts = computePlayerScore(d, cardCount, mode);
        scores[p.name] = { mise: d.mise, result: d.result, pts,
            bonus14c: d.bonus14c, bonus14n: d.bonus14n,
            bonusSiren: d.bonusSiren, bonusPirate: d.bonusPirate,
            bonusSK: d.bonusSK, bonusButin: d.bonusButin || 0,
            bonusRascal: d.bonusRascal || 0, harryDelta: d.harryDelta || 0, boulet: d.boulet };
    });

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

    const entry = { round, cardCount, scores };
    if (existingIdx !== -1) state.history[existingIdx] = entry;
    else state.history.push(entry);

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();
}


/* ═══════════════════════════════════════════
   NOUVELLE PARTIE — Config
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
        '</div>' +
        '<div class="newgame-section-title" style="margin-top:14px">🏴‍☠️ Règles avancées (optionnel)</div>' +
        '<div class="sk-advanced-rules">' +
        mkAdvancedToggle('butin',   '💰 Butin', 'Alliance +20 si les deux joueurs ont misé juste', ngAdvancedButin) +
        mkAdvancedToggle('pirates', '🏴‍☠️ Pouvoirs des pirates', 'Active Rascal (pari ±0/10/20) et Harry (ajuster mise ±1) dans la saisie', ngAdvancedPirates) +
        '</div>';
}

function mkAdvancedToggle(key, label, desc, active) {
    return '<div class="sk-adv-toggle' + (active ? ' active' : '') + '" onclick="toggleAdvanced(\'' + key + '\')">' +
        '<div class="sk-adv-info"><div class="sk-adv-label">' + label + '</div><div class="sk-adv-desc">' + desc + '</div></div>' +
        '<div class="sk-adv-check">' + (active ? '✅' : '⬜') + '</div>' +
        '</div>';
}

function selectNgMode(mode) {
    ngScoreMode = mode;
    renderNgScoreMode();
}

function toggleAdvanced(key) {
    if (key === 'kraken')  ngAdvancedKraken  = !ngAdvancedKraken;
    if (key === 'baleine') ngAdvancedBaleine = !ngAdvancedBaleine;
    if (key === 'butin')   ngAdvancedButin   = !ngAdvancedButin;
    if (key === 'pirates') ngAdvancedPirates = !ngAdvancedPirates;
    renderNgScoreMode();
}


/* ── Surcharge confirmNewGame : min 2, max 8 joueurs ── */
const _coreConfirmNewGame = window.confirmNewGame;
function skShowNgError(msg) {
    const el = BoardScore.$('ng-player-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}
window.confirmNewGame = () => {
    const mode = game.getNgMode();
    let count = 0;
    if (mode === 'same') {
        count = [...game.getNgKeepSet()].length;
    } else {
        count = game.getNgNewPlayers().length;
    }
    if (count < 2) {
        skShowNgError('⚠️ Il faut au moins 2 joueurs pour jouer à Skull King !');
        return;
    }
    if (count > 8) {
        skShowNgError('⚠️ Skull King se joue à 8 joueurs maximum !');
        return;
    }
    skShowNgError('');
    _coreConfirmNewGame();
};

/* ── Surcharges pour limiter à 8 joueurs dans la modale nouvelle partie ── */
const _coreNgAdd = window.ngAddPlayer;
const _coreNgAddRoster = window.ngAddFromRoster || ((n) => game.ngAddFromRoster(n));

window.ngAddPlayer = () => {
    if (game.getNgNewPlayers().length >= 8) {
        const inp = BoardScore.$('ngNewPlayerInput');
        if (inp) { inp.style.borderColor = 'var(--red)'; setTimeout(() => inp.style.borderColor = '', 800); }
        return;
    }
    _coreNgAdd();
};

window.ngAddFromRoster = (name) => {
    if (game.getNgNewPlayers().length >= 8) return;
    game.ngAddFromRoster(name);
};

/* ── INIT ── */
game.init();
/* ═══════════════════════════════════════════
   yams.js — Yam's (Yahtzee)
   Utilise BoardScore.create() de core.js
   ═══════════════════════════════════════════ */


/* ── CATÉGORIES ── */
const CATEGORIES = [
    // Section haute : sélecteur × combien de dés (1-5)
    { id: 'ones',   name: 'Un',      section: 'upper', face: 1, type: 'dice',   icon: '⚀' },
    { id: 'twos',   name: 'Deux',    section: 'upper', face: 2, type: 'dice',   icon: '⚁' },
    { id: 'threes', name: 'Trois',   section: 'upper', face: 3, type: 'dice',   icon: '⚂' },
    { id: 'fours',  name: 'Quatre',  section: 'upper', face: 4, type: 'dice',   icon: '⚃' },
    { id: 'fives',  name: 'Cinq',    section: 'upper', face: 5, type: 'dice',   icon: '⚄' },
    { id: 'sixes',  name: 'Six',     section: 'upper', face: 6, type: 'dice',   icon: '⚅' },
    // Section basse
    { id: 'threeK', name: 'Brelan',     section: 'lower', type: 'ofkind', mult: 3, icon: '3X' },
    { id: 'fourK',  name: 'Carré',      section: 'lower', type: 'ofkind', mult: 4, icon: '4X' },
    { id: 'full',   name: 'Full',       section: 'lower', type: 'check',  fixed: 25, icon: 'FH' },
    { id: 'smStr',  name: 'Pte suite',  section: 'lower', type: 'check',  fixed: 30, icon: 'S' },
    { id: 'lgStr',  name: 'Gde suite',  section: 'lower', type: 'check',  fixed: 40, icon: 'L' },
    { id: 'yams',   name: "Yam's",      section: 'lower', type: 'check',  fixed: 50, icon: '🎲' },
    { id: 'chance', name: 'Chance',      section: 'lower', type: 'chance', max: 30,   icon: 'CH' },
];

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;
const TOTAL_TURNS = 13;


/* ── STATE LOCAL ── */
let ngFirstIdx = 0;
let sacrificeMode = false;


/* ── HELPERS DE CALCUL ── */

function emptySheet() {
    const s = {};
    CATEGORIES.forEach(c => s[c.id] = null);
    s.yamsBonus = 0; // +100 par Yam's bonus
    return s;
}

function upperTotal(sheet) {
    return CATEGORIES
        .filter(c => c.section === 'upper')
        .reduce((sum, c) => sum + (sheet[c.id] || 0), 0);
}

function lowerTotal(sheet) {
    return CATEGORIES
        .filter(c => c.section === 'lower')
        .reduce((sum, c) => sum + (sheet[c.id] || 0), 0);
}

function bonus(sheet) {
    return upperTotal(sheet) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

function grandTotal(sheet) {
    return upperTotal(sheet) + bonus(sheet) + lowerTotal(sheet) + (sheet.yamsBonus || 0);
}

function filled(sheet) {
    return CATEGORIES.filter(c => sheet[c.id] !== null).length;
}

function gameOver(state) {
    return state.players.length > 0 &&
        state.players.every(p => filled(state.sheets[p.name] || {}) >= TOTAL_TURNS);
}

function curPlayer(state) {
    return state.players[state.currentPlayerIdx] || null;
}


/* ═══════════════════════════════════════════
   INSTANCE DU JEU (via core.js)
   ═══════════════════════════════════════════ */

const game = BoardScore.create({
    key: 'yams',
    emptyEmoji: '🎲',
    highestWins: true,

    defaultState: {
        players: [],
        round: 1,
        history: [],
        currentPlayerIdx: 0,
        sheets: {},
        turnPending: {},
    },

    onDeserialize(parsed) {
        if (!parsed.sheets) parsed.sheets = {};
        if (!parsed.turnPending) parsed.turnPending = {};
        return parsed;
    },

    /* ── Badge ── */
    buildBadgeText(state) {
        const total = state.players.length * TOTAL_TURNS;
        const done = state.players.reduce((s, p) => s + filled(state.sheets[p.name] || {}), 0);
        return '🎲 Tour ' + Math.min(done + 1, total) + ' / ' + total;
    },

    /* ── Player cards ── */
    getPlayerCardExtras(p, i, state) {
        const isCurrent = i === state.currentPlayerIdx && !gameOver(state);
        return {
            cardClass: isCurrent ? 'is-current' : '',
            afterName: isCurrent ? ' 🎲' : '',
        };
    },

    /* ── Rendu spécifique ── */
    onRender(state) {
        // Recalculer les scores
        state.players.forEach(p => {
            p.score = grandTotal(state.sheets[p.name] || {});
        });
        renderTurnBar(state);
        renderYamsHistory(state);
    },

    buildHistoryItem() { return ''; },

    /* ── New Game Modal ── */
    onOpenNewGameModal() { ngFirstIdx = 0; renderNgFirst(); },
    onSelectPlayerMode() { renderNgFirst(); },
    onToggleKeepPlayer() { ngFirstIdx = 0; renderNgFirst(); },
    onNgPlayersChanged() { ngFirstIdx = 0; renderNgFirst(); },

    onConfirmNewGame(state) {
        state.currentPlayerIdx = ngFirstIdx;
        state.sheets = {};
        state.turnPending = {};
        state.players.forEach(p => {
            state.sheets[p.name] = emptySheet();
        });
    },

    onRemovePlayer(state) {
        if (state.currentPlayerIdx >= state.players.length && state.players.length > 0) {
            state.currentPlayerIdx = 0;
        }
    },
});


/* ═══════════════════════════════════════════
   TURN BAR (bandeau "qui joue")
   ═══════════════════════════════════════════ */

function renderTurnBar(state) {
    const bar = BoardScore.$('turnBar');
    if (!bar) return;

    if (state.players.length === 0 || gameOver(state)) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    const current = curPlayer(state);
    const nextIdx = (state.currentPlayerIdx + 1) % state.players.length;

    BoardScore.$('turnCurrentPill').textContent = current ? current.name : '—';
    BoardScore.$('turnNextName').textContent = state.players[nextIdx] ? state.players[nextIdx].name : '—';
}


/* ═══════════════════════════════════════════
   SCORE MODAL — ouverture
   ═══════════════════════════════════════════ */

function openScoreModal() {
    const state = game.getState();

    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }
    if (gameOver(state)) { game.showWinner(); return; }

    // Init sheets si nécessaire
    state.players.forEach(p => {
        if (!state.sheets[p.name]) state.sheets[p.name] = emptySheet();
    });

    state.turnPending = {};
    sacrificeMode = false;

    const current = curPlayer(state);
    BoardScore.$('scoreModalTitle').textContent = '🎲 Tour de ' + current.name;
    BoardScore.$('modalSub').textContent = 'Choisis une catégorie et entre ton score';

    renderSheet();

    const errHint = BoardScore.$('turnErrorHint');
    if (errHint) errHint.style.display = 'none';

    BoardScore.$('scoreModal').classList.add('open');
}


/* ═══════════════════════════════════════════
   SCORE SHEET — rendu de la grille
   ═══════════════════════════════════════════ */

function renderSheet() {
    const state = game.getState();
    const current = curPlayer(state);
    const sheet = state.sheets[current.name];
    const pending = state.turnPending;

    const upperCats = CATEGORIES.filter(c => c.section === 'upper');
    const lowerCats = CATEGORIES.filter(c => c.section === 'lower');
    const uTot = upperTotal(sheet);

    // Sacrifice hint
    const hintEl = BoardScore.$('sacrificeHint');
    if (hintEl) hintEl.style.display = sacrificeMode ? 'block' : 'none';

    // Bouton sacrifice / annuler
    const btnSkip = BoardScore.$('btnSkip');
    if (btnSkip) {
        if (sacrificeMode) {
            btnSkip.textContent = '↩ Annuler';
            btnSkip.setAttribute('onclick', 'cancelSacrifice()');
        } else {
            btnSkip.textContent = '0️⃣ Sacrifier';
            btnSkip.setAttribute('onclick', 'enterSacrificeMode()');
        }
    }

    /* ── Rendu d'une ligne de catégorie ── */
    function row(cat) {
        const done = sheet[cat.id] !== null;
        const isPend = pending.catId === cat.id;
        const disabled = done && !isPend;

        // ── Mode sacrifice ──
        if (sacrificeMode) {
            if (done) {
                return '<div class="sh-row done">' +
                    '<span class="sh-icon">' + cat.icon + '</span>' +
                    '<span class="sh-name">' + cat.name + '</span>' +
                    '<div class="sh-inp-area"><span class="sh-done-val">' + sheet[cat.id] + '</span></div></div>';
            }
            const isSacrificePend = pending.catId === cat.id;
            return '<div class="sh-row sacrifice-pick ' + (isSacrificePend ? 'pend' : '') + '" onclick="selectSacrifice(\'' + cat.id + '\')">' +
                '<span class="sh-icon">' + cat.icon + '</span>' +
                '<span class="sh-name">' + cat.name + '</span>' +
                '<div class="sh-inp-area"><span class="sh-sacrifice-label">' + (isSacrificePend ? '✕ 0 pts' : '–') + '</span></div></div>';
        }

        // ── Déjà rempli : afficher la valeur ──
        if (disabled) {
            const val = sheet[cat.id];
            const valClass = val > 0 ? '' : 'zero';

            // Cas spécial : Yam's déjà scoré à 50 → bouton pour ouvrir la modale bonus
            if (cat.id === 'yams' && val === 50) {
                const yb = sheet.yamsBonus || 0;
                return '<div class="sh-row done yams-bonus-row">' +
                    '<span class="sh-icon">' + cat.icon + '</span>' +
                    '<span class="sh-name">' + cat.name + '</span>' +
                    '<div class="sh-inp-area">' +
                    '<span class="sh-done-val">50</span>' +
                    '<button class="sh-yams-bonus-btn" onclick="openYamsBonusModal()">🎲 Bonus' + (yb > 0 ? ' (+' + yb + ')' : ' ?') + '</button>' +
                    '</div></div>';
            }

            return '<div class="sh-row done">' +
                '<span class="sh-icon">' + cat.icon + '</span>' +
                '<span class="sh-name">' + cat.name + '</span>' +
                '<div class="sh-inp-area"><span class="sh-done-val ' + valClass + '">' + (val > 0 ? val : '0') + '</span></div></div>';
        }

        // ── Mode normal : inputs ──
        let inp = '';

        if (cat.type === 'dice') {
            // Section haute : sélecteur 1-5 occurrences
            inp = '<div class="sh-dice-sel">';
            for (let n = 1; n <= 5; n++) {
                const active = isPend && (pending.value === n * cat.face);
                inp += '<button class="sh-dice-btn ' + (active ? 'on' : '') + '" ' +
                    'onclick="selectDice(\'' + cat.id + '\',' + cat.face + ',' + n + ')">' + n + '</button>';
            }
            inp += '<span class="sh-dice-result">' + (isPend ? '= ' + pending.value : '') + '</span></div>';

        } else if (cat.type === 'ofkind') {
            // Brelan / Carré : sélecteur du dé 1-6
            inp = '<div class="sh-dice-sel">';
            for (let d = 1; d <= 6; d++) {
                const active = isPend && (pending.value === d * cat.mult);
                inp += '<button class="sh-dice-btn ' + (active ? 'on' : '') + '" ' +
                    'onclick="selectOfKind(\'' + cat.id + '\',' + cat.mult + ',' + d + ')">' + d + '</button>';
            }
            inp += '<span class="sh-dice-result">' + (isPend ? '= ' + pending.value : '') + '</span></div>';

        } else if (cat.type === 'check') {
            // Full, suites, Yam's : toggle check
            const on = isPend ? pending.value > 0 : (done && sheet[cat.id] > 0);
            inp = '<button class="sh-check ' + (on ? 'on' : '') + '" ' +
                'onclick="toggleCheck(\'' + cat.id + '\',' + cat.fixed + ')">' +
                (on ? '✓' : '') + '</button>' +
                '<span class="sh-fix">' + cat.fixed + '</span>';

        } else if (cat.type === 'chance') {
            // Chance : input libre + bouton détail 5 dés
            const v = isPend ? pending.value : (done ? sheet[cat.id] : '');
            inp = '<div class="sh-chance-wrap">' +
                '<input type="number" class="sh-inp" id="sh_chance" ' +
                'value="' + (v === '' || v === null ? '' : v) + '" ' +
                'min="0" max="30" placeholder="–" ' +
                'onfocus="shChanceFocus()" oninput="shChanceInput()" />' +
                '<button class="sh-chance-detail-btn" onclick="toggleChanceDetail()">🎲5</button>' +
                '</div>';

            // Détail des 5 dés
            if (isPend && pending.chanceDetail) {
                inp += '<div class="sh-chance-dice">';
                for (let d = 0; d < 5; d++) {
                    const dv = pending.chanceDice ? pending.chanceDice[d] || '' : '';
                    inp += '<input type="number" class="sh-chance-d" id="sh_cd_' + d + '" ' +
                        'value="' + dv + '" min="1" max="6" placeholder="?" ' +
                        'oninput="updateChanceDice()" />';
                }
                inp += '</div>';
            }
        }

        return '<div class="sh-row ' + (isPend ? 'pend' : '') + '">' +
            '<span class="sh-icon">' + cat.icon + '</span>' +
            '<span class="sh-name">' + cat.name + '</span>' +
            '<div class="sh-inp-area">' + inp + '</div></div>';
    }

    // Assembler le HTML
    let html = '<div class="sh-label">Section haute</div>';
    html += upperCats.map(row).join('');
    html += '<div class="sh-sub"><span>Sous-total</span><span>' + uTot + ' / 63</span></div>';
    html += '<div class="sh-sub ' + (uTot >= 63 ? 'earned' : '') + '"><span>Bonus</span><span>' + (uTot >= 63 ? '+35' : '–') + '</span></div>';
    html += '<div class="sh-label">Section basse</div>';
    html += lowerCats.map(row).join('');

    // Yam's bonus
    const yb = sheet.yamsBonus || 0;
    if (yb > 0) {
        html += '<div class="sh-sub earned"><span>🎲 Yam\'s bonus</span><span>+' + yb + '</span></div>';
    }

    html += '<div class="sh-grand"><span>Total</span><span>' + grandTotal(sheet) + '</span></div>';

    BoardScore.$('scoreSheet').innerHTML = html;
}


/* ═══════════════════════════════════════════
   SÉLECTEURS DE SCORE
   ═══════════════════════════════════════════ */

/* Dés 1-6 (section haute) */
function selectDice(catId, face, count) {
    game.getState().turnPending = { catId, value: face * count };
    renderSheet();
}

/* Brelan / Carré */
function selectOfKind(catId, mult, dieFace) {
    game.getState().turnPending = { catId, value: dieFace * mult };
    renderSheet();
}

/* Full, suites, Yam's */
function toggleCheck(id, fixed) {
    const p = game.getState().turnPending;
    if (p.catId === id && p.value > 0) {
        game.getState().turnPending = { catId: id, value: 0 };
    } else {
        game.getState().turnPending = { catId: id, value: fixed };
    }
    renderSheet();
}

/* Yam's bonus : sous-modale complète */
let ybDieFace = null;  // dé du Yam's bonus (1-6)
let ybCatId = null;    // catégorie choisie pour placer le score

function openYamsBonusModal() {
    ybDieFace = null;
    ybCatId = null;
    renderYbDicePick();
    BoardScore.$('ybStep2').style.display = 'none';
    const err = BoardScore.$('ybErrorHint');
    if (err) err.style.display = 'none';
    BoardScore.$('yamsBonusModal').classList.add('open');
}

function cancelYamsBonus() {
    BoardScore.$('yamsBonusModal').classList.remove('open');
}

function renderYbDicePick() {
    let html = '';
    for (let d = 1; d <= 6; d++) {
        const active = ybDieFace === d;
        html += '<button class="sh-dice-btn yb-die ' + (active ? 'on' : '') + '" onclick="selectYbDie(' + d + ')">' + d + '</button>';
    }
    BoardScore.$('ybDicePick').innerHTML = html;
}

function selectYbDie(die) {
    ybDieFace = die;
    ybCatId = null;
    renderYbDicePick();
    renderYbCatList();
    BoardScore.$('ybStep2').style.display = 'block';
}

function renderYbCatList() {
    const state = game.getState();
    const current = curPlayer(state);
    const sheet = state.sheets[current.name];

    const jokerCats = [];

    // Section haute correspondante
    const upperCat = CATEGORIES.find(c => c.type === 'dice' && c.face === ybDieFace);
    if (upperCat) {
        const val = ybDieFace * 5;
        jokerCats.push({ cat: upperCat, value: val, icon: upperCat.icon, name: upperCat.name, pts: val });
    }

    // Section basse (sauf Yam's)
    const lowerItems = [
        { id: 'threeK', icon: '3X', name: 'Brelan',    pts: ybDieFace * 5 },
        { id: 'fourK',  icon: '4X', name: 'Carré',     pts: ybDieFace * 5 },
        { id: 'full',   icon: 'FH', name: 'Full',      pts: 25 },
        { id: 'smStr',  icon: 'S',  name: 'Pte suite', pts: 30 },
        { id: 'lgStr',  icon: 'L',  name: 'Gde suite', pts: 40 },
        { id: 'chance', icon: 'CH', name: 'Chance',    pts: ybDieFace * 5 },
    ];
    lowerItems.forEach(li => {
        const cat = CATEGORIES.find(c => c.id === li.id);
        if (cat) jokerCats.push({ cat, value: li.pts, icon: li.icon, name: li.name, pts: li.pts });
    });

    // Vérifier s'il reste au moins une catégorie ouverte
    const hasOpen = jokerCats.some(jc => sheet[jc.cat.id] === null);

    let html = '';
    jokerCats.forEach(jc => {
        const done = sheet[jc.cat.id] !== null;
        const selected = ybCatId === jc.cat.id;
        const label = '<span class="yb-icon">' + jc.icon + '</span> ' + jc.name + ' → ' + jc.pts + ' pts';

        if (done) {
            html += '<div class="yb-cat-row done">' +
                '<span class="yb-cat-label">' + label + '</span>' +
                '<span class="sh-done-val">' + sheet[jc.cat.id] + '</span></div>';
        } else {
            html += '<div class="yb-cat-row ' + (selected ? 'selected' : '') + '" onclick="selectYbCat(\'' + jc.cat.id + '\',' + jc.value + ')">' +
                '<span class="yb-cat-label">' + label + '</span>' +
                (selected ? '<span class="yb-cat-check">✓</span>' : '') + '</div>';
        }
    });

    // Si tout est pris → option sacrifice (0 dans n'importe quelle catégorie encore ouverte globalement)
    if (!hasOpen) {
        html += '<div class="yb-sacrifice-notice">Toutes les catégories liées sont prises.</div>';
        // Trouver les catégories encore ouvertes (toutes sections confondues)
        const openCats = CATEGORIES.filter(c => c.id !== 'yams' && sheet[c.id] === null);
        if (openCats.length > 0) {
            html += '<div class="newgame-section-title" style="margin-top:12px">Sacrifier (0 pts)</div>';
            openCats.forEach(c => {
                const selected = ybCatId === c.id;
                html += '<div class="yb-cat-row sacrifice ' + (selected ? 'selected' : '') + '" onclick="selectYbCat(\'' + c.id + '\',0)">' +
                    '<span class="yb-cat-label"><span class="yb-icon">' + c.icon + '</span> ' + c.name + ' → 0 pts</span>' +
                    (selected ? '<span class="yb-cat-check">✓</span>' : '') + '</div>';
            });
        }
    }

    BoardScore.$('ybCatList').innerHTML = html;
}

function selectYbCat(catId, value) {
    ybCatId = catId;
    // Stocker aussi la valeur
    game.getState()._ybValue = value;
    renderYbCatList();
}

function confirmYamsBonus() {
    const state = game.getState();

    if (!ybDieFace) {
        const hint = BoardScore.$('ybErrorHint');
        if (hint) { hint.textContent = '⚠️ Choisis avec quel dé tu as fait ton Yam\'s !'; hint.style.display = 'block'; setTimeout(() => hint.style.display = 'none', 3000); }
        return;
    }
    if (!ybCatId) {
        const hint = BoardScore.$('ybErrorHint');
        if (hint) { hint.textContent = '⚠️ Choisis où placer ton score !'; hint.style.display = 'block'; setTimeout(() => hint.style.display = 'none', 3000); }
        return;
    }

    const current = curPlayer(state);
    const sheet = state.sheets[current.name];
    const value = state._ybValue || 0;

    // Écrire le score dans la catégorie choisie
    sheet[ybCatId] = value;
    // Ajouter le bonus +100
    sheet.yamsBonus = (sheet.yamsBonus || 0) + 100;
    // Recalculer
    current.score = grandTotal(sheet);

    // Historique — montrer le bonus et le placement séparément
    const cat = CATEGORIES.find(c => c.id === ybCatId);
    const catLabel = cat ? cat.icon + ' ' + cat.name : ybCatId;
    const isSacrifice = value === 0;
    state.history.push({
        round: state.history.length + 1,
        player: current.name,
        category: '🎲 Bonus Yam\'s',
        value: 100,
        detail: isSacrifice
            ? 'Sacrifié : ' + catLabel
            : catLabel + ' +' + value,
        scores: Object.fromEntries(
            state.players.map(pl => [pl.name, grandTotal(state.sheets[pl.name] || {})])
        ),
    });

    // Passer au joueur suivant
    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
    delete state._ybValue;

    // Fermer les modales
    BoardScore.$('yamsBonusModal').classList.remove('open');
    BoardScore.$('scoreModal').classList.remove('open');

    game.save();
    game.render();

    if (gameOver(state)) setTimeout(() => game.showWinner(), 400);
}

/* Chance — input libre */
function shChanceFocus() {
    const p = game.getState().turnPending;
    if (p.catId !== 'chance') {
        game.getState().turnPending = { catId: 'chance', value: 0 };
    }
}

function shChanceInput() {
    const inp = BoardScore.$('sh_chance');
    if (!inp) return;

    let v = parseInt(inp.value) || 0;
    if (v > 30) { v = 30; inp.value = v; }
    if (v < 0)  { v = 0;  inp.value = v; }

    const p = game.getState().turnPending;
    game.getState().turnPending = {
        catId: 'chance',
        value: v,
        chanceDetail: p.chanceDetail,
        chanceDice: p.chanceDice,
    };
}

/* Chance — détail 5 dés */
function toggleChanceDetail() {
    const p = game.getState().turnPending;
    if (p.catId !== 'chance') {
        game.getState().turnPending = { catId: 'chance', value: 0 };
    }
    const cur = game.getState().turnPending;
    cur.chanceDetail = !cur.chanceDetail;
    if (!cur.chanceDice) cur.chanceDice = [null, null, null, null, null];
    renderSheet();
}

function updateChanceDice() {
    const p = game.getState().turnPending;
    if (!p.chanceDice) p.chanceDice = [null, null, null, null, null];

    let total = 0;
    for (let d = 0; d < 5; d++) {
        const inp = BoardScore.$('sh_cd_' + d);
        let v = parseInt(inp ? inp.value : '') || 0;
        if (v > 6) { v = 6; if (inp) inp.value = v; }
        if (v < 0) { v = 0; if (inp) inp.value = v; }
        p.chanceDice[d] = v;
        total += v;
    }

    p.value = Math.min(30, total);
    const mainInp = BoardScore.$('sh_chance');
    if (mainInp) mainInp.value = p.value;
}


/* ═══════════════════════════════════════════
   MODE SACRIFICE
   ═══════════════════════════════════════════ */

function enterSacrificeMode() {
    sacrificeMode = true;
    game.getState().turnPending = {};
    renderSheet();
}

function cancelSacrifice() {
    sacrificeMode = false;
    game.getState().turnPending = {};
    renderSheet();
}

function selectSacrifice(catId) {
    game.getState().turnPending = { catId, value: 0 };
    renderSheet();
}


/* ═══════════════════════════════════════════
   ERREUR DANS LA MODALE
   ═══════════════════════════════════════════ */

function showTurnError(msg) {
    const hint = BoardScore.$('turnErrorHint');
    if (!hint) return;

    hint.textContent = msg;
    hint.style.display = 'block';

    // Petit shake des boutons
    const btns = document.querySelector('.modal-btns');
    if (btns) {
        btns.style.transform = 'scale(1.02)';
        setTimeout(() => btns.style.transform = '', 200);
    }

    clearTimeout(hint._timer);
    hint._timer = setTimeout(() => hint.style.display = 'none', 3000);
}


/* ═══════════════════════════════════════════
   VALIDATION DU TOUR
   ═══════════════════════════════════════════ */

function confirmTurn() {
    const state = game.getState();
    const p = state.turnPending;

    // Vérif : catégorie sélectionnée
    if (!p.catId) {
        showTurnError('⚠️ Entre un score ou utilise Sacrifier avant de valider !');
        return;
    }

    // Vérif : valeur entrée (sauf en mode sacrifice)
    if (!sacrificeMode && (p.value === undefined || p.value === null)) {
        showTurnError('⚠️ Entre un score ou utilise Sacrifier !');
        return;
    }

    // Écrire le score
    const current = curPlayer(state);
    const sheet = state.sheets[current.name];
    sheet[p.catId] = p.value || 0;

    current.score = grandTotal(sheet);

    // Historique
    const cat = CATEGORIES.find(x => x.id === p.catId);
    state.history.push({
        round: state.history.length + 1,
        player: current.name,
        category: cat ? cat.icon + ' ' + cat.name : p.catId,
        value: sheet[p.catId],
        scores: Object.fromEntries(
            state.players.map(pl => [pl.name, grandTotal(state.sheets[pl.name] || {})])
        ),
    });

    // Reset et passer au joueur suivant
    state.turnPending = {};
    sacrificeMode = false;
    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();

    // Fin de partie ?
    if (gameOver(state)) {
        setTimeout(() => game.showWinner(), 400);
    }
}


/* ═══════════════════════════════════════════
   HISTORIQUE
   ═══════════════════════════════════════════ */

function renderYamsHistory(state) {
    const section = BoardScore.$('historySection');
    const list = BoardScore.$('historyList');
    if (!section || !list) return;

    if (!state.history.length) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = [...state.history].reverse().slice(0, 20).map(h => {
        const detailHtml = h.detail
            ? '<div class="h-detail">' + h.detail + '</div>'
            : '';
        return '<div class="history-item">' +
            '<div class="history-item-header">' +
            '<span class="history-round-num">' + h.player + '</span>' +
            '<span class="h-tag yams-cat">' + h.category + '</span>' +
            '</div>' +
            '<div class="history-scores">' +
            '<span class="h-score"><span class="val ' + (h.value > 0 ? 'bonus' : 'penalty') + '">' +
            (h.value > 0 ? '+' + h.value : '0') +
            '</span></span>' +
            '</div>' +
            detailHtml +
            '</div>';
    }).join('');
}


/* ═══════════════════════════════════════════
   COMPARATIF DES SCORES
   ═══════════════════════════════════════════ */

function openCompareModal() {
    const state = game.getState();
    if (!state.players.length) return;

    const cols = state.players.length;
    let h = '<div class="cmp-grid" style="grid-template-columns:auto ' + '1fr '.repeat(cols) + '">';

    // Header joueurs
    h += '<div class="cmp-h"></div>';
    state.players.forEach(p => {
        h += '<div class="cmp-h">' +
            '<div class="cmp-av" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            p.name +
            '</div>';
    });

    // Section haute
    h += '<div class="cmp-sec" style="grid-column:1/-1">Section haute</div>';
    CATEGORIES.filter(c => c.section === 'upper').forEach(c => {
        h += '<div class="cmp-c">' + c.icon + ' ' + c.name + '</div>';
        state.players.forEach(p => {
            const v = (state.sheets[p.name] || {})[c.id];
            h += '<div class="cmp-v ' + (v === null ? 'empty' : '') + '">' + (v !== null ? v : '–') + '</div>';
        });
    });

    // Sous-total + bonus
    h += '<div class="cmp-c cmp-tot">Sous-total</div>';
    state.players.forEach(p => {
        h += '<div class="cmp-v cmp-tot">' + upperTotal(state.sheets[p.name] || {}) + '</div>';
    });
    h += '<div class="cmp-c cmp-tot">Bonus</div>';
    state.players.forEach(p => {
        const b = bonus(state.sheets[p.name] || {});
        h += '<div class="cmp-v cmp-tot ' + (b ? 'earned' : '') + '">' + (b ? '+35' : '–') + '</div>';
    });

    // Section basse
    h += '<div class="cmp-sec" style="grid-column:1/-1">Section basse</div>';
    CATEGORIES.filter(c => c.section === 'lower').forEach(c => {
        h += '<div class="cmp-c">' + c.icon + ' ' + c.name + '</div>';
        state.players.forEach(p => {
            const v = (state.sheets[p.name] || {})[c.id];
            h += '<div class="cmp-v ' + (v === null ? 'empty' : '') + '">' + (v !== null ? v : '–') + '</div>';
        });
    });

    // Yam's bonus
    h += '<div class="cmp-c cmp-tot">🎲 Yam\'s bonus</div>';
    state.players.forEach(p => {
        const yb = (state.sheets[p.name] || {}).yamsBonus || 0;
        h += '<div class="cmp-v cmp-tot ' + (yb > 0 ? 'earned' : '') + '">' + (yb > 0 ? '+' + yb : '–') + '</div>';
    });

    // Grand total
    h += '<div class="cmp-c cmp-grand">TOTAL</div>';
    state.players.forEach(p => {
        h += '<div class="cmp-v cmp-grand">' + grandTotal(state.sheets[p.name] || {}) + '</div>';
    });

    h += '</div>';

    BoardScore.$('compareContent').innerHTML = h;
    BoardScore.$('compareModal').classList.add('open');
}


/* ═══════════════════════════════════════════
   NEW GAME — sélecteur "qui commence"
   ═══════════════════════════════════════════ */

function renderNgFirst() {
    const state = game.getState();
    const sec = BoardScore.$('ng-first-section');
    const list = BoardScore.$('ngFirstPlayerList');
    if (!sec || !list) return;

    let players = [];
    if (game.getNgMode() === 'same') {
        const keepSet = game.getNgKeepSet();
        players = state.players.filter((_, i) => keepSet.has(i));
    } else {
        players = game.getNgNewPlayers().map((name, i) => ({
            name,
            color: BoardScore.COLORS[i % BoardScore.COLORS.length],
        }));
    }

    if (!players.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';

    list.innerHTML = players.map((p, i) =>
        '<button class="picker-btn ' + (ngFirstIdx === i ? 'selected' : '') + '" ' +
        'onclick="selectNgFirstPlayer(' + i + ')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name +
        '</button>'
    ).join('');
}

function selectNgFirstPlayer(i) {
    ngFirstIdx = i;
    renderNgFirst();
}


/* ═══════════════════════════════════════════
   FONCTIONS GLOBALES (onclick HTML)
   ═══════════════════════════════════════════ */

function nextRound()             { openScoreModal(); }
function openNewGameModal()      { game.openNewGameModal(); }
function closeNewGameModal()     { game.closeNewGameModal(); }
function selectPlayerMode(m)     { game.selectPlayerMode(m); }
function toggleKeepPlayer(i)     { game.toggleKeepPlayer(i); }
function ngAddPlayer()           { game.ngAddPlayer(); }
function ngRemovePlayer(i)       { game.ngRemovePlayer(i); }
function confirmNewGame()        { game.confirmNewGame(); }
function openNewGameFromWinner() { game.openNewGameFromWinner(); }
function closeBgModal(e, id)     { game.closeBgModal(e, id); }

function addPlayer() {
    game.addPlayer();
    const st = game.getState();
    st.players.forEach(p => {
        if (!st.sheets[p.name]) st.sheets[p.name] = emptySheet();
    });
    game.save();
    game.render();
}

function removePlayer(i) {
    game.removePlayer(i);
}


/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */

game.init();

// S'assurer que les sheets existent pour tous les joueurs
(function ensureSheets() {
    const st = game.getState();
    if (st.players.length > 0) {
        let needsSave = false;
        st.players.forEach(p => {
            if (!st.sheets[p.name]) {
                st.sheets[p.name] = emptySheet();
                needsSave = true;
            }
        });
        if (needsSave) {
            game.save();
            game.render();
        }
    }
})();
/* ═══════════════════════════════════════════
   uno.js — Uno
   Utilise BoardScore.create() de core.js

   Règles de scoring Uno :
   - Le gagnant de la manche marque 0
   - Les perdants comptent les cartes dans leur main :
     · Chiffres (0-9) : valeur faciale
     · +2 / Inverse / Passer : 20 pts
     · Joker / +4 : 50 pts
   - Premier joueur à atteindre la limite → fin de partie
   - Le gagnant est celui avec le MOINS de points
   ═══════════════════════════════════════════ */

const STEP = 5;

/* ── New game modal state (score limit) ── */
let ngScoreLimit = 500;
let ngCustomLimit = 200;

/* ── Card calculator state ── */
let calcOpenForIdx = null; // index du joueur dont la calculatrice est ouverte


const game = BoardScore.create({

    key: 'uno',
    emptyEmoji: '🎴',

    defaultState: {
        players: [],
        round: 1,
        history: [],
        scoreLimit: 500,
        tempScores: {},
        tempWinner: null
    },

    /* ── Player cards : danger à 70% de la limite ── */
    getPlayerCardExtras(p, i, state, { isLeader }) {
        const dangerThreshold = state.scoreLimit ? Math.floor(state.scoreLimit * 0.7) : null;
        const isDanger = dangerThreshold !== null && p.score >= dangerThreshold && !isLeader;
        const scoreClass = (dangerThreshold !== null && p.score >= dangerThreshold)
            ? 'danger-score'
            : (p.score === 0 ? 'zero-score' : '');
        return { isDanger, scoreClass };
    },

    /* ── Progress bar : gère scoreLimit null (infini) ── */
    renderProgress(state, { wrap, bar, lbl, maxScore }) {
        if (!state.scoreLimit) {
            bar.style.width = '0%';
            lbl.textContent = 'max sans limite (∞)';
            return;
        }
        const pct = Math.min(100, (maxScore / state.scoreLimit) * 100);
        bar.style.width = pct + '%';
        lbl.textContent = 'max ' + maxScore + ' / ' + state.scoreLimit;
    },

    /* ── History : gagnant en vert, gros scores en rouge ── */
    buildHistoryItem(h) {
        const header = '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + '</span></div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const isWinner = h.winner === name;
                const cls = isWinner ? 'bonus' : (pts >= 100 ? 'penalty' : '');
                const prefix = pts > 0 ? '+' : '';
                return '<span class="h-score"><strong>' + name + '</strong>: ' +
                    '<span class="val ' + cls + '">' + prefix + pts + '</span>' +
                    (isWinner ? ' 🏆' : '') + '</span>';
            }).join('') + '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── New Game Modal : score limit ── */
    onOpenNewGameModal(state) {
        ngScoreLimit = (state.scoreLimit !== undefined) ? state.scoreLimit : 500;
        ngCustomLimit = (ngScoreLimit && ngScoreLimit !== 500) ? ngScoreLimit : 200;
        renderNgScoreLimit();
    },

    onConfirmNewGame(state) {
        state.scoreLimit = ngScoreLimit;
    },

    /* ── Fin de partie : quelqu'un atteint scoreLimit ── */
    checkGameEnd(state) {
        if (!state.scoreLimit) return false;
        return state.players.some(p => p.score >= state.scoreLimit);
    }
});


/* ═══════════════════════════════════════════
   FONCTIONS SPÉCIFIQUES AU UNO
   ═══════════════════════════════════════════ */

/* ── Score Modal ── */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempWinner = existing ? existing.winner : null;
    state.tempScores = {};
    state.players.forEach(p => {
        state.tempScores[p.name] = existing ? (existing.scores[p.name] || 0) : 0;
    });

    calcOpenForIdx = null;
    BoardScore.$('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderWinnerPicker();
    renderScoreInputs();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderWinnerPicker() {
    const state = game.getState();
    const block = document.querySelector('.modal-block');
    if (block && !BoardScore.$('winnerRequiredHint')) {
        const hint = document.createElement('div');
        hint.id = 'winnerRequiredHint';
        hint.style.cssText = 'display:none;margin-top:8px;background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);border-radius:10px;padding:8px 12px;font-size:0.78rem;color:var(--red);text-align:center;';
        hint.textContent = '⚠️ Sélectionne qui a gagné la manche avant de confirmer !';
        block.appendChild(hint);
    }
    BoardScore.$('winnerRoundList').innerHTML = state.players.map(p =>
        '<button class="picker-btn ' + (state.tempWinner === p.name ? 'selected' : '') +
        '" onclick="selectWinner(\'' + p.name + '\')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
    ).join('');
}

function selectWinner(name) {
    game.getState().tempWinner = name;
    calcOpenForIdx = null;
    renderWinnerPicker();
    renderScoreInputs();
}

/* ── Sauvegarder les valeurs courantes des inputs avant re-render ── */
function snapshotInputValues() {
    const state = game.getState();
    state.players.forEach((p, i) => {
        const inp = BoardScore.$('inp_' + i);
        if (inp) state.tempScores[p.name] = parseInt(inp.value) || 0;
    });
}

function renderScoreInputs() {
    const state = game.getState();
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const isWinner = state.tempWinner === p.name;
        const val = isWinner ? 0 : (state.tempScores[p.name] || 0);

        const calcOpen = calcOpenForIdx === i && !isWinner;

        return '<div class="score-row ' + (isWinner ? 'is-winner locked' : '') + '" id="srow_' + i + '">' +
            (isWinner ? '<div class="row-tag winner-tag">🏆 UNO !</div>' : '') +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div>' +
            '<div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + (-STEP) + ')">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" min="0" ' +
            'oninput="game.getState().tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + STEP + ')">+</div>' +
            '</div>' +
            (!isWinner ? '<div class="calc-toggle ' + (calcOpen ? 'active' : '') + '" onclick="toggleCalc(' + i + ')" title="Calculatrice de cartes">🧮</div>' : '') +
            (calcOpen ? buildCalcPanel(i) : '') +
            '</div>';
    }).join('');
}

/* ═══════════════════════════════════════════
   CALCULATRICE DE CARTES
   ═══════════════════════════════════════════ */

function toggleCalc(idx) {
    snapshotInputValues();
    calcOpenForIdx = calcOpenForIdx === idx ? null : idx;
    renderScoreInputs();
}

function buildCalcPanel(idx) {
    return '<div class="calc-panel">' +
        '<div class="calc-row">' +
        '<span class="calc-label">Chiffres (0–9)</span>' +
        '<div class="calc-input-wrap">' +
        '<input type="number" class="calc-inp" id="calc_digits_' + idx + '" value="0" min="0" placeholder="total" oninput="computeCalc(' + idx + ')" />' +
        '<span class="calc-unit">pts</span>' +
        '</div>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-label">+2 / Inverse / Passer</span>' +
        '<div class="calc-counter">' +
        '<div class="calc-step" onclick="calcStep(' + idx + ',\'specials\',-1)">−</div>' +
        '<span class="calc-count" id="calc_specials_' + idx + '">0</span>' +
        '<div class="calc-step" onclick="calcStep(' + idx + ',\'specials\',1)">+</div>' +
        '<span class="calc-pts">× 20</span>' +
        '</div>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-label">Joker / +4</span>' +
        '<div class="calc-counter">' +
        '<div class="calc-step" onclick="calcStep(' + idx + ',\'wilds\',-1)">−</div>' +
        '<span class="calc-count" id="calc_wilds_' + idx + '">0</span>' +
        '<div class="calc-step" onclick="calcStep(' + idx + ',\'wilds\',1)">+</div>' +
        '<span class="calc-pts">× 50</span>' +
        '</div>' +
        '</div>' +
        '<button class="calc-apply" onclick="applyCalc(' + idx + ')">✅ Appliquer</button>' +
        '</div>';
}

function calcStep(idx, type, delta) {
    const el = BoardScore.$('calc_' + type + '_' + idx);
    if (!el) return;
    const val = Math.max(0, (parseInt(el.textContent) || 0) + delta);
    el.textContent = val;
}

function computeCalc(idx) {
    // Pas besoin de calcul en temps réel, on applique au clic "Appliquer"
}

function applyCalc(idx) {
    const state = game.getState();
    const digits   = parseInt(BoardScore.$('calc_digits_' + idx)?.value) || 0;
    const specials = parseInt(BoardScore.$('calc_specials_' + idx)?.textContent) || 0;
    const wilds    = parseInt(BoardScore.$('calc_wilds_' + idx)?.textContent) || 0;

    const total = digits + (specials * 20) + (wilds * 50);

    // Sauvegarder toutes les valeurs courantes avant re-render
    snapshotInputValues();
    // Mettre à jour le joueur concerné avec le total calculé
    state.tempScores[state.players[idx].name] = total;

    calcOpenForIdx = null;
    renderScoreInputs();
}

function stepScore(idx, delta) {
    const newVal = game.stepScore(idx, delta, { min: 0 });
    const state = game.getState();
    if (state.players[idx]) {
        state.tempScores[state.players[idx].name] = newVal;
    }
}

function confirmScores() {
    const state = game.getState();

    if (!state.tempWinner) {
        const hint = BoardScore.$('winnerRequiredHint');
        if (hint) {
            hint.style.display = 'block';
            setTimeout(() => hint.style.display = 'none', 2500);
        }
        const block = document.querySelector('.modal-block');
        if (block) {
            block.style.transform = 'scale(1.02)';
            setTimeout(() => block.style.transform = '', 200);
        }
        return;
    }

    const scores = {};
    state.players.forEach((p, i) => {
        if (state.tempWinner === p.name) {
            scores[p.name] = 0;
        } else {
            scores[p.name] = parseInt(BoardScore.$('inp_' + i)?.value) || 0;
        }
    });

    const existingIdx = state.history.findIndex(h => h.round === state.round);

    state.players.forEach(p => {
        if (existingIdx !== -1) {
            const oldPts = state.history[existingIdx].scores[p.name] || 0;
            p.score = p.score - oldPts + scores[p.name];
        } else {
            p.score += scores[p.name];
        }
    });

    const entry = {
        round: state.round,
        winner: state.tempWinner,
        scores
    };

    if (existingIdx !== -1) state.history[existingIdx] = entry;
    else state.history.push(entry);

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();

    // Vérifier fin de partie
    if (state.scoreLimit && state.players.some(p => p.score >= state.scoreLimit)) {
        setTimeout(() => game.showWinner(), 400);
    }
}


/* ── New Game : score limit selector ── */
function renderNgScoreLimit() {
    const section = BoardScore.$('ng-limit-section');
    if (!section) return;
    const isCustom = ngScoreLimit !== 500 && ngScoreLimit !== null;
    const modes = [
        { val: 500,      label: '500 pts',  sub: 'Standard' },
        { val: null,     label: '∞ Infini', sub: 'Sans limite' },
        { val: 'custom', label: 'Perso',    sub: 'Nombre libre' },
    ];
    section.innerHTML =
        '<div class="newgame-section-title">🏁 Limite de points</div>' +
        '<div class="limit-cards">' +
        modes.map(m => {
            const active = m.val === 'custom' ? isCustom : (m.val === ngScoreLimit && !isCustom);
            const onclickVal = m.val === 'custom' ? '\'custom\'' : (m.val === null ? 'null' : m.val);
            return '<button class="limit-card ' + (active ? 'active' : '') +
                '" onclick="selectNgScoreMode(' + onclickVal + ')">' +
                '<div class="lc-label">' + m.label + '</div>' +
                '<div class="lc-sub">' + m.sub + '</div></button>';
        }).join('') + '</div>' +
        (isCustom
            ? '<div class="custom-limit-wrap">' +
            '<input type="number" id="ngCustomLimitInput" value="' + ngCustomLimit + '" min="200" step="50" placeholder="ex: 300" oninput="onNgCustomLimitInput()" />' +
            '<span class="custom-limit-unit">pts (min. 200)</span></div>'
            : '');
}

function selectNgScoreMode(val) {
    if (val === 'custom') {
        ngScoreLimit = ngCustomLimit >= 200 ? ngCustomLimit : 500;
    } else {
        ngScoreLimit = val;
    }
    renderNgScoreLimit();
}

function onNgCustomLimitInput() {
    const inp = BoardScore.$('ngCustomLimitInput');
    const v = parseInt(inp.value) || 200;
    ngCustomLimit = Math.max(200, v);
    ngScoreLimit = ngCustomLimit;
}



/* ── INIT ── */
game.init();
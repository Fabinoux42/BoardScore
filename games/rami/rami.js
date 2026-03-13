/* ═══════════════════════════════════════════
   rami.js — Rami
   Utilise BoardScore.create() de core.js
   ═══════════════════════════════════════════ */

const STEP = 100;

/* ── New game modal state (spécifique Rami) ── */
let ngDealerIdx = 0;
let ngScoreLimit = 1000;
let ngCustomLimit = 200;

/* ── Dealer helpers ── */
function getDealerIdx()     { const s = game.getState(); return s.dealerIdx % s.players.length; }
function getNextDealerIdx() { const s = game.getState(); return (s.dealerIdx + 1) % s.players.length; }


const game = BoardScore.create({

    key: 'rami',
    emptyEmoji: '🃏',

    defaultState: {
        players: [],
        round: 1,
        history: [],
        scoreLimit: 1000,
        dealerIdx: 0,
        tempWinner: null,
        tempNoPoseSet: new Set(),
        tempRamiSec: false,
        tempNoPoseActive: false
    },

    /* ── Sérialisation : Set → Array ── */
    onSerialize(state) {
        return { ...state, tempNoPoseSet: [...state.tempNoPoseSet] };
    },

    onDeserialize(parsed) {
        parsed.tempNoPoseSet = new Set(parsed.tempNoPoseSet || []);
        return parsed;
    },

    /* ── Player cards : dealer, danger à 70% de la limite ── */
    getPlayerCardExtras(p, i, state, { isLeader }) {
        const dealerIdx = getDealerIdx();
        const dangerThreshold = state.scoreLimit ? Math.floor(state.scoreLimit * 0.7) : null;
        const isDanger = dangerThreshold !== null && p.score >= dangerThreshold && !isLeader;
        const isDealer = i === dealerIdx;
        const scoreClass = (dangerThreshold !== null && p.score >= dangerThreshold)
            ? 'danger-score'
            : (p.score === 0 ? 'zero-score' : '');
        return {
            isDanger,
            cardClass: isDealer ? 'is-dealer' : '',
            scoreClass
        };
    },

    /* ── Remove player : ajuster dealerIdx ── */
    onRemovePlayer(state) {
        if (state.dealerIdx >= state.players.length && state.players.length > 0) {
            state.dealerIdx = 0;
        }
    },

    /* ── Rendu spécifique : dealer bar ── */
    onRender(state) {
        renderDealerBar(state);
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

    /* ── Next round : avancer le donneur ── */
    onNextRound(state) {
        state.dealerIdx = (state.dealerIdx + 1) % state.players.length;
    },

    /* ── History : tags rami sec / sans pose + trophée ── */
    buildHistoryItem(h) {
        const tags = [];
        if (h.ramiSec) tags.push('<span class="h-tag rami-sec">⚡ Rami sec</span>');
        if (h.noPose && h.noPose.length > 0) tags.push('<span class="h-tag no-pose">🚫 Sans pose</span>');
        const header = '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + '</span>' +
            (tags.length ? '<div class="history-tags">' + tags.join('') + '</div>' : '') + '</div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const isWinner = h.winner === name;
                const cls = pts < 0 ? 'bonus' : (pts >= 200 ? 'penalty' : '');
                const prefix = pts <= 0 ? '' : '+';
                return '<span class="h-score"><strong>' + name + '</strong>: ' +
                    '<span class="val ' + cls + '">' + prefix + pts + '</span>' +
                    (isWinner ? ' 🏆' : '') + '</span>';
            }).join('') + '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── New Game Modal : dealer + score limit ── */
    onOpenNewGameModal(state) {
        ngDealerIdx = 0;
        ngScoreLimit = (state.scoreLimit !== undefined) ? state.scoreLimit : 1000;
        ngCustomLimit = (ngScoreLimit && ngScoreLimit !== 1000) ? ngScoreLimit : 200;
        renderNgDealerList();
        renderNgScoreLimit();
    },

    onSelectPlayerMode(mode, ngKeepSet, ngNewPlayers) {
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
        state.dealerIdx = ngDealerIdx;
        state.scoreLimit = ngScoreLimit;
    }
});


/* ═══════════════════════════════════════════
   FONCTIONS SPÉCIFIQUES AU RAMI
   ═══════════════════════════════════════════ */

/* ── Dealer bar ── */
function renderDealerBar(state) {
    const bar = BoardScore.$('dealerBar');
    if (!bar) return;
    if (state.players.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const dealer = state.players[getDealerIdx()];
    const next   = state.players[getNextDealerIdx()];
    BoardScore.$('dealerCurrentPill').textContent = dealer ? dealer.name : '—';
    BoardScore.$('dealerNextName').textContent    = next ? next.name : '—';
}


/* ── Score Modal ── */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempWinner = existing ? existing.winner : null;
    state.tempRamiSec = existing ? !!existing.ramiSec : true;
    state.tempNoPoseActive = existing ? (existing.noPose && existing.noPose.length > 0) : false;
    state.tempNoPoseSet = new Set(existing && existing.noPose ? existing.noPose : []);

    BoardScore.$('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderWinnerPicker();
    renderSpecialBtns();
    renderNoPoseSection();
    renderScoreInputs();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderWinnerPicker() {
    const state = game.getState();
    // Ajouter le hint si absent
    const block = document.querySelector('.modal-block');
    if (block && !BoardScore.$('winnerRequiredHint')) {
        const hint = document.createElement('div');
        hint.id = 'winnerRequiredHint';
        hint.style.cssText = 'display:none;margin-top:8px;background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);border-radius:10px;padding:8px 12px;font-size:0.78rem;color:var(--red);text-align:center;';
        hint.textContent = '⚠️ Sélectionne qui a fait Rami avant de confirmer !';
        block.appendChild(hint);
    }
    BoardScore.$('winnerRoundList').innerHTML = state.players.map(p =>
        '<button class="picker-btn ' + (state.tempWinner === p.name ? 'selected' : '') +
        '" onclick="selectWinner(\'' + p.name + '\')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
    ).join('');
}

function selectWinner(name) {
    const state = game.getState();
    state.tempWinner = name;
    state.tempNoPoseSet.delete(name);
    renderWinnerPicker();
    renderScoreInputs();
}

function renderSpecialBtns() {
    const state = game.getState();
    BoardScore.$('specialBtns').innerHTML =
        '<button class="special-btn ' + (state.tempRamiSec ? 'active' : '') + '" onclick="toggleRamiSec()">' +
        '<span class="sb-icon">⚡</span><span class="sb-text">Rami sec</span><span class="sb-sub">Perdants +200 pts chacun</span></button>' +
        '<button class="special-btn ' + (state.tempNoPoseActive ? 'active' : '') + '" onclick="toggleNoPose()">' +
        '<span class="sb-icon">🚫</span><span class="sb-text">Sans pose</span><span class="sb-sub">+100 pts automatique</span></button>';
}

function toggleRamiSec() {
    game.getState().tempRamiSec = !game.getState().tempRamiSec;
    renderSpecialBtns();
    renderScoreInputs();
}

function toggleNoPose() {
    const state = game.getState();
    state.tempNoPoseActive = !state.tempNoPoseActive;
    if (!state.tempNoPoseActive) state.tempNoPoseSet.clear();
    renderSpecialBtns();
    renderNoPoseSection();
    renderScoreInputs();
}

function renderNoPoseSection() {
    const state = game.getState();
    const section = BoardScore.$('noPoseSection');
    if (!state.tempNoPoseActive) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    BoardScore.$('noPoseList').innerHTML = state.players
        .filter(p => p.name !== state.tempWinner)
        .map(p =>
            '<button class="picker-btn ' + (state.tempNoPoseSet.has(p.name) ? 'selected' : '') +
            '" onclick="toggleNoPosePlayer(\'' + p.name + '\')">' +
            '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
        ).join('');
}

function toggleNoPosePlayer(name) {
    const state = game.getState();
    if (state.tempNoPoseSet.has(name)) state.tempNoPoseSet.delete(name);
    else state.tempNoPoseSet.add(name);
    renderNoPoseSection();
    renderScoreInputs();
}

function renderScoreInputs() {
    const state = game.getState();
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const isWinner = state.tempWinner === p.name;
        const isNoPose = state.tempNoPoseSet.has(p.name);
        const isRamiSecLoser = state.tempRamiSec && !isWinner;

        let val = 0;
        if (isWinner) val = -10;
        else if (isNoPose) val = 100;
        else if (isRamiSecLoser) val = 200;

        const existing = state.history.find(h => h.round === state.round);
        if (existing && !isWinner && !isNoPose && !isRamiSecLoser) {
            val = existing.rawScores ? (existing.rawScores[p.name] || 0) : (existing.scores[p.name] || 0);
        }

        const locked = isWinner || isNoPose || isRamiSecLoser;
        let rowTag = '';
        if (isWinner) rowTag = '<div class="row-tag winner-tag">🏆 Gagnant −10</div>';
        else if (isRamiSecLoser) rowTag = '';
        else if (isNoPose) rowTag = '<div class="row-tag noPose-tag">🚫 Sans pose</div>';

        const secBadge = isRamiSecLoser ? '<span class="ramisec-badge">⚡</span>' : '';

        return '<div class="score-row ' + (isWinner ? 'is-winner' : '') + (isNoPose ? ' is-noPose' : '') + (locked ? ' locked' : '') + '" id="srow_' + i + '">' +
            rowTag +
            secBadge +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div><div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + (-STEP) + ')">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" />' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + STEP + ')">+</div>' +
            '</div></div>';
    }).join('');
}

function stepScore(idx, delta) {
    game.stepScore(idx, delta, { min: 0 });
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
    const rawScores = {};

    state.players.forEach((p, i) => {
        const isWinner  = state.tempWinner === p.name;
        const isNoPose  = state.tempNoPoseSet.has(p.name);
        const isRamiSec = state.tempRamiSec && !isWinner;

        let pts;
        if (isWinner)  pts = -10;
        else if (isNoPose)  pts = 100;
        else if (isRamiSec) pts = 200;
        else pts = parseInt(BoardScore.$('inp_' + i)?.value) || 0;

        scores[p.name] = pts;
        rawScores[p.name] = pts;
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
        ramiSec: state.tempRamiSec,
        noPose: [...state.tempNoPoseSet],
        rawScores,
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


/* ── New Game : dealer list ── */
function renderNgDealerList() {
    const state = game.getState();
    const section = BoardScore.$('ng-dealer-section');
    const list = BoardScore.$('ngDealerList');
    if (!section || !list) return;

    let players = [];
    if (game.getNgMode() === 'same') {
        const keepSet = game.getNgKeepSet();
        players = state.players.filter((_, i) => keepSet.has(i));
    } else {
        players = game.getNgNewPlayers().map((name, i) => ({ name, color: BoardScore.COLORS[i % BoardScore.COLORS.length] }));
    }
    if (players.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = players.map((p, i) =>
        '<button class="picker-btn ' + (ngDealerIdx === i ? 'selected' : '') +
        '" onclick="selectNgDealer(' + i + ')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
    ).join('');
}

function selectNgDealer(i) {
    ngDealerIdx = i;
    renderNgDealerList();
}


/* ── New Game : score limit selector ── */
function renderNgScoreLimit() {
    const section = BoardScore.$('ng-limit-section');
    if (!section) return;
    const isCustom = ngScoreLimit !== 1000 && ngScoreLimit !== null;
    const modes = [
        { val: 1000,     label: '1 000 pts', sub: 'Standard' },
        { val: null,     label: '∞ Infini',  sub: 'Sans limite' },
        { val: 'custom', label: 'Perso',     sub: 'Nombre libre' },
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
            '<input type="number" id="ngCustomLimitInput" value="' + ngCustomLimit + '" min="200" step="100" placeholder="ex: 500" oninput="onNgCustomLimitInput()" />' +
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
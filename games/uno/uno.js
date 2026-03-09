/* ═══════════════════════════════════════════
   uno.js — Uno
   Utilise BoardScore.create() de core.js

   Règles de scoring Uno :
   - Le gagnant de la manche marque 0
   - Les perdants comptent les cartes dans leur main :
     · Chiffres (0-9) : valeur faciale
     · +2 / Inverse / Passer : 20 pts
     · Joker / +4 : 50 pts
   - Premier joueur à atteindre 500 pts → fin de partie
   - Le gagnant est celui avec le MOINS de points
   ═══════════════════════════════════════════ */

const SCORE_LIMIT = 500;
const STEP = 5;

const game = BoardScore.create({

    key: 'uno',
    emptyEmoji: '🎴',

    defaultState: {
        players: [],
        round: 1,
        history: [],
        tempScores: {},
        tempWinner: null
    },

    /* ── Progress bar : limite fixe à 500 ── */
    scoreLimit: SCORE_LIMIT,

    /* ── Player cards : danger à 400+ ── */
    getPlayerCardExtras(p, i, state, { isLeader }) {
        const isDanger = p.score >= 400 && !isLeader;
        const scoreClass = p.score >= 400 ? 'danger-score' : (p.score === 0 ? 'zero-score' : '');
        return { isDanger, scoreClass };
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

    /* ── Fin de partie : vérifiée après confirmScores ── */
    // (géré manuellement dans confirmScores comme Skyjo/Rami)
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

    BoardScore.$('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderWinnerPicker();
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
        hint.textContent = '⚠️ Sélectionne qui a crié UNO et gagné avant de confirmer !';
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
    renderWinnerPicker();
    renderScoreInputs();
}

function renderScoreInputs() {
    const state = game.getState();
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const isWinner = state.tempWinner === p.name;
        const existing = state.history.find(h => h.round === state.round);
        let val = 0;
        if (isWinner) {
            val = 0;
        } else if (existing) {
            val = existing.scores[p.name] || 0;
        }

        return '<div class="score-row ' + (isWinner ? 'is-winner locked' : '') + '" id="srow_' + i + '">' +
            (isWinner ? '<div class="row-tag winner-tag">🏆 UNO !</div>' : '') +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div>' +
            '<div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + (-STEP) + ')">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" min="0" />' +
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
    if (state.players.some(p => p.score >= SCORE_LIMIT)) {
        setTimeout(() => game.showWinner(), 400);
    }
}


/* ── Fonctions globales (appelées depuis le HTML via onclick) ── */
function addPlayer()             { game.addPlayer(); }
function removePlayer(i)         { game.removePlayer(i); }
function nextRound()             { game.nextRound(); }
function openNewGameModal()      { game.openNewGameModal(); }
function closeNewGameModal()     { game.closeNewGameModal(); }
function selectPlayerMode(m)     { game.selectPlayerMode(m); }
function toggleKeepPlayer(i)     { game.toggleKeepPlayer(i); }
function ngAddPlayer()           { game.ngAddPlayer(); }
function ngRemovePlayer(i)       { game.ngRemovePlayer(i); }
function confirmNewGame()        { game.confirmNewGame(); }
function openNewGameFromWinner() { game.openNewGameFromWinner(); }
function closeBgModal(e, id)     { game.closeBgModal(e, id); }


/* ── INIT ── */
game.init();
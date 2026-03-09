/* ═══════════════════════════════════════════
   skyjo.js — Skyjo
   Utilise BoardScore.create() de core.js
   ═══════════════════════════════════════════ */

const SCORE_LIMIT = 100;

const game = BoardScore.create({

    key: 'skyjo',
    emptyEmoji: '🃏',

    defaultState: {
        players: [],
        round: 1,
        history: [],
        tempScores: {},
        tempFinisher: null
    },

    /* ── Player cards : scores négatifs, danger à 75+ ── */
    getPlayerCardExtras(p, i, state, { isLeader }) {
        const isDanger = p.score >= 75 && !isLeader;
        const scoreClass = p.score < 0 ? 'negative' : (p.score >= 75 ? 'danger-score' : '');
        return { isDanger, scoreClass };
    },

    /* ── Progress bar : limite fixe à 100 ── */
    scoreLimit: SCORE_LIMIT,

    /* ── History : affichage pénalité doublement ── */
    buildHistoryItem(h) {
        const hasPenalty = !!h.doubled;
        const header = '<div class="history-item-header">' +
            '<span class="round-num">Manche ' + h.round + '</span>' +
            (hasPenalty ? '<span class="penalty-tag">✕2 pénalité ' + h.doubled + '</span>' : '') +
            '</div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const isDoubled = h.doubled === name;
                const isNeg = pts < 0;
                const ptsClass = isDoubled ? 'pts-val dbl' : (isNeg ? 'pts-val neg' : 'pts-val');
                const ptsStr = (pts >= 0 ? '+' : '') + pts + (isDoubled ? ' (×2)' : '');
                return '<span class="history-score-entry"><strong>' + name + '</strong>: ' +
                    '<span class="' + ptsClass + '">' + ptsStr + '</span></span>';
            }).join('') + '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── Fin de partie : quelqu'un atteint 100+ ── */
    // Note : pour Skyjo on vérifie après confirmScores, pas après nextRound
    // donc on ne met pas checkGameEnd ici (géré manuellement dans confirmScores)
});


/* ═══════════════════════════════════════════
   FONCTIONS SPÉCIFIQUES AU SKYJO
   ═══════════════════════════════════════════ */

/* ── Score Modal ── */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempFinisher = existing ? existing.finisher : null;
    state.tempScores = {};
    state.players.forEach(p => {
        if (existing) {
            state.tempScores[p.name] = existing.rawScores
                ? (existing.rawScores[p.name] || 0)
                : (existing.scores[p.name] || 0);
        } else {
            state.tempScores[p.name] = 0;
        }
    });

    BoardScore.$('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderFinisherList();
    renderScoreInputs();
    updatePenaltyHint();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderFinisherList() {
    const state = game.getState();
    const list = BoardScore.$('finisherList');
    list.innerHTML = '<button class="finisher-btn none-btn ' + (state.tempFinisher === null ? 'selected' : '') +
        '" onclick="selectFinisher(null)">Aucun / Passer</button>' +
        state.players.map(p =>
            '<button class="finisher-btn ' + (state.tempFinisher === p.name ? 'selected' : '') +
            '" onclick="selectFinisher(\'' + p.name + '\')">' +
            '<span class="fb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
        ).join('');
}

function selectFinisher(name) {
    game.getState().tempFinisher = name;
    renderFinisherList();
    updatePenaltyHint();
}

function updatePenaltyHint() {
    const state = game.getState();
    const hint = BoardScore.$('penaltyHint');
    const nameEl = BoardScore.$('penaltyName');
    if (state.tempFinisher) {
        nameEl.textContent = state.tempFinisher;
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

function renderScoreInputs() {
    const state = game.getState();
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const val = state.tempScores[p.name] || 0;
        const isFinisher = state.tempFinisher === p.name;
        return '<div class="score-row ' + (isFinisher ? 'is-finisher' : '') + '" id="srow_' + i + '">' +
            (isFinisher ? '<div class="finisher-tag">A terminé !</div>' : '') +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div>' +
            '<div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',-1)">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" ' +
            'oninput="game.getState().tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',1)">+</div>' +
            '</div></div>';
    }).join('');
}

function stepScore(name, delta) {
    game.stepScore(name, delta);
}

function confirmScores() {
    const state = game.getState();

    // Lire les valeurs finales depuis les inputs
    state.players.forEach((p, i) => {
        const inp = BoardScore.$('inp_' + i);
        state.tempScores[p.name] = parseInt(inp?.value) || 0;
    });

    const rawScores = { ...state.tempScores };
    const finalScores = { ...state.tempScores };
    let doubled = null;

    // Appliquer la pénalité de doublement si nécessaire
    if (state.tempFinisher) {
        const finisherRaw = rawScores[state.tempFinisher];
        const minScore = Math.min(...Object.values(rawScores));
        if (finisherRaw !== minScore && finisherRaw > 0) {
            finalScores[state.tempFinisher] = finisherRaw * 2;
            doubled = state.tempFinisher;
        }
    }

    const existingIdx = state.history.findIndex(h => h.round === state.round);

    // Corriger les scores des joueurs
    state.players.forEach(p => {
        if (existingIdx !== -1) {
            const old = state.history[existingIdx];
            const oldFinal = old.scores[p.name] || 0;
            p.score = p.score - oldFinal + finalScores[p.name];
        } else {
            p.score += finalScores[p.name];
        }
    });

    const entry = {
        round: state.round,
        finisher: state.tempFinisher,
        doubled,
        rawScores,
        scores: finalScores
    };

    if (existingIdx !== -1) {
        state.history[existingIdx] = entry;
    } else {
        state.history.push(entry);
    }

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();

    // Vérifier si quelqu'un a atteint 100+
    const triggered = state.players.find(p => p.score >= SCORE_LIMIT);
    if (triggered) {
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
/* ═══════════════════════════════════════════
   mexicanTrain.js — Train Mexicain
   Utilise BoardScore.create() de core.js
   ═══════════════════════════════════════════ */

const DOMINO_SETS = [6, 9, 12, 15, 18];
let ngDominoMax = 12;

const game = BoardScore.create({

    key: 'mxt',
    emptyEmoji: '🁣',

    defaultState: {
        players: [],
        round: 1,
        history: [],
        tempScores: {},
        tempWinner: null,
        dominoMax: 12
    },

    /* ── Deserialize : garantir dominoMax ── */
    onDeserialize(parsed) {
        if (!parsed.dominoMax) parsed.dominoMax = 12;
        return parsed;
    },

    /* ── Badge : affiche "Manche X / total" ── */
    buildBadgeText(state, scored) {
        const total = state.dominoMax + 1;
        return (scored ? '✅ ' : '⏳ ') + 'Manche ' + state.round + ' / ' + total;
    },

    /* ── Rendu spécifique (domino set selector) ── */
    onRender(state) {
        renderDominoSet(state);
    },

    /* ── History : scores avec + devant, trophée pour le gagnant ── */
    buildHistoryItem(h) {
        const header = '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + '</span></div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const isWinner = h.winner === name;
                const prefix = pts === 0 ? '' : '+';
                return '<span class="h-score"><strong>' + name + '</strong>: ' +
                    '<span class="val">' + prefix + pts + '</span>' +
                    (isWinner ? ' 🏆' : '') + '</span>';
            }).join('') + '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    },

    /* ── Fin de partie : quand round dépasse dominoMax + 1 ── */
    checkGameEnd(state) {
        return state.round > state.dominoMax + 1;
    },

    /* ── New Game Modal : init domino selector ── */
    onOpenNewGameModal(state) {
        ngDominoMax = state.dominoMax;
        renderNgSetOptions();
    },

    /* ── New Game : sauver le choix de dominos ── */
    onConfirmNewGame(state) {
        state.dominoMax = ngDominoMax;
    }
});


/* ═══════════════════════════════════════════
   FONCTIONS SPÉCIFIQUES AU MEXICAN TRAIN
   ═══════════════════════════════════════════ */

/* ── Domino Set Selector (page principale) ── */
function renderDominoSet(state) {
    const max = state.dominoMax;
    const valEl = BoardScore.$('setValueDisplay');
    const roundsEl = BoardScore.$('setRoundsDisplay');
    const optsEl = BoardScore.$('setOptions');
    if (!valEl || !roundsEl || !optsEl) return;

    valEl.textContent = max;
    roundsEl.textContent = (max + 1) + ' manches · de [' + max + ':' + max + '] à [0:0]';
    optsEl.innerHTML = DOMINO_SETS.map(n =>
        '<button class="set-btn ' + (n === max ? 'active' : '') + '" onclick="setDominoMax(' + n + ')">' +
        'D-' + n + '<span class="set-rounds">' + (n + 1) + ' man.</span></button>'
    ).join('');
}

function setDominoMax(n) {
    const state = game.getState();
    if (state.history.length > 0) {
        if (!confirm('Changer le jeu de dominos va réinitialiser la partie. Continuer ?')) return;
        state.players.forEach(p => p.score = 0);
        state.round = 1;
        state.history = [];
    }
    state.dominoMax = n;
    game.save();
    game.render();
}


/* ── Score Modal ── */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempWinner = existing ? (existing.winner || null) : null;
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
    const list = BoardScore.$('winnerList');
    if (!list) return;
    list.innerHTML =
        state.players.map(p =>
            '<button class="finisher-btn ' + (state.tempWinner === p.name ? 'selected' : '') +
            '" onclick="selectWinner(\'' + p.name + '\')">' +
            '<span class="fb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
        ).join('');
}

function selectWinner(name) {
    const state = game.getState();
    state.tempWinner = name;
    // Le gagnant a 0 points, on met à jour tempScores
    if (name) state.tempScores[name] = 0;
    renderWinnerPicker();
    renderScoreInputs();
}

function renderScoreInputs() {
    const state = game.getState();
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const isWinner = state.tempWinner === p.name;
        const val = isWinner ? 0 : (state.tempScores[p.name] || 0);
        const locked = isWinner;
        const rowTag = isWinner ? '<div class="row-tag winner-tag">🏆 Gagnant — 0 pt</div>' : '';
        return '<div class="score-row ' + (isWinner ? 'is-winner locked' : '') + '" id="srow_' + i + '">' +
            rowTag +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div>' +
            '<div class="current">Total actuel : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" ' + (locked ? 'style="opacity:0.3;pointer-events:none"' : '') + ' onclick="stepScore(\'' + p.name + '\',-5)">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" min="0" max="999" ' +
            (locked ? 'readonly style="opacity:0.5" ' : '') +
            'oninput="game.getState().tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" ' + (locked ? 'style="opacity:0.3;pointer-events:none"' : '') + ' onclick="stepScore(\'' + p.name + '\',5)">+</div>' +
            '</div></div>';
    }).join('');
}



function stepScore(name, delta) {
    game.stepScore(name, delta, { min: 0 });
}

function confirmScores() {
    const state = game.getState();

    // Validation : le gagnant doit être sélectionné
    if (!state.tempWinner) {
        const hint = BoardScore.$('winnerRequiredHint');
        if (hint) {
            hint.style.display = 'block';
            setTimeout(() => hint.style.display = 'none', 2500);
        }
        const modal = document.querySelector('#scoreModal .modal');
        if (modal) {
            modal.style.transform = 'scale(1.02)';
            setTimeout(() => modal.style.transform = '', 200);
        }
        return;
    }

    const roundScores = {};
    const existingIdx = state.history.findIndex(h => h.round === state.round);

    state.players.forEach((p, i) => {
        const isWinner = state.tempWinner === p.name;
        let newPts;
        if (isWinner) {
            newPts = 0;
        } else {
            const inp = BoardScore.$('inp_' + i);
            newPts = parseInt(inp?.value) || 0;
        }
        roundScores[p.name] = newPts;

        if (existingIdx !== -1) {
            const oldPts = state.history[existingIdx].scores[p.name] || 0;
            p.score = p.score - oldPts + newPts;
        } else {
            p.score += newPts;
        }
    });

    if (existingIdx !== -1) {
        state.history[existingIdx] = { round: state.round, winner: state.tempWinner, scores: roundScores };
    } else {
        state.history.push({ round: state.round, winner: state.tempWinner, scores: roundScores });
    }

    BoardScore.$('scoreModal').classList.remove('open');
    game.save();
    game.render();
}



/* ── New Game : domino set selector ── */
function renderNgSetOptions() {
    const el = BoardScore.$('ngSetOptions');
    if (!el) return;
    el.innerHTML = DOMINO_SETS.map(n =>
        '<button class="newgame-set-btn ' + (n === ngDominoMax ? 'active' : '') + '" onclick="selectNgSet(' + n + ')">' +
        'D-' + n + '<span class="nsb-rounds">' + (n + 1) + ' man.</span></button>'
    ).join('');
}

function selectNgSet(n) {
    ngDominoMax = n;
    renderNgSetOptions();
}



/* ── INIT ── */
game.init();
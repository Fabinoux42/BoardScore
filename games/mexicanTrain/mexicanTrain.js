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

    /* ── History : scores avec + devant ── */
    buildHistoryItem(h) {
        const header = '<div class="history-item-header">' +
            '<span class="history-round-num">Manche ' + h.round + '</span></div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) =>
                '<span class="h-score"><strong>' + name + '</strong>: ' +
                '<span class="val">+' + pts + '</span></span>'
            ).join('') + '</div>';
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
    state.tempScores = {};
    state.players.forEach(p => {
        state.tempScores[p.name] = existing ? (existing.scores[p.name] || 0) : 0;
    });

    BoardScore.$('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    BoardScore.$('scoreInputs').innerHTML = state.players.map((p, i) => {
        const val = state.tempScores[p.name];
        return '<div class="score-row">' +
            '<div class="avatar-sm" style="background:' + p.color + '">' + BoardScore.getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div>' +
            '<div class="current">Total actuel : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',-5)">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" min="0" max="999" ' +
            'oninput="game.getState().tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',5)">+</div>' +
            '</div></div>';
    }).join('');

    BoardScore.$('scoreModal').classList.add('open');
}

function stepScore(name, delta) {
    game.stepScore(name, delta, { min: 0 });
}

function confirmScores() {
    const state = game.getState();
    const roundScores = {};
    const existingIdx = state.history.findIndex(h => h.round === state.round);

    state.players.forEach((p, i) => {
        const inp = BoardScore.$('inp_' + i);
        const newPts = parseInt(inp?.value) || 0;
        roundScores[p.name] = newPts;

        if (existingIdx !== -1) {
            const oldPts = state.history[existingIdx].scores[p.name] || 0;
            p.score = p.score - oldPts + newPts;
        } else {
            p.score += newPts;
        }
    });

    if (existingIdx !== -1) {
        state.history[existingIdx].scores = roundScores;
    } else {
        state.history.push({ round: state.round, scores: roundScores });
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


/* ── Fonctions globales (appelées depuis le HTML via onclick) ── */
function addPlayer()            { game.addPlayer(); }
function removePlayer(i)        { game.removePlayer(i); }
function nextRound()            { game.nextRound(); }
function openNewGameModal()     { game.openNewGameModal(); }
function closeNewGameModal()    { game.closeNewGameModal(); }
function selectPlayerMode(m)    { game.selectPlayerMode(m); }
function toggleKeepPlayer(i)    { game.toggleKeepPlayer(i); }
function ngAddPlayer()          { game.ngAddPlayer(); }
function ngRemovePlayer(i)      { game.ngRemovePlayer(i); }
function confirmNewGame()       { game.confirmNewGame(); }
function openNewGameFromWinner() { game.openNewGameFromWinner(); }
function closeBgModal(e, id)    { game.closeBgModal(e, id); }


/* ── INIT ── */
game.init();
const COLORS = ['#f5c542','#e05c2a','#3ddc84','#9b59f5','#38bdf8','#fb7185','#a3e635','#f97316'];
const DOMINO_SETS = [6, 9, 12, 15, 18];

let state = {
    players: [],
    round: 1,
    history: [],
    tempScores: {},
    dominoMax: 12
};

// New game modal state
let ngMode = 'same';
let ngKeepSet = new Set();
let ngNewPlayers = [];
let ngDominoMax = 12;

/* ─── PERSISTENCE ─── */
function save() {
    try { localStorage.setItem('mxt_state', JSON.stringify(state)); } catch(e) {}
}
function load() {
    try {
        const s = localStorage.getItem('mxt_state');
        if (s) {
            const loaded = JSON.parse(s);
            state = { ...state, ...loaded };
            if (!state.dominoMax) state.dominoMax = 12;
        }
    } catch(e) {}
}

/* ─── UTILS ─── */
function getInitial(name) { return name.trim().charAt(0).toUpperCase(); }

/* ─── PLAYERS ─── */
function addPlayer() {
    const input = document.getElementById('newPlayerName');
    const name = input.value.trim();
    if (!name) return;
    if (state.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        input.style.borderColor = 'var(--red)';
        setTimeout(() => input.style.borderColor = '', 800);
        return;
    }
    const idx = state.players.length % COLORS.length;
    state.players.push({ name, score: 0, color: COLORS[idx] });
    input.value = '';
    save(); render();
}

function removePlayer(idx) {
    if (!confirm('Supprimer ' + state.players[idx].name + ' ?')) return;
    state.players.splice(idx, 1);
    save(); render();
}

/* ─── RENDER ─── */
function roundHasScores() {
    return state.history.some(h => h.round === state.round);
}

function render() {
    renderPlayers();
    renderHistory();
    renderDominoSet();
    const total = state.dominoMax + 1;
    const badge = document.getElementById('roundBadge');
    const scored = roundHasScores();
    badge.textContent = (scored ? '\u2705 ' : '\u23f3 ') + 'Manche ' + state.round + ' / ' + total;
    badge.style.background = scored ? 'var(--green)' : 'var(--accent)';
    badge.style.color = scored ? '#0d2e1a' : '#1a0a2e';

    // Bouton manche suivante : grisé si pas de scores
    const btnNext = document.querySelector('.btn-next');
    if (btnNext) {
        btnNext.style.opacity = scored ? '1' : '0.4';
    }
}

function renderDominoSet() {
    const max = state.dominoMax;
    document.getElementById('setValueDisplay').textContent = max;
    document.getElementById('setRoundsDisplay').textContent =
        (max + 1) + ' manches · de [' + max + ':' + max + '] à [0:0]';
    document.getElementById('setOptions').innerHTML = DOMINO_SETS.map(n =>
        '<button class="set-btn ' + (n === max ? 'active' : '') + '" onclick="setDominoMax(' + n + ')">' +
        'D-' + n + '<span class="set-rounds">' + (n+1) + ' man.</span></button>'
    ).join('');
}

function setDominoMax(n) {
    if (state.history.length > 0) {
        if (!confirm('Changer le jeu de dominos va réinitialiser la partie. Continuer ?')) return;
        state.players.forEach(p => p.score = 0);
        state.round = 1; state.history = [];
    }
    state.dominoMax = n;
    save(); render();
}

function renderPlayers() {
    const list = document.getElementById('playersList');
    if (state.players.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="emoji">🁣</div><p>Aucun joueur encore.<br>Ajoute des joueurs pour commencer !</p></div>';
        return;
    }
    const sorted = [...state.players].sort((a, b) => a.score - b.score);
    const leader = sorted[0];
    list.innerHTML = state.players.map((p, i) => {
        const isLeader = p.name === leader.name;
        const rounds = state.history.length;
        return '<div class="player-card ' + (isLeader ? 'leader' : '') + '" style="--player-color:' + p.color + '">' +
            '<div class="player-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
            '<div class="player-info">' +
            '<div class="player-name">' + p.name + '</div>' +
            '<div class="player-details">' + (rounds > 0 ? rounds + ' manche' + (rounds > 1 ? 's' : '') + ' jouée' + (rounds > 1 ? 's' : '') : 'Prêt à jouer') + '</div>' +
            '</div>' +
            '<div><div class="player-score">' + p.score + '</div><div class="score-label">points</div></div>' +
            '<div class="player-actions"><div class="btn-icon danger" onclick="removePlayer(' + i + ')">🗑</div></div>' +
            '</div>';
    }).join('');
}

function renderHistory() {
    const section = document.getElementById('historySection');
    const list = document.getElementById('historyList');
    if (state.history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = state.history.map((h, i) => {
        const entries = Object.entries(h.scores).map(([name, pts]) => '<strong>' + name + '</strong>: +' + pts).join(' · ');
        return '<div class="history-item"><span>Manche ' + (i + 1) + '</span><span>' + entries + '</span></div>';
    }).join('');
}

/* ─── SCORE MODAL ─── */
function openScoreModal() {
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    // Si la manche en cours a déjà des scores, on les pré-remplit
    const existing = state.history.find(h => h.round === state.round);

    state.tempScores = {};
    state.players.forEach(p => {
        state.tempScores[p.name] = existing ? (existing.scores[p.name] || 0) : 0;
    });

    document.getElementById('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    document.getElementById('scoreInputs').innerHTML = state.players.map((p, i) => {
        const val = state.tempScores[p.name];
        return '<div class="score-row">' +
            '<div class="avatar-sm" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
            '<div><div class="name">' + p.name + '</div><div class="current">Total actuel : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',-5)">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" min="0" max="999" oninput="state.tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',5)">+</div>' +
            '</div>' +
            '</div>';
    }).join('');
    document.getElementById('scoreModal').classList.add('open');
}

function stepScore(name, delta) {
    const idx = state.players.findIndex(p => p.name === name);
    const inp = document.getElementById('inp_' + idx);
    const newVal = Math.max(0, (parseInt(inp.value) || 0) + delta);
    inp.value = newVal;
    state.tempScores[name] = newVal;
}

function confirmScores() {
    const roundScores = {};
    const existingIdx = state.history.findIndex(h => h.round === state.round);

    state.players.forEach((p, i) => {
        const inp = document.getElementById('inp_' + i);
        const newPts = parseInt(inp?.value) || 0;
        roundScores[p.name] = newPts;

        if (existingIdx !== -1) {
            // Correction : on retire l'ancien score et on ajoute le nouveau
            const oldPts = state.history[existingIdx].scores[p.name] || 0;
            p.score = p.score - oldPts + newPts;
        } else {
            // Première saisie pour cette manche
            p.score += newPts;
        }
    });

    if (existingIdx !== -1) {
        // On remplace l'entrée existante
        state.history[existingIdx].scores = roundScores;
    } else {
        state.history.push({ round: state.round, scores: roundScores });
    }

    document.getElementById('scoreModal').classList.remove('open');
    save(); render();
}

/* ─── ROUND ─── */
function showRoundError(msg) {
    let el = document.getElementById('roundError');
    if (!el) {
        el = document.createElement('div');
        el.id = 'roundError';
        el.style.cssText = 'background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);border-radius:10px;padding:9px 14px;font-size:0.8rem;color:var(--red);text-align:center;margin:10px 16px 0;animation:fadeIn 0.25s ease;';
        // Insérer sous le header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', el);
    }
    el.textContent = msg;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.remove(), 3500);
}

function nextRound() {
    if (state.players.length === 0) return;
    if (!roundHasScores()) {
        showRoundError('\u26a0\ufe0f Saisis les scores de la manche ' + state.round + ' avant de continuer !');
        // Faire vibrer le bouton "Saisir scores"
        const btnScore = document.querySelector('.btn-score');
        if (btnScore) {
            btnScore.style.transform = 'scale(1.06)';
            setTimeout(() => btnScore.style.transform = '', 200);
        }
        return;
    }
    state.round++;
    save(); render();
    if (state.round > state.dominoMax + 1) setTimeout(showWinner, 300);
}

/* ─── WINNER ─── */
function showWinner() {
    const sorted = [...state.players].sort((a, b) => a.score - b.score);
    const winner = sorted[0];
    document.getElementById('winnerName').textContent = winner.name;
    document.getElementById('winnerScore').textContent = winner.score + ' points au total';
    document.getElementById('winnerScreen').classList.add('show');
}

function openNewGameFromWinner() {
    document.getElementById('winnerScreen').classList.remove('show');
    openNewGameModal();
}

/* ─── NEW GAME MODAL ─── */
function openNewGameModal() {
    ngMode = 'same';
    ngDominoMax = state.dominoMax;
    ngKeepSet = new Set(state.players.map((_, i) => i));
    ngNewPlayers = [];

    renderNgModeCards();
    renderNgKeepList();
    renderNgNewList();
    renderNgSetOptions();

    document.getElementById('newGameModal').classList.add('open');
}

function closeNewGameModal() {
    document.getElementById('newGameModal').classList.remove('open');
}

function selectPlayerMode(mode) {
    ngMode = mode;
    renderNgModeCards();
    document.getElementById('ng-keep-section').style.display = mode === 'same' ? 'block' : 'none';
    document.getElementById('ng-new-section').style.display = mode === 'new' ? 'block' : 'none';
}

function renderNgModeCards() {
    document.getElementById('cc-same').classList.toggle('selected', ngMode === 'same');
    document.getElementById('cc-new').classList.toggle('selected', ngMode === 'new');
}

function renderNgKeepList() {
    const list = document.getElementById('ngKeepList');
    if (state.players.length === 0) {
        list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">Aucun joueur dans la partie actuelle.</div>';
        return;
    }
    list.innerHTML = state.players.map((p, i) =>
        '<div class="keep-player-row ' + (ngKeepSet.has(i) ? 'checked' : '') + '" onclick="toggleKeepPlayer(' + i + ')" id="kpr_' + i + '">' +
        '<div class="kp-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
        '<div class="kp-name">' + p.name + '</div>' +
        '<div class="kp-check">' + (ngKeepSet.has(i) ? '✅' : '⬜') + '</div>' +
        '</div>'
    ).join('');
}

function toggleKeepPlayer(i) {
    if (ngKeepSet.has(i)) ngKeepSet.delete(i); else ngKeepSet.add(i);
    renderNgKeepList();
}

function renderNgNewList() {
    const list = document.getElementById('ngNewList');
    if (ngNewPlayers.length === 0) {
        list.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0 8px">Aucun joueur ajouté — ajoute des joueurs ci-dessous.</div>';
        return;
    }
    list.innerHTML = ngNewPlayers.map((p, i) =>
        '<div class="new-player-row">' +
        '<div class="np-avatar" style="background:' + COLORS[i % COLORS.length] + '">' + getInitial(p) + '</div>' +
        '<div class="np-name">' + p + '</div>' +
        '<div class="np-remove" onclick="ngRemovePlayer(' + i + ')">✕</div>' +
        '</div>'
    ).join('');
}

function ngAddPlayer() {
    const input = document.getElementById('ngNewPlayerInput');
    const name = input.value.trim();
    if (!name) return;
    if (ngNewPlayers.find(n => n.toLowerCase() === name.toLowerCase())) {
        input.style.borderColor = 'var(--red)';
        setTimeout(() => input.style.borderColor = '', 800);
        return;
    }
    ngNewPlayers.push(name);
    input.value = '';
    renderNgNewList();
}

function ngRemovePlayer(i) {
    ngNewPlayers.splice(i, 1);
    renderNgNewList();
}

function renderNgSetOptions() {
    document.getElementById('ngSetOptions').innerHTML = DOMINO_SETS.map(n =>
        '<button class="newgame-set-btn ' + (n === ngDominoMax ? 'active' : '') + '" onclick="selectNgSet(' + n + ')">' +
        'D-' + n + '<span class="nsb-rounds">' + (n+1) + ' man.</span></button>'
    ).join('');
}

function selectNgSet(n) {
    ngDominoMax = n;
    renderNgSetOptions();
}

function confirmNewGame() {
    let newPlayers = [];

    if (ngMode === 'same') {
        newPlayers = state.players
            .filter((_, i) => ngKeepSet.has(i))
            .map(p => ({ ...p, score: 0 }));
        if (newPlayers.length === 0) {
            alert('Sélectionne au moins un joueur !');
            return;
        }
    } else {
        if (ngNewPlayers.length === 0) {
            alert('Ajoute au moins un joueur !');
            return;
        }
        newPlayers = ngNewPlayers.map((name, i) => ({
            name, score: 0, color: COLORS[i % COLORS.length]
        }));
    }

    state.players = newPlayers;
    state.round = 1;
    state.history = [];
    state.dominoMax = ngDominoMax;

    document.getElementById('newGameModal').classList.remove('open');
    save(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── MODAL HELPERS ─── */
function closeBgModal(e, id) {
    if (e.target.id === id) document.getElementById(id).classList.remove('open');
}

/* ─── ENTER KEY ─── */
document.getElementById('newPlayerName').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const ngInput = document.getElementById('ngNewPlayerInput');
        if (document.activeElement === ngInput) ngAddPlayer();
    }
});

/* ─── INIT ─── */
load();
render();
setTimeout(() => {
    const hint = document.getElementById('installHint');
    if (hint) hint.style.display = 'none';
}, 8000);
const COLORS = ['#f5c542','#e05c2a','#3ddc84','#9b59f5','#38bdf8','#fb7185','#a3e635','#f97316'];
const SCORE_LIMIT = 100;

let state = {
    players: [],
    round: 1,
    history: [],      // { round, scores: {name: pts}, finisher: name|null, doubled: name|null }
    tempScores: {},
    tempFinisher: null
};

let ngMode = 'same';
let ngKeepSet = new Set();
let ngNewPlayers = [];

/* ─── PERSISTENCE ─── */
function save() {
    try { localStorage.setItem('skyjo_state', JSON.stringify(state)); } catch(e) {}
}
function load() {
    try {
        const s = localStorage.getItem('skyjo_state');
        if (s) state = { ...state, ...JSON.parse(s) };
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
    renderBadge();
    renderProgress();

    const btnNext = document.querySelector('.btn-next');
    if (btnNext) {
        const scored = roundHasScores();
        btnNext.style.opacity = scored ? '1' : '0.4';
    }
}

function renderBadge() {
    const badge = document.getElementById('roundBadge');
    const scored = roundHasScores();
    badge.textContent = (scored ? '\u2705 ' : '\u23f3 ') + 'Manche ' + state.round;
    badge.style.background = scored ? 'var(--green)' : 'var(--accent)';
    badge.style.color = scored ? '#0d2e1a' : '#1a0a2e';
}

function renderProgress() {
    const wrap = document.getElementById('progressWrap');
    const bar  = document.getElementById('progressBar');
    const lbl  = document.getElementById('progressLabel');
    if (state.players.length === 0) { wrap.style.display = 'none'; return; }
    const maxScore = Math.max(...state.players.map(p => p.score));
    if (maxScore <= 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const pct = Math.min(100, (maxScore / SCORE_LIMIT) * 100);
    bar.style.width = pct + '%';
    lbl.textContent = 'max ' + maxScore + ' / ' + SCORE_LIMIT;
}

function renderPlayers() {
    const list = document.getElementById('playersList');
    if (state.players.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="emoji">🃏</div><p>Aucun joueur encore.<br>Ajoute des joueurs pour commencer !</p></div>';
        return;
    }
    // Leader = moins de points (le meilleur score à Skyjo)
    const sorted = [...state.players].sort((a, b) => a.score - b.score);
    const leader = sorted[0];
    const rounds = state.history.length;

    list.innerHTML = state.players.map((p, i) => {
        const isLeader = p.name === leader.name && rounds > 0;
        const isDanger = p.score >= 75 && !isLeader;
        const scoreClass = p.score < 0 ? 'negative' : (p.score >= 75 ? 'danger-score' : '');
        let cardClass = '';
        if (isLeader) cardClass = 'leader';
        else if (isDanger) cardClass = 'danger';

        return '<div class="player-card ' + cardClass + '" style="--player-color:' + p.color + '">' +
            '<div class="player-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
            '<div class="player-info">' +
            '<div class="player-name">' + p.name + '</div>' +
            '<div class="player-details">' + (rounds > 0 ? rounds + ' manche' + (rounds > 1 ? 's' : '') + ' jouée' + (rounds > 1 ? 's' : '') : 'Prêt à jouer') + '</div>' +
            '</div>' +
            '<div><div class="player-score ' + scoreClass + '">' + p.score + '</div><div class="score-label">points</div></div>' +
            '<div class="player-actions"><div class="btn-icon danger" onclick="removePlayer(' + i + ')">🗑</div></div>' +
            '</div>';
    }).join('');
}

function renderHistory() {
    const section = document.getElementById('historySection');
    const list = document.getElementById('historyList');
    if (state.history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    // Afficher du plus récent au plus ancien
    list.innerHTML = [...state.history].reverse().map((h) => {
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
                return '<span class="history-score-entry"><strong>' + name + '</strong>: <span class="' + ptsClass + '">' + ptsStr + '</span></span>';
            }).join('') +
            '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    }).join('');
}

/* ─── SCORE MODAL ─── */
function openScoreModal() {
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempFinisher = existing ? existing.finisher : null;
    state.tempScores = {};
    state.players.forEach(p => {
        // Si correction : récupérer le score BRUT (avant doublement éventuel)
        if (existing) {
            state.tempScores[p.name] = existing.rawScores ? (existing.rawScores[p.name] || 0) : (existing.scores[p.name] || 0);
        } else {
            state.tempScores[p.name] = 0;
        }
    });

    document.getElementById('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderFinisherList();
    renderScoreInputs();
    updatePenaltyHint();
    document.getElementById('scoreModal').classList.add('open');
}

function renderFinisherList() {
    const list = document.getElementById('finisherList');
    list.innerHTML = '<button class="finisher-btn none-btn ' + (state.tempFinisher === null ? 'selected' : '') + '" onclick="selectFinisher(null)">Aucun / Passer</button>' +
        state.players.map(p =>
            '<button class="finisher-btn ' + (state.tempFinisher === p.name ? 'selected' : '') + '" onclick="selectFinisher(\'' + p.name + '\')">' +
            '<span class="fb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
        ).join('');
}

function selectFinisher(name) {
    state.tempFinisher = name;
    renderFinisherList();
    updatePenaltyHint();
}

function updatePenaltyHint() {
    const hint = document.getElementById('penaltyHint');
    const nameEl = document.getElementById('penaltyName');
    if (state.tempFinisher) {
        nameEl.textContent = state.tempFinisher;
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

function renderScoreInputs() {
    document.getElementById('scoreInputs').innerHTML = state.players.map((p, i) => {
        const val = state.tempScores[p.name] || 0;
        const isFinisher = state.tempFinisher === p.name;
        return '<div class="score-row ' + (isFinisher ? 'is-finisher' : '') + '" id="srow_' + i + '">' +
            (isFinisher ? '<div class="finisher-tag">A terminé !</div>' : '') +
            '<div class="avatar-sm" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
            '<div style="flex:1"><div class="name">' + p.name + '</div><div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',-1)">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" oninput="state.tempScores[\'' + p.name + '\']=parseInt(this.value)||0" />' +
            '<div class="score-stepper" onclick="stepScore(\'' + p.name + '\',1)">+</div>' +
            '</div>' +
            '</div>';
    }).join('');
}

function stepScore(name, delta) {
    const idx = state.players.findIndex(p => p.name === name);
    const inp = document.getElementById('inp_' + idx);
    const newVal = (parseInt(inp.value) || 0) + delta;
    inp.value = newVal;
    state.tempScores[name] = newVal;
}

function confirmScores() {
    // Lire les valeurs finales depuis les inputs
    state.players.forEach((p, i) => {
        const inp = document.getElementById('inp_' + i);
        state.tempScores[p.name] = parseInt(inp?.value) || 0;
    });

    const rawScores = { ...state.tempScores };
    const finalScores = { ...state.tempScores };
    let doubled = null;

    // Appliquer la pénalité de doublement si nécessaire
    if (state.tempFinisher) {
        const finisherRaw = rawScores[state.tempFinisher];
        const minScore = Math.min(...Object.values(rawScores));
        // Si le finisseur n'a pas STRICTEMENT le plus petit score et que son score est positif
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

    document.getElementById('scoreModal').classList.remove('open');
    save(); render();

    // Vérifier si quelqu'un a atteint 100+
    const triggered = state.players.find(p => p.score >= SCORE_LIMIT);
    if (triggered) {
        setTimeout(showWinner, 400);
    }
}

/* ─── ROUND ─── */
function showRoundError(msg) {
    let el = document.getElementById('roundError');
    if (!el) {
        el = document.createElement('div');
        el.id = 'roundError';
        el.style.cssText = 'background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);border-radius:10px;padding:9px 14px;font-size:0.8rem;color:var(--red);text-align:center;margin:10px 16px 0;animation:fadeIn 0.25s ease;';
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
        const btnScore = document.querySelector('.btn-score');
        if (btnScore) {
            btnScore.style.transform = 'scale(1.06)';
            setTimeout(() => btnScore.style.transform = '', 200);
        }
        return;
    }
    state.round++;
    save(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── WINNER ─── */
function showWinner() {
    const sorted = [...state.players].sort((a, b) => a.score - b.score);
    const winner = sorted[0];
    document.getElementById('winnerName').textContent = winner.name;
    document.getElementById('winnerScore').textContent = winner.score + ' points';

    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('winnerPodium').innerHTML = sorted.map((p, i) =>
        '<div class="podium-row">' +
        '<span class="podium-rank">' + (medals[i] || (i + 1) + '.') + '</span>' +
        '<span class="podium-name">' + p.name + '</span>' +
        '<span class="podium-pts">' + p.score + ' pts</span>' +
        '</div>'
    ).join('');

    document.getElementById('winnerScreen').classList.add('show');
}

function openNewGameFromWinner() {
    document.getElementById('winnerScreen').classList.remove('show');
    openNewGameModal();
}

/* ─── NEW GAME MODAL ─── */
function openNewGameModal() {
    ngMode = 'same';
    ngKeepSet = new Set(state.players.map((_, i) => i));
    ngNewPlayers = [];
    renderNgModeCards();
    renderNgKeepList();
    renderNgNewList();
    document.getElementById('newGameModal').classList.add('open');
}

function closeNewGameModal() {
    document.getElementById('newGameModal').classList.remove('open');
}

function selectPlayerMode(mode) {
    ngMode = mode;
    renderNgModeCards();
    document.getElementById('ng-keep-section').style.display = mode === 'same' ? 'block' : 'none';
    document.getElementById('ng-new-section').style.display  = mode === 'new'  ? 'block' : 'none';
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
        '<div class="keep-player-row ' + (ngKeepSet.has(i) ? 'checked' : '') + '" onclick="toggleKeepPlayer(' + i + ')">' +
        '<div class="kp-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
        '<div class="kp-name">' + p.name + '</div>' +
        '<div class="kp-check">' + (ngKeepSet.has(i) ? '\u2705' : '\u2b1c') + '</div>' +
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
        list.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0 8px">Aucun joueur ajouté.</div>';
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

function confirmNewGame() {
    let newPlayers = [];
    if (ngMode === 'same') {
        newPlayers = state.players.filter((_, i) => ngKeepSet.has(i)).map(p => ({ ...p, score: 0 }));
        if (newPlayers.length === 0) { alert('Sélectionne au moins un joueur !'); return; }
    } else {
        if (ngNewPlayers.length === 0) { alert('Ajoute au moins un joueur !'); return; }
        newPlayers = ngNewPlayers.map((name, i) => ({ name, score: 0, color: COLORS[i % COLORS.length] }));
    }
    state.players = newPlayers;
    state.round = 1;
    state.history = [];
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
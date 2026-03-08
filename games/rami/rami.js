const COLORS = ['#f5c542','#e05c2a','#3ddc84','#9b59f5','#38bdf8','#fb7185','#a3e635','#f97316'];
const STEP = 100; // incrément du stepper

let state = {
    players: [],
    round: 1,
    history: [],
    scoreLimit: 1000,   // null = infini, number = limite custom
    dealerIdx: 0,   // index du donneur actuel dans players[]
    tempWinner: null,
    tempNoPoseSet: new Set(),
    tempRamiSec: false,
    tempNoPoseActive: false
};

let ngMode = 'same';
let ngKeepSet = new Set();
let ngNewPlayers = [];
let ngDealerIdx = 0;
let ngScoreLimit = 1000;   // 1000 | null | number custom
let ngCustomLimit = 200;

/* ─── PERSISTENCE ─── */
function save() {
    try {
        const s = { ...state, tempNoPoseSet: [...state.tempNoPoseSet] };
        localStorage.setItem('rami_state', JSON.stringify(s));
    } catch(e) {}
}
function load() {
    try {
        const s = localStorage.getItem('rami_state');
        if (s) {
            const parsed = JSON.parse(s);
            parsed.tempNoPoseSet = new Set(parsed.tempNoPoseSet || []);
            state = { ...state, ...parsed };
        }
    } catch(e) {}
}

/* ─── UTILS ─── */
function getInitial(name) { return name.trim().charAt(0).toUpperCase(); }
function getDealerIdx() { return state.dealerIdx % state.players.length; }
function getNextDealerIdx() { return (state.dealerIdx + 1) % state.players.length; }

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
    if (state.dealerIdx >= state.players.length && state.players.length > 0) {
        state.dealerIdx = 0;
    }
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
    renderDealerBar();
    renderProgress();

    const btnNext = document.querySelector('.btn-next');
    if (btnNext) btnNext.style.opacity = roundHasScores() ? '1' : '0.4';
}

function renderBadge() {
    const badge = document.getElementById('roundBadge');
    const scored = roundHasScores();
    badge.textContent = (scored ? '\u2705 ' : '\u23f3 ') + 'Manche ' + state.round;
    badge.style.background = scored ? 'var(--green)' : 'var(--accent)';
    badge.style.color = scored ? '#0d2e1a' : '#1a0a2e';
}

function renderDealerBar() {
    const bar = document.getElementById('dealerBar');
    if (state.players.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const dealer = state.players[getDealerIdx()];
    const next   = state.players[getNextDealerIdx()];
    document.getElementById('dealerCurrentPill').textContent = dealer ? dealer.name : '—';
    document.getElementById('dealerNextName').textContent    = next ? next.name : '—';
}

function renderProgress() {
    const wrap = document.getElementById('progressWrap');
    const bar  = document.getElementById('progressBar');
    const lbl  = document.getElementById('progressLabel');
    if (state.players.length === 0) { wrap.style.display = 'none'; return; }
    const maxScore = Math.max(...state.players.map(p => p.score));
    if (maxScore <= 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    if (!state.scoreLimit) {
        bar.style.width = '0%';
        lbl.textContent = 'max sans limite (∞)';
        return;
    }
    const pct = Math.min(100, (maxScore / state.scoreLimit) * 100);
    bar.style.width = pct + '%';
    lbl.textContent = 'max ' + maxScore + ' / ' + state.scoreLimit;
}

function renderPlayers() {
    const list = document.getElementById('playersList');
    if (state.players.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="emoji">🃏</div><p>Aucun joueur encore.<br>Ajoute des joueurs pour commencer !</p></div>';
        return;
    }
    const rounds = state.history.length;
    const sorted = [...state.players].sort((a, b) => a.score - b.score);
    const leader = sorted[0];
    const dealerIdx = getDealerIdx();
    const dangerThreshold = state.scoreLimit ? Math.floor(state.scoreLimit * 0.7) : null;

    list.innerHTML = state.players.map((p, i) => {
        const isLeader = p.name === leader.name && rounds > 0;
        const isDanger = dangerThreshold !== null && p.score >= dangerThreshold && !isLeader;
        const isDealer = i === dealerIdx;
        let cardClass = isDealer ? 'is-dealer' : '';
        if (isLeader) cardClass += ' leader';
        else if (isDanger) cardClass += ' danger';
        const scoreClass = (dangerThreshold !== null && p.score >= dangerThreshold) ? 'danger-score' : (p.score === 0 ? 'zero-score' : '');

        return '<div class="player-card ' + cardClass.trim() + '" style="--player-color:' + p.color + '">' +
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

    list.innerHTML = [...state.history].reverse().map(h => {
        const tags = [];
        if (h.ramiSec) tags.push('<span class="h-tag rami-sec">⚡ Rami sec</span>');
        if (h.noPose && h.noPose.length > 0) tags.push('<span class="h-tag no-pose">🚫 Sans pose</span>');
        const header = '<div class="history-item-header"><span class="history-round-num">Manche ' + h.round + '</span>' +
            (tags.length ? '<div class="history-tags">' + tags.join('') + '</div>' : '') + '</div>';
        const scores = '<div class="history-scores">' +
            Object.entries(h.scores).map(([name, pts]) => {
                const isWinner = h.winner === name;
                const cls = pts < 0 ? 'bonus' : (pts >= 200 ? 'penalty' : '');
                const prefix = pts <= 0 ? '' : '+';
                return '<span class="h-score"><strong>' + name + '</strong>: <span class="val ' + cls + '">' + prefix + pts + '</span>' + (isWinner ? ' 🏆' : '') + '</span>';
            }).join('') + '</div>';
        return '<div class="history-item">' + header + scores + '</div>';
    }).join('');
}

/* ─── SCORE MODAL ─── */
function openScoreModal() {
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }

    const existing = state.history.find(h => h.round === state.round);
    state.tempWinner = existing ? existing.winner : null;
    state.tempRamiSec = existing ? !!existing.ramiSec : true;
    state.tempNoPoseActive = existing ? (existing.noPose && existing.noPose.length > 0) : false;
    state.tempNoPoseSet = new Set(existing && existing.noPose ? existing.noPose : []);

    document.getElementById('modalSub').textContent = 'Manche ' + state.round + ' — points de chaque joueur';
    renderWinnerPicker();
    renderSpecialBtns();
    renderNoPoseSection();
    renderScoreInputs();
    document.getElementById('scoreModal').classList.add('open');
}

function renderWinnerPicker() {
    // Ajouter le hint si absent
    const block = document.querySelector('.modal-block');
    if (block && !document.getElementById('winnerRequiredHint')) {
        const hint = document.createElement('div');
        hint.id = 'winnerRequiredHint';
        hint.style.cssText = 'display:none;margin-top:8px;background:rgba(255,85,85,0.12);border:1px solid rgba(255,85,85,0.35);border-radius:10px;padding:8px 12px;font-size:0.78rem;color:var(--red);text-align:center;';
        hint.textContent = '⚠️ Sélectionne qui a fait Rami avant de confirmer !';
        block.appendChild(hint);
    }
    const list = document.getElementById('winnerRoundList');
    list.innerHTML = state.players.map(p =>
        '<button class="picker-btn ' + (state.tempWinner === p.name ? 'selected' : '') + '" onclick="selectWinner(\'' + p.name + '\')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
    ).join('');
}

function selectWinner(name) {
    state.tempWinner = name;
    // Le gagnant ne peut pas être sans pose
    state.tempNoPoseSet.delete(name);
    renderWinnerPicker();
    renderScoreInputs();
}

function renderSpecialBtns() {
    document.getElementById('specialBtns').innerHTML =
        '<button class="special-btn ' + (state.tempRamiSec ? 'active' : '') + '" id="btnRamiSec" onclick="toggleRamiSec()">' +
        '<span class="sb-icon">⚡</span><span class="sb-text">Rami sec</span><span class="sb-sub">Perdants +200 pts chacun</span></button>' +
        '<button class="special-btn ' + (state.tempNoPoseActive ? 'active' : '') + '" id="btnNoPose" onclick="toggleNoPose()">' +
        '<span class="sb-icon">🚫</span><span class="sb-text">Sans pose</span><span class="sb-sub">+100 pts automatique</span></button>';
}

function toggleRamiSec() {
    state.tempRamiSec = !state.tempRamiSec;
    renderSpecialBtns();
    renderScoreInputs();
}

function toggleNoPose() {
    state.tempNoPoseActive = !state.tempNoPoseActive;
    if (!state.tempNoPoseActive) state.tempNoPoseSet.clear();
    renderSpecialBtns();
    renderNoPoseSection();
    renderScoreInputs();
}

function renderNoPoseSection() {
    const section = document.getElementById('noPoseSection');
    if (!state.tempNoPoseActive) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    document.getElementById('noPoseList').innerHTML = state.players
        .filter(p => p.name !== state.tempWinner)
        .map(p =>
            '<button class="picker-btn ' + (state.tempNoPoseSet.has(p.name) ? 'selected' : '') + '" onclick="toggleNoPosePlayer(\'' + p.name + '\')">' +
            '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
        ).join('');
}

function toggleNoPosePlayer(name) {
    if (state.tempNoPoseSet.has(name)) state.tempNoPoseSet.delete(name);
    else state.tempNoPoseSet.add(name);
    renderNoPoseSection();
    renderScoreInputs();
}

function renderScoreInputs() {
    document.getElementById('scoreInputs').innerHTML = state.players.map((p, i) => {
        const isWinner = state.tempWinner === p.name;
        const isNoPose = state.tempNoPoseSet.has(p.name);
        const isRamiSecLoser = state.tempRamiSec && !isWinner;

        let val = 0;
        if (isWinner) val = -10;        // bonus gagnant
        else if (isNoPose) val = 100;   // sans pose forcé
        else if (isRamiSecLoser) val = 200; // rami sec forcé

        // Récupérer valeur existante si ni forcé ni gagnant
        const existing = state.history.find(h => h.round === state.round);
        if (existing && !isWinner && !isNoPose && !isRamiSecLoser) {
            val = existing.rawScores ? (existing.rawScores[p.name] || 0) : (existing.scores[p.name] || 0);
        }

        const locked = isWinner || isNoPose || isRamiSecLoser;
        let rowTag = '';
        if (isWinner) rowTag = '<div class="row-tag winner-tag">🏆 Gagnant −10</div>';
        else if (isRamiSecLoser) rowTag = '<div class="row-tag ramiSec-tag">⚡</div>';
        else if (isNoPose) rowTag = '<div class="row-tag noPose-tag">🚫 Sans pose</div>';

        return '<div class="score-row ' + (isWinner ? 'is-winner' : '') + (isNoPose ? ' is-noPose' : '') + (locked ? ' locked' : '') + '" id="srow_' + i + '">' +
            rowTag +
            '<div class="avatar-sm" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
            '<div class="row-info"><div class="name">' + p.name + '</div><div class="current">Total : ' + p.score + '</div></div>' +
            '<div class="score-input-wrap">' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + (-STEP) + ')">−</div>' +
            '<input type="number" id="inp_' + i + '" value="' + val + '" oninput="onInputChange(' + i + ')" />' +
            '<div class="score-stepper" onclick="stepScore(' + i + ',' + STEP + ')">+</div>' +
            '</div></div>';
    }).join('');
}

function stepScore(idx, delta) {
    const inp = document.getElementById('inp_' + idx);
    if (!inp) return;
    const newVal = Math.max(0, (parseInt(inp.value) || 0) + delta);
    inp.value = newVal;
}

function onInputChange(idx) {
    // rien de spécial, juste laisser l'input libre
}

function confirmScores() {
    if (!state.tempWinner) {
        const hint = document.getElementById('winnerRequiredHint');
        if (hint) {
            hint.style.display = 'block';
            setTimeout(() => hint.style.display = 'none', 2500);
        }
        // Faire vibrer la section picker
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
        else pts = parseInt(document.getElementById('inp_' + i)?.value) || 0;

        scores[p.name] = pts;
        rawScores[p.name] = pts;
    });

    const existingIdx = state.history.findIndex(h => h.round === state.round);

    // Appliquer les scores (correction si existant)
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

    document.getElementById('scoreModal').classList.remove('open');
    save(); render();

    // Vérifier fin de partie
    if (state.scoreLimit && state.players.some(p => p.score >= state.scoreLimit)) {
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
        document.querySelector('header').insertAdjacentElement('afterend', el);
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
        if (btnScore) { btnScore.style.transform = 'scale(1.06)'; setTimeout(() => btnScore.style.transform = '', 200); }
        return;
    }
    state.round++;
    // Avancer le donneur
    state.dealerIdx = (state.dealerIdx + 1) % state.players.length;
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
        '<div class="podium-row"><span class="podium-rank">' + (medals[i] || (i+1) + '.') + '</span>' +
        '<span class="podium-name">' + p.name + '</span>' +
        '<span class="podium-pts">' + p.score + ' pts</span></div>'
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
    ngDealerIdx = 0;
    ngScoreLimit = (state.scoreLimit !== undefined) ? state.scoreLimit : 1000;
    ngCustomLimit = (ngScoreLimit && ngScoreLimit !== 1000) ? ngScoreLimit : 200;
    renderNgModeCards();
    renderNgKeepList();
    renderNgNewList();
    renderNgDealerList();
    renderNgScoreLimit();
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
    renderNgDealerList();
}

function renderNgModeCards() {
    document.getElementById('cc-same').classList.toggle('selected', ngMode === 'same');
    document.getElementById('cc-new').classList.toggle('selected', ngMode === 'new');
}

function renderNgKeepList() {
    const list = document.getElementById('ngKeepList');
    if (state.players.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">Aucun joueur.</div>'; return; }
    list.innerHTML = state.players.map((p, i) =>
        '<div class="keep-player-row ' + (ngKeepSet.has(i) ? 'checked' : '') + '" onclick="toggleKeepPlayer(' + i + ')">' +
        '<div class="kp-avatar" style="background:' + p.color + '">' + getInitial(p.name) + '</div>' +
        '<div class="kp-name">' + p.name + '</div>' +
        '<div class="kp-check">' + (ngKeepSet.has(i) ? '\u2705' : '\u2b1c') + '</div></div>'
    ).join('');
}

function toggleKeepPlayer(i) {
    if (ngKeepSet.has(i)) ngKeepSet.delete(i); else ngKeepSet.add(i);
    ngDealerIdx = 0;
    renderNgKeepList();
    renderNgDealerList();
}

function renderNgNewList() {
    const list = document.getElementById('ngNewList');
    if (ngNewPlayers.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0 8px">Aucun joueur ajouté.</div>'; return; }
    list.innerHTML = ngNewPlayers.map((p, i) =>
        '<div class="new-player-row">' +
        '<div class="np-avatar" style="background:' + COLORS[i % COLORS.length] + '">' + getInitial(p) + '</div>' +
        '<div class="np-name">' + p + '</div>' +
        '<div class="np-remove" onclick="ngRemovePlayer(' + i + ')">✕</div></div>'
    ).join('');
}

function ngAddPlayer() {
    const input = document.getElementById('ngNewPlayerInput');
    const name = input.value.trim();
    if (!name) return;
    if (ngNewPlayers.find(n => n.toLowerCase() === name.toLowerCase())) {
        input.style.borderColor = 'var(--red)'; setTimeout(() => input.style.borderColor = '', 800); return;
    }
    ngNewPlayers.push(name);
    input.value = '';
    ngDealerIdx = 0;
    renderNgNewList();
    renderNgDealerList();
}

function ngRemovePlayer(i) {
    ngNewPlayers.splice(i, 1);
    ngDealerIdx = 0;
    renderNgNewList();
    renderNgDealerList();
}

function renderNgDealerList() {
    const section = document.getElementById('ng-dealer-section');
    const list = document.getElementById('ngDealerList');
    // Construire la liste des joueurs qui seront dans la partie
    let players = [];
    if (ngMode === 'same') {
        players = state.players.filter((_, i) => ngKeepSet.has(i));
    } else {
        players = ngNewPlayers.map((name, i) => ({ name, color: COLORS[i % COLORS.length] }));
    }
    if (players.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = players.map((p, i) =>
        '<button class="picker-btn ' + (ngDealerIdx === i ? 'selected' : '') + '" onclick="selectNgDealer(' + i + ')">' +
        '<span class="pb-dot" style="background:' + p.color + '"></span>' + p.name + '</button>'
    ).join('');
}

function selectNgDealer(i) {
    ngDealerIdx = i;
    renderNgDealerList();
}

/* ─── SCORE LIMIT SELECTOR ─── */
function renderNgScoreLimit() {
    const section = document.getElementById('ng-limit-section');
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
            return '<button class="limit-card ' + (active ? 'active' : '') + '" onclick="selectNgScoreMode(' + onclickVal + ')">' +
                '<div class="lc-label">' + m.label + '</div>' +
                '<div class="lc-sub">' + m.sub + '</div>' +
                '</button>';
        }).join('') +
        '</div>' +
        (isCustom
            ? '<div class="custom-limit-wrap">' +
            '<input type="number" id="ngCustomLimitInput" value="' + ngCustomLimit + '" min="200" step="100" placeholder="ex: 500" oninput="onNgCustomLimitInput()" />' +
            '<span class="custom-limit-unit">pts (min. 200)</span>' +
            '</div>'
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
    const inp = document.getElementById('ngCustomLimitInput');
    const v = parseInt(inp.value) || 200;
    ngCustomLimit = Math.max(200, v);
    ngScoreLimit = ngCustomLimit;
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
    state.dealerIdx = ngDealerIdx;
    state.scoreLimit = ngScoreLimit;
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
        const ng = document.getElementById('ngNewPlayerInput');
        if (document.activeElement === ng) ngAddPlayer();
    }
});

/* ─── INIT ─── */
load();
render();
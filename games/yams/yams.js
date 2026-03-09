/* ═══════════════════════════════════════════
   yams.js — Yam's (Yahtzee)
   Utilise BoardScore.create() de core.js

   Règles :
   - 13 tours par joueur (13 catégories à remplir)
   - Tour par tour
   - Section haute : As,Deux,Trois,Quatre,Cinq,Six → bonus +35 si ≥63
   - Section basse : Brelan, Carré, Full(25), Pte suite(30),
     Gde suite(40), Yam's(50), Chance
   ═══════════════════════════════════════════ */

const CATEGORIES = [
    { id: 'ones',   name: 'As',     section: 'upper', max: 5,  type: 'number', icon: '1️⃣' },
    { id: 'twos',   name: 'Deux',   section: 'upper', max: 10, type: 'number', icon: '2️⃣' },
    { id: 'threes', name: 'Trois',  section: 'upper', max: 15, type: 'number', icon: '3️⃣' },
    { id: 'fours',  name: 'Quatre', section: 'upper', max: 20, type: 'number', icon: '4️⃣' },
    { id: 'fives',  name: 'Cinq',   section: 'upper', max: 25, type: 'number', icon: '5️⃣' },
    { id: 'sixes',  name: 'Six',    section: 'upper', max: 30, type: 'number', icon: '6️⃣' },
    { id: 'threeK', name: 'Brelan',     section: 'lower', max: 30, type: 'number', icon: '3X' },
    { id: 'fourK',  name: 'Carré',      section: 'lower', max: 30, type: 'number', icon: '4X' },
    { id: 'full',   name: 'Full',       section: 'lower', fixed: 25, type: 'check', icon: 'FH' },
    { id: 'smStr',  name: 'Pte suite',  section: 'lower', fixed: 30, type: 'check', icon: 'S◻' },
    { id: 'lgStr',  name: 'Gde suite',  section: 'lower', fixed: 40, type: 'check', icon: 'L◻' },
    { id: 'yams',   name: "Yam's",      section: 'lower', fixed: 50, type: 'check', icon: '🎲' },
    { id: 'chance', name: 'Chance',      section: 'lower', max: 30, type: 'number', icon: 'CH' },
];

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;
const TOTAL_TURNS = 13;

let ngFirstIdx = 0;

function emptySheet() {
    const s = {};
    CATEGORIES.forEach(c => s[c.id] = null);
    return s;
}
function upperTotal(s) { return CATEGORIES.filter(c=>c.section==='upper').reduce((a,c)=>a+(s[c.id]||0),0); }
function lowerTotal(s) { return CATEGORIES.filter(c=>c.section==='lower').reduce((a,c)=>a+(s[c.id]||0),0); }
function bonus(s) { return upperTotal(s) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0; }
function grandTotal(s) { return upperTotal(s) + bonus(s) + lowerTotal(s); }
function filled(s) { return CATEGORIES.filter(c=>s[c.id]!==null).length; }
function gameOver(st) { return st.players.length>0 && st.players.every(p=>filled(st.sheets[p.name]||{})>=TOTAL_TURNS); }
function curPlayer(st) { return st.players[st.currentPlayerIdx] || null; }

const game = BoardScore.create({
    key: 'yams',
    emptyEmoji: '🎲',
    highestWins: true,
    defaultState: {
        players: [], round: 1, history: [],
        currentPlayerIdx: 0,
        sheets: {},
        turnPending: {},
    },
    onDeserialize(p) {
        if (!p.sheets) p.sheets = {};
        if (!p.turnPending) p.turnPending = {};
        return p;
    },
    buildBadgeText(state) {
        const total = state.players.length * TOTAL_TURNS;
        const done = state.players.reduce((s,p) => s + filled(state.sheets[p.name]||{}), 0);
        return '🎲 Tour ' + Math.min(done+1, total) + ' / ' + total;
    },
    getPlayerCardExtras(p, i, state) {
        const cur = i === state.currentPlayerIdx && !gameOver(state);
        return { cardClass: cur ? 'is-current' : '', afterName: cur ? ' 🎲' : '' };
    },
    onRender(state) {
        state.players.forEach(p => {
            const s = state.sheets[p.name] || {};
            p.score = grandTotal(s);
        });
        renderTurnBar(state);
        renderYamsHistory(state);
    },
    buildHistoryItem() { return ''; },
    onOpenNewGameModal() { ngFirstIdx = 0; renderNgFirst(); },
    onSelectPlayerMode() { renderNgFirst(); },
    onToggleKeepPlayer() { ngFirstIdx = 0; renderNgFirst(); },
    onNgPlayersChanged() { ngFirstIdx = 0; renderNgFirst(); },
    onConfirmNewGame(state) {
        state.currentPlayerIdx = ngFirstIdx;
        state.sheets = {};
        state.turnPending = {};
        state.players.forEach(p => state.sheets[p.name] = emptySheet());
    },
    onRemovePlayer(state) {
        if (state.currentPlayerIdx >= state.players.length && state.players.length > 0)
            state.currentPlayerIdx = 0;
    },
});

/* ── Turn bar ── */
function renderTurnBar(state) {
    const bar = BoardScore.$('turnBar');
    if (!bar) return;
    if (state.players.length === 0 || gameOver(state)) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const c = curPlayer(state);
    const nIdx = (state.currentPlayerIdx + 1) % state.players.length;
    BoardScore.$('turnCurrentPill').textContent = c ? c.name : '—';
    BoardScore.$('turnNextName').textContent = state.players[nIdx] ? state.players[nIdx].name : '—';
}

/* ── Score modal ── */
function openScoreModal() {
    const state = game.getState();
    if (state.players.length === 0) { alert('Ajoute au moins un joueur !'); return; }
    if (gameOver(state)) { game.showWinner(); return; }
    state.players.forEach(p => { if (!state.sheets[p.name]) state.sheets[p.name] = emptySheet(); });
    state.turnPending = {};
    const c = curPlayer(state);
    BoardScore.$('scoreModalTitle').textContent = '🎲 Tour de ' + c.name;
    BoardScore.$('modalSub').textContent = 'Choisis une catégorie et entre ton score';
    renderSheet();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderSheet() {
    const state = game.getState();
    const c = curPlayer(state);
    const sheet = state.sheets[c.name];
    const pending = state.turnPending;
    const uCats = CATEGORIES.filter(c=>c.section==='upper');
    const lCats = CATEGORIES.filter(c=>c.section==='lower');
    const uTot = upperTotal(sheet);

    function row(cat) {
        const done = sheet[cat.id] !== null;
        const isPend = pending.catId === cat.id;
        const disabled = done && !isPend;
        let inp = '';
        if (cat.type === 'check') {
            const on = isPend ? pending.value > 0 : (done && sheet[cat.id] > 0);
            inp = '<button class="sh-check ' + (on?'on':'') + ' ' + (disabled?'dis':'') + '" ' +
                (disabled ? '' : 'onclick="toggleCheck(\''+cat.id+'\','+cat.fixed+')"') + '>' +
                (on ? '✓' : '') + '</button><span class="sh-fix">' + cat.fixed + '</span>';
        } else {
            const v = isPend ? pending.value : (done ? sheet[cat.id] : '');
            inp = '<input type="number" class="sh-inp" id="sh_'+cat.id+'" value="'+(v===''||v===null?'':v)+'" ' +
                'min="0" max="'+cat.max+'" placeholder="–" ' + (disabled?'disabled ':'') +
                'onfocus="shFocus(\''+cat.id+'\')" oninput="shInput(\''+cat.id+'\','+cat.max+')" />';
        }
        return '<div class="sh-row ' + (disabled?'done':'') + ' ' + (isPend?'pend':'') + '">' +
            '<span class="sh-icon">' + cat.icon + '</span>' +
            '<span class="sh-name">' + cat.name + '</span>' +
            '<div class="sh-inp-area">' + inp + '</div></div>';
    }

    let h = '<div class="sh-label">Section haute</div>' + uCats.map(row).join('');
    h += '<div class="sh-sub"><span>Sous-total</span><span>' + uTot + ' / 63</span></div>';
    h += '<div class="sh-sub ' + (uTot>=63?'earned':'') + '"><span>Bonus</span><span>' + (uTot>=63?'+35':'–') + '</span></div>';
    h += '<div class="sh-label">Section basse</div>' + lCats.map(row).join('');
    h += '<div class="sh-grand"><span>Total</span><span>' + grandTotal(sheet) + '</span></div>';

    BoardScore.$('scoreSheet').innerHTML = h;
}

function shFocus(id) {
    const state = game.getState();
    const p = state.turnPending;
    if (p.catId && p.catId !== id) {
        const old = BoardScore.$('sh_' + p.catId);
        if (old) old.value = '';
    }
    state.turnPending = { catId: id, value: 0 };
}

function shInput(id, max) {
    const inp = BoardScore.$('sh_' + id);
    if (!inp) return;
    let v = parseInt(inp.value) || 0;
    if (v > max) { v = max; inp.value = v; }
    if (v < 0) { v = 0; inp.value = v; }
    game.getState().turnPending = { catId: id, value: v };
}

function toggleCheck(id, fixed) {
    const state = game.getState();
    const p = state.turnPending;
    if (p.catId === id && p.value > 0) state.turnPending = { catId: id, value: 0 };
    else state.turnPending = { catId: id, value: fixed };
    renderSheet();
}

function confirmTurn() {
    const state = game.getState();
    const p = state.turnPending;
    if (!p.catId) { game.showRoundError('⚠️ Choisis une catégorie !'); return; }
    const c = curPlayer(state);
    const sheet = state.sheets[c.name];
    sheet[p.catId] = p.value || 0;
    c.score = grandTotal(sheet);
    const cat = CATEGORIES.find(x=>x.id===p.catId);
    state.history.push({
        round: state.history.length+1,
        player: c.name, category: cat ? cat.icon + ' ' + cat.name : p.catId,
        value: sheet[p.catId],
        scores: Object.fromEntries(state.players.map(pl=>[pl.name, grandTotal(state.sheets[pl.name]||{})]))
    });
    state.turnPending = {};
    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
    BoardScore.$('scoreModal').classList.remove('open');
    game.save(); game.render();
    if (gameOver(state)) setTimeout(() => game.showWinner(), 400);
}

/* ── History ── */
function renderYamsHistory(state) {
    const section = BoardScore.$('historySection');
    const list = BoardScore.$('historyList');
    if (!section || !list) return;
    if (!state.history.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = [...state.history].reverse().slice(0,20).map(h =>
        '<div class="history-item"><div class="history-item-header">' +
        '<span class="history-round-num">' + h.player + '</span>' +
        '<span class="h-tag yams-cat">' + h.category + '</span></div>' +
        '<div class="history-scores"><span class="h-score"><span class="val ' +
        (h.value > 0 ? '' : 'penalty') + '">' + (h.value > 0 ? '+'+h.value : '0') +
        '</span></span></div></div>'
    ).join('');
}

/* ── Compare modal ── */
function openCompareModal() {
    const state = game.getState();
    if (!state.players.length) return;
    const cols = state.players.length;
    let h = '<div class="cmp-grid" style="grid-template-columns:auto ' + '1fr '.repeat(cols) + '">';
    h += '<div class="cmp-h"></div>';
    state.players.forEach(p => {
        h += '<div class="cmp-h"><div class="cmp-av" style="background:'+p.color+'">'+BoardScore.getInitial(p.name)+'</div>'+p.name+'</div>';
    });
    h += '<div class="cmp-sec" style="grid-column:1/-1">Section haute</div>';
    CATEGORIES.filter(c=>c.section==='upper').forEach(c => {
        h += '<div class="cmp-c">' + c.icon + ' ' + c.name + '</div>';
        state.players.forEach(p => {
            const v = (state.sheets[p.name]||{})[c.id];
            h += '<div class="cmp-v ' + (v===null?'empty':'') + '">' + (v!==null?v:'–') + '</div>';
        });
    });
    h += '<div class="cmp-c cmp-tot">Sous-total</div>';
    state.players.forEach(p => h += '<div class="cmp-v cmp-tot">' + upperTotal(state.sheets[p.name]||{}) + '</div>');
    h += '<div class="cmp-c cmp-tot">Bonus</div>';
    state.players.forEach(p => { const b = bonus(state.sheets[p.name]||{}); h += '<div class="cmp-v cmp-tot ' + (b?'earned':'') + '">' + (b?'+35':'–') + '</div>'; });
    h += '<div class="cmp-sec" style="grid-column:1/-1">Section basse</div>';
    CATEGORIES.filter(c=>c.section==='lower').forEach(c => {
        h += '<div class="cmp-c">' + c.icon + ' ' + c.name + '</div>';
        state.players.forEach(p => {
            const v = (state.sheets[p.name]||{})[c.id];
            h += '<div class="cmp-v ' + (v===null?'empty':'') + '">' + (v!==null?v:'–') + '</div>';
        });
    });
    h += '<div class="cmp-c cmp-grand">TOTAL</div>';
    state.players.forEach(p => h += '<div class="cmp-v cmp-grand">' + grandTotal(state.sheets[p.name]||{}) + '</div>');
    h += '</div>';
    BoardScore.$('compareContent').innerHTML = h;
    BoardScore.$('compareModal').classList.add('open');
}

/* ── New Game first player ── */
function renderNgFirst() {
    const state = game.getState();
    const sec = BoardScore.$('ng-first-section');
    const list = BoardScore.$('ngFirstPlayerList');
    if (!sec||!list) return;
    let pls = [];
    if (game.getNgMode()==='same') { const k=game.getNgKeepSet(); pls=state.players.filter((_,i)=>k.has(i)); }
    else pls = game.getNgNewPlayers().map((n,i)=>({name:n,color:BoardScore.COLORS[i%BoardScore.COLORS.length]}));
    if (!pls.length) { sec.style.display='none'; return; }
    sec.style.display='block';
    list.innerHTML = pls.map((p,i) =>
        '<button class="picker-btn '+(ngFirstIdx===i?'selected':'')+'" onclick="selectNgFirstPlayer('+i+')">' +
        '<span class="pb-dot" style="background:'+p.color+'"></span>'+p.name+'</button>'
    ).join('');
}
function selectNgFirstPlayer(i) { ngFirstIdx=i; renderNgFirst(); }

function nextRound() { openScoreModal(); }

function addPlayer() { game.addPlayer(); const st=game.getState(); st.players.forEach(p=>{if(!st.sheets[p.name])st.sheets[p.name]=emptySheet();}); game.save(); game.render(); }
function removePlayer(i) { game.removePlayer(i); }
function openNewGameModal() { game.openNewGameModal(); }
function closeNewGameModal() { game.closeNewGameModal(); }
function selectPlayerMode(m) { game.selectPlayerMode(m); }
function toggleKeepPlayer(i) { game.toggleKeepPlayer(i); }
function ngAddPlayer() { game.ngAddPlayer(); }
function ngRemovePlayer(i) { game.ngRemovePlayer(i); }
function confirmNewGame() { game.confirmNewGame(); }
function openNewGameFromWinner() { game.openNewGameFromWinner(); }
function closeBgModal(e,id) { game.closeBgModal(e,id); }

game.init();
// Les sheets sont initialisées par onConfirmNewGame lors de la première visite (modale auto)
// ou par la persistence (load). Pour la sécurité, on s'assure qu'elles existent.
(function ensureSheets() {
    const st = game.getState();
    if (st.players.length > 0) {
        let needsSave = false;
        st.players.forEach(p => {
            if (!st.sheets[p.name]) { st.sheets[p.name] = emptySheet(); needsSave = true; }
        });
        if (needsSave) { game.save(); game.render(); }
    }
})();
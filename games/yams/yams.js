/* ═══════════════════════════════════════════
   yams.js — Yam's (Yahtzee)
   Utilise BoardScore.create() de core.js
   ═══════════════════════════════════════════ */

const CATEGORIES = [
    // Section haute : sélecteur × combien de dés (0-5)
    { id: 'ones',   name: 'As',     section: 'upper', face: 1, type: 'dice', icon: '⚀' },
    { id: 'twos',   name: 'Deux',   section: 'upper', face: 2, type: 'dice', icon: '⚁' },
    { id: 'threes', name: 'Trois',  section: 'upper', face: 3, type: 'dice', icon: '⚂' },
    { id: 'fours',  name: 'Quatre', section: 'upper', face: 4, type: 'dice', icon: '⚃' },
    { id: 'fives',  name: 'Cinq',   section: 'upper', face: 5, type: 'dice', icon: '⚄' },
    { id: 'sixes',  name: 'Six',    section: 'upper', face: 6, type: 'dice', icon: '⚅' },
    // Section basse
    { id: 'threeK', name: 'Brelan',      section: 'lower', type: 'ofkind', mult: 3, icon: '3X' },
    { id: 'fourK',  name: 'Carré',       section: 'lower', type: 'ofkind', mult: 4, icon: '4X' },
    { id: 'full',   name: 'Full',        section: 'lower', type: 'check', fixed: 25, icon: 'FH' },
    { id: 'smStr',  name: 'Pte suite',   section: 'lower', type: 'check', fixed: 30, icon: 'S◻' },
    { id: 'lgStr',  name: 'Gde suite',   section: 'lower', type: 'check', fixed: 40, icon: 'L◻' },
    { id: 'yams',   name: "Yam's",       section: 'lower', type: 'check', fixed: 50, icon: '🎲' },
    { id: 'chance', name: 'Chance',       section: 'lower', type: 'chance', max: 30, icon: 'CH' },
];

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;
const TOTAL_TURNS = 13;

let ngFirstIdx = 0;
let sacrificeMode = false;

function emptySheet() { const s = {}; CATEGORIES.forEach(c => s[c.id] = null); return s; }
function upperTotal(s) { return CATEGORIES.filter(c=>c.section==='upper').reduce((a,c)=>a+(s[c.id]||0),0); }
function lowerTotal(s) { return CATEGORIES.filter(c=>c.section==='lower').reduce((a,c)=>a+(s[c.id]||0),0); }
function bonus(s) { return upperTotal(s)>=UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0; }
function grandTotal(s) { return upperTotal(s)+bonus(s)+lowerTotal(s); }
function filled(s) { return CATEGORIES.filter(c=>s[c.id]!==null).length; }
function gameOver(st) { return st.players.length>0 && st.players.every(p=>filled(st.sheets[p.name]||{})>=TOTAL_TURNS); }
function curPlayer(st) { return st.players[st.currentPlayerIdx]||null; }

const game = BoardScore.create({
    key: 'yams', emptyEmoji: '🎲', highestWins: true,
    defaultState: {
        players:[], round:1, history:[],
        currentPlayerIdx:0, sheets:{}, turnPending:{},
    },
    onDeserialize(p) { if(!p.sheets) p.sheets={}; if(!p.turnPending) p.turnPending={}; return p; },
    buildBadgeText(state) {
        const total=state.players.length*TOTAL_TURNS;
        const done=state.players.reduce((s,p)=>s+filled(state.sheets[p.name]||{}),0);
        return '🎲 Tour '+Math.min(done+1,total)+' / '+total;
    },
    getPlayerCardExtras(p,i,state) {
        const cur=i===state.currentPlayerIdx && !gameOver(state);
        return { cardClass: cur?'is-current':'', afterName: cur?' 🎲':'' };
    },
    onRender(state) {
        state.players.forEach(p=>{ p.score = grandTotal(state.sheets[p.name]||{}); });
        renderTurnBar(state);
        renderYamsHistory(state);
    },
    buildHistoryItem() { return ''; },
    onOpenNewGameModal() { ngFirstIdx=0; renderNgFirst(); },
    onSelectPlayerMode() { renderNgFirst(); },
    onToggleKeepPlayer() { ngFirstIdx=0; renderNgFirst(); },
    onNgPlayersChanged() { ngFirstIdx=0; renderNgFirst(); },
    onConfirmNewGame(state) {
        state.currentPlayerIdx=ngFirstIdx;
        state.sheets={}; state.turnPending={};
        state.players.forEach(p=>state.sheets[p.name]=emptySheet());
    },
    onRemovePlayer(state) {
        if(state.currentPlayerIdx>=state.players.length && state.players.length>0) state.currentPlayerIdx=0;
    },
});

/* ── Turn bar ── */
function renderTurnBar(state) {
    const bar=BoardScore.$('turnBar'); if(!bar) return;
    if(!state.players.length||gameOver(state)){bar.style.display='none';return;}
    bar.style.display='flex';
    const c=curPlayer(state);
    const nIdx=(state.currentPlayerIdx+1)%state.players.length;
    BoardScore.$('turnCurrentPill').textContent=c?c.name:'—';
    BoardScore.$('turnNextName').textContent=state.players[nIdx]?state.players[nIdx].name:'—';
}

/* ═══════════════════════════════════
   SCORE MODAL
   ═══════════════════════════════════ */
function openScoreModal() {
    const state=game.getState();
    if(!state.players.length){alert('Ajoute au moins un joueur !');return;}
    if(gameOver(state)){game.showWinner();return;}
    state.players.forEach(p=>{if(!state.sheets[p.name]) state.sheets[p.name]=emptySheet();});
    state.turnPending={};
    sacrificeMode=false;
    const c=curPlayer(state);
    BoardScore.$('scoreModalTitle').textContent='🎲 Tour de '+c.name;
    BoardScore.$('modalSub').textContent='Choisis une catégorie et entre ton score';
    renderSheet();
    BoardScore.$('scoreModal').classList.add('open');
}

function renderSheet() {
    const state=game.getState();
    const c=curPlayer(state);
    const sheet=state.sheets[c.name];
    const pending=state.turnPending;
    const uCats=CATEGORIES.filter(c=>c.section==='upper');
    const lCats=CATEGORIES.filter(c=>c.section==='lower');
    const uTot=upperTotal(sheet);

    // Sacrifice hint
    const hintEl=BoardScore.$('sacrificeHint');
    if(hintEl) hintEl.style.display=sacrificeMode?'block':'none';
    const btnSkip=BoardScore.$('btnSkip');
    if(btnSkip){
        if(sacrificeMode){btnSkip.textContent='↩ Annuler';btnSkip.setAttribute('onclick','cancelSacrifice()');}
        else{btnSkip.textContent='0️⃣ Sacrifier';btnSkip.setAttribute('onclick','enterSacrificeMode()');}
    }

    function row(cat) {
        const done=sheet[cat.id]!==null;
        const isPend=pending.catId===cat.id;
        const disabled=done&&!isPend;

        // Sacrifice mode
        if(sacrificeMode) {
            if(done) return '<div class="sh-row done"><span class="sh-icon">'+cat.icon+'</span><span class="sh-name">'+cat.name+'</span><div class="sh-inp-area"><span class="sh-done-val">'+sheet[cat.id]+'</span></div></div>';
            const isSP=pending.catId===cat.id;
            return '<div class="sh-row sacrifice-pick '+(isSP?'pend':'')+'" onclick="selectSacrifice(\''+cat.id+'\')"><span class="sh-icon">'+cat.icon+'</span><span class="sh-name">'+cat.name+'</span><div class="sh-inp-area"><span class="sh-sacrifice-label">'+(isSP?'✕ 0 pts':'–')+'</span></div></div>';
        }

        // Normal mode — already filled: show recorded value
        if(disabled) {
            const val = sheet[cat.id];
            const valDisplay = val > 0 ? val : '0';
            const valClass = val > 0 ? '' : 'zero';
            return '<div class="sh-row done"><span class="sh-icon">'+cat.icon+'</span><span class="sh-name">'+cat.name+'</span>' +
                '<div class="sh-inp-area"><span class="sh-done-val '+valClass+'">'+valDisplay+'</span></div></div>';
        }

        // Normal mode — open for input
        let inp='';
        if(cat.type==='dice') {
            // Sélecteur 0-5 occurrences
            const count=isPend?pending.value/cat.face:0;
            inp='<div class="sh-dice-sel">';
            for(let n=0;n<=5;n++){
                const active=isPend&&(pending.value===n*cat.face);
                inp+='<button class="sh-dice-btn '+(active?'on':'')+' '+(disabled?'dis':'')+'" '+(disabled?'':'onclick="selectDice(\''+cat.id+'\','+cat.face+','+n+')"')+'>'+n+'</button>';
            }
            inp+='<span class="sh-dice-result">'+(isPend?'= '+pending.value:'')+'</span></div>';
        } else if(cat.type==='ofkind') {
            // Sélecteur du dé 1-6
            inp='<div class="sh-dice-sel">';
            for(let d=1;d<=6;d++){
                const active=isPend&&(pending.value===d*cat.mult);
                inp+='<button class="sh-dice-btn '+(active?'on':'')+' '+(disabled?'dis':'')+'" '+(disabled?'':'onclick="selectOfKind(\''+cat.id+'\','+cat.mult+','+d+')"')+'>'+d+'</button>';
            }
            inp+='<span class="sh-dice-result">'+(isPend?'= '+pending.value:'')+'</span></div>';
        } else if(cat.type==='check') {
            const on=isPend?pending.value>0:(done&&sheet[cat.id]>0);
            inp='<button class="sh-check '+(on?'on':'')+' '+(disabled?'dis':'')+'" '+(disabled?'':'onclick="toggleCheck(\''+cat.id+'\','+cat.fixed+')"')+'>'+(on?'✓':'')+'</button><span class="sh-fix">'+cat.fixed+'</span>';
        } else if(cat.type==='chance') {
            const v=isPend?pending.value:(done?sheet[cat.id]:'');
            inp='<div class="sh-chance-wrap">';
            inp+='<input type="number" class="sh-inp" id="sh_chance" value="'+(v===''||v===null?'':v)+'" min="0" max="30" placeholder="–" '+(disabled?'disabled ':'')+' onfocus="shChanceFocus()" oninput="shChanceInput()" />';
            inp+='<button class="sh-chance-detail-btn '+(disabled?'dis':'')+'" '+(disabled?'':'onclick="toggleChanceDetail()"')+'>🎲5</button>';
            inp+='</div>';
            // Détail des 5 dés (affiché si mode détaillé actif)
            if(isPend&&pending.chanceDetail) {
                inp+='<div class="sh-chance-dice">';
                for(let d=0;d<5;d++){
                    const dv=pending.chanceDice?pending.chanceDice[d]||'':'';
                    inp+='<input type="number" class="sh-chance-d" id="sh_cd_'+d+'" value="'+dv+'" min="1" max="6" placeholder="?" oninput="updateChanceDice()" />';
                }
                inp+='</div>';
            }
        }
        return '<div class="sh-row '+(disabled?'done':'')+' '+(isPend?'pend':'')+'">' +
            '<span class="sh-icon">'+cat.icon+'</span><span class="sh-name">'+cat.name+'</span>' +
            '<div class="sh-inp-area">'+inp+'</div></div>';
    }

    let h='<div class="sh-label">Section haute</div>'+uCats.map(row).join('');
    h+='<div class="sh-sub"><span>Sous-total</span><span>'+uTot+' / 63</span></div>';
    h+='<div class="sh-sub '+(uTot>=63?'earned':'')+'"><span>Bonus</span><span>'+(uTot>=63?'+35':'–')+'</span></div>';
    h+='<div class="sh-label">Section basse</div>'+lCats.map(row).join('');
    h+='<div class="sh-grand"><span>Total</span><span>'+grandTotal(sheet)+'</span></div>';
    BoardScore.$('scoreSheet').innerHTML=h;
}

/* ── Dice selectors (section haute) ── */
function selectDice(catId, face, count) {
    game.getState().turnPending = { catId, value: face*count };
    renderSheet();
}

/* ── Of-a-kind selectors (3X, 4X) ── */
function selectOfKind(catId, mult, dieFace) {
    game.getState().turnPending = { catId, value: dieFace*mult };
    renderSheet();
}

/* ── Check toggles ── */
function toggleCheck(id, fixed) {
    const p=game.getState().turnPending;
    if(p.catId===id&&p.value>0) game.getState().turnPending={catId:id,value:0};
    else game.getState().turnPending={catId:id,value:fixed};
    renderSheet();
}

/* ── Chance ── */
function shChanceFocus() {
    const p=game.getState().turnPending;
    if(p.catId!=='chance') game.getState().turnPending={catId:'chance',value:0};
}

function shChanceInput() {
    const inp=BoardScore.$('sh_chance'); if(!inp) return;
    let v=parseInt(inp.value)||0;
    if(v>30){v=30;inp.value=v;} if(v<0){v=0;inp.value=v;}
    const p=game.getState().turnPending;
    game.getState().turnPending={catId:'chance',value:v,chanceDetail:p.chanceDetail,chanceDice:p.chanceDice};
}

function toggleChanceDetail() {
    const p=game.getState().turnPending;
    if(p.catId!=='chance') game.getState().turnPending={catId:'chance',value:0};
    const cur=game.getState().turnPending;
    cur.chanceDetail=!cur.chanceDetail;
    if(!cur.chanceDice) cur.chanceDice=[null,null,null,null,null];
    renderSheet();
}

function updateChanceDice() {
    const p=game.getState().turnPending;
    if(!p.chanceDice) p.chanceDice=[null,null,null,null,null];
    let total=0;
    for(let d=0;d<5;d++){
        const inp=BoardScore.$('sh_cd_'+d);
        let v=parseInt(inp?inp.value:'')||0;
        if(v>6){v=6;if(inp)inp.value=v;} if(v<0){v=0;if(inp)inp.value=v;}
        p.chanceDice[d]=v;
        total+=v;
    }
    p.value=Math.min(30,total);
    const mainInp=BoardScore.$('sh_chance');
    if(mainInp) mainInp.value=p.value;
}

/* ── Sacrifice ── */
function enterSacrificeMode() { sacrificeMode=true; game.getState().turnPending={}; renderSheet(); }
function cancelSacrifice() { sacrificeMode=false; game.getState().turnPending={}; renderSheet(); }
function selectSacrifice(catId) { game.getState().turnPending={catId,value:0}; renderSheet(); }

/* ── Confirm ── */
function confirmTurn() {
    const state=game.getState();
    const p=state.turnPending;

    if(!p.catId) {
        game.showRoundError('⚠️ Choisis une catégorie !');
        return;
    }

    // En mode normal (pas sacrifice), vérifier qu'une valeur a été entrée
    if(!sacrificeMode && (p.value===undefined || p.value===null)) {
        game.showRoundError('⚠️ Entre un score ou utilise Sacrifier !');
        return;
    }

    const c=curPlayer(state);
    const sheet=state.sheets[c.name];
    sheet[p.catId]=p.value||0;
    c.score=grandTotal(sheet);
    const cat=CATEGORIES.find(x=>x.id===p.catId);
    state.history.push({
        round:state.history.length+1,
        player:c.name,
        category:cat?cat.icon+' '+cat.name:p.catId,
        value:sheet[p.catId],
        scores:Object.fromEntries(state.players.map(pl=>[pl.name,grandTotal(state.sheets[pl.name]||{})]))
    });
    state.turnPending={};
    sacrificeMode=false;
    state.currentPlayerIdx=(state.currentPlayerIdx+1)%state.players.length;
    BoardScore.$('scoreModal').classList.remove('open');
    game.save(); game.render();
    if(gameOver(state)) setTimeout(()=>game.showWinner(),400);
}

/* ── History ── */
function renderYamsHistory(state) {
    const section=BoardScore.$('historySection');
    const list=BoardScore.$('historyList');
    if(!section||!list) return;
    if(!state.history.length){section.style.display='none';return;}
    section.style.display='block';
    list.innerHTML=[...state.history].reverse().slice(0,20).map(h=>
        '<div class="history-item"><div class="history-item-header">'+
        '<span class="history-round-num">'+h.player+'</span>'+
        '<span class="h-tag yams-cat">'+h.category+'</span></div>'+
        '<div class="history-scores"><span class="h-score"><span class="val '+
        (h.value>0?'':'penalty')+'">'+(h.value>0?'+'+h.value:'0')+
        '</span></span></div></div>'
    ).join('');
}

/* ── Compare ── */
function openCompareModal() {
    const state=game.getState();
    if(!state.players.length) return;
    const cols=state.players.length;
    let h='<div class="cmp-grid" style="grid-template-columns:auto '+'1fr '.repeat(cols)+'">';
    h+='<div class="cmp-h"></div>';
    state.players.forEach(p=>{h+='<div class="cmp-h"><div class="cmp-av" style="background:'+p.color+'">'+BoardScore.getInitial(p.name)+'</div>'+p.name+'</div>';});
    h+='<div class="cmp-sec" style="grid-column:1/-1">Section haute</div>';
    CATEGORIES.filter(c=>c.section==='upper').forEach(c=>{
        h+='<div class="cmp-c">'+c.icon+' '+c.name+'</div>';
        state.players.forEach(p=>{const v=(state.sheets[p.name]||{})[c.id];h+='<div class="cmp-v '+(v===null?'empty':'')+'">'+(v!==null?v:'–')+'</div>';});
    });
    h+='<div class="cmp-c cmp-tot">Sous-total</div>';
    state.players.forEach(p=>h+='<div class="cmp-v cmp-tot">'+upperTotal(state.sheets[p.name]||{})+'</div>');
    h+='<div class="cmp-c cmp-tot">Bonus</div>';
    state.players.forEach(p=>{const b=bonus(state.sheets[p.name]||{});h+='<div class="cmp-v cmp-tot '+(b?'earned':'')+'">'+(b?'+35':'–')+'</div>';});
    h+='<div class="cmp-sec" style="grid-column:1/-1">Section basse</div>';
    CATEGORIES.filter(c=>c.section==='lower').forEach(c=>{
        h+='<div class="cmp-c">'+c.icon+' '+c.name+'</div>';
        state.players.forEach(p=>{const v=(state.sheets[p.name]||{})[c.id];h+='<div class="cmp-v '+(v===null?'empty':'')+'">'+(v!==null?v:'–')+'</div>';});
    });
    h+='<div class="cmp-c cmp-grand">TOTAL</div>';
    state.players.forEach(p=>h+='<div class="cmp-v cmp-grand">'+grandTotal(state.sheets[p.name]||{})+'</div>');
    h+='</div>';
    BoardScore.$('compareContent').innerHTML=h;
    BoardScore.$('compareModal').classList.add('open');
}

/* ── New Game first player ── */
function renderNgFirst() {
    const state=game.getState();
    const sec=BoardScore.$('ng-first-section');const list=BoardScore.$('ngFirstPlayerList');
    if(!sec||!list)return;
    let pls=[];
    if(game.getNgMode()==='same'){const k=game.getNgKeepSet();pls=state.players.filter((_,i)=>k.has(i));}
    else pls=game.getNgNewPlayers().map((n,i)=>({name:n,color:BoardScore.COLORS[i%BoardScore.COLORS.length]}));
    if(!pls.length){sec.style.display='none';return;}
    sec.style.display='block';
    list.innerHTML=pls.map((p,i)=>'<button class="picker-btn '+(ngFirstIdx===i?'selected':'')+'" onclick="selectNgFirstPlayer('+i+')"><span class="pb-dot" style="background:'+p.color+'"></span>'+p.name+'</button>').join('');
}
function selectNgFirstPlayer(i){ngFirstIdx=i;renderNgFirst();}

function nextRound(){openScoreModal();}
function addPlayer(){game.addPlayer();const st=game.getState();st.players.forEach(p=>{if(!st.sheets[p.name])st.sheets[p.name]=emptySheet();});game.save();game.render();}
function removePlayer(i){game.removePlayer(i);}
function openNewGameModal(){game.openNewGameModal();}
function closeNewGameModal(){game.closeNewGameModal();}
function selectPlayerMode(m){game.selectPlayerMode(m);}
function toggleKeepPlayer(i){game.toggleKeepPlayer(i);}
function ngAddPlayer(){game.ngAddPlayer();}
function ngRemovePlayer(i){game.ngRemovePlayer(i);}
function confirmNewGame(){game.confirmNewGame();}
function openNewGameFromWinner(){game.openNewGameFromWinner();}
function closeBgModal(e,id){game.closeBgModal(e,id);}

game.init();
(function(){const st=game.getState();let n=false;st.players.forEach(p=>{if(!st.sheets[p.name]){st.sheets[p.name]=emptySheet();n=true;}});if(n){game.save();game.render();}})();
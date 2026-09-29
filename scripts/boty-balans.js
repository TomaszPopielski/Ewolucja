// scripts/boty-balans.js — boty grające bezpośrednio na silniku (recenzja, docs/RECENZJA.md).
// Użycie: node scripts/boty-balans.js [katalog_repo] [liczba_gier]
const dir = require('path').resolve(process.argv[2] || '.'); const N = +process.argv[3] || 400;
const E = require(dir + '/js/engine.js'), D = require(dir + '/js/data.js');
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const BRAIN=['ganglia','brain','scales','endothermy','big_brain','fins','limbs','social','grasping_hand','tool_use','parental_care','many_eggs','insulation'];
const strategies = {
  nic: {order:[]},
  mozg: {order:BRAIN},
  mozg_lad: {order:BRAIN, land:true},
  obrona: {order:['scales','shell','eyes','camouflage','lateral_line','fins','fast_muscle']},
  losowo: {random:true},
  specjacja: {order:BRAIN, spec:true},
};
function play(diff, strat, seed){
  const rng = mulberry(seed);
  let s = E.createInitialState(D,'X',{difficulty:diff});
  const st = strategies[strat];
  let guard=0;
  while(s.status==='playing' && guard++<50){
    // buy
    let bought=true;
    while(bought){ bought=false;
      if(st.random){ const av=D.TRAITS.filter(t=>E.traitStatus(s,t,D)==='available'); if(av.length && rng()<0.8){const r=E.buyTrait(D,s,av[Math.floor(rng()*av.length)].id); if(r.ok){s=r.state;bought=true;}} }
      else for(const id of st.order){ const t=D.TRAITS.find(x=>x.id===id); if(E.traitStatus(s,t,D)==='available'){ const r=E.buyTrait(D,s,id); if(r.ok){s=r.state;bought=true;break;} } }
    }
    if(st.spec){ const c=E.canSpeciate(D,s); if(c.ok){ const act=s.activeLineageId; const r=E.speciate(D,s); if(r.ok){ s=E.setActiveLineage(r.state,act);} } }
    if(st.land){ const l=E.getActiveLineage(s); if(l.niche!=='lad' && E.canMigrate(D,s,l,'lad').ok) s=E.migrateLineage(D,s,l.id,'lad').state; }
    s = E.simulateTurn(D,s,rng).state;
  }
  const gt = s.history.length;
  return {status:s.status, turn:gt, pop:E.totalPopulation(s)};
}
const out=[];
for(const diff of ['latwy','normalny','trudny']) for(const strat of Object.keys(strategies)){
  const c={won:0,lost:0,survived:0}; let tsum=0;
  for(let i=0;i<N;i++){const r=play(diff,strat,1000+i); c[r.status]=(c[r.status]||0)+1; if(r.status==='won') tsum+=r.turn;}
  out.push(`${diff.padEnd(9)} ${strat.padEnd(10)} wygr ${(100*c.won/N).toFixed(0).padStart(3)}%  wymarcie ${(100*c.lost/N).toFixed(0).padStart(3)}%  przetrw ${(100*c.survived/N).toFixed(0).padStart(3)}%  śr.tura wygr ${c.won?(tsum/c.won).toFixed(1):'-'}`);
}
console.log(out.join('\n'));

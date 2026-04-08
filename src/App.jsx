import { useState, useEffect, useMemo } from "react";

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const PROS = [
  // ── Top contenders ──
  {id:'p1',name:'Scottie Scheffler'},{id:'p2',name:'Rory McIlroy'},
  {id:'p3',name:'Jon Rahm'},{id:'p4',name:'Tommy Fleetwood'},
  {id:'p5',name:'Ludvig Aberg'},{id:'p6',name:'Xander Schauffele'},
  {id:'p7',name:'Collin Morikawa'},{id:'p8',name:'Brooks Koepka'},
  {id:'p9',name:'Patrick Cantlay'},{id:'p10',name:'Viktor Hovland'},
  {id:'p11',name:'Justin Thomas'},{id:'p12',name:'Bryson DeChambeau'},
  {id:'p13',name:'Jordan Spieth'},{id:'p14',name:'Patrick Reed'},
  {id:'p15',name:'Hideki Matsuyama'},{id:'p16',name:'Shane Lowry'},
  {id:'p17',name:'Cameron Young'},{id:'p18',name:'Chris Gotterup'},
  {id:'p19',name:'Russell Henley'},{id:'p20',name:'Justin Rose'},
  // ── Mid-tier ──
  {id:'p21',name:'Jake Knapp'},{id:'p22',name:'Maverick McNealy'},
  {id:'p23',name:'Sungjae Im'},{id:'p24',name:'Max Homa'},
  {id:'p25',name:'Wyndham Clark'},{id:'p26',name:'Jason Day'},
  {id:'p27',name:'Sam Burns'},{id:'p28',name:'Keegan Bradley'},
  {id:'p29',name:'Tyrrell Hatton'},{id:'p30',name:'Nick Taylor'},
  {id:'p31',name:'Alex Noren'},{id:'p32',name:'Corey Conners'},
  {id:'p33',name:'Brian Harman'},{id:'p34',name:'Kurt Kitayama'},
  {id:'p35',name:'Matt Fitzpatrick'},{id:'p36',name:'Harris English'},
  {id:'p37',name:'Akshay Bhatia'},{id:'p38',name:'Haotong Li'},
  {id:'p39',name:'Ryan Fox'},{id:'p40',name:'Sam Stevens'},
  {id:'p41',name:'Max Greyserman'},{id:'p42',name:'Carlos Ortiz'},
  {id:'p43',name:'Si Woo Kim'},{id:'p44',name:'Nicolai Hojgaard'},
  {id:'p45',name:'Min Woo Lee'},{id:'p46',name:'Adam Scott'},
  {id:'p47',name:'J.J. Spaun'},{id:'p48',name:'Gary Woodland'},
  {id:'p49',name:'Matt McCarty'},{id:'p50',name:'Daniel Berger'},
  {id:'p51',name:'Johnny Keefer'},{id:'p52',name:'Nico Echavarria'},
  {id:'p53',name:'Dustin Johnson'},{id:'p54',name:'Sergio Garcia'},
  {id:'p55',name:'Kristoffer Reitan'},{id:'p56',name:'Ben Griffin'},
  {id:'p57',name:'Jacob Bridgeman'},{id:'p58',name:'Michael Brennan'},
  {id:'p59',name:'Casey Jarvis'},{id:'p60',name:'Ethan Fang'},
  // ── Past champions & veterans ──
  {id:'p61',name:'Zach Johnson'},{id:'p62',name:'Fred Couples'},
  {id:'p63',name:'Angel Cabrera'},{id:'p64',name:'Jose Maria Olazabal'},
  {id:'p65',name:'Charl Schwartzel'},{id:'p66',name:'Trevor Immelman'},
  {id:'p67',name:'Sandy Lyle'},{id:'p68',name:'Bernhard Langer'},
  {id:'p69',name:'Larry Mize'},{id:'p70',name:"Mark O'Meara"},
  // ── Others in field ──
  {id:'p71',name:'Kevin Yu'},{id:'p72',name:'Sepp Straka'},
  {id:'p73',name:'Tom Kim'},{id:'p74',name:'Billy Horschel'},
  {id:'p75',name:'Tony Finau'},{id:'p76',name:'Sahith Theegala'},
  {id:'p77',name:'Denny McCarthy'},{id:'p78',name:'Brian Campbell'},
  {id:'p79',name:'Chandler Phillips'},{id:'p80',name:'Ryo Hisatsune'},
  {id:'p81',name:'Robert MacIntyre'},{id:'p82',name:'Andrew Putnam'},
  {id:'p83',name:'Davis Thompson'},{id:'p84',name:'S.H. Kim'},
  {id:'p85',name:'Si Woo Kim'},{id:'p86',name:'Bud Cauley'},
  {id:'p87',name:'Lucas Glover'},{id:'p88',name:'Rickie Fowler'},
  {id:'p89',name:'Will Zalatoris'},{id:'p90',name:'Nick Dunlap'},
  {id:'p91',name:'Tom Hoge'},
];
const PROS_MAP = Object.fromEntries(PROS.map(p => [p.id, p]));

const DEFAULT_PAR = [4,4,3,4,5,3,4,5,4, 4,3,4,5,3,4,5,4,4]; // par 72
const STORAGE_KEY = 'scramble_golf_v3';
const ESPN_API = 'https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga';

// Normalize a name for fuzzy matching (last name + first initial)
function normalizeName(n) {
  return n.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}
function namesMatch(espnName, ourName) {
  const a = normalizeName(espnName);
  const b = normalizeName(ourName);
  if (a === b) return true;
  // Last name match
  const aLast = a.split(' ').pop();
  const bLast = b.split(' ').pop();
  if (aLast === bLast && aLast.length > 4) {
    // Also check first initial
    const aFirst = a[0];
    const bFirst = b[0];
    return aFirst === bFirst;
  }
  return false;
}

const INIT = {
  tournament: { name:'Saturday Scramble', pgaEvent:'', date:'', skinsPerHole:20, buyIn:100 },
  teams: [],
  proScores: {}, // proId → number (to par, e.g. -5)
  par: DEFAULT_PAR,
};


// ── STROKES GAINED ENGINE ───────────────────────────────────────────────────
// Simplified Broadie-style baseline: expected strokes by distance (yards) & lie
// Lie types: 'tee' | 'fairway' | 'rough' | 'bunker' | 'fringe' | 'green'

const SG_BASELINE = {
  // [distance_yards]: expected_strokes from fairway/approach
  fairway: [
    [0,0],[1,1.00],[2,1.01],[3,1.02],[5,1.04],[7,1.07],[10,1.10],
    [15,1.18],[20,1.25],[25,1.32],[30,1.40],[40,1.55],[50,1.65],
    [75,1.85],[100,2.10],[125,2.30],[150,2.50],[175,2.65],[200,2.80],
    [225,2.95],[250,3.10],[275,3.25],[300,3.40],[350,3.65],[400,3.90],
    [450,4.10],[500,4.30],[550,4.55],[600,4.80],
  ],
  rough: [
    [0,0],[1,1.01],[2,1.02],[3,1.04],[5,1.07],[7,1.10],[10,1.15],
    [15,1.23],[20,1.32],[25,1.40],[30,1.52],[40,1.67],[50,1.80],
    [75,2.00],[100,2.25],[125,2.47],[150,2.67],[175,2.83],[200,2.97],
    [225,3.12],[250,3.27],[275,3.42],[300,3.57],[350,3.82],[400,4.05],
    [450,4.27],[500,4.47],[550,4.72],[600,4.97],
  ],
  bunker: [
    [0,0],[1,1.03],[2,1.05],[3,1.07],[5,1.12],[7,1.17],[10,1.24],
    [15,1.36],[20,1.48],[25,1.59],[30,1.72],[40,1.92],[50,2.07],
    [75,2.33],[100,2.60],[125,2.82],[150,3.02],[175,3.18],[200,3.33],
    [250,3.57],[300,3.82],[350,4.07],[400,4.32],
  ],
  fringe: [
    [0,0],[1,1.00],[2,1.01],[3,1.02],[5,1.06],[7,1.10],[10,1.16],
    [15,1.25],[20,1.35],[25,1.44],[30,1.53],[40,1.68],[50,1.78],
    [75,1.98],[100,2.18],
  ],
  green: [
    [0,0],[1,1.00],[2,1.00],[3,1.01],[4,1.03],[5,1.07],[6,1.12],
    [7,1.17],[8,1.21],[9,1.25],[10,1.30],[12,1.38],[14,1.45],
    [16,1.52],[18,1.58],[20,1.64],[25,1.74],[30,1.82],[35,1.88],
    [40,1.93],[50,2.01],[60,2.08],[70,2.14],[80,2.19],[90,2.23],[100,2.27],
  ],
};
// Tee shots use fairway baseline adjusted for longer distances
SG_BASELINE.tee = SG_BASELINE.fairway;

function sgLookup(distYards, lie) {
  const table = SG_BASELINE[lie] || SG_BASELINE.fairway;
  const d = Math.max(0, distYards);
  // Find surrounding breakpoints and interpolate
  for (let i = 0; i < table.length - 1; i++) {
    const [d0, v0] = table[i];
    const [d1, v1] = table[i + 1];
    if (d <= d1) {
      const t = d1 === d0 ? 0 : (d - d0) / (d1 - d0);
      return v0 + t * (v1 - v0);
    }
  }
  return table[table.length - 1][1];
}

// Calculate SG for a single shot
// shot = { distBefore, lieBefore, distAfter, lieAfter }
function calcShotSG(shot) {
  const before = sgLookup(shot.distBefore, shot.lieBefore);
  const after  = shot.lieAfter === 'hole' ? 0 : sgLookup(shot.distAfter, shot.lieAfter);
  return parseFloat((before - after - 1).toFixed(2));
}

// Determine SG category from a shot
// holeIndex needed to identify par 3 tee shots (no OTT on par 3)
function sgCategory(shot, holeIndex, par) {
  const holePar = par[holeIndex] || 4;
  if (shot.lieBefore === 'tee') return holePar === 3 ? 'app' : 'ott';
  if (shot.lieAfter === 'hole' || shot.lieBefore === 'green') return 'putt';
  if (shot.distBefore <= 30) return 'arg';
  return 'app';
}

// Summarize SG across all holes for a team
function calcTeamSG(team, par) {
  const totals = { ott: 0, app: 0, arg: 0, putt: 0, total: 0 };
  (team.shots || []).forEach((holeShots, h) => {
    if (!holeShots) return;
    holeShots.forEach(shot => {
      const sg = calcShotSG(shot);
      const cat = sgCategory(shot, h, par);
      totals[cat] = parseFloat((totals[cat] + sg).toFixed(2));
      totals.total = parseFloat((totals.total + sg).toFixed(2));
    });
  });
  return totals;
}

const CLUBS = ['Driver','3W','5W','Hybrid','2i','3i','4i','5i','6i','7i','8i','9i','PW','GW','SW','LW','Putter','Penalty'];
const LIES  = ['tee','fairway','rough','bunker','fringe','green'];

// ── STORAGE ────────────────────────────────────────────────────────────────
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined) return { text:'--', cls:'dim' };
  if (n === 0) return { text:'E', cls:'even' };
  if (n < 0)   return { text:String(n), cls:'under' };
  return { text:`+${n}`, cls:'over' };
}

function calcTeam(team, proScores) {
  const entered = team.scores.filter(s => s !== '' && s !== null && s !== undefined);
  const n = entered.length;
  const scrambleStrokes = entered.reduce((s,v) => s + Number(v), 0);
  const scramblePar = DEFAULT_PAR.slice(0, n).reduce((a,b) => a+b, 0);
  const scrambleToPar = n > 0 ? scrambleStrokes - scramblePar : null;

  const pVals = (team.proIds || [])
    .map(id => proScores[id] !== undefined ? proScores[id] : 0)
    .sort((a,b) => a - b)
    .slice(0, 3);
  const proTotal = pVals.length === 3 ? pVals.reduce((a,b)=>a+b,0) : null;

  const combined = scrambleToPar !== null && proTotal !== null
    ? scrambleToPar + proTotal : scrambleToPar;

  const hcp = teamHandicap(team.hcp1||0, team.hcp2||0);
  const netCombined = combined !== null ? combined - hcp : null;

  return { scrambleToPar, proTotal, combined, netCombined, hcp, n, pVals };
}

function calcSkins(teams, par, skinsAmt) {
  const result = []; let carry = 0;
  for (let h = 0; h < 18; h++) {
    const entries = teams
      .map(t => { const s = t.scores[h]; return (s !== '' && s !== null && s !== undefined) ? {team:t, score:Number(s)} : null; })
      .filter(Boolean);
    if (entries.length < 2) { result.push({hole:h+1,par:par[h],st:'pending',carry,pot:0}); continue; }
    const min = Math.min(...entries.map(e=>e.score));
    const wins = entries.filter(e=>e.score===min);
    const pot = (carry+1)*skinsAmt;
    if (wins.length === 1) {
      result.push({hole:h+1,par:par[h],st:'won',winner:wins[0].team,score:min,carry,pot});
      carry = 0;
    } else {
      result.push({hole:h+1,par:par[h],st:'tied',tied:wins.map(w=>w.team),score:min,carry,pot:0});
      carry++;
    }
  }
  return result;
}

function teamHandicap(hcp1, hcp2) {
  const low = Math.min(hcp1, hcp2);
  const high = Math.max(hcp1, hcp2);
  return Math.round(0.75 * low + 0.25 * high);
}

function scoreColor(score, par) {
  if (score === '' || score === null || score === undefined) return 'var(--muted)';
  const n = Number(score);
  if (n <= par-2) return '#FFD700';
  if (n === par-1) return 'var(--green)';
  if (n === par)   return 'var(--cream)';
  if (n === par+1) return 'var(--red)';
  return '#FF4444';
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#09150A;--bg2:#0D1B0E;--surface:#132013;--surface2:#1C2E1C;
  --gold:#C9A84C;--gold2:#E8C96B;--cream:#EDE3D0;--muted:#6B8A68;
  --green:#52C462;--red:#E05252;--border:#223322;--border2:#2E432E;
}
html,body{background:var(--bg);color:var(--cream);font-family:'Inter',sans-serif;overflow-x:hidden;}
.app{max-width:480px;margin:0 auto;min-height:100vh;padding-bottom:68px;}
/* Header */
.hdr{padding:14px 16px 10px;background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;}
.hdr-left h1{font-family:'Playfair Display',serif;font-size:19px;color:var(--gold);letter-spacing:.3px;}
.hdr-left p{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);margin-top:2px;}
/* Bottom nav */
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--surface);border-top:1px solid var(--border);display:flex;z-index:30;}
.nb{flex:1;padding:9px 2px 8px;background:none;border:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.5px;text-transform:uppercase;transition:color .2s;}
.nb.on{color:var(--gold);}
.nb .ico{font-size:19px;}
/* Pages */
.page{padding-bottom:8px;}
.sec{padding:14px 16px;}
.sec+.sec{padding-top:0;}
.sh{font-family:'Playfair Display',serif;font-size:15px;color:var(--gold);margin-bottom:10px;}
/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;}
.card-sm{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center;}
/* Inputs */
.inp{width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:7px;color:var(--cream);font-family:'Inter',sans-serif;font-size:14px;padding:10px 12px;outline:none;transition:border-color .2s;margin-bottom:8px;appearance:none;}
.inp:focus{border-color:var(--gold);}
.inp::placeholder{color:var(--muted);}
.row2{display:flex;gap:8px;}.row2 .inp{flex:1;}
/* Buttons */
.btn{background:var(--gold);color:#09150A;border:none;border-radius:7px;font-family:'Inter',sans-serif;font-weight:700;font-size:13px;padding:10px 18px;cursor:pointer;letter-spacing:.3px;width:100%;transition:background .15s;}
.btn:active{background:var(--gold2);}
.btn.sec{background:var(--surface2);color:var(--cream);border:1px solid var(--border2);}
.btn.sm{width:auto;padding:5px 12px;font-size:11px;}
.btn.danger{background:var(--red);color:#fff;}
/* Labels */
.lbl{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;display:block;}
/* Score spans */
.sc{font-family:'DM Mono',monospace;font-size:13px;padding:2px 8px;border-radius:5px;font-weight:500;display:inline-block;}
.sc.under{background:rgba(82,196,98,.15);color:var(--green);}
.sc.over{background:rgba(224,82,82,.15);color:var(--red);}
.sc.even{background:rgba(201,168,76,.12);color:var(--gold);}
.sc.dim{color:var(--muted);}
/* Leaderboard */
.lb-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer;}
.lb-row:last-child{border-bottom:none;}
.lb-rank{font-family:'Playfair Display',serif;font-size:22px;color:var(--gold);width:26px;text-align:center;flex-shrink:0;}
.lb-rank.g{color:var(--gold2);}
.lb-name{font-size:14px;font-weight:600;color:var(--cream);}
.lb-players{font-size:11px;color:var(--muted);margin-top:1px;}
.lb-right{text-align:right;flex-shrink:0;}
.lb-big{font-family:'DM Mono',monospace;font-size:20px;font-weight:500;}
.lb-big.under{color:var(--green);}
.lb-big.over{color:var(--red);}
.lb-big.even{color:var(--gold);}
.lb-big.dim{color:var(--muted);}
.lb-detail{font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;}
/* Scorecard */
.sc-grid{display:grid;grid-template-columns:28px 24px 1fr 44px;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);}
.sc-grid:last-child{border-bottom:none;}
.hn{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);text-align:center;}
.hinp{width:100%;height:38px;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--cream);font-family:'DM Mono',monospace;font-size:16px;text-align:center;outline:none;appearance:textfield;}
.hinp:focus{border-color:var(--gold);}
.hinp::-webkit-inner-spin-button,.hinp::-webkit-outer-spin-button{-webkit-appearance:none;}
/* Draft */
.pro-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border2);border-radius:20px;padding:5px 10px;font-size:11px;margin:3px;cursor:pointer;transition:all .15s;color:var(--cream);}
.pro-chip.sel{border-color:var(--gold);color:var(--gold);background:rgba(201,168,76,.1);}
.pro-chip.full{opacity:.3;pointer-events:none;}
/* Skins */
.sk-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);}
.sk-row:last-child{border-bottom:none;}
.sk-n{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold);width:22px;flex-shrink:0;}
/* Tabs */
.tabs{display:flex;gap:6px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{flex-shrink:0;padding:5px 13px;border-radius:20px;border:1px solid var(--border2);background:none;color:var(--muted);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;text-transform:uppercase;letter-spacing:.5px;transition:all .2s;}
.tab.on{background:var(--gold);color:#09150A;border-color:var(--gold);font-weight:600;}
/* Alerts */
.alert{background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:11px 12px;margin-bottom:10px;font-size:12px;color:var(--gold);line-height:1.5;}
.alert.green{background:rgba(82,196,98,.07);border-color:rgba(82,196,98,.2);color:var(--green);}
/* Divider */
.dv{height:1px;background:var(--border);margin:10px 0;}
/* Totals row */
.tot-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;}
/* Shot modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50;display:flex;align-items:flex-end;}
.modal{background:var(--bg2);border-top:1px solid var(--border2);border-radius:16px 16px 0 0;width:100%;max-width:480px;margin:0 auto;padding:18px 16px 28px;max-height:85vh;overflow-y:auto;}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.shot-row{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;}
.shot-num{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold);margin-right:8px;}
.sel-row{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px;}
.sel-btn{padding:4px 10px;border-radius:16px;border:1px solid var(--border2);background:none;color:var(--muted);font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;text-transform:uppercase;}
.sel-btn.on{background:var(--gold);color:#09150A;border-color:var(--gold);font-weight:700;}
.dist-inp{width:80px;height:34px;background:var(--bg);border:1px solid var(--border2);border-radius:6px;color:var(--cream);font-family:'DM Mono',monospace;font-size:15px;text-align:center;outline:none;-moz-appearance:textfield;}
.dist-inp::-webkit-inner-spin-button{-webkit-appearance:none;}
.sg-bar{height:6px;border-radius:3px;margin-top:3px;}
.sg-pos{background:var(--green);}
.sg-neg{background:var(--red);}
/* SG stats grid */
.sg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}

`;

// ── VIEWS ──────────────────────────────────────────────────────────────────

function SetupView({ state, setState, adminMode }) {
  const { tournament, teams, proScores } = state;
  const [tab, setTab] = useState('tournament');
  const [newTeam, setNewTeam] = useState({ name:'', player1:'', player2:'', hcp1:0, hcp2:0 });
  const [proSearch, setProSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const setT = (f,v) => setState(p => ({...p, tournament:{...p.tournament,[f]:v}}));

  async function syncESPN() {
    setSyncing(true); setSyncMsg('Fetching ESPN…');
    try {
      const res = await fetch(ESPN_API);
      const data = await res.json();
      const event = data.events?.[0];
      if (!event) throw new Error('No event');
      const holes = event.courses?.[0]?.holes;
      if (holes?.length === 18) setState(p => ({...p, par: holes.map(h => h.shotsToPar)}));
      if (event.name) setState(p => ({...p, tournament:{...p.tournament, pgaEvent: event.name}}));
      const competitors = event.competitions?.[0]?.competitors || [];
      const espnMap = {};
      competitors.forEach(c => {
        const name = c.athlete?.displayName;
        const s = c.statistics?.find(x => x.name === 'scoreToPar');
        if (name) espnMap[name] = s?.value ?? 0;
      });
      let matched = 0;
      const newScores = {};
      PROS.forEach(pro => {
        const found = Object.entries(espnMap).find(([n]) => namesMatch(n, pro.name));
        if (found) { newScores[pro.id] = found[1]; matched++; }
      });
      setState(p => ({...p, proScores:{...p.proScores, ...newScores}}));
      setSyncMsg(`✓ Synced ${matched}/${PROS.length} pros · ${new Date().toLocaleTimeString()}`);
    } catch(e) { setSyncMsg('✗ Sync failed'); }
    setSyncing(false);
  }

  function addTeam() {
    if (!newTeam.name || !newTeam.player1 || !newTeam.player2) return;
    setState(p => ({...p, teams:[...p.teams, {...newTeam, id:Date.now().toString(), proIds:[], scores:Array(18).fill(''), shots:Array(18).fill(null).map(()=>[]), hcp1:newTeam.hcp1||0, hcp2:newTeam.hcp2||0}]}));
    setNewTeam({name:'',player1:'',player2:'',hcp1:0,hcp2:0});
  }

  function removeTeam(id) { setState(p => ({...p, teams:p.teams.filter(t=>t.id!==id)})); }

  function setProScore(id, val) {
    setState(p => ({...p, proScores:{...p.proScores,[id]: val===''? 0 : Number(val)}}));
  }

  const filteredPros = PROS.filter(p => p.name.toLowerCase().includes(proSearch.toLowerCase()));

  return (
    <div className="page">
      <div style={{height:14}} />
      <div className="tabs">
        {['tournament','teams','pros'].map(t => (
          <button key={t} className={`tab ${tab===t?'on':''}`} onClick={()=>setTab(t)}>
            {t==='teams'?`Teams (${teams.length})`: t==='pros'?'Pro Scores':'Info'}
          </button>
        ))}
      </div>

      {tab === 'tournament' && (
        <div className="sec" style={{paddingTop:0}}>
          {adminMode ? (
            <div className="card">
              <div className="sh">Tournament Info</div>
              <label className="lbl">Name</label>
              <input className="inp" value={tournament.name} onChange={e=>setT('name',e.target.value)} placeholder="Saturday Scramble" />
              <label className="lbl">PGA Event This Weekend</label>
              <input className="inp" value={tournament.pgaEvent} onChange={e=>setT('pgaEvent',e.target.value)} placeholder="e.g. The Masters" />
              <label className="lbl">Date</label>
              <input className="inp" type="date" value={tournament.date} onChange={e=>setT('date',e.target.value)} />
              <div className="row2">
                <div style={{flex:1}}>
                  <label className="lbl">Skins/Hole ($)</label>
                  <input className="inp" type="number" value={tournament.skinsPerHole} onChange={e=>setT('skinsPerHole',Number(e.target.value))} />
                </div>
                <div style={{flex:1}}>
                  <label className="lbl">Overall Buy-In ($)</label>
                  <input className="inp" type="number" value={tournament.buyIn} onChange={e=>setT('buyIn',Number(e.target.value))} />
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="sh">{tournament.name || 'No Name Set'}</div>
              {[
                ['PGA Event', tournament.pgaEvent],
                ['Date', tournament.date],
                ['Teams', `${teams.length} teams`],
                ['Skins', `$${tournament.skinsPerHole}/hole`],
                ['Overall Buy-In', `$${tournament.buyIn}/team`],
                ['Overall Pot', `$${teams.length * tournament.buyIn}`],
              ].map(([k,v]) => v && (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:12,color:'var(--muted)'}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {!adminMode && <div className="alert">Tap "Admin" in the header to edit settings.</div>}
        </div>
      )}

      {tab === 'teams' && (
        <div className="sec" style={{paddingTop:0}}>
          {adminMode && teams.length < 10 && (
            <div className="card">
              <div className="sh">Add Team</div>
              <label className="lbl">Team Name</label>
              <input className="inp" value={newTeam.name} onChange={e=>setNewTeam(p=>({...p,name:e.target.value}))} placeholder="Team Birdie" />
              <div className="row2">
                <input className="inp" value={newTeam.player1} onChange={e=>setNewTeam(p=>({...p,player1:e.target.value}))} placeholder="Player 1" />
                <input className="inp" value={newTeam.player2} onChange={e=>setNewTeam(p=>({...p,player2:e.target.value}))} placeholder="Player 2" />
              </div>
              <label className="lbl">Handicap Indices</label>
              <div className="row2">
                <input className="inp" type="number" min="0" max="54" step="0.1" value={newTeam.hcp1||0} onChange={e=>setNewTeam(p=>({...p,hcp1:parseFloat(e.target.value)||0}))} placeholder="P1 HCP" />
                <input className="inp" type="number" min="0" max="54" step="0.1" value={newTeam.hcp2||0} onChange={e=>setNewTeam(p=>({...p,hcp2:parseFloat(e.target.value)||0}))} placeholder="P2 HCP" />
              </div>
              <button className="btn" onClick={addTeam}>+ Add Team</button>
            </div>
          )}
          {teams.length === 0
            ? <div className="alert">No teams yet. Enable Admin to add teams.</div>
            : (
              <div className="card">
                {teams.map((t,i) => (
                  <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<teams.length-1?'1px solid var(--border)':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                      <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{t.player1} & {t.player2}</div>
                      <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginTop:2}}>
                      {(t.proIds?.length||0) + "/6 pros · HCP: " + teamHandicap(t.hcp1||0,t.hcp2||0)}
                    </div>
                    </div>
                    {adminMode && <button className="btn sm danger" onClick={()=>removeTeam(t.id)}>✕</button>}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {tab === 'pros' && (
        <div className="sec" style={{paddingTop:0}}>
          <div className="alert">
            Tap "Sync ESPN" to pull live PGA scores automatically. Scores update the leaderboard in real time.
          </div>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            <button className="btn" onClick={syncESPN} disabled={syncing} style={{flex:2}}>
              {syncing ? '⟳ Syncing…' : '⚡ Sync ESPN Scores'}
            </button>
            <input className="inp" placeholder="Search…" value={proSearch} onChange={e=>setProSearch(e.target.value)} style={{flex:1,marginBottom:0}} />
          </div>
          {syncMsg && <div className="alert" style={{marginBottom:10,fontSize:11}}>{syncMsg}</div>}
          {adminMode && false && (
            <input className="inp" placeholder="Search pros…" value={proSearch} onChange={e=>setProSearch(e.target.value)} />
          )}
          <div className="card" style={{padding:'4px 12px'}}>
            {filteredPros.map(pro => {
              const s = proScores[pro.id] ?? 0;
              const {text,cls} = fmt(s);
              return (
                <div key={pro.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{flex:1,fontSize:13}}>{pro.name}</div>
                  {adminMode
                    ? <input
                        style={{width:64,height:34,background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:6,color:'var(--cream)',fontFamily:'DM Mono,monospace',fontSize:14,textAlign:'center',outline:'none',appearance:'textfield'}}
                        type="number"
                        value={proScores[pro.id] ?? 0}
                        onChange={e=>setProScore(pro.id,e.target.value)}
                      />
                    : <span className={`sc ${cls}`}>{text}</span>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DraftView({ state, setState }) {
  const { teams, proScores } = state;
  const [selTeam, setSelTeam] = useState(teams[0]?.id || null);
  const team = teams.find(t=>t.id===selTeam);

  // Pros already drafted by OTHER teams
  const takenByOthers = new Set(
    teams.filter(t=>t.id!==selTeam).flatMap(t=>t.proIds||[])
  );

  function togglePro(proId) {
    if (!team) return;
    const has = team.proIds?.includes(proId);
    let newIds;
    if (has) newIds = team.proIds.filter(id=>id!==proId);
    else {
      if ((team.proIds?.length||0) >= 6) return;
      if (takenByOthers.has(proId)) return; // can't draft taken pro
      newIds = [...(team.proIds||[]), proId];
    }
    setState(p=>({...p,teams:p.teams.map(t=>t.id===team.id?{...t,proIds:newIds}:t)}));
  }

  return (
    <div className="page">
      <div style={{height:14}}/>
      <div className="tabs">
        {teams.map(t=>(
          <button key={t.id} className={`tab ${selTeam===t.id?'on':''}`} onClick={()=>setSelTeam(t.id)}>
            {t.name} {t.proIds?.length===6 ? "✓" : "(" + (t.proIds?.length||0) + " of 6)"}
          </button>
        ))}
      </div>

      <div className="sec" style={{paddingTop:0}}>
        {!team
          ? <div className="alert">No teams found. Add teams in Setup first.</div>
          : <>
            {/* Team card */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:15}}>{team.name}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{team.player1} & {team.player2}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:24,color:team.proIds?.length===6?'var(--green)':'var(--gold)'}}>
                    {(team.proIds?.length||0) + "/6"}
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>drafted</div>
                </div>
              </div>

              {(team.proIds?.length||0) > 0 && (
                <>
                  <div className="dv"/>
                  <div className="lbl">My Picks</div>
                  {[...(team.proIds||[])]
                    .sort((a,b)=>(proScores[a]??0)-(proScores[b]??0))
                    .map((id,idx) => {
                      const pro = PROS_MAP[id];
                      const s = proScores[id]??0;
                      const {text,cls}=fmt(s);
                      return (
                        <div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0'}}>
                          <span style={{fontSize:11,color:idx<3?'var(--gold)':'var(--muted)',width:14}}>{idx<3?'★':''}</span>
                          <span style={{fontSize:13,flex:1,opacity:idx<3?1:0.55}}>{pro?.name}</span>
                          <span className={`sc ${cls}`} style={{fontSize:11}}>{text}</span>
                        </div>
                      );
                    })}
                  {(team.proIds?.length||0)<3 && (
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:4,fontStyle:'italic'}}>
                      ★ = top 3 used in combined score
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pro pool */}
            <div className="lbl">PGA Field — Pick 6</div>
            <div className="card" style={{padding:'10px 10px'}}>
              <div style={{display:'flex',flexWrap:'wrap',margin:'-3px'}}>
                {PROS.map(pro => {
                  const sel = team.proIds?.includes(pro.id);
                  const isFull = (team.proIds?.length||0)>=6 && !sel;
                  const s=proScores[pro.id]??0;
                  const {text,cls}=fmt(s);
                  return (
                    <button key={pro.id}
                      className={`pro-chip ${sel?'sel':''} ${isFull?'full':''}`}
                      onClick={()=>!isFull&&togglePro(pro.id)}
                    >
                      {pro.name}
                      <span className={`sc ${cls}`} style={{fontSize:10,padding:'1px 5px'}}>{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        }
      </div>
    </div>
  );
}

function ShotModal({ team, holeIndex, par, onClose, onSave }) {
  const holePar = par[holeIndex] || 4;
  const holeNum = holeIndex + 1;
  const existing = (team.shots?.[holeIndex] || []);
  const [shots, setShots] = useState(existing.length > 0 ? existing : [
    { lieBefore: 'tee', distBefore: 0, club: 'Driver', lieAfter: 'fairway', distAfter: 0 }
  ]);

  function updShot(i, field, val) {
    setShots(prev => prev.map((s,idx) => idx===i ? {...s, [field]: val} : s));
  }

  function addShot(i) {
    const prev = shots[i];
    const newShot = {
      lieBefore: prev.lieAfter || 'fairway',
      distBefore: prev.distAfter || 0,
      club: prev.lieAfter === 'green' ? 'Putter' : '7i',
      lieAfter: 'green',
      distAfter: 0,
    };
    setShots(s => [...s.slice(0, i+1), newShot, ...s.slice(i+1)]);
  }

  function removeShot(i) {
    if (shots.length <= 1) return;
    setShots(s => s.filter((_,idx) => idx !== i));
  }

  const sgCats = { ott:'OTT', app:'APP', arg:'ARG', putt:'PUTT' };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:17,color:'var(--gold)'}}>Hole {holeNum} · Par {holePar}</div>
            <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>Tap hole number on scorecard to open · tap outside to close</div>
          </div>
          <button className="btn sm sec" onClick={()=>onSave(shots)}>Save</button>
        </div>

        {shots.map((shot, i) => {
          const sg = calcShotSG(shot);
          const cat = sgCategory(shot, holeIndex, par);
          return (
            <div key={i} className="shot-row">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span className="shot-num">S{i+1}</span>
                  <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'var(--muted)',background:'var(--bg)',padding:'2px 6px',borderRadius:4}}>
                    {sgCats[cat]}
                  </span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:15,color:sg>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                    {sg>=0?'+':''}{sg}
                  </span>
                  {shots.length > 1 && <button className="btn sm danger" style={{padding:'3px 8px'}} onClick={()=>removeShot(i)}>✕</button>}
                </div>
              </div>

              {/* From */}
              <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:6}}>
                <div style={{flex:1}}>
                  <div className="lbl">From lie</div>
                  <div className="sel-row">
                    {LIES.map(l=>(
                      <button key={l} className={`sel-btn ${shot.lieBefore===l?'on':''}`} onClick={()=>updShot(i,'lieBefore',l)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="lbl">Dist (yds)</div>
                  <input className="dist-inp" type="number" min="0" max="700"
                    value={shot.distBefore||''} placeholder="350"
                    onChange={e=>updShot(i,'distBefore',Number(e.target.value))} />
                </div>
              </div>

              {/* Club */}
              <div style={{marginBottom:6}}>
                <div className="lbl">Club</div>
                <div className="sel-row">
                  {CLUBS.map(c=>(
                    <button key={c} className={`sel-btn ${shot.club===c?'on':''}`} onClick={()=>updShot(i,'club',c)}>{c}</button>
                  ))}
                </div>
              </div>

              {/* Result */}
              <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div className="lbl">Result lie</div>
                  <div className="sel-row">
                    {[...LIES,'hole'].map(l=>(
                      <button key={l} className={`sel-btn ${shot.lieAfter===l?'on':''}`} onClick={()=>updShot(i,'lieAfter',l)}
                        style={l==='hole'?{borderColor:'var(--gold)',color:'var(--gold)'}:{}}>{l}</button>
                    ))}
                  </div>
                </div>
                {shot.lieAfter !== 'hole' && (
                  <div>
                    <div className="lbl">Dist (yds)</div>
                    <input className="dist-inp" type="number" min="0" max="700"
                      value={shot.distAfter||''} placeholder="15"
                      onChange={e=>updShot(i,'distAfter',Number(e.target.value))} />
                  </div>
                )}
              </div>

              {/* SG bar */}
              <div style={{marginTop:8}}>
                <div className={`sg-bar ${sg>=0?'sg-pos':'sg-neg'}`} style={{width:`${Math.min(100,Math.abs(sg)*50)}%`}}/>
              </div>
            </div>
          );
        })}

        <button className="btn sec" style={{marginTop:4}} onClick={()=>addShot(shots.length-1)}>
          + Add Shot
        </button>

        {/* Hole SG summary */}
        {shots.length > 0 && (
          <div style={{marginTop:14,padding:'10px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div className="lbl" style={{marginBottom:6}}>Hole SG Summary</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {Object.entries({ott:'OTT',app:'APP',arg:'ARG',putt:'PUTT'}).map(([k,label])=>{
                const total = shots
                  .filter((_,i2) => sgCategory(shots[i2], holeIndex, par) === k)
                  .reduce((sum,sh) => sum + calcShotSG(sh), 0);
                const hasAny = shots.some((_,i2) => sgCategory(shots[i2], holeIndex, par) === k);
                if (!hasAny) return null;
                return (
                  <div key={k} style={{textAlign:'center'}}>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:10,color:'var(--muted)'}}>{label}</div>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:16,color:total>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                      {total>=0?'+':''}{total.toFixed(2)}
                    </div>
                  </div>
                );
              })}
              <div style={{textAlign:'center',marginLeft:'auto'}}>
                <div style={{fontFamily:'DM Mono,monospace',fontSize:10,color:'var(--muted)'}}>TOTAL</div>
                <div style={{fontFamily:'DM Mono,monospace',fontSize:16,fontWeight:600,color:shots.reduce((s,sh)=>s+calcShotSG(sh),0)>=0?'var(--green)':'var(--red)'}}>
                  {(()=>{const t=shots.reduce((s,sh)=>s+calcShotSG(sh),0);return `${t>=0?'+':''}${t.toFixed(2)}`;})()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoresView({ state, setState }) {
  const { teams, par } = state;
  const [selTeam, setSelTeam] = useState(teams[0]?.id||null);
  const [trackingHole, setTrackingHole] = useState(null);
  const team = teams.find(t=>t.id===selTeam);

  function setScore(h, val) {
    if (!team) return;
    setState(p=>({...p,teams:p.teams.map(t=>{
      if(t.id!==team.id)return t;
      const sc=[...t.scores]; sc[h]=val; return {...t,scores:sc};
    })}));
  }

  function saveShots(holeIndex, shots) {
    setState(p=>({...p,teams:p.teams.map(t=>{
      if(t.id!==team.id)return t;
      const sh=[...(t.shots||Array(18).fill(null).map(()=>[]))];
      sh[holeIndex]=shots;
      return {...t,shots:sh};
    })}));
    setTrackingHole(null);
  }

  const frontTotal = team ? team.scores.slice(0,9).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const backTotal  = team ? team.scores.slice(9,18).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const frontPar   = par.slice(0,9).reduce((a,b)=>a+b,0);
  const backPar    = par.slice(9,18).reduce((a,b)=>a+b,0);
  const frontEntered = team ? team.scores.slice(0,9).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;
  const backEntered  = team ? team.scores.slice(9,18).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;

  return (
    <>
    {trackingHole !== null && team && (
      <ShotModal
        team={team}
        holeIndex={trackingHole}
        par={par}
        onClose={()=>setTrackingHole(null)}
        onSave={(shots)=>saveShots(trackingHole, shots)}
      />
    )}
    <div className="page">
      <div style={{height:14}}/>
      <div className="tabs">
        {teams.map(t=>(
          <button key={t.id} className={`tab ${selTeam===t.id?'on':''}`} onClick={()=>setSelTeam(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="sec" style={{paddingTop:0}}>
        {!team
          ? <div className="alert">No teams found. Add teams in Setup first.</div>
          : <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <div style={{fontWeight:600,fontSize:15}}>{team.name}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{team.player1} & {team.player2}</div>
              </div>
              {(() => {
                const total = frontTotal+backTotal;
                const entered = frontEntered+backEntered;
                if(!entered) return null;
                const {text,cls}=fmt(total-(par.slice(0,entered).reduce((a,b)=>a+b,0)));
                return (
                  <div style={{textAlign:'right'}}>
                    <span className={`sc ${cls}`} style={{fontSize:17}}>{text}</span>
                    <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginTop:2}}>thru {entered}</div>
                  </div>
                );
              })()}
            </div>

            {/* Scorecard */}
            <div className="card" style={{padding:'8px 12px'}}>
              {/* Header */}
              <div className="sc-grid" style={{paddingBottom:6}}>
                <div className="hn" style={{color:'var(--gold)'}}>HLE</div>
                <div className="hn" style={{color:'var(--gold)'}}>PAR</div>
                <div style={{fontSize:10,color:'var(--gold)',fontFamily:'DM Mono,monospace',paddingLeft:4}}>SCORE</div>
                <div style={{fontSize:10,color:'var(--gold)',fontFamily:'DM Mono,monospace',textAlign:'right'}}>+/-</div>
              </div>

              {/* Front 9 */}
              {Array.from({length:9},(_,h)=>(
                <div key={h}>
                  <div className="sc-grid">
                    <div className="hn" style={{cursor:'pointer'}} onClick={()=>setTrackingHole(h)}>
                      <span style={{color:(team.shots?.[h]?.length||0)>0?'var(--gold)':'var(--muted)'}}>{h+1}</span>
                    </div>
                    <div className="hn">{par[h]}</div>
                    <input className="hinp" type="number" min="1" max="12"
                      value={team.scores[h]??''} onChange={e=>setScore(h,e.target.value)}
                      onFocus={e=>e.target.select()} />
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h],par[h])}}>
                      {team.scores[h]!==''&&team.scores[h]!==null&&team.scores[h]!==undefined ? fmt(Number(team.scores[h])-par[h]).text : '--'}
                    </div>
                  </div>
                  {(team.shots?.[h]?.length||0)>0 && (
                    <div style={{paddingLeft:4,paddingBottom:4,display:'flex',gap:6,flexWrap:'wrap'}}>
                      {(team.shots[h]||[]).map((sh,si)=>{
                        const sg=calcShotSG(sh);
                        return <span key={si} style={{fontSize:10,fontFamily:'DM Mono,monospace',color:sg>=0?'var(--green)':'var(--red)'}}>
                          S{si+1} {sg>=0?'+':''}{sg}
                        </span>;
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Front 9 subtotal */}
              {frontEntered > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)'}}>OUT ({frontEntered} of 9)</span>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:13}}>{frontTotal}</span>
                    <span className={`sc ${fmt(frontTotal-frontPar*Math.floor(frontEntered/9)).cls}`} style={{fontSize:11}}>
                      {frontEntered===9?fmt(frontTotal-frontPar).text:`thru ${frontEntered}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Back 9 */}
              {Array.from({length:9},(_,h)=>(
                <div key={h+9}>
                  <div className="sc-grid">
                    <div className="hn" style={{cursor:'pointer'}} onClick={()=>setTrackingHole(h+9)}>
                      <span style={{color:(team.shots?.[h+9]?.length||0)>0?'var(--gold)':'var(--muted)'}}>{h+10}</span>
                    </div>
                    <div className="hn">{par[h+9]}</div>
                    <input className="hinp" type="number" min="1" max="12"
                      value={team.scores[h+9]??''} onChange={e=>setScore(h+9,e.target.value)}
                      onFocus={e=>e.target.select()} />
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h+9],par[h+9])}}>
                      {team.scores[h+9]!==''&&team.scores[h+9]!==null&&team.scores[h+9]!==undefined ? fmt(Number(team.scores[h+9])-par[h+9]).text : '--'}
                    </div>
                  </div>
                  {(team.shots?.[h+9]?.length||0)>0 && (
                    <div style={{paddingLeft:4,paddingBottom:4,display:'flex',gap:6,flexWrap:'wrap'}}>
                      {(team.shots[h+9]||[]).map((sh,si)=>{
                        const sg=calcShotSG(sh);
                        return <span key={si} style={{fontSize:10,fontFamily:'DM Mono,monospace',color:sg>=0?'var(--green)':'var(--red)'}}>
                          S{si+1} {sg>=0?'+':''}{sg}
                        </span>;
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Totals */}
              <div className="dv"/>
              <div className="tot-grid">
                {[['OUT',frontTotal,frontPar,frontEntered===9],['IN',backTotal,backPar,backEntered===9],['TOT',frontTotal+backTotal,frontPar+backPar,frontEntered+backEntered===18]].map(([l,s,p,done])=>(
                  <div key={l} className="card-sm" style={{padding:'8px 6px'}}>
                    <div className="lbl" style={{textAlign:'center'}}>{l}</div>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:16,color:'var(--cream)'}}>{s||0}</div>
                    {done && <span className={`sc ${fmt(s-p).cls}`} style={{fontSize:10,marginTop:2}}>{fmt(s-p).text}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        }
      </div>
    </div>
    </>
  );
}

function LeaderboardView({ state }) {
  const { teams, proScores, tournament } = state;
  const [open, setOpen] = useState(null);
  const [showNet, setShowNet] = useState(false);

  const ranked = useMemo(()=>{
    return teams
      .map(t=>({team:t,...calcTeam(t,proScores)}))
      .sort((a,b)=>{
        if(a.combined===null&&b.combined===null) return 0;
        if(a.combined===null) return 1;
        if(b.combined===null) return -1;
        return a.combined-b.combined;
      });
  },[teams,proScores,showNet]);

  return (
    <div className="page">
      <div className="sec">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div className="sh" style={{marginBottom:0}}>Leaderboard</div>
          <button className={`btn sm ${showNet?'':'sec'}`} style={{flexShrink:0}} onClick={()=>setShowNet(n=>!n)}>
            {showNet?'⛳ Net':'📊 Gross'}
          </button>
        </div>
        <div className="alert green" style={{marginBottom:10,fontSize:11}}>
          Combined = Scramble + top 3 pros · {showNet?'Net (handicap applied)':'Gross'} · tap row for details
        </div>

        {ranked.length===0
          ? <div className="alert">No teams yet. Go to Setup to add teams.</div>
          : <div className="card" style={{padding:'0 14px'}}>
            {ranked.map(({team,combined,netCombined,scrambleToPar,proTotal,hcp,n},i)=>{
              const displayScore = showNet ? netCombined : combined;
              const {text,cls}=fmt(displayScore);
              const isOpen=open===team.id;
              const sortedProIds=[...(team.proIds||[])].sort((a,b)=>(proScores[a]??0)-(proScores[b]??0));
              const top3=sortedProIds.slice(0,3);
              return (
                <div key={team.id}>
                  <div className="lb-row" onClick={()=>setOpen(isOpen?null:team.id)}>
                    <div className={`lb-rank ${i===0?'g':''}`}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="lb-name">{team.name}</div>
                      <div className="lb-players">{team.player1} & {team.player2}</div>
                    </div>
                    <div className="lb-right">
                      <div className={`lb-big ${cls}`}>{text}</div>
                      <div className="lb-detail">
                        {n>0?`Scr: ${fmt(scrambleToPar).text}`:'No scores'}
                        {proTotal!==null?` · Pros: ${fmt(proTotal).text}`:''}
                        {hcp>0?` · HCP -${hcp}`:''}
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{padding:'0 0 12px 36px',borderBottom:'1px solid var(--border)'}}>
                      <div className="lbl" style={{marginBottom:6}}>Drafted Pros</div>
                      {sortedProIds.length===0
                        ? <div style={{fontSize:12,color:'var(--muted)'}}>No pros drafted yet</div>
                        : sortedProIds.map((id,idx) => {
                          const pro=PROS_MAP[id]; const s=proScores[id]??0; const {text:pt,cls:pc}=fmt(s);
                          const inTop=top3.includes(id);
                          return (
                            <div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0',opacity:inTop?1:0.45}}>
                              <span style={{fontSize:11,color:'var(--gold)',width:14}}>{inTop?'★':''}</span>
                              <span style={{fontSize:12,flex:1}}>{pro?.name}</span>
                              <span className={`sc ${pc}`} style={{fontSize:11}}>{pt}</span>
                            </div>
                          );
                        })
                      }
                      <div style={{marginTop:8,fontSize:11,color:'var(--muted)'}}>★ counted in combined score</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}

function SkinsView({ state }) {
  const { teams, par, tournament } = state;
  const skins = useMemo(()=>calcSkins(teams,par,tournament.skinsPerHole),[teams,par,tournament.skinsPerHole]);

  const tally = {};
  skins.forEach(s=>{
    if(s.st==='won'){
      const id=s.winner.id;
      if(!tally[id]) tally[id]={team:s.winner,holes:[],total:0};
      tally[id].holes.push(s.hole); tally[id].total+=s.pot;
    }
  });
  const winners=Object.values(tally).sort((a,b)=>b.total-a.total);
  const totalPot=skins.reduce((_s,h)=>_s+(h.pot||0)+(h.st==='pending'?tournament.skinsPerHole:0),0);
  const carryAmt=skins.filter(s=>s.st!=='won'&&s.st!=='pending').length * tournament.skinsPerHole;

  return (
    <div className="page">
      <div className="sec">
        <div className="sh">Skins Tracker</div>

        {/* Summary tiles */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
          {[
            ['Won', skins.filter(s=>s.st==='won').length, 'var(--green)'],
            ['Carried', skins.filter(s=>s.st==='tied').length, 'var(--red)'],
            ['Remaining', skins.filter(s=>s.st==='pending').length, 'var(--muted)'],
          ].map(([l,v,c])=>(
            <div key={l} className="card-sm">
              <div style={{fontFamily:'DM Mono,monospace',fontSize:24,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',textTransform:'uppercase',letterSpacing:'.5px',marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Winnings tally */}
        {winners.length > 0 && (
          <div className="card" style={{marginBottom:12}}>
            <div className="lbl">Winnings</div>
            {winners.map(({team,holes,total})=>(
              <div key={team.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{team.name}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>Holes {holes.join(', ')}</div>
                </div>
                <div style={{fontFamily:'DM Mono,monospace',fontSize:17,color:'var(--green)'}}>${total}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hole by hole */}
        <div className="card" style={{padding:'8px 14px'}}>
          <div className="lbl" style={{marginBottom:6}}>Hole by Hole</div>
          {skins.map(s=>(
            <div key={s.hole} className="sk-row">
              <div className="sk-n">{s.hole}</div>
              <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',width:32,flexShrink:0}}>P{s.par}</div>
              <div style={{flex:1,minWidth:0}}>
                {s.st==='won' && (
                  <>
                    <div style={{fontWeight:600,fontSize:13,color:'var(--green)'}}>{s.winner.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>Score {s.score}{s.carry>0?` · +${s.carry} carried`:''}</div>
                  </>
                )}
                {s.st==='tied' && (
                  <>
                    <div style={{fontWeight:600,fontSize:12,color:'var(--red)'}}>Tied — Carry Forward</div>
                    <div style={{fontSize:10,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.tied.map(t=>t.name).join(', ')}</div>
                  </>
                )}
                {s.st==='pending' && (
                  <div style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>Not played</div>
                )}
              </div>
              <div style={{textAlign:'right',flexShrink:0,fontFamily:'DM Mono,monospace',fontSize:13}}>
                {s.st==='won' && <span style={{color:'var(--green)'}}>${s.pot}</span>}
                {s.st==='tied' && <span style={{color:'var(--muted)',fontSize:11}}>carry</span>}
                {s.st==='pending' && <span style={{color:'var(--muted)'}}>${tournament.skinsPerHole}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── STATS VIEW ────────────────────────────────────────────────────────────
function StatsView({ state }) {
  const { teams, par } = state;
  const [selTeam, setSelTeam] = useState(teams[0]?.id||null);
  const team = teams.find(t=>t.id===selTeam);
  const sg = team ? calcTeamSG(team, par) : null;

  const totalShots = team ? (team.shots||[]).flat().length : 0;

  function sgColor(v) { return v >= 0 ? 'var(--green)' : 'var(--red)'; }
  function sgFmt(v) { return `${v>=0?'+':''}${v.toFixed(2)}`; }

  // Per-hole SG for sparkline
  const holesSG = team ? Array.from({length:18},(_,h)=>{
    const hShots = (team.shots||[])[h] || [];
    return hShots.reduce((s,sh)=>s+calcShotSG(sh),0);
  }) : [];

  const catInfo = [
    {key:'ott',  label:'Off the Tee',       desc:'Tee shots on par 4s & 5s'},
    {key:'app',  label:'Approach',           desc:'30+ yards, not tee shots'},
    {key:'arg',  label:'Around the Green',   desc:'Within 30 yards, not putting'},
    {key:'putt', label:'Putting',            desc:'On the green'},
  ];

  return (
    <div className="page">
      <div style={{height:14}}/>
      <div className="tabs">
        {teams.map(t=><button key={t.id} className={`tab ${selTeam===t.id?'on':''}`} onClick={()=>setSelTeam(t.id)}>{t.name}</button>)}
      </div>

      <div className="sec" style={{paddingTop:0}}>
        {!team || totalShots===0 ? (
          <div className="alert">
            No shot data yet. On the Scores tab, tap any hole number to log shots and calculate strokes gained.
          </div>
        ) : <>
          {/* Total SG card */}
          <div className="card" style={{textAlign:'center',padding:'18px 14px',marginBottom:10}}>
            <div className="lbl">Total Strokes Gained</div>
            <div style={{fontFamily:'DM Mono,monospace',fontSize:42,fontWeight:600,color:sgColor(sg.total)}}>
              {sgFmt(sg.total)}
            </div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>
              {totalShots} shots tracked · {holesSG.filter(v=>v!==0).length} holes
            </div>
          </div>

          {/* Category breakdown */}
          <div className="sg-grid">
            {catInfo.map(({key,label,desc})=>{
              const val = sg[key];
              const hasData = (team.shots||[]).flat().some(sh => {
                const holeIdx = (team.shots||[]).findIndex(hs=>(hs||[]).includes(sh));
                return sgCategory(sh, holeIdx, par) === key;
              });
              return (
                <div key={key} className="card" style={{padding:'12px',marginBottom:0}}>
                  <div className="lbl">{label}</div>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:26,color:sgColor(val),fontWeight:600}}>
                    {hasData||val!==0 ? sgFmt(val) : '--'}
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{desc}</div>
                </div>
              );
            })}
          </div>

          {/* Hole-by-hole SG */}
          <div className="card" style={{padding:'10px 14px'}}>
            <div className="lbl" style={{marginBottom:8}}>Hole by Hole SG</div>
            {holesSG.map((sgVal, h) => {
              if ((team.shots?.[h]?.length||0) === 0) return null;
              const width = Math.min(100, Math.abs(sgVal) * 40);
              return (
                <div key={h} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)',width:20}}>H{h+1}</div>
                  <div style={{flex:1,position:'relative',height:8,background:'var(--bg)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{
                      position:'absolute',
                      height:'100%',
                      width:`${width}%`,
                      borderRadius:4,
                      background: sgVal>=0 ? 'var(--green)' : 'var(--red)',
                      left: sgVal >= 0 ? '50%' : `calc(50% - ${width}%)`,
                    }}/>
                    <div style={{position:'absolute',top:0,left:'50%',width:1,height:'100%',background:'var(--border2)'}}/>
                  </div>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:sgColor(sgVal),width:40,textAlign:'right'}}>
                    {sgFmt(sgVal)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Club usage */}
          {(()=>{
            const clubCounts = {};
            (team.shots||[]).flat().forEach(sh=>{
              if(sh.club) clubCounts[sh.club]=(clubCounts[sh.club]||0)+1;
            });
            const clubs = Object.entries(clubCounts).sort((a,b)=>b[1]-a[1]);
            if (!clubs.length) return null;
            return (
              <div className="card" style={{padding:'10px 14px'}}>
                <div className="lbl" style={{marginBottom:8}}>Club Usage</div>
                {clubs.map(([club,count])=>(
                  <div key={club} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:13}}>{club}</span>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--muted)'}}>{count} shot{count!==1?'s':''}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </>}
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(()=>load()||INIT);
  const [view, setView] = useState('leaderboard');
  const [adminMode, setAdminMode] = useState(false);

  useEffect(()=>{ save(state); },[state]);

  useEffect(()=>{
    const el=document.createElement('style');
    el.textContent=CSS;
    document.head.appendChild(el);
    return ()=>document.head.removeChild(el);
  },[]);

  const {tournament} = state;

  const TABS = [
    {id:'leaderboard',label:'Board',ico:'🏆'},
    {id:'skins',label:'Skins',ico:'💰'},
    {id:'scores',label:'Scores',ico:'✏️'},
    {id:'stats',label:'Stats',ico:'📈'},
    {id:'draft',label:'Draft',ico:'🎯'},
    {id:'setup',label:'Setup',ico:'⚙️'},
  ];

  return (
    <div className="app">
      {/* Header */}
      <div className="hdr">
        <div className="hdr-left">
          <h1>{tournament.name||'Golf Tournament'}</h1>
          <p>
            {tournament.pgaEvent ? `${tournament.pgaEvent}` : 'No PGA event set'}
            {tournament.date ? ` · ${tournament.date}` : ''}
          </p>
        </div>
        <button className="btn sm sec" style={{width:'auto'}} onClick={()=>setAdminMode(a=>!a)}>
          {adminMode ? '🔓 Admin' : '🔒 Admin'}
        </button>
      </div>

      {/* Views */}
      {view==='setup'       && <SetupView      state={state} setState={setState} adminMode={adminMode} />}
      {view==='draft'       && <DraftView      state={state} setState={setState} />}
      {view==='scores'      && <ScoresView     state={state} setState={setState} />}
      {view==='leaderboard' && <LeaderboardView state={state} />}
      {view==='skins'       && <SkinsView      state={state} />}
      {view==='stats'       && <StatsView      state={state} />}

      {/* Bottom nav */}
      <nav className="bnav">
        {TABS.map(t=>(
          <button key={t.id} className={`nb ${view===t.id?'on':''}`} onClick={()=>setView(t.id)}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
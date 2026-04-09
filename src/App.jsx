import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, onSnapshot
} from "firebase/firestore";

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const PROS = [
  // ── Masters Champions (lifetime) ──
  {id:'p1', name:'Scottie Scheffler'},    {id:'p2', name:'Rory McIlroy'},
  {id:'p3', name:'Jon Rahm'},             {id:'p4', name:'Jordan Spieth'},
  {id:'p5', name:'Hideki Matsuyama'},     {id:'p6', name:'Patrick Reed'},
  {id:'p7', name:'Dustin Johnson'},       {id:'p8', name:'Charl Schwartzel'},
  {id:'p9', name:'Adam Scott'},           {id:'p10',name:'Sergio Garcia'},
  {id:'p11',name:'Bubba Watson'},         {id:'p12',name:'Mike Weir'},
  {id:'p13',name:'Danny Willett'},        {id:'p14',name:'Jose Maria Olazabal'},
  {id:'p15',name:'Fred Couples'},         {id:'p16',name:'Angel Cabrera'},
  {id:'p17',name:'Vijay Singh'},          {id:'p18',name:'Zach Johnson'},
  // ── Major Champions in field ──
  {id:'p19',name:'Xander Schauffele'},    {id:'p20',name:'Collin Morikawa'},
  {id:'p21',name:'Brooks Koepka'},        {id:'p22',name:'Justin Thomas'},
  {id:'p23',name:'Bryson DeChambeau'},    {id:'p24',name:'Wyndham Clark'},
  {id:'p25',name:'Matt Fitzpatrick'},     {id:'p26',name:'Brian Harman'},
  {id:'p27',name:'Cameron Smith'},        {id:'p28',name:'J.J. Spaun'},
  // ── Top contenders ──
  {id:'p29',name:'Ludvig Aberg'},         {id:'p30',name:'Tommy Fleetwood'},
  {id:'p31',name:'Cameron Young'},        {id:'p32',name:'Viktor Hovland'},
  {id:'p33',name:'Patrick Cantlay'},      {id:'p34',name:'Justin Rose'},
  {id:'p35',name:'Tyrrell Hatton'},       {id:'p36',name:'Robert MacIntyre'},
  {id:'p37',name:'Shane Lowry'},          {id:'p38',name:'Min Woo Lee'},
  {id:'p39',name:'Chris Gotterup'},       {id:'p40',name:'Nicolai Hojgaard'},
  // ── Mid-tier ──
  {id:'p41',name:'Si Woo Kim'},           {id:'p42',name:'Jason Day'},
  {id:'p43',name:'Sungjae Im'},           {id:'p44',name:'Max Homa'},
  {id:'p45',name:'Corey Conners'},        {id:'p46',name:'Sam Burns'},
  {id:'p47',name:'Nick Taylor'},          {id:'p48',name:'Keegan Bradley'},
  {id:'p49',name:'Gary Woodland'},        {id:'p50',name:'Jake Knapp'},
  {id:'p51',name:'Sepp Straka'},          {id:'p52',name:'Harris English'},
  {id:'p53',name:'Kurt Kitayama'},        {id:'p54',name:'Alex Noren'},
  {id:'p55',name:'Russell Henley'},       {id:'p56',name:'Haotong Li'},
  {id:'p57',name:'Sam Stevens'},          {id:'p58',name:'Ryan Fox'},
  {id:'p59',name:'Ben Griffin'},          {id:'p60',name:'Carlos Ortiz'},
  {id:'p61',name:'Akshay Bhatia'},        {id:'p62',name:'Maverick McNealy'},
  {id:'p63',name:'Daniel Berger'},        {id:'p64',name:'Matt McCarty'},
  {id:'p65',name:'Kristoffer Reitan'},    {id:'p66',name:'Jacob Bridgeman'},
  {id:'p67',name:'Michael Brennan'},      {id:'p68',name:'Ryan Gerard'},
  {id:'p69',name:'Max Greyserman'},       {id:'p70',name:'Rasmus Hojgaard'},
  {id:'p71',name:'Harry Hall'},           {id:'p72',name:'John Keefer'},
  {id:'p73',name:'Casey Jarvis'},         {id:'p74',name:'Aldrich Potgieter'},
  {id:'p75',name:'Davis Riley'},          {id:'p76',name:'Andrew Novak'},
  {id:'p77',name:'Brian Campbell'},       {id:'p78',name:'Nicolas Echavarria'},
  {id:'p79',name:'Samuel Stevens'},       {id:'p80',name:'Marco Penge'},
  {id:'p81',name:'Aaron Rai'},            {id:'p82',name:'Sami Valimaki'},
  {id:'p83',name:'Michael Kim'},          {id:'p84',name:'Tom McKibbin'},
  {id:'p85',name:'Naoyuki Kataoka'},      {id:'p86',name:'Rasmus Neergaard-Petersen'},
  {id:'p87',name:'Tom McKibbin'},         {id:'p88',name:'Aldrich Potgieter'},
  // ── Amateurs ──
  {id:'p89',name:'Mason Howell (a)'},     {id:'p90',name:'Jackson Herrington (a)'},
  {id:'p91',name:'Ethan Fang (a)'},
];
const PROS_MAP = Object.fromEntries(PROS.map(p => [p.id, p]));

const DEFAULT_PAR    = [4,3,4,3,3,5,3,3,4, 3,4,3,3,4,3,4,3,3]; // par 62
const HOLE_HCP       = [3,15,17,1,13,7,11,5,9, 16,2,14,12,8,10,4,6,18];
const HOLE_YDS       = [356,150,262,156,158,397,150,168,301, 143,333,97,154,260,129,321,149,118];
const COURSE_RATING  = 59.6;
const COURSE_SLOPE   = 100;
const STORAGE_KEY    = 'scramble_golf_v9';   // local cache key
const FS_DOC         = 'tournament/state';    // Firestore path
const ESPN_API = 'https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga';
const ADMIN_PASSWORD = 'Eagle47';

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
  tournament: { name:'Saturday Scramble', pgaEvent:'', date:'', skinsPerHole:20, buyIn:100, proCount:1 },
  teams: [],
  proScores: {}, // proId → number (to par, e.g. -5)
  par: DEFAULT_PAR,
};


// ── STROKES GAINED ENGINE ─────────────────────────────────────────────────────
// Scratch-golfer baseline tables.
// Green distances are in FEET; all others in YARDS.
// Lie types: 'tee' | 'fairway' | 'rough' | 'bunker' | 'fringe' | 'green'

const SG_BASELINE = {
  // Fairway/Tee (yards) — scratch calibrated
  fairway: [
    [0,0],[5,1.10],[10,1.25],[15,1.38],[20,1.50],[25,1.62],[30,1.72],
    [40,1.90],[50,2.05],[75,2.35],[100,2.65],[125,2.85],[150,3.05],
    [175,3.22],[200,3.42],[225,3.60],[250,3.80],[275,3.98],[300,4.18],
    [350,4.50],[400,4.75],[450,4.95],
  ],
  rough: [
    [0,0],[5,1.15],[10,1.32],[15,1.47],[20,1.60],[25,1.74],[30,1.87],
    [40,2.07],[50,2.22],[75,2.53],[100,2.85],[125,3.07],[150,3.28],
    [175,3.46],[200,3.68],[225,3.87],[250,4.07],[300,4.45],[350,4.75],
    [400,5.00],
  ],
  bunker: [
    [0,0],[5,1.20],[10,1.40],[15,1.58],[20,1.75],[25,1.90],[30,2.05],
    [40,2.28],[50,2.48],[75,2.82],[100,3.12],[125,3.38],[150,3.60],
    [175,3.80],[200,4.00],[250,4.40],[300,4.75],
  ],
  fringe: [
    [0,0],[3,1.05],[5,1.12],[7,1.20],[10,1.30],[15,1.45],[20,1.58],
    [25,1.70],[30,1.80],[40,1.95],[50,2.07],[75,2.28],[100,2.45],
  ],
  // Green table is in FEET
  green: [
    [0,0],[1,1.00],[2,1.00],[3,1.04],[4,1.09],[5,1.15],[6,1.22],
    [7,1.28],[8,1.34],[9,1.40],[10,1.46],[12,1.56],[15,1.67],
    [18,1.76],[20,1.82],[25,1.92],[30,2.00],[40,2.10],[50,2.18],
    [60,2.24],[80,2.30],[100,2.35],
  ],
};
SG_BASELINE.tee = SG_BASELINE.fairway;

function interpolate(table, d) {
  const v = Math.max(0, d);
  for (let i = 0; i < table.length - 1; i++) {
    const [d0,v0] = table[i], [d1,v1] = table[i+1];
    if (v <= d1) {
      const t = d1===d0 ? 0 : (v-d0)/(d1-d0);
      return v0 + t*(v1-v0);
    }
  }
  return table[table.length-1][1];
}

// positions = [{lie, dist}] where green dist is in feet, others in yards
// last position should have lie='holed' OR we compute final shot as holed
function sgLookup(dist, lie) {
  return interpolate(SG_BASELINE[lie] || SG_BASELINE.fairway, dist);
}

// SG between two consecutive positions (one stroke played)
function segmentSG(from, to) {
  const before = sgLookup(from.dist, from.lie);
  const after  = to.lie === 'holed' ? 0 : sgLookup(to.dist, to.lie);
  return parseFloat((before - after - 1).toFixed(2));
}

// SG category for a segment
function segCategory(from, holeIndex, par) {
  const holePar = par[holeIndex] || 4;
  if (from.lie === 'tee') return holePar === 3 ? 'app' : 'ott';
  if (from.lie === 'green') return 'putt';
  if (from.dist <= 30) return 'arg'; // yards
  return 'app';
}

// Backwards compat: old shot model
function calcShotSG(shot) {
  if (shot.lieBefore !== undefined) {
    return segmentSG({lie:shot.lieBefore,dist:shot.distBefore},{lie:shot.lieAfter,dist:shot.distAfter});
  }
  return 0;
}
function sgCategory(shot, hi, par) { return segCategory({lie:shot.lieBefore,dist:shot.distBefore},hi,par); }

// Compute SG from a positions array
// - Segments pointing to 'gimme' produce 0 (no SG recorded)
// - Positions with bothMissed:true compute SG to 1ft on green (both players hit it there)
function calcPositionsSG(positions) {
  if (!positions || positions.length < 2) return [];
  return positions.slice(0,-1).map((pos, i) => {
    const next = positions[i+1];
    if (next?.lie === 'gimme') return 0;
    if (pos.bothMissed) return segmentSG({ lie:'green', dist: pos.dist }, { lie:'green', dist: 1 });
    return segmentSG(pos, next);
  });
}

// Summarize SG across all holes for a team (supports both old shot model and new positions model)
function calcTeamSG(team, par) {
  const totals = { ott:0, app:0, arg:0, putt:0, total:0 };
  (team.shots||[]).forEach((holeData, h) => {
    if (!holeData) return;
    const positions = Array.isArray(holeData) && holeData[0]?.lie !== undefined ? holeData : null;
    if (!positions || positions.length < 2) return;
    positions.slice(0,-1).forEach((_,i) => {
      const sg  = segmentSG(positions[i], positions[i+1]);
      const cat = segCategory(positions[i], h, par);
      totals[cat]  = parseFloat((totals[cat]+sg).toFixed(2));
      totals.total = parseFloat((totals.total+sg).toFixed(2));
    });
  });
  return totals;
}

const LIES = ['tee','fairway','rough','bunker','fringe','green'];

// ── STORAGE ────────────────────────────────────────────────────────────────
// localStorage = instant local cache; Firestore = shared source of truth
function loadLocal() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveLocal(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}


// ── FIRESTORE SERIALIZATION ────────────────────────────────────────────────
// Firestore forbids nested arrays (array-of-arrays). Each team's `shots` field
// is Array(18) where every element is itself an array of position objects —
// exactly the pattern Firestore rejects. We convert shots to a plain object
// keyed by hole index ("0"…"17") before writing, and back to an array on read.

function toFirestore(state) {
  return {
    ...state,
    teams: (state.teams || []).map(t => ({
      ...t,
      shots: Object.fromEntries(
        (t.shots || []).map((hole, i) => [String(i), hole || []])
      ),
    })),
  };
}

function fromFirestore(state) {
  return {
    ...state,
    teams: (state.teams || []).map(t => ({
      ...t,
      shots: Array.from({ length: 18 }, (_, i) => t.shots?.[String(i)] || []),
    })),
  };
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined) return { text:'--', cls:'dim' };
  if (n === 0) return { text:'E', cls:'even' };
  if (n < 0)   return { text:String(n), cls:'under' };
  return { text:`+${n}`, cls:'over' };
}

function calcTeam(team, proScores, tournament) {
  const entered = team.scores.filter(s => s !== '' && s !== null && s !== undefined);
  const n = entered.length;
  const scrambleStrokes = entered.reduce((s,v) => s + Number(v), 0);
  const scramblePar = DEFAULT_PAR.slice(0, n).reduce((a,b) => a+b, 0);
  const scrambleToPar = n > 0 ? scrambleStrokes - scramblePar : null;

  const proCount = tournament?.proCount || 1;
  const pVals = (team.proIds || [])
    .map(id => proScores[id] !== undefined ? proScores[id] : 0)
    .sort((a,b) => a - b)
    .slice(0, proCount);
  const proTotal = pVals.length === proCount ? pVals.reduce((a,b)=>a+b,0) : null;

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

function courseHandicap(idx) {
  const totalPar = DEFAULT_PAR.reduce((a,b)=>a+b,0);
  return Math.round(idx * (COURSE_SLOPE / 113) + (COURSE_RATING - totalPar));
}
function teamHandicap(hcp1, hcp2) {
  const ch1 = courseHandicap(hcp1);
  const ch2 = courseHandicap(hcp2);
  const low  = Math.min(ch1, ch2);
  const high = Math.max(ch1, ch2);
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
.app{max-width:480px;margin:0 auto;min-height:100vh;padding-bottom:68px;overflow-x:hidden;}
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
.page{padding-bottom:8px;width:100%;overflow-x:hidden;}
.sec{padding:14px 16px;width:100%;box-sizing:border-box;}
.sec+.sec{padding-top:0;}
.sh{font-family:'Playfair Display',serif;font-size:15px;color:var(--gold);margin-bottom:10px;}
/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;overflow:hidden;}
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
.sc-grid{display:grid;grid-template-columns:36px 38px 24px 44px 36px;gap:4px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);}
.sc-grid:last-child{border-bottom:none;}
.hn{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);text-align:center;}
.hinp{width:100%;min-width:0;height:38px;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--cream);font-family:'DM Mono',monospace;font-size:16px;text-align:center;outline:none;appearance:textfield;}
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

function SetupView({ state, setState, adminMode, setSyncStatus }) {
  const { tournament, teams, proScores } = state;
  const [tab, setTab] = useState('tournament');
  const [newTeam, setNewTeam] = useState({ name:'', player1:'', player2:'', hcp1:0, hcp2:0 });
  const [proSearch, setProSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamProSearch, setTeamProSearch] = useState('');

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

  function toggleTeamPro(teamId, proId) {
    setState(p => ({...p, teams: p.teams.map(t => {
      if (t.id !== teamId) return t;
      const has = (t.proIds||[]).includes(proId);
      if (has) return {...t, proIds: t.proIds.filter(id=>id!==proId)};
      if ((t.proIds||[]).length >= 6) return t;
      return {...t, proIds: [...(t.proIds||[]), proId]};
    })}));
  }

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
              <label className="lbl">Pro Scores Used (Best N of 6)</label>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                {[1,2,3].map(n=>(
                  <button key={n}
                    className={`btn sm ${(tournament.proCount||1)===n?'':'sec'}`}
                    style={{flex:1}}
                    onClick={()=>setT('proCount',n)}>
                    Best {n}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:4,lineHeight:1.5}}>
                {(tournament.proCount||1)===1
                  ? '✓ Recommended — scramble decides the winner, pros add a bonus'
                  : (tournament.proCount||1)===2
                  ? 'Moderate — draft quality matters more, less chance of blowout'
                  : 'Original — 3 pros carry significant weight'}
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
                ['Pro Scoring', `Best ${tournament.proCount||1} of 6 pros`],
                ['Course Rating', `${COURSE_RATING} / Slope ${COURSE_SLOPE}`],
                ['Par', `${DEFAULT_PAR.reduce((a,b)=>a+b,0)}`],
              ].map(([k,v]) => v && (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:12,color:'var(--muted)'}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {adminMode && (
            <button className="btn sec" style={{marginTop:4}} onClick={async ()=>{
              setSyncStatus('syncing');
              try {
                const clean = toFirestore(JSON.parse(JSON.stringify(state)));
                const [col, docId] = FS_DOC.split('/');
                await setDoc(doc(db, col, docId), { state: clean, updatedAt: Date.now() });
                setSyncStatus('live');
                alert('Saved! ✓ All devices will update within seconds.');
              } catch(e) {
                const msg = e?.code || e?.message || 'unknown';
                setSyncStatus('error:' + msg);
                alert('Save failed: ' + msg);
              }
            }}>
              ☁️ Force Save to Cloud
            </button>
          )}
          {!adminMode && <div className="alert">Tap "🔒 Admin" in the header to edit settings.</div>}
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
              <div className="card" style={{padding:0}}>
                {teams.map((t,i) => {
                  const isExpanded = expandedTeam === t.id;
                  const filteredForTeam = PROS.filter(p => p.name.toLowerCase().includes(teamProSearch.toLowerCase()));
                  return (
                    <div key={t.id} style={{borderBottom:i<teams.length-1?'1px solid var(--border)':'none'}}>
                      {/* Team row */}
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:adminMode?'pointer':'default'}}
                        onClick={()=>adminMode&&setExpandedTeam(isExpanded?null:t.id)}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                          <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{t.player1} & {t.player2}</div>
                          <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginTop:2}}>
                            {(t.proIds?.length||0)}/6 pros · HCP: {teamHandicap(t.hcp1||0,t.hcp2||0)}
                          </div>
                        </div>
                        {adminMode && (
                          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                            <span style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                            <button className="btn sm danger" onClick={e=>{e.stopPropagation();removeTeam(t.id);}}>✕</button>
                          </div>
                        )}
                      </div>

                      {/* Inline pro picker — only in admin + expanded */}
                      {adminMode && isExpanded && (
                        <div style={{padding:'0 14px 14px'}}>
                          {/* Current picks */}
                          {(t.proIds?.length||0) > 0 && (
                            <div style={{marginBottom:10}}>
                              <div className="lbl">Current Picks ({t.proIds.length}/6)</div>
                              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                                {[...(t.proIds||[])].sort((a,b)=>(proScores[a]??0)-(proScores[b]??0)).map(id=>{
                                  const pro=PROS_MAP[id];
                                  const {text,cls}=fmt(proScores[id]??0);
                                  return (
                                    <button key={id} className="pro-chip sel"
                                      onClick={()=>toggleTeamPro(t.id,id)}>
                                      {pro?.name}
                                      <span className={`sc ${cls}`} style={{fontSize:10,padding:'1px 5px'}}>{text}</span>
                                      <span style={{fontSize:10,color:'var(--red)',marginLeft:2}}>✕</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Pro search + pool */}
                          <div className="lbl">Add Pros {t.proIds?.length>=6 && <span style={{color:'var(--red)'}}>— full (6/6)</span>}</div>
                          <input
                            className="inp"
                            placeholder="Search pros…"
                            value={teamProSearch}
                            onChange={e=>setTeamProSearch(e.target.value)}
                            style={{marginBottom:8}}
                          />
                          <div style={{display:'flex',flexWrap:'wrap',gap:0,margin:'-3px'}}>
                            {filteredForTeam.map(pro => {
                              const sel = (t.proIds||[]).includes(pro.id);
                              const full = (t.proIds?.length||0) >= 6 && !sel;
                              const {text,cls} = fmt(proScores[pro.id]??0);
                              return (
                                <button key={pro.id}
                                  className={`pro-chip ${sel?'sel':''} ${full?'full':''}`}
                                  onClick={()=>!full&&toggleTeamPro(t.id,pro.id)}>
                                  {pro.name}
                                  <span className={`sc ${cls}`} style={{fontSize:10,padding:'1px 5px'}}>{text}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

// Distinct colors for up to 10 teams — works on the dark background
const TEAM_COLORS = [
  '#52C462','#4A9EE0','#E05252','#E8C96B','#A855F7',
  '#F97316','#EC4899','#14B8A6','#84CC16','#F59E0B',
];

function ProsView({ state }) {
  const { teams, proScores, tournament } = state;
  const [tab, setTab] = useState('teams');
  const [open, setOpen] = useState(null);
  const proCount = tournament?.proCount || 1;

  // Assign a stable color to each team by index
  const teamColorMap = Object.fromEntries(teams.map((t, i) => [t.id, TEAM_COLORS[i % TEAM_COLORS.length]]));

  // Build a map: proId → [{teamId, teamName, color}]
  const proOwnership = {};
  teams.forEach(t => {
    (t.proIds||[]).forEach(pid => {
      if (!proOwnership[pid]) proOwnership[pid] = [];
      proOwnership[pid].push({ teamId: t.id, teamName: t.name, color: teamColorMap[t.id] });
    });
  });

  // ── Teams tab ──────────────────────────────────────────────────────────────
  const ranked = [...teams]
    .map(t => {
      const sorted = [...(t.proIds||[])].sort((a,b) => (proScores[a]??0) - (proScores[b]??0));
      const top = sorted.slice(0, proCount);
      const proTotal = top.length === proCount
        ? top.reduce((s,id) => s + (proScores[id]??0), 0)
        : null;
      return { team: t, sorted, proTotal };
    })
    .sort((a, b) => {
      if (a.proTotal === null && b.proTotal === null) return 0;
      if (a.proTotal === null) return 1;
      if (b.proTotal === null) return -1;
      return a.proTotal - b.proTotal;
    });

  // ── Field tab ──────────────────────────────────────────────────────────────
  // Sort all pros by score, assign positions with ties
  const fieldRows = [...PROS]
    .map(pro => ({ pro, score: proScores[pro.id] ?? 0, owners: proOwnership[pro.id] || [] }))
    .sort((a, b) => a.score - b.score);

  // Compute display positions (T2, T2, 4…)
  let pos = 1;
  const fieldWithPos = fieldRows.map((row, i) => {
    if (i > 0 && row.score !== fieldRows[i-1].score) pos = i + 1;
    const tied = fieldRows.filter(r => r.score === row.score).length > 1;
    return { ...row, pos: tied ? `T${pos}` : String(pos) };
  });

  // Color legend for teams that have drafted anyone
  const teamsWithPros = teams.filter(t => (t.proIds||[]).length > 0);

  return (
    <div className="page">
      <div style={{height:14}}/>
      <div className="tabs">
        <button className={`tab ${tab==='teams'?'on':''}`} onClick={()=>setTab('teams')}>My Teams</button>
        <button className={`tab ${tab==='field'?'on':''}`} onClick={()=>setTab('field')}>Masters Field</button>
      </div>

      {/* ── TEAMS TAB ── */}
      {tab === 'teams' && (
        <div className="sec" style={{paddingTop:0}}>
          <div className="alert" style={{fontSize:11,marginBottom:10}}>
            Best {proCount} pro{proCount>1?'s':''} per team count toward combined score · tap to expand
          </div>
          {ranked.length === 0
            ? <div className="alert">No teams drafted yet. Go to Setup to add teams.</div>
            : <div className="card" style={{padding:'0 14px'}}>
                {ranked.map(({team, sorted, proTotal}, i) => {
                  const {text, cls} = fmt(proTotal);
                  const isOpen = open === team.id;
                  const color = teamColorMap[team.id];
                  return (
                    <div key={team.id}>
                      <div className="lb-row" onClick={()=>setOpen(isOpen ? null : team.id)}
                        style={{borderLeft:`3px solid ${color}`,paddingLeft:10,marginLeft:-14}}>
                        <div className={`lb-rank ${i===0?'g':''}`}>{i+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="lb-name">{team.name}</div>
                          <div className="lb-players">{team.player1} & {team.player2}</div>
                        </div>
                        <div className="lb-right">
                          <div className={`lb-big ${cls}`}>{text}</div>
                          <div className="lb-detail">{sorted.length}/6 drafted · best {proCount}</div>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{padding:'4px 0 12px 36px',borderBottom:'1px solid var(--border)'}}>
                          {sorted.length === 0
                            ? <div style={{fontSize:12,color:'var(--muted)'}}>No pros drafted yet.</div>
                            : <>
                                {sorted.map((id, idx) => {
                                  const pro = PROS_MAP[id];
                                  const s = proScores[id] ?? 0;
                                  const {text:pt, cls:pc} = fmt(s);
                                  const inTop = idx < proCount;
                                  return (
                                    <div key={id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',opacity:inTop?1:0.45}}>
                                      <span style={{fontSize:11,color:'var(--gold)',width:14,flexShrink:0}}>{inTop?'★':''}</span>
                                      <span style={{fontSize:13,flex:1}}>{pro?.name}</span>
                                      <span className={`sc ${pc}`} style={{fontSize:12}}>{pt}</span>
                                    </div>
                                  );
                                })}
                                <div style={{fontSize:10,color:'var(--muted)',marginTop:6}}>★ = counting toward combined score</div>
                              </>
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* ── FIELD TAB ── */}
      {tab === 'field' && (
        <div className="sec" style={{paddingTop:0}}>
          {/* Team color legend */}
          {teamsWithPros.length > 0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {teamsWithPros.map(t => (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:20,border:`1px solid ${teamColorMap[t.id]}22`,background:`${teamColorMap[t.id]}18`}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:teamColorMap[t.id],flexShrink:0,display:'inline-block'}}/>
                  <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:teamColorMap[t.id]}}>{t.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{padding:'4px 12px'}}>
            {fieldWithPos.map(({pro, score, owners, pos}) => {
              const {text, cls} = fmt(score);
              const isDrafted = owners.length > 0;
              return (
                <div key={pro.id} style={{
                  display:'flex',alignItems:'center',gap:8,
                  padding:'8px 0',
                  borderBottom:'1px solid var(--border)',
                  opacity: isDrafted ? 1 : 0.35,
                }}>
                  {/* Position */}
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)',width:26,flexShrink:0,textAlign:'right'}}>{pos}</div>
                  {/* Colored left bar if drafted */}
                  <div style={{width:3,alignSelf:'stretch',borderRadius:2,flexShrink:0,background:owners.length===1?owners[0].color:owners.length>1?'var(--gold)':'transparent'}}/>
                  {/* Name */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:isDrafted?600:400,color:isDrafted?'var(--cream)':'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {pro.name}
                    </div>
                    {/* Team badges */}
                    {owners.length > 0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:2}}>
                        {owners.map(o => (
                          <span key={o.teamId} style={{fontSize:9,fontFamily:'DM Mono,monospace',color:o.color,background:`${o.color}18`,border:`1px solid ${o.color}44`,borderRadius:10,padding:'1px 6px'}}>
                            {o.teamName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Score */}
                  <span className={`sc ${cls}`} style={{fontSize:12,flexShrink:0}}>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ShotModal({ team, holeIndex, par, onClose, onSave }) {
  const holePar  = par[holeIndex] || 4;
  const holeNum  = holeIndex + 1;
  const holeYds  = HOLE_YDS[holeIndex] || 0;

  // Positions: [{lie, dist}] — green dist in feet, others in yards
  // Pre-populate from existing shots, or from the entered score if shots are empty,
  // or fall back to the standard tee + fairway pair.
  const existing = (team.shots?.[holeIndex] || []);
  const existingScore = team.scores?.[holeIndex];
  const scoreNum = (existingScore !== '' && existingScore !== null && existingScore !== undefined)
    ? Number(existingScore) : null;

  const defaultPos = (scoreNum !== null && scoreNum >= 1)
    ? [
        { lie:'tee', dist: holeYds, player: team.player1 },
        ...Array(Math.max(0, scoreNum - 1)).fill(null).map(() => ({ lie:'fairway', dist:0, player: team.player1 })),
        { lie:'holed', dist:0 },
      ]
    : [
        { lie:'tee', dist: holeYds, player: team.player1 },
        { lie:'fairway', dist: 0, player: team.player1 },
      ];
  const [positions, setPositions] = useState(
    existing.length >= 2 ? existing : defaultPos
  );

  function updPos(i, field, val) {
    setPositions(p => p.map((pos,idx) => idx===i ? {...pos,[field]:val} : pos));
  }

  function addPos() {
    const last = positions[positions.length-1];
    const nextLie = last.lie==='green' ? 'holed' : last.lie==='fringe' ? 'green' : last.lie;
    setPositions(p => [...p, { lie: nextLie==='holed'?'green':nextLie, dist:0, player: team.player1 }]);
  }

  function removePos(i) {
    if (i === 0 || positions.length <= 2) return;
    setPositions(p => p.filter((_,idx) => idx!==i));
  }

  function markHoled() {
    setPositions(p => {
      const last = p[p.length-1];
      if (last.lie === 'holed' || last.lie === 'gimme') return p;
      return [...p, { lie:'holed', dist:0 }];
    });
  }

  function markGimme() {
    setPositions(p => {
      const last = p[p.length-1];
      if (last.lie === 'holed' || last.lie === 'gimme') return p;
      return [...p, { lie:'gimme', dist:0 }];
    });
  }

  const lastLie = positions[positions.length-1]?.lie;
  const isTerminal = lastLie === 'holed' || lastLie === 'gimme';

  // SG: skip segments pointing to gimme; bothMissed overrides the endpoint to 1ft
  const sgValues = positions.length >= 2
    ? positions.slice(0,-1).map((pos, i) => {
        const next = positions[i+1];
        if (next?.lie === 'gimme') return null;
        if (pos.bothMissed) return segmentSG({ lie:'green', dist: pos.dist }, { lie:'green', dist: 1 });
        return segmentSG(pos, next);
      })
    : [];
  const totalSG = sgValues.filter(v => v !== null).reduce((s,v) => s+v, 0);

  const catLabels = { ott:'OTT', app:'APP', arg:'ARG', putt:'PUTT' };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:17,color:'var(--gold)'}}>
              Hole {holeNum} · Par {holePar} · {holeYds}y
            </div>
            <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>
              Enter each ball position. Tap hole # to open. Green = feet.
            </div>
          </div>
          <button className="btn sm" onClick={()=>onSave(positions)}>Save</button>
        </div>

        {/* Position rows */}
        {positions.map((pos, i) => {
          const isGreen = pos.lie === 'green';
          const sg = sgValues[i] ?? null;
          const cat = (sg !== null && i < sgValues.length) ? segCategory(pos, holeIndex, par) : null;
          // Show bothMissed toggle: only on a green position that is immediately before a gimme
          const nextIsGimme = positions[i+1]?.lie === 'gimme';

          if (pos.lie === 'holed') {
            return (
              <div key={i} className="shot-row" style={{textAlign:'center',padding:'10px'}}>
                <span style={{fontSize:13,color:'var(--gold)',fontFamily:'DM Mono,monospace'}}>⛳ Holed</span>
                {i > 0 && <button className="btn sm danger" style={{marginLeft:10,padding:'3px 8px'}} onClick={()=>removePos(i)}>✕</button>}
              </div>
            );
          }

          if (pos.lie === 'gimme') {
            return (
              <div key={i} className="shot-row" style={{textAlign:'center',padding:'10px'}}>
                <span style={{fontSize:13,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>🤏 Gimme — no SG recorded</span>
                {i > 0 && <button className="btn sm danger" style={{marginLeft:10,padding:'3px 8px'}} onClick={()=>removePos(i)}>✕</button>}
              </div>
            );
          }

          return (
            <div key={i} className="shot-row">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span className="shot-num">Shot {i+1}</span>
                  {i===0 && <span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'var(--muted)',background:'var(--bg)',padding:'2px 6px',borderRadius:4}}>START</span>}
                  {sg !== null && cat && (
                    <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'var(--muted)',background:'var(--bg)',padding:'2px 6px',borderRadius:4}}>
                      {catLabels[cat]}
                    </span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {sg !== null && (
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:15,color:sg>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                      {sg>=0?'+':''}{sg}
                    </span>
                  )}
                  {i > 0 && <button className="btn sm danger" style={{padding:'3px 8px'}} onClick={()=>removePos(i)}>✕</button>}
                </div>
              </div>

              {/* Player selector */}
              <div className="lbl">Player</div>
              <div className="sel-row">
                {[team.player1, team.player2].map(p=>(
                  <button key={p} className={`sel-btn ${pos.player===p?'on':''}`}
                    onClick={()=>updPos(i,'player',p)}
                    style={{borderRadius:20}}
                  >{p}</button>
                ))}
              </div>

              {/* Lie selector */}
              <div className="lbl">Lie</div>
              <div className="sel-row">
                {LIES.map(l=>(
                  <button key={l} className={`sel-btn ${pos.lie===l?'on':''}`}
                    onClick={()=>updPos(i,'lie',l)}
                    style={l==='green'?{borderColor:'var(--green)',color:pos.lie==='green'?'#09150A':'var(--green)'}:{}}
                  >{l}</button>
                ))}
              </div>

              {/* Distance */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                <div className="lbl" style={{marginBottom:0,minWidth:60}}>
                  {isGreen ? 'Distance (ft)' : 'Distance (yds)'}
                </div>
                <input className="dist-inp" type="number" min="0" max={isGreen?300:600}
                  value={pos.dist||''} placeholder={isGreen?'15ft':'120y'}
                  onChange={e=>updPos(i,'dist',Number(e.target.value))}
                  style={isGreen?{borderColor:'rgba(82,196,98,.4)',color:'var(--green)'}:{}}
                />
                {i===0 && holeYds > 0 && pos.dist !== holeYds && (
                  <button className="btn sm sec" style={{padding:'3px 8px',fontSize:10}}
                    onClick={()=>updPos(0,'dist',holeYds)}>
                    {holeYds}y
                  </button>
                )}
              </div>

              {isGreen && (
                <div style={{fontSize:10,color:'var(--green)',fontFamily:'DM Mono,monospace',marginTop:3,opacity:.7}}>
                  Green distances are in feet
                </div>
              )}

              {/* Both missed → gimme: show when this green position precedes a gimme */}
              {isGreen && nextIsGimme && (
                <button
                  onClick={()=>updPos(i,'bothMissed',!pos.bothMissed)}
                  style={{
                    marginTop:8,width:'100%',padding:'8px',borderRadius:8,
                    border:`1px solid ${pos.bothMissed?'var(--green)':'var(--border2)'}`,
                    background:pos.bothMissed?'rgba(82,196,98,.10)':'var(--bg)',
                    color:pos.bothMissed?'var(--green)':'var(--muted)',
                    fontFamily:'DM Mono,monospace',fontSize:11,
                    cursor:'pointer',display:'flex',alignItems:'center',
                    justifyContent:'center',gap:8,letterSpacing:'.4px',
                    textTransform:'uppercase',
                  }}
                >
                  <span style={{fontSize:15}}>🎯</span>
                  {pos.bothMissed
                    ? `Both missed — each credited putt to 1ft ✓`
                    : 'Both players missed this putt?'}
                  {pos.bothMissed && sg !== null && (
                    <span style={{fontSize:10,color:'var(--muted)',marginLeft:4}}>
                      {sg>=0?'+':''}{sg} each
                    </span>
                  )}
                </button>
              )}

              {/* Carolina Mulligan — only on OTT or APP shots */}
              {(()=>{
                const cat = segCategory(pos, holeIndex, par);
                if (cat !== 'ott' && cat !== 'app') return null;
                const taken = pos.mulligan === true;
                return (
                  <button
                    onClick={()=>updPos(i,'mulligan',!taken)}
                    style={{
                      marginTop:8,width:'100%',padding:'8px',borderRadius:8,
                      border:`1px solid ${taken?'#C9A84C':'var(--border2)'}`,
                      background:taken?'rgba(201,168,76,.12)':'var(--bg)',
                      color:taken?'var(--gold)':'var(--muted)',
                      fontFamily:'DM Mono,monospace',fontSize:11,
                      cursor:'pointer',display:'flex',alignItems:'center',
                      justifyContent:'center',gap:8,letterSpacing:'.4px',
                      textTransform:'uppercase',
                    }}
                  >
                    <span style={{fontSize:16}}>🍺</span>
                    {taken ? 'Carolina Mulligan — Shotgunned ✓' : 'Take a Carolina Mulligan?'}
                    {taken && <span style={{fontSize:9,color:'var(--muted)',marginLeft:4}}>12 oz</span>}
                  </button>
                );
              })()}
            </div>
          );
        })}

        {/* Action buttons */}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          {!isTerminal && (
            <button className="btn sec" style={{flex:1}} onClick={addPos}>+ Add Position</button>
          )}
          {!isTerminal && (
            <button className="btn sec" style={{flex:1,borderColor:'var(--muted)',color:'var(--muted)'}} onClick={markGimme}>
              🤏 Gimme
            </button>
          )}
          {!isTerminal && (
            <button className="btn" style={{flex:1,background:'var(--green)'}} onClick={markHoled}>
              ⛳ Holed
            </button>
          )}
        </div>

        {/* SG Summary */}
        {sgValues.filter(v=>v!==null).length > 0 && (
          <div style={{marginTop:14,padding:'10px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div className="lbl" style={{marginBottom:0}}>Strokes Gained vs Scratch</div>
              <span style={{fontFamily:'DM Mono,monospace',fontSize:17,fontWeight:600,
                color:totalSG>=0?'var(--green)':'var(--red)'}}>
                {totalSG>=0?'+':''}{totalSG.toFixed(2)}
              </span>
            </div>
            {sgValues.map((sg, i) => {
              if (sg === null) return null;
              const cat = segCategory(positions[i], holeIndex, par);
              return (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',
                  borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:11,color:'var(--muted)'}}>
                    <span style={{color:'var(--cream)',fontSize:10,fontWeight:600}}>
                      {positions[i].bothMissed ? `${positions[i].player || '—'} + other` : (positions[i].player || '—')}
                    </span>
                    {' '}{catLabels[cat]}
                    {positions[i].mulligan && <span style={{marginLeft:4,fontSize:11}}>🍺</span>}
                    {positions[i].bothMissed && <span style={{marginLeft:4,fontSize:11}}>🎯</span>}
                    <span style={{marginLeft:4,fontSize:10,color:'var(--muted)'}}>
                      {positions[i].lie} {positions[i].dist}{positions[i].lie==='green'?'ft':'y'}
                      {positions[i].bothMissed ? ' → 1ft' : ''}
                    </span>
                  </span>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:12,
                    color:sg>=0?'var(--green)':'var(--red)'}}>
                    {sg>=0?'+':''}{sg}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom save button */}
        <button className="btn" style={{marginTop:14,background:'var(--gold)'}} onClick={()=>onSave(positions)}>
          Save Hole
        </button>
      </div>
    </div>
  );
}

function ScoresView({ state, setState }) {
  const { teams, par } = state;
  const [selTeam, setSelTeam] = useState(teams[0]?.id||null);
  const [trackingHole, setTrackingHole] = useState(null);
  useEffect(() => {
    if (!selTeam && teams.length > 0) setSelTeam(teams[0].id);
  }, [teams]);
  const team = teams.find(t=>t.id===selTeam);

  function setScore(h, val) {
    if (!team) return;
    setState(p=>({...p,teams:p.teams.map(t=>{
      if(t.id!==team.id)return t;
      const sc=[...t.scores]; sc[h]=val; return {...t,scores:sc};
    })}));
  }

  function saveShots(holeIndex, shots) {
    const lastLie = shots[shots.length-1]?.lie;
    const isTerminal = lastLie === 'holed' || lastLie === 'gimme';
    const calcScore = isTerminal ? String(shots.length - 1) : null;
    setState(p=>({...p,teams:p.teams.map(t=>{
      if(t.id!==team.id)return t;
      const sh=[...(t.shots||Array(18).fill(null).map(()=>[]))];
      sh[holeIndex]=shots;
      const sc=[...t.scores];
      if(calcScore !== null) sc[holeIndex]=calcScore;
      return {...t,shots:sh,scores:sc};
    })}));
    setTrackingHole(null);
  }

  const frontTotal = team ? team.scores.slice(0,9).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const backTotal  = team ? team.scores.slice(9,18).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const frontPar   = par.slice(0,9).reduce((a,b)=>a+b,0);
  const backPar    = par.slice(9,18).reduce((a,b)=>a+b,0);
  const frontEntered = team ? team.scores.slice(0,9).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;
  const backEntered  = team ? team.scores.slice(9,18).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;
  const teamHcp    = team ? teamHandicap(team.hcp1||0, team.hcp2||0) : 0;

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
      <div className="sec" style={{paddingBottom:0}}>
        <select
          className="inp"
          value={selTeam||''}
          onChange={e=>setSelTeam(e.target.value)}
          style={{marginBottom:0,fontWeight:600}}
        >
          <option value="">— Select team —</option>
          {teams.map(t=>(
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
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
                <div className="hn" style={{color:'var(--gold)'}}>YDS</div>
                <div className="hn" style={{color:'var(--gold)'}}>PAR</div>
                <div style={{fontSize:10,color:'var(--gold)',fontFamily:'DM Mono,monospace',paddingLeft:4}}>SCORE</div>
                <div style={{fontSize:10,color:'var(--gold)',fontFamily:'DM Mono,monospace',textAlign:'right'}}>+/-</div>
              </div>

              {/* Front 9 */}
              {Array.from({length:9},(_,h)=>(
                <div key={h}>
                  <div className="sc-grid">
                    <div style={{cursor:'pointer',textAlign:'center',borderRadius:4,border:teamHcp>0&&HOLE_HCP[h]<=teamHcp?'1px solid rgba(201,168,76,.35)':'1px solid transparent',padding:'1px 2px'}} onClick={()=>setTrackingHole(h)}>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:(team.shots?.[h]?.length||0)>1?'var(--gold)':'var(--muted)'}}>{h+1}</div>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:8,color:'var(--border2)',marginTop:-1}}>h{HOLE_HCP[h]}</div>
                    </div>
                    <div className="hn" style={{fontSize:10}}>{HOLE_YDS[h]}</div>
                    <div className="hn">{par[h]}</div>
                    <input className="hinp" type="number" min="1" max="12"
                      value={team.scores[h]??''} onChange={e=>setScore(h,e.target.value)}
                      onFocus={e=>e.target.select()} />
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h],par[h])}}>
                      {team.scores[h]!==''&&team.scores[h]!==null&&team.scores[h]!==undefined ? fmt(Number(team.scores[h])-par[h]).text : '--'}
                    </div>
                  </div>
                  {(team.shots?.[h]?.length||0)>1 && (()=>{
                    const sgs=calcPositionsSG(team.shots[h]||[]);
                    const tot=sgs.reduce((s,v)=>s+v,0);
                    return(
                      <div style={{paddingLeft:4,paddingBottom:3}}>
                        <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:tot>=0?'var(--green)':'var(--red)'}}>
                          SG {tot>=0?'+':''}{tot.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
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
                    <div style={{cursor:'pointer',textAlign:'center',borderRadius:4,border:teamHcp>0&&HOLE_HCP[h+9]<=teamHcp?'1px solid rgba(201,168,76,.35)':'1px solid transparent',padding:'1px 2px'}} onClick={()=>setTrackingHole(h+9)}>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:(team.shots?.[h+9]?.length||0)>1?'var(--gold)':'var(--muted)'}}>{h+10}</div>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:8,color:'var(--border2)',marginTop:-1}}>h{HOLE_HCP[h+9]}</div>
                    </div>
                    <div className="hn" style={{fontSize:10}}>{HOLE_YDS[h+9]}</div>
                    <div className="hn">{par[h+9]}</div>
                    <input className="hinp" type="number" min="1" max="12"
                      value={team.scores[h+9]??''} onChange={e=>setScore(h+9,e.target.value)}
                      onFocus={e=>e.target.select()} />
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h+9],par[h+9])}}>
                      {team.scores[h+9]!==''&&team.scores[h+9]!==null&&team.scores[h+9]!==undefined ? fmt(Number(team.scores[h+9])-par[h+9]).text : '--'}
                    </div>
                  </div>
                  {(team.shots?.[h+9]?.length||0)>1 && (()=>{
                    const sgs=calcPositionsSG(team.shots[h+9]||[]);
                    const tot=sgs.reduce((s,v)=>s+v,0);
                    return(
                      <div style={{paddingLeft:4,paddingBottom:3}}>
                        <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:tot>=0?'var(--green)':'var(--red)'}}>
                          SG {tot>=0?'+':''}{tot.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
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
                        {proTotal!==null?` · Best ${tournament?.proCount||1}: ${fmt(proTotal).text}`:''}
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
                      <div style={{marginTop:8,fontSize:11,color:'var(--muted)'}}>★ top {proCount} counted in combined score</div>
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
// Build a full player-level stats object across ALL teams
function buildAllPlayerStats(teams, par) {
  const players = {};
  teams.forEach(team => {
    [team.player1, team.player2].forEach(name => {
      if (!name) return;
      players[name] = players[name] || {
        name, team: team.name,
        sg: { ott:0, app:0, arg:0, putt:0, total:0 },
        shots:0, holes:0,
        bestHole: null, worstHole: null,
        lies: { tee:0, fairway:0, rough:0, bunker:0, fringe:0, green:0 },
        mulligans: 0, mulliganSGTotal: 0,
        bestMulligan: null, worstMulligan: null,
      };
    });
    (team.shots||[]).forEach((positions, h) => {
      if (!positions || positions.length < 2) return;
      const segs = calcPositionsSG(positions);
      const holeSG = segs.reduce((s,v)=>s+v,0);
      positions.slice(0,-1).forEach((pos, i) => {
        const next = positions[i+1];
        // Skip gimme segments — no SG recorded
        if (next?.lie === 'gimme') return;
        const pName = pos.player;
        if (!pName || !players[pName]) return;
        const p = players[pName];
        const sgVal = segs[i];
        const cat = segCategory(pos, h, par);
        p.sg[cat] = parseFloat((p.sg[cat] + sgVal).toFixed(2));
        p.sg.total = parseFloat((p.sg.total + sgVal).toFixed(2));
        p.shots++;
        if (pos.lie && p.lies[pos.lie] !== undefined) p.lies[pos.lie]++;
        if (pos.mulligan) {
          p.mulligans++;
          p.mulliganSGTotal = parseFloat((p.mulliganSGTotal + sgVal).toFixed(2));
          if (p.bestMulligan  === null || sgVal > p.bestMulligan.sg)  p.bestMulligan  = { hole:h+1, sg: parseFloat(sgVal.toFixed(2)), cat };
          if (p.worstMulligan === null || sgVal < p.worstMulligan.sg) p.worstMulligan = { hole:h+1, sg: parseFloat(sgVal.toFixed(2)), cat };
        }
        // Track best/worst hole contribution
        if (i === 0) {
          p.holes++;
          if (p.bestHole  === null || holeSG > p.bestHole.sg)  p.bestHole  = { hole:h+1, sg: parseFloat(holeSG.toFixed(2)) };
          if (p.worstHole === null || holeSG < p.worstHole.sg) p.worstHole = { hole:h+1, sg: parseFloat(holeSG.toFixed(2)) };
        }
        // bothMissed: the OTHER player also gets credited for hitting the same putt to 1ft
        if (pos.bothMissed) {
          const otherName = pName === team.player1 ? team.player2 : team.player1;
          if (otherName && players[otherName]) {
            const op = players[otherName];
            op.sg.putt  = parseFloat((op.sg.putt  + sgVal).toFixed(2));
            op.sg.total = parseFloat((op.sg.total + sgVal).toFixed(2));
            op.shots++;
          }
        }
      });
    });
  });
  return players;
}

function sgFmtFn(v) { return `${v>=0?'+':''}${v.toFixed(2)}`; }
function sgColorFn(v) { return v >= 0 ? 'var(--green)' : 'var(--red)'; }

function StatsView({ state }) {
  const { teams, par } = state;
  const [mode, setMode] = useState('field'); // 'field' | team id
  // No auto-select needed — field view works without a selected team
  const team = mode !== 'field' ? teams.find(t=>t.id===mode) : null;

  const allPlayers = useMemo(() => buildAllPlayerStats(teams, par), [teams, par]);
  const playerList = Object.values(allPlayers).filter(p => p.shots > 0);
  const hasAnyData = playerList.length > 0;

  // ── Field / tournament-wide stats ──────────────────────────────────────
  function FieldView() {
    if (!hasAnyData) return (
      <div className="alert">
        No shot data yet. On the Scores tab, tap any hole number to log shots.
      </div>
    );

    const cats = [
      { key:'total', label:'Total SG',      icon:'⭐' },
      { key:'ott',   label:'Off the Tee',   icon:'🏌️' },
      { key:'app',   label:'Approach',      icon:'🎯' },
      { key:'arg',   label:'Around Green',  icon:'🌀' },
      { key:'putt',  label:'Putting',       icon:'⛳' },
    ];

    // Most shots hit (the grinder)
    const mostShots = [...playerList].sort((a,b)=>b.shots-a.shots);
    // Biggest contributor (% of team's shots)
    const lieLeaders = {};
    ['rough','bunker'].forEach(lie => {
      const sorted = [...playerList].sort((a,b)=>b.lies[lie]-a.lies[lie]);
      if (sorted[0]?.lies[lie] > 0) lieLeaders[lie] = sorted[0];
    });

    return (<>
      {/* Category leaders */}
      {cats.map(({key,label,icon}) => {
        const sorted = [...playerList].filter(p=>p.sg[key]!==0)
          .sort((a,b)=>b.sg[key]-a.sg[key]);
        if (sorted.length === 0) return null;
        const leader = sorted[0];
        const worst  = sorted[sorted.length-1];
        return (
          <div key={key} className="card" style={{padding:'12px 14px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:16}}>{icon}</span>
                <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.5px'}}>{label}</span>
              </div>
            </div>
            {sorted.map((p,i) => {
              const val = p.sg[key];
              const maxAbs = Math.max(...sorted.map(x=>Math.abs(x.sg[key])),0.01);
              const barW = Math.round(Math.abs(val)/maxAbs*100);
              return (
                <div key={p.name} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom: i<sorted.length-1?'1px solid var(--border)':'none'}}>
                  <div style={{fontFamily:'Playfair Display,serif',fontSize:16,color:i===0?'var(--gold)':'var(--muted)',width:20,textAlign:'center',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>{p.team}</div>
                    <div style={{marginTop:3,height:4,borderRadius:2,background:'var(--bg)',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${barW}%`,borderRadius:2,background:val>=0?'var(--green)':'var(--red)'}}/>
                    </div>
                  </div>
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,color:sgColorFn(val),flexShrink:0}}>
                    {sgFmtFn(val)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Fun stats */}
      <div className="card" style={{padding:'12px 14px',marginBottom:8}}>
        <div className="lbl" style={{marginBottom:8}}>🏅 Fun Stats</div>

        {/* Shot count leaders */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:6,textTransform:'uppercase',letterSpacing:'.4px'}}>Most Shots Hit</div>
          {mostShots.slice(0,5).map((p,i) => (
            <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'Playfair Display,serif',fontSize:14,color:'var(--gold)',width:16}}>{i+1}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{p.team}</div>
                </div>
              </div>
              <span style={{fontFamily:'DM Mono,monospace',fontSize:16,color:'var(--cream)'}}>{p.shots}</span>
            </div>
          ))}
        </div>

        {/* Best & worst single hole */}
        {(()=>{
          const bests = playerList.filter(p=>p.bestHole).sort((a,b)=>b.bestHole.sg-a.bestHole.sg);
          const worsts = playerList.filter(p=>p.worstHole).sort((a,b)=>a.worstHole.sg-b.worstHole.sg);
          if (!bests.length) return null;
          return (<>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:6,textTransform:'uppercase',letterSpacing:'.4px'}}>🔥 Best Single Hole</div>
              {bests.slice(0,3).map(p=>(
                <div key={p.name} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                  <div>
                    <span style={{fontSize:12,fontWeight:600}}>{p.name}</span>
                    <span style={{fontSize:10,color:'var(--muted)',marginLeft:6}}>H{p.bestHole.hole} · {p.team}</span>
                  </div>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--green)',fontWeight:600}}>{sgFmtFn(p.bestHole.sg)}</span>
                </div>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:6,textTransform:'uppercase',letterSpacing:'.4px'}}>🥶 Toughest Hole</div>
              {worsts.slice(0,3).map(p=>(
                <div key={p.name} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                  <div>
                    <span style={{fontSize:12,fontWeight:600}}>{p.name}</span>
                    <span style={{fontSize:10,color:'var(--muted)',marginLeft:6}}>H{p.worstHole.hole} · {p.team}</span>
                  </div>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--red)',fontWeight:600}}>{sgFmtFn(p.worstHole.sg)}</span>
                </div>
              ))}
            </div>
          </>);
        })()}

        {/* Carolina Mulligan stats */}
        {(()=>{
          const mulliganPlayers = [...playerList]
            .filter(p => p.mulligans > 0)
            .sort((a,b) => b.mulligans - a.mulligans);
          if (!mulliganPlayers.length) return null;

          const totalMulligans = mulliganPlayers.reduce((s,p)=>s+p.mulligans,0);
          const totalOz = totalMulligans * 12;
          const sgPerMulligan = mulliganPlayers.map(p=>({
            ...p, sgPer: p.mulligans > 0 ? parseFloat((p.mulliganSGTotal/p.mulligans).toFixed(2)) : 0
          })).sort((a,b)=>b.sgPer-a.sgPer);

          const bestMulliganShot = [...playerList]
            .filter(p=>p.bestMulligan)
            .sort((a,b)=>b.bestMulligan.sg-a.bestMulligan.sg)[0];
          const worstMulliganShot = [...playerList]
            .filter(p=>p.worstMulligan)
            .sort((a,b)=>a.worstMulligan.sg-b.worstMulligan.sg)[0];

          return (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:'var(--gold)',fontFamily:'DM Mono,monospace',marginBottom:8,
                textTransform:'uppercase',letterSpacing:'.4px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>🍺 Carolina Mulligan Board</span>
                <span style={{color:'var(--muted)',fontSize:10}}>{totalMulligans} taken · {totalOz} oz total</span>
              </div>

              {/* Mulligan count leaderboard */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:5,letterSpacing:'.3px'}}>MOST MULLIGANS</div>
                {mulliganPlayers.map((p,i)=>(
                  <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontFamily:'Playfair Display,serif',fontSize:14,color:'var(--gold)',width:16}}>{i+1}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:600}}>{p.name}</div>
                        <div style={{fontSize:10,color:'var(--muted)'}}>{p.team}</div>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:15,color:'var(--gold)'}}>
                        {'🍺'.repeat(Math.min(p.mulligans,5))}{p.mulligans>5?` x${p.mulligans}`:''}
                      </div>
                      <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace'}}>{p.mulligans * 12} oz</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SG per mulligan */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:5,letterSpacing:'.3px'}}>SG PER MULLIGAN</div>
                {sgPerMulligan.map((p,i)=>(
                  <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:600}}>{p.name}</span>
                      <span style={{fontSize:10,color:'var(--muted)',marginLeft:6}}>{p.team} · {p.mulligans} mulligans</span>
                    </div>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,color:sgColorFn(p.sgPer)}}>
                      {sgFmtFn(p.sgPer)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Best & worst single mulligan */}
              <div style={{display:'flex',gap:8}}>
                {bestMulliganShot && (
                  <div style={{flex:1,background:'rgba(82,196,98,.07)',border:'1px solid rgba(82,196,98,.2)',borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'var(--green)',fontFamily:'DM Mono,monospace',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Best 🍺</div>
                    <div style={{fontSize:12,fontWeight:600}}>{bestMulliganShot.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>H{bestMulliganShot.bestMulligan.hole} · {bestMulliganShot.bestMulligan.cat.toUpperCase()}</div>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:16,color:'var(--green)',fontWeight:600,marginTop:2}}>
                      {sgFmtFn(bestMulliganShot.bestMulligan.sg)}
                    </div>
                  </div>
                )}
                {worstMulliganShot && (
                  <div style={{flex:1,background:'rgba(224,82,82,.07)',border:'1px solid rgba(224,82,82,.2)',borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'var(--red)',fontFamily:'DM Mono,monospace',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Worst 🍺</div>
                    <div style={{fontSize:12,fontWeight:600}}>{worstMulliganShot.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>H{worstMulliganShot.worstMulligan.hole} · {worstMulliganShot.worstMulligan.cat.toUpperCase()}</div>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:16,color:'var(--red)',fontWeight:600,marginTop:2}}>
                      {sgFmtFn(worstMulliganShot.worstMulligan.sg)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Trouble finders */}
        {(()=>{
          const roughHounds = [...playerList].sort((a,b)=>b.lies.rough-a.lies.rough).filter(p=>p.lies.rough>0);
          const sandmen = [...playerList].sort((a,b)=>b.lies.bunker-a.lies.bunker).filter(p=>p.lies.bunker>0);
          if (!roughHounds.length && !sandmen.length) return null;
          return (<>
            {roughHounds.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:6,textTransform:'uppercase',letterSpacing:'.4px'}}>🌿 Rough Rider</div>
                {roughHounds.slice(0,3).map((p,i)=>(
                  <div key={p.name} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{fontSize:12}}>{p.name} <span style={{fontSize:10,color:'var(--muted)'}}>{p.team}</span></div>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--muted)'}}>{p.lies.rough} times</span>
                  </div>
                ))}
              </div>
            )}
            {sandmen.length > 0 && (
              <div>
                <div style={{fontSize:11,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:6,textTransform:'uppercase',letterSpacing:'.4px'}}>🏖️ Sand Trap Regular</div>
                {sandmen.slice(0,3).map((p,i)=>(
                  <div key={p.name} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{fontSize:12}}>{p.name} <span style={{fontSize:10,color:'var(--muted)'}}>{p.team}</span></div>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--muted)'}}>{p.lies.bunker} times</span>
                  </div>
                ))}
              </div>
            )}
          </>);
        })()}
      </div>
    </>);
  }

  // ── Team detail view ───────────────────────────────────────────────────
  function TeamDetailView({ team }) {
    const sg = calcTeamSG(team, par);
    const totalShots = (team.shots||[]).filter(h=>h&&h.length>=2).reduce((s,h)=>s+(h.length-1),0);
    const holesSG = Array.from({length:18},(_,h)=>{
      const positions = (team.shots||[])[h] || [];
      if (positions.length < 2) return 0;
      return calcPositionsSG(positions).reduce((s,v)=>s+v,0);
    });
    const catInfo = [
      {key:'ott',label:'Off Tee'},{key:'app',label:'Approach'},
      {key:'arg',label:'Around Green'},{key:'putt',label:'Putting'},
    ];
    const players = [team.player1, team.player2];
    const playerSG = {};
    players.forEach(p => { playerSG[p] = { ott:0,app:0,arg:0,putt:0,shots:0,mulligans:0 }; });
    (team.shots||[]).forEach((positions,h) => {
      if (!positions||positions.length<2) return;
      positions.slice(0,-1).forEach((pos,i) => {
        const pn = pos.player; if (!pn||!playerSG[pn]) return;
        const sgVal = segmentSG(positions[i],positions[i+1]);
        const cat = segCategory(pos,h,par);
        playerSG[pn][cat] = parseFloat((playerSG[pn][cat]+sgVal).toFixed(2));
        playerSG[pn].shots++;
        if (pos.mulligan) playerSG[pn].mulligans = (playerSG[pn].mulligans||0) + 1;
      });
    });

    if (totalShots === 0) return (
      <div className="alert">No shot data for this team yet.</div>
    );

    return (<>
      {/* Total */}
      <div className="card" style={{textAlign:'center',padding:'16px 14px',marginBottom:8}}>
        <div className="lbl">Total SG vs Scratch</div>
        <div style={{fontFamily:'DM Mono,monospace',fontSize:40,fontWeight:600,color:sgColorFn(sg.total)}}>
          {sgFmtFn(sg.total)}
        </div>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>
          {totalShots} shots · {holesSG.filter(v=>v!==0).length} holes tracked
        </div>
      </div>

      {/* Category grid */}
      <div className="sg-grid" style={{marginBottom:8}}>
        {catInfo.map(({key,label}) => {
          const val = sg[key];
          return (
            <div key={key} className="card" style={{padding:'12px',marginBottom:0}}>
              <div className="lbl">{label}</div>
              <div style={{fontFamily:'DM Mono,monospace',fontSize:24,color:sgColorFn(val),fontWeight:600}}>
                {val!==0?sgFmtFn(val):'--'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-player */}
      <div className="card" style={{marginBottom:8}}>
        <div className="lbl" style={{marginBottom:8}}>Player Breakdown</div>
        {players.map(p => {
          const d = playerSG[p]; if (!d||d.shots===0) return null;
          const total = parseFloat((d.ott+d.app+d.arg+d.putt).toFixed(2));
          return (
            <div key={p} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontWeight:600,fontSize:14}}>{p}</span>
                <div style={{textAlign:'right'}}>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:16,fontWeight:600,color:sgColorFn(total)}}>
                    {sgFmtFn(total)}
                  </span>
                  <span style={{fontSize:10,color:'var(--muted)',marginLeft:8,fontFamily:'DM Mono,monospace'}}>{d.shots} shots</span>
                  {d.mulligans > 0 && <span style={{fontSize:10,color:'var(--gold)',marginLeft:6,fontFamily:'DM Mono,monospace'}}>🍺×{d.mulligans}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                {[['OTT',d.ott],['APP',d.app],['ARG',d.arg],['PUTT',d.putt]].map(([lbl,val])=>(
                  val!==0 && (
                    <div key={lbl} style={{textAlign:'center'}}>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:9,color:'var(--muted)'}}>{lbl}</div>
                      <div style={{fontFamily:'DM Mono,monospace',fontSize:13,color:sgColorFn(val)}}>{sgFmtFn(val)}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hole-by-hole */}
      <div className="card" style={{padding:'10px 14px'}}>
        <div className="lbl" style={{marginBottom:6}}>Hole by Hole</div>
        {holesSG.map((sgVal,h)=>{
          if ((team.shots?.[h]?.length||0)<2) return null;
          const width = Math.min(100,Math.abs(sgVal)*40);
          return (
            <div key={h} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)',width:22}}>H{h+1}</div>
              <div style={{flex:1,position:'relative',height:6,background:'var(--bg)',borderRadius:3,overflow:'hidden'}}>
                <div style={{position:'absolute',height:'100%',width:`${width}%`,borderRadius:3,
                  background:sgVal>=0?'var(--green)':'var(--red)',
                  left:sgVal>=0?'50%':`calc(50% - ${width}%)`}}/>
                <div style={{position:'absolute',top:0,left:'50%',width:1,height:'100%',background:'var(--border2)'}}/>
              </div>
              <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:sgColorFn(sgVal),width:42,textAlign:'right'}}>
                {sgFmtFn(sgVal)}
              </div>
            </div>
          );
        })}
      </div>
    </>);
  }

  return (
    <div className="page">
      <div className="sec" style={{paddingBottom:0}}>
        <div style={{display:'flex',gap:8}}>
          <button
            className={`btn sm ${mode==='field'?'':'sec'}`}
            style={{flexShrink:0,padding:'10px 14px'}}
            onClick={()=>setMode('field')}
          >
            🏆 Field
          </button>
          <select
            className="inp"
            style={{marginBottom:0,flex:1}}
            value={mode==='field'?'':mode}
            onChange={e=>setMode(e.target.value)}
          >
            <option value="">— Select team —</option>
            {teams.map(t=>(
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="sec" style={{paddingTop:12}}>
        {mode==='field'
          ? <FieldView />
          : team ? <TeamDetailView team={team} /> : null
        }
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(() => {
    const s = loadLocal();
    return s ? { ...s, par: DEFAULT_PAR } : INIT;
  });
  const [view, setView]           = useState('leaderboard');
  const [adminMode, setAdminMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [pwInput, setPwInput]     = useState('');
  const [pwError, setPwError]     = useState(false);

  // lastFirestoreState: JSON string of the last state we received FROM Firestore.
  // We compare current state to this before saving — if they match, the change
  // came from Firestore and we skip the save to prevent echo loops.
  // Initialized to INIT so a React Strict Mode double-mount never writes the
  // empty initial state back to Firestore on first render.
  const lastFirestoreState = useRef(JSON.stringify(INIT));

  // userEditedAt: timestamp of last local edit. We refuse Firestore updates
  // for 5 seconds after a local edit so typing doesn't get wiped mid-keystroke.
  const userEditedAt = useRef(0);

  // mounted: skip the very first effect run (initial render — no need to save)
  const mounted   = useRef(false);
  const saveTimer = useRef(null);

  // stateRef: always holds the current state so the onSnapshot closure (which
  // runs once with [] deps) can do fresh comparisons without going stale.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Inject CSS once
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // ── Real-time Firestore listener ────────────────────────────────────
  useEffect(() => {
    const [col, docId] = FS_DOC.split('/');
    const unsub = onSnapshot(
      doc(db, col, docId),
      (snap) => {
        // Only advance to 'live' from initial/offline states — never overwrite a
        // write error. A failed setDoc sets 'error:...' and we must not mask it
        // just because the listener fires again (e.g. from another client's write).
        setSyncStatus(prev =>
          prev === 'connecting' || prev === 'offline' ? 'live' : prev
        );
        if (!snap.exists()) return;
        const remote = fromFirestore(snap.data().state);
        if (!remote) return;

        // Don't overwrite local state while user is actively editing
        if (Date.now() - userEditedAt.current < 5000) return;

        const merged = { ...remote, par: DEFAULT_PAR };
        const mergedStr = JSON.stringify(merged);

        // Use stateRef (not stale closure `state`) so this comparison is always fresh
        const currentStr = JSON.stringify(stateRef.current);
        if (mergedStr === currentStr) return;

        // Accept the Firestore data — record it so save effect knows to skip
        lastFirestoreState.current = mergedStr;
        setState(merged);
        saveLocal(merged);
        // Firestore round-trip confirmed — mark as live
        setSyncStatus('live');
      },
      (err) => {
        console.warn('Firestore error:', err);
        setSyncStatus('offline');
      }
    );
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save local changes to Firestore ────────────────────────────────
  useEffect(() => {
    // Skip the initial render — nothing new to save on first mount
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    saveLocal(state);

    const stateStr = JSON.stringify(state);

    // If this state matches the last thing we got from Firestore, it IS the
    // Firestore data — don't save it back or we'll create an infinite loop
    if (stateStr === lastFirestoreState.current) return;

    // This is a real local change — record when it happened
    userEditedAt.current = Date.now();

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const clean = toFirestore(JSON.parse(stateStr));
        const [col, docId] = FS_DOC.split('/');
        await setDoc(doc(db, col, docId), { state: clean, updatedAt: Date.now() });
        // Record that this state is now what Firestore has
        lastFirestoreState.current = stateStr;
        setSyncStatus('live');
      } catch (e) {
        console.error('Firestore save failed:', e);
        setSyncStatus('error:' + (e?.code || e?.message || 'unknown'));
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const { tournament } = state;

  const TABS = [
    { id: 'leaderboard', label: 'Board',  ico: '🏆' },
    { id: 'skins',       label: 'Skins',  ico: '💰' },
    { id: 'scores',      label: 'Scores', ico: '✏️' },
    { id: 'stats',       label: 'Stats',  ico: '📈' },
    { id: 'pros',        label: 'Pros',   ico: '⛳' },
    { id: 'setup',       label: 'Setup',  ico: '⚙️' },
  ];

  const syncColor =
    syncStatus === 'live'           ? 'var(--green)'  :
    syncStatus === 'offline'        ? 'var(--red)'    :
    syncStatus === 'syncing'        ? 'var(--gold)'   :
    syncStatus.startsWith('error:') ? 'var(--red)'    : 'var(--muted)';

  const syncLabel =
    syncStatus === 'live'           ? '● live'    :
    syncStatus === 'offline'        ? '● offline' :
    syncStatus === 'syncing'        ? '● saving'  :
    syncStatus.startsWith('error:') ? '⚠ ' + syncStatus.replace('error:', '') :
    '● connecting';

  return (
    <div className="app">
      {/* Admin password prompt */}
      {showAdminPrompt && (
        <div className="modal-bg" onClick={()=>{setShowAdminPrompt(false);setPwInput('');setPwError(false);}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{paddingBottom:36}}>
            <div className="modal-hdr">
              <div style={{fontFamily:'Playfair Display,serif',fontSize:17,color:'var(--gold)'}}>Admin Access</div>
              <button className="btn sm sec" onClick={()=>{setShowAdminPrompt(false);setPwInput('');setPwError(false);}}>✕</button>
            </div>
            <label className="lbl">Password</label>
            <input
              className="inp"
              type="password"
              placeholder="Enter admin password"
              value={pwInput}
              autoFocus
              onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
              onKeyDown={e=>{
                if(e.key==='Enter'){
                  if(pwInput===ADMIN_PASSWORD){setAdminMode(true);setShowAdminPrompt(false);setPwInput('');setPwError(false);}
                  else setPwError(true);
                }
              }}
              style={pwError?{borderColor:'var(--red)'}:{}}
            />
            {pwError && <div style={{fontSize:11,color:'var(--red)',marginTop:-4,marginBottom:8,fontFamily:'DM Mono,monospace'}}>Incorrect password</div>}
            <button className="btn" onClick={()=>{
              if(pwInput===ADMIN_PASSWORD){setAdminMode(true);setShowAdminPrompt(false);setPwInput('');setPwError(false);}
              else setPwError(true);
            }}>Unlock</button>
          </div>
        </div>
      )}

      <div className="hdr">
        <div className="hdr-left">
          <h1>{tournament.name || 'Golf Tournament'}</h1>
          <p>
            {tournament.pgaEvent || 'No PGA event set'}
            {tournament.date ? ` · ${tournament.date}` : ''}
            {' '}
            <span style={{ fontSize: 9, fontFamily: 'DM Mono,monospace', color: syncColor }}>
              {syncLabel}
            </span>
          </p>
        </div>
        <button className="btn sm sec" style={{ width: 'auto' }} onClick={() => {
          if(adminMode) setAdminMode(false);
          else { setPwInput(''); setPwError(false); setShowAdminPrompt(true); }
        }}>
          {adminMode ? '🔓 Admin' : '🔒 Admin'}
        </button>
      </div>

      {view === 'setup'       && <SetupView      state={state} setState={setState} adminMode={adminMode} setSyncStatus={setSyncStatus} />}
      {view === 'pros'        && <ProsView        state={state} />}
      {view === 'scores'      && <ScoresView      state={state} setState={setState} />}
      {view === 'leaderboard' && <LeaderboardView state={state} />}
      {view === 'skins'       && <SkinsView       state={state} />}
      {view === 'stats'       && <StatsView       state={state} />}

      <nav className="bnav">
        {TABS.map(t => (
          <button key={t.id} className={`nb ${view === t.id ? 'on' : ''}`} onClick={() => setView(t.id)}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

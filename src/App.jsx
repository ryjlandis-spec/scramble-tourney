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
    setState(p => ({...p, teams:[...p.teams, {...newTeam, id:Date.now().toString(), proIds:[], scores:Array(18).fill(''), hcp1:newTeam.hcp1||0, hcp2:newTeam.hcp2||0}]}));
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
                      {t.proIds?.length||0}/6 pros · HCP: {teamHandicap(t.hcp1||0,t.hcp2||0)}
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
            {t.name} {t.proIds?.length===6?'✓':`(${t.proIds?.length||0}/6)`}
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
                    {team.proIds?.length||0}/6
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

function ScoresView({ state, setState }) {
  const { teams, par } = state;
  const [selTeam, setSelTeam] = useState(teams[0]?.id||null);
  const team = teams.find(t=>t.id===selTeam);

  function setScore(h, val) {
    if (!team) return;
    setState(p=>({...p,teams:p.teams.map(t=>{
      if(t.id!==team.id)return t;
      const sc=[...t.scores]; sc[h]=val; return {...t,scores:sc};
    })}));
  }

  const frontTotal = team ? team.scores.slice(0,9).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const backTotal  = team ? team.scores.slice(9,18).reduce((s,v)=>s+(v!==''&&v!==null?Number(v):0),0) : 0;
  const frontPar   = par.slice(0,9).reduce((a,b)=>a+b,0);
  const backPar    = par.slice(9,18).reduce((a,b)=>a+b,0);
  const frontEntered = team ? team.scores.slice(0,9).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;
  const backEntered  = team ? team.scores.slice(9,18).filter(s=>s!==''&&s!==null&&s!==undefined).length : 0;

  return (
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
                <div key={h} className="sc-grid">
                  <div className="hn">{h+1}</div>
                  <div className="hn">{par[h]}</div>
                  <input className="hinp" type="number" min="1" max="12"
                    value={team.scores[h]??''} onChange={e=>setScore(h,e.target.value)}
                    onFocus={e=>e.target.select()} />
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h],par[h])}}>
                    {team.scores[h]!==''&&team.scores[h]!==null&&team.scores[h]!==undefined ? fmt(Number(team.scores[h])-par[h]).text : '--'}
                  </div>
                </div>
              ))}

              {/* Front 9 subtotal */}
              {frontEntered > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--muted)'}}>OUT ({frontEntered}/9)</span>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:13}}>{frontTotal}</span>
                    <span className={`sc ${fmt(frontTotal-frontPar*(frontEntered/9|0)).cls}`} style={{fontSize:11}}>
                      {frontEntered===9?fmt(frontTotal-frontPar).text:`thru ${frontEntered}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Back 9 */}
              {Array.from({length:9},(_,h)=>(
                <div key={h+9} className="sc-grid">
                  <div className="hn">{h+10}</div>
                  <div className="hn">{par[h+9]}</div>
                  <input className="hinp" type="number" min="1" max="12"
                    value={team.scores[h+9]??''} onChange={e=>setScore(h+9,e.target.value)}
                    onFocus={e=>e.target.select()} />
                  <div style={{fontFamily:'DM Mono,monospace',fontSize:11,textAlign:'right',color:scoreColor(team.scores[h+9],par[h+9])}}>
                    {team.scores[h+9]!==''&&team.scores[h+9]!==null&&team.scores[h+9]!==undefined ? fmt(Number(team.scores[h+9])-par[h+9]).text : '--'}
                  </div>
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
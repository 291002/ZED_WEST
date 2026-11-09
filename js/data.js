'use strict';
/* ZED West — demonstration data model.
   EVERYTHING in this file is simulated (seeded, deterministic) so every tab agrees with every other tab.
   Replace the generators with adapters in js/integrations.js when PMS / BMS / IoT feeds are connected.
   The compound layout (zones, buildings, gates) is CONCEPTUAL — it is not the verified ZED West masterplan. */
window.ZW = (() => {
  // ---------- seeded RNG ----------
  let seed = 20261109;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + rnd() * (b - a);
  const ri = (a, b) => Math.round(rr(a, b));
  const pick = a => a[Math.floor(rnd() * a.length)];
  const sum = a => a.reduce((x, y) => x + (y || 0), 0);
  const r1 = v => Math.round(v * 10) / 10;

  // ---------- calendar ----------
  const MONTHS = ['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'];
  const MSHORT = MONTHS.map(m => m.slice(0, 3));
  const CUR = 11; // November 2026 = reporting month
  const SEASON = [.58, .55, .57, .64, .74, .86, .97, 1.0, .99, .9, .76, .63]; // cooling-driven electricity factor
  const WSEASON = [.86, .84, .86, .92, 1.0, 1.1, 1.2, 1.24, 1.22, 1.12, .98, .9];

  // ---------- tariffs & assumptions (demo) ----------
  const TARIFF = { kwh: 2.14, m3: 9.5, irrigation: 4.75 };

  // ---------- zones (conceptual) ----------
  const ZONES = [
    { id: 'A', name: 'North Residences', type: 'Apartments', green: 21500 },
    { id: 'B', name: 'Park Residences', type: 'Apartments', green: 24800 },
    { id: 'C', name: 'Lagoon Residences', type: 'Apartments', green: 19600 },
    { id: 'D', name: 'Garden Townhouses', type: 'Townhouses', green: 16200 },
    { id: 'E', name: 'Signature Villas', type: 'Villas', green: 22400 },
    { id: 'F', name: 'Gateway Residences', type: 'Apartments', green: 14300 },
  ];
  const ZMAP = Object.fromEntries(ZONES.map(z => [z.id, z]));
  const CENTRAL_PARK = { name: 'Central Park & Lagoon', green: 38500 };

  // ---------- buildings (conceptual positions on a 1000x560 plan) ----------
  const POS = {
    A1: [318, 74], A2: [408, 60], A3: [500, 56], A4: [592, 60], A5: [682, 74],
    B1: [800, 132], B2: [858, 198], B3: [880, 268], B4: [862, 340], B5: [820, 404],
    C1: [384, 470], C2: [470, 486], C3: [560, 486], C4: [644, 470],
    D1: [150, 120], D2: [118, 196], D3: [116, 274], D4: [140, 350],
    E1: [196, 438], E2: [112, 444], E3: [168, 510],
    F1: [704, 498], F2: [786, 506], F3: [866, 494], F4: [936, 446],
  };
  const OCC0 = { A: .9, B: .88, C: .84, D: .82, E: .73, F: .55 };
  const COLL = { A: .955, B: .945, C: .93, D: .94, E: .885, F: .92 };
  const HH = { Apartments: 2.9, Townhouses: 3.8, Villas: 4.4 };
  const KWH = { Apartments: 1080, Townhouses: 1820, Villas: 3150 };
  const M3 = { Apartments: 19, Townhouses: 27, Villas: 41 };
  const SC = { Apartments: 3650, Townhouses: 6200, Villas: 9800 };

  const BUILDINGS = Object.keys(POS).map(id => {
    const z = id[0], zone = ZMAP[z];
    const type = zone.type;
    const units = type === 'Apartments' ? pick([64, 68, 72, 72, 76, 80, 84]) : type === 'Townhouses' ? 24 : 12;
    const floors = type === 'Apartments' ? ri(7, 10) : type === 'Townhouses' ? 3 : 2;
    const deliveredFrom = id === 'F4' ? 6 : id === 'F3' ? 2 : 0; // phased handover in Gateway Residences
    return { id, zone: z, type, units, floors, x: POS[id][0], y: POS[id][1], deliveredFrom,
      lifts: type === 'Apartments' ? (units >= 76 ? 3 : 2) : 0,
      name: (type === 'Apartments' ? 'Building ' : type === 'Townhouses' ? 'Townhouse Cluster ' : 'Villa Cluster ') + id };
  });
  const BMAP = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

  // per-building monthly series
  BUILDINGS.forEach(b => {
    const z = b.zone;
    const occ = [], res = [], kwh = [], m3 = [], billed = [], coll = [], tix = [], csat = [], mi = [], mo = [], units = [];
    let rate = OCC0[z] + rr(-.04, .04);
    if (z === 'F') rate = b.id === 'F4' ? 0 : rr(.42, .55);
    for (let m = 0; m < 12; m++) {
      const delivered = m >= b.deliveredFrom;
      const u = delivered ? b.units : 0; units.push(u);
      if (!delivered) { occ.push(0); res.push(0); kwh.push(0); m3.push(0); billed.push(0); coll.push(0); tix.push(0); csat.push(null); mi.push(0); mo.push(0); continue; }
      if (b.id === 'F4' && m === b.deliveredFrom) rate = .12;
      const growth = z === 'F' ? rr(.04, .07) : rr(-.002, .007);
      rate = Math.min(.985, Math.max(.05, rate + growth));
      const o = Math.round(u * rate);
      const prev = occ.length ? occ[occ.length - 1] : Math.round(o * .99);
      const outs = Math.max(0, Math.round(o * rr(.004, .014)));
      const ins = Math.max(0, o - prev + outs);
      occ.push(o); mi.push(m === 0 ? Math.round(outs + rr(0, 2)) : ins); mo.push(outs);
      res.push(Math.round(o * HH[b.type] * rr(.96, 1.04)));
      let e = o * KWH[b.type] * SEASON[m] * rr(.93, 1.07) + u * 38; // + common-area share
      let w = o * M3[b.type] * WSEASON[m] * rr(.94, 1.06) + u * 1.2;
      if (b.id === 'C3' && m === 11) w *= 1.42; // night-flow anomaly (suspected leak)
      if (b.id === 'B4' && m === 11) e *= 1.17;                    // common-area lighting left on (BMS schedule override)
      kwh.push(Math.round(e)); m3.push(Math.round(w));
      const sc = u * SC[b.type] * rr(.97, 1.03);
      const util = e * TARIFF.kwh * .92 + w * TARIFF.m3;
      const bill = sc + util;
      let cr = COLL[z] + rr(-.025, .02) + (m > 8 ? .006 : 0);
      if (z === 'E' && m >= 9) cr -= .045 + (m - 9) * .012;         // collection dip in Signature Villas
      billed.push(Math.round(bill)); coll.push(Math.round(bill * Math.min(.995, cr)));
      tix.push(Math.max(0, Math.round(u * rr(.055, .085) * (z === 'F' && m >= 6 ? 1.35 : 1) * (.8 + SEASON[m] * .35))));
      csat.push(r1(Math.min(97, (z === 'E' && m >= 9 ? 84 : 88) + m * .35 + rr(-1.6, 1.6))));
    }
    Object.assign(b, { s: { units, occ, res, kwh, m3, billed, coll, tix, csat, mi, mo } });
    b.serviceCharge = SC[b.type];
    b.openingArrears = Math.round(b.units * SC[b.type] * rr(.4, 1.1) * (z === 'E' ? 1.8 : 1));
  });

  // ---------- filters ----------
  const sel = (f = {}) => BUILDINGS.filter(b => (!f.zone || b.zone === f.zone) && (!f.bld || b.id === f.bld));
  const isAll = f => !f || (!f.zone && !f.bld);
  const series = (f, k) => MONTHS.map((_, m) => sum(sel(f).map(b => b.s[k][m])));

  // ---------- compound-level (not building-attributable) ----------
  const COMMON = { // monthly MWh by common system
    'Clubhouse & amenity HVAC': SEASON.map(s => Math.round(118 * s * rr(.95, 1.05))),
    'Pools & filtration': SEASON.map((s, m) => Math.round((m < 3 ? 52 : 40) * rr(.94, 1.06))),
    'Street & landscape lighting': MONTHS.map((_, m) => Math.round([62, 62, 58, 54, 50, 47, 46, 47, 50, 54, 58, 61][m] * rr(.97, 1.03))),
    'Water & irrigation pumping': WSEASON.map(s => Math.round(46 * s * rr(.95, 1.05))),
    'Sewage treatment plant': MONTHS.map(() => Math.round(31 * rr(.96, 1.04))),
  };
  const IRR = ZONES.map(z => ({ zone: z.id, s: WSEASON.map((s, m) => Math.round(z.green * .052 * s * (z.id === 'D' && m >= 10 ? (m === 11 ? 1.38 : 1.15) : 1) * rr(.95, 1.05))) }));
  IRR.push({ zone: 'P', s: WSEASON.map(s => Math.round(CENTRAL_PARK.green * .05 * s * rr(.95, 1.05))) });
  const POOLWATER = WSEASON.map(s => Math.round(820 * s * rr(.95, 1.05)));
  const OTHER_REV = { 'Amenities & memberships': MONTHS.map((_, m) => Math.round((372000 + m * 6200) * (SEASON[m] > .8 ? 1.18 : 1) * rr(.96, 1.04))), 'Parking, events & other': MONTHS.map(() => Math.round(rr(236000, 288000))) };

  // operating budget (compound) by cost centre, EGP / month
  const OPEX_CC = [
    ['Maintenance & repairs', 1850000], ['Security services', 1420000], ['Landscape & irrigation', 980000], ['Common-area utilities', 1560000],
    ['Cleaning & waste', 760000], ['Amenities & pools', 640000], ['Administration & IT', 520000]];
  const OPEX = OPEX_CC.map(([name, base]) => {
    const budget = MONTHS.map((_, m) => Math.round(base * (name === 'Common-area utilities' ? .7 + SEASON[m] * .45 : 1)));
    const actual = budget.map((v, m) => Math.round(v * rr(.9, 1.07) * (name === 'Maintenance & repairs' && m >= 9 ? 1.09 : 1)));
    return { name, budget, actual };
  });

  // ---------- assets & systems (live snapshot, "today") ----------
  const PUMPS = [
    { id: 'P-01', sys: 'Domestic booster', st: 'Running', flow: 182, bar: 6.2, vib: 2.1, hrs: 11840, health: 92 },
    { id: 'P-02', sys: 'Domestic booster', st: 'Running', flow: 176, bar: 6.1, vib: 2.4, hrs: 11210, health: 90 },
    { id: 'P-03', sys: 'Domestic booster', st: 'Standby', flow: 0, bar: 0, vib: 0, hrs: 6020, health: 95 },
    { id: 'P-04', sys: 'Irrigation', st: 'Running', flow: 141, bar: 4.4, vib: 3.2, hrs: 9480, health: 84 },
    { id: 'P-05', sys: 'Irrigation', st: 'Running', flow: 128, bar: 4.1, vib: 7.4, hrs: 14920, health: 58, issue: 'Vibration 7.4 mm/s (alarm 7.1) — bearing wear suspected' },
    { id: 'P-06', sys: 'Irrigation', st: 'Standby', flow: 0, bar: 0, vib: 0, hrs: 5110, health: 94 },
    { id: 'JP-01', sys: 'Fire — jockey', st: 'Auto', flow: 0, bar: 8.6, vib: 1.2, hrs: 860, health: 97 },
    { id: 'FP-01', sys: 'Fire — electric', st: 'Auto', flow: 0, bar: 8.6, vib: 0, hrs: 140, health: 98 },
    { id: 'FP-02', sys: 'Fire — diesel', st: 'Auto', flow: 0, bar: 8.6, vib: 0, hrs: 96, health: 88, issue: 'Weekly churn test overdue by 2 days' },
  ];
  const TANKS = [
    { id: 'T-01', name: 'Domestic ground tank 1', cap: 2500, lvl: 74 },
    { id: 'T-02', name: 'Domestic ground tank 2', cap: 2500, lvl: 66 },
    { id: 'FT-01', name: 'Fire water reserve', cap: 1200, lvl: 100 },
    { id: 'IT-01', name: 'Irrigation storage', cap: 1800, lvl: 31, issue: 'Below 35% refill threshold' },
  ];
  const GENS = [
    { id: 'G-01', kva: 1250, serves: 'Clubhouse, pumps, security', fuel: 82, st: 'Standby', lastTest: '02 Nov', due: '30 Nov' },
    { id: 'G-02', kva: 800, serves: 'Fire pumps & life safety', fuel: 91, st: 'Standby', lastTest: '02 Nov', due: '30 Nov' },
    { id: 'G-03', kva: 630, serves: 'Gateway Residences', fuel: 64, st: 'Standby', lastTest: '19 Oct', due: '09 Nov', issue: '500-hour service due today' },
  ];
  const HVAC = [
    { id: 'CH-01', name: 'Clubhouse chiller 1', kw: 142, cop: 3.1, sup: 7.2, avail: 99.4, st: 'Running' },
    { id: 'CH-02', name: 'Clubhouse chiller 2', kw: 0, cop: null, sup: null, avail: 98.8, st: 'Standby' },
    { id: 'AHU-01', name: 'Gym & spa AHU', kw: 18, cop: null, sup: 14.1, avail: 99.9, st: 'Running' },
    { id: 'AHU-02', name: 'Clubhouse hall AHU', kw: 22, cop: null, sup: 16.8, avail: 97.6, st: 'Running', issue: 'Supply air 16.8 °C vs 14 °C set-point — filter ΔP high' },
    { id: 'FCU-L', name: 'Lobby FCUs (18 bldgs)', kw: 31, cop: null, sup: 15.2, avail: 98.9, st: 'Running' },
  ];
  const HVAC_COP = MONTHS.map((_, m) => r1(3.45 - SEASON[m] * .42 + rr(-.06, .06)));

  const LIFTS = [];
  BUILDINGS.filter(b => b.lifts).forEach(b => { for (let i = 1; i <= b.lifts; i++) LIFTS.push({ id: `${b.id}-L${i}`, bld: b.id, st: 'In service', up: r1(rr(98.6, 99.95)), trips: ri(310, 520), lastPM: ri(3, 27) }); });
  Object.assign(LIFTS.find(l => l.id === 'B2-L2'), { st: 'Out of service', up: 91.4, trips: 0, issue: 'Door operator fault — OEM technician booked 14:00' });
  Object.assign(LIFTS.find(l => l.id === 'C3-L1'), { st: 'Planned maintenance', up: 97.9, trips: 96 });
  const COMMONEQ = [
    { name: 'Lobby automatic doors', n: 36, ok: 35 }, { name: 'Car-park barriers', n: 8, ok: 8 }, { name: 'Common-area lighting circuits', n: 214, ok: 209 },
    { name: 'Sump & drainage pumps', n: 22, ok: 21 }, { name: 'Waste chutes & compactors', n: 18, ok: 18 }, { name: 'Smart-meter gateways', n: 24, ok: 23 },
  ];

  // maintenance tickets
  const CATS = ['Plumbing', 'Electrical', 'HVAC', 'Elevators', 'Civil & finishing', 'Doors & access', 'Landscape', 'Pest control'];
  const CATW = [24, 20, 16, 6, 14, 9, 7, 4];
  const wpick = () => { let t = rnd() * sum(CATW); for (let i = 0; i < CATS.length; i++) { t -= CATW[i]; if (t <= 0) return CATS[i]; } return CATS[0]; };
  const TDESC = {
    'Plumbing': ['Leak under kitchen sink', 'Low water pressure — 4th floor', 'Water heater not working', 'Blocked bathroom drain', 'Riser valve weeping'],
    'Electrical': ['Corridor lights flickering', 'Socket tripping RCD', 'Staircase emergency light failed', 'Meter display blank', 'Balcony light not working'],
    'HVAC': ['Split unit not cooling', 'Lobby FCU noisy', 'Condensate leak — ceiling stain', 'Thermostat unresponsive'],
    'Elevators': ['Lift door slow to close', 'Lift levelling error', 'Lift car light out'],
    'Civil & finishing': ['Cracked façade tile', 'Balcony waterproofing seep', 'Paint touch-up — lobby', 'Loose handrail'],
    'Doors & access': ['Intercom not ringing', 'Access card reader offline', 'Lobby door closer broken', 'Garage remote not pairing'],
    'Landscape': ['Dry patch near entrance', 'Sprinkler head broken', 'Tree pruning request'],
    'Pest control': ['Ants in kitchen', 'Mosquito treatment request'],
  };
  const PRIOS = ['Critical', 'High', 'Medium', 'Low'];
  const TICKETS = [];
  for (let i = 0; i < 46; i++) {
    const b = pick(BUILDINGS.filter(x => x.deliveredFrom <= CUR));
    const cat = b.lifts ? wpick() : (c => c === 'Elevators' ? 'Plumbing' : c)(wpick());
    const p = i < 2 ? 'Critical' : pick(['High', 'High', 'Medium', 'Medium', 'Medium', 'Low', 'Low']);
    const ageH = Math.round(p === 'Critical' ? rr(1, 6) : rr(2, 160));
    const slaH = { Critical: 4, High: 24, Medium: 72, Low: 120 }[p];
    TICKETS.push({ id: 'WO-' + (24800 + i * 7 + ri(0, 6)), bld: b.id, zone: b.zone, cat, desc: pick(TDESC[cat]), prio: p, ageH, slaH, overdue: ageH > slaH,
      st: pick(['Assigned', 'In progress', 'In progress', 'Awaiting parts', 'Scheduled']), tech: pick(['Team Alpha', 'Team Bravo', 'Team Cedar', 'MEP contractor', 'OEM vendor']) });
  }
  TICKETS[0] = { ...TICKETS[0], bld: 'B2', zone: 'B', cat: 'Elevators', desc: 'Lift B2-L2 out of service — door operator', prio: 'Critical', ageH: 3, slaH: 4, overdue: false, st: 'Awaiting parts', tech: 'OEM vendor' };
  TICKETS[1] = { ...TICKETS[1], bld: 'C3', zone: 'C', cat: 'Plumbing', desc: 'Night-time flow on C3 riser — leak survey', prio: 'Critical', ageH: 5, slaH: 4, overdue: true, st: 'In progress', tech: 'Team Alpha' };
  TICKETS.sort((a, b) => PRIOS.indexOf(a.prio) - PRIOS.indexOf(b.prio) || b.ageH - a.ageH);
  const PPM = MONTHS.map((_, m) => r1(Math.min(99, 90.5 + m * .5 + rr(-1.2, 1.2))));
  const RESP = MONTHS.map((_, m) => r1(3.9 - m * .12 + rr(-.3, .3)));      // hours to first response
  const RESOL = MONTHS.map((_, m) => r1(31 - m * .9 + rr(-2, 2)));       // hours to resolution
  const SLA = MONTHS.map((_, m) => r1(Math.min(97, 82 + m * .55 + rr(-1.5, 1.5))));

  // ---------- security & safety ----------
  const GATES = [
    { id: 'G1', name: 'Main Gate', x: 500, y: 548, lanes: 4, lpr: 99.1, cards: 3920, visitors: 412, vehicles: 2860, denied: 14, cams: 18, camsOn: 18 },
    { id: 'G2', name: 'West Gate', x: 18, y: 270, lanes: 2, lpr: 98.4, cards: 1640, visitors: 138, vehicles: 1210, denied: 6, cams: 10, camsOn: 10 },
    { id: 'G3', name: 'Service Gate', x: 952, y: 40, lanes: 2, lpr: 96.2, cards: 610, visitors: 96, vehicles: 388, denied: 9, cams: 8, camsOn: 5, issue: '3 cameras offline — PoE switch SW-G3 unreachable' },
    { id: 'G4', name: 'Villas Gate', x: 40, y: 530, lanes: 1, lpr: 98.9, cards: 420, visitors: 54, vehicles: 330, denied: 2, cams: 6, camsOn: 6 },
  ];
  const CCTV = { total: 412, online: 405 };
  const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00');
  const hourShape = h => Math.exp(-((h - 8.5) ** 2) / 5) * .9 + Math.exp(-((h - 18.5) ** 2) / 7) + .06 + (h > 10 && h < 16 ? .25 : 0);
  const VIS_H = HOURS.map((_, h) => Math.round(hourShape(h) * 46 * rr(.85, 1.15)));
  const VEH_H = HOURS.map((_, h) => Math.round(hourShape(h) * 330 * rr(.88, 1.12)));
  const VISITORS_M = MONTHS.map((_, m) => Math.round(18400 * (SEASON[m] > .9 ? .92 : 1.05) * (1 + m * .012) * rr(.95, 1.05)));
  const FIRE = BUILDINGS.map(b => ({ panel: 'FAP-' + b.id, bld: b.id, zone: b.zone, st: 'Normal', devices: b.type === 'Apartments' ? ri(180, 260) : b.units * 6 }));
  FIRE.push({ panel: 'FAP-CLB', bld: 'Clubhouse', zone: '—', st: 'Normal', devices: 340 });
  Object.assign(FIRE.find(f => f.bld === 'D2'), { st: 'Fault', issue: 'Smoke detector loop 2 / device 14 — dirty head' });
  Object.assign(FIRE.find(f => f.bld === 'F4'), { st: 'Isolated', issue: 'Zone 3 isolated for fit-out works (permit PTW-1182)' });
  const INC_T = [['Unauthorised entry attempt', 'High'], ['Tailgating at gate', 'Medium'], ['Speeding vehicle', 'Low'], ['Parking violation', 'Low'], ['Noise complaint', 'Low'], ['Suspicious person', 'Medium'], ['Fire alarm — false', 'Medium'], ['Medical assistance', 'High'], ['Lost & found', 'Low'], ['Delivery dispute', 'Low']];
  const INCIDENTS = [];
  for (let i = 0; i < 38; i++) {
    const [type, sev] = pick(INC_T); const b = pick(BUILDINGS);
    INCIDENTS.push({ id: 'SEC-' + (6120 + i), type, sev, loc: rnd() < .35 ? pick(GATES).name : b.name, zone: b.zone, day: ri(1, 30), resp: r1(type === 'Medical assistance' ? rr(2.1, 4.2) : rr(2.4, 9.5)), st: i < 4 ? 'Open' : 'Closed' });
  }
  INCIDENTS.sort((a, b) => a.day - b.day);
  const INC_M = MONTHS.map((_, m) => ri(28, 46) - Math.round(m * .6));
  const ERT = MONTHS.map((_, m) => r1(5.6 - m * .1 + rr(-.35, .35))); // emergency response minutes

  // ---------- amenities & landscape ----------
  const AMEN = [
    { id: 'club', name: 'Clubhouse', cap: 320, util: 64, book: 0, st: 'Open' },
    { id: 'gym', name: 'Fitness centre', cap: 90, util: 78, book: 0, st: 'Open' },
    { id: 'pool1', name: 'Main lagoon pool', cap: 260, util: 41, book: 0, st: 'Open', pool: { cl: 1.8, ph: 7.4, temp: 26.5, load: 96, turb: .3 } },
    { id: 'pool2', name: 'Family pool', cap: 140, util: 47, book: 0, st: 'Open', pool: { cl: 2.2, ph: 7.6, temp: 27.1, load: 58, turb: .4 } },
    { id: 'pool3', name: 'Kids splash pool', cap: 60, util: 0, book: 0, st: 'Closed', pool: { cl: .6, ph: 7.9, temp: 25.8, load: 0, turb: .9 }, issue: 'Closed for re-dosing — free chlorine 0.6 ppm (min 1.0)' },
    { id: 'padel', name: 'Padel courts (4)', cap: 64, util: 86, book: 212, st: 'Open' },
    { id: 'tennis', name: 'Tennis courts (2)', cap: 28, util: 52, book: 74, st: 'Open' },
    { id: 'football', name: 'Football pitch', cap: 30, util: 69, book: 46, st: 'Open' },
    { id: 'kids', name: 'Kids play areas', cap: 180, util: 57, book: 0, st: 'Open' },
    { id: 'bbq', name: 'BBQ & events lawn', cap: 120, util: 38, book: 31, st: 'Open' },
    { id: 'cowork', name: 'Co-working lounge', cap: 48, util: 61, book: 118, st: 'Open' },
    { id: 'track', name: 'Jogging & cycling loop', cap: 400, util: 44, book: 0, st: 'Open' },
  ];
  const BOOK_M = MONTHS.map((_, m) => Math.round((380 + m * 9) * (SEASON[m] > .9 ? 1.2 : 1) * rr(.93, 1.07)));
  const LAND = ZONES.map(z => ({ zone: z.id, cond: ri(84, 95) - (z.id === 'D' ? 9 : 0), tasks: ri(88, 99), moist: ri(24, 36) - (z.id === 'D' ? 9 : 0), area: z.green }));
  LAND.push({ zone: 'P', cond: 93, tasks: 96, moist: 31, area: CENTRAL_PARK.green });
  const LAND_COND = MONTHS.map((_, m) => r1(87 + m * .35 + rr(-1, 1)));
  const LTASKS = [
    { name: 'Mowing & edging', done: 46, plan: 48 }, { name: 'Pruning & hedging', done: 31, plan: 34 }, { name: 'Fertilising', done: 12, plan: 12 },
    { name: 'Irrigation audits', done: 9, plan: 12 }, { name: 'Pest & disease control', done: 8, plan: 8 }, { name: 'Seasonal planting', done: 3, plan: 6 }];

  // ---------- resident experience ----------
  const CSAT = MONTHS.map((_, m) => r1(86.4 + m * .52 + rr(-.6, .6)));
  const NPS = MONTHS.map((_, m) => Math.round(31 + m * 1.4 + rr(-2, 2)));
  const COMPL_CAT = [['Maintenance delays', 34], ['Noise & neighbours', 22], ['Cleanliness', 17], ['Security & gates', 15], ['Billing queries', 19], ['Amenities & pools', 12], ['Parking', 11]];
  const COMPL_M = MONTHS.map((_, m) => Math.round(156 - m * 3.2 + rr(-9, 9)));
  const CHANNELS = [
    { name: 'Resident app', vol: 1840, resp: 0.4, csat: 93, fcr: 81 }, { name: 'Call centre', vol: 960, resp: 1.6, csat: 88, fcr: 74 },
    { name: 'Front desk / concierge', vol: 610, resp: 0.2, csat: 95, fcr: 88 }, { name: 'Email', vol: 240, resp: 6.8, csat: 82, fcr: 61 }];
  const FEEDBACK = [
    { s: 5, z: 'B', ch: 'Resident app', t: 'Lift in our building was fixed the same afternoon — great follow-up from the concierge.', d: '08 Nov' },
    { s: 2, z: 'E', ch: 'Call centre', t: 'Service-charge statement does not match what I paid last quarter. Waiting for a call back.', d: '08 Nov' },
    { s: 4, z: 'C', ch: 'Resident app', t: 'Lagoon walkway lighting looks beautiful in the evening. Please add more benches.', d: '07 Nov' },
    { s: 3, z: 'D', ch: 'Front desk', t: 'Grass behind D2 is drying out even though sprinklers run at night.', d: '07 Nov' },
    { s: 5, z: 'A', ch: 'Resident app', t: 'Padel booking through the app is effortless.', d: '06 Nov' },
    { s: 2, z: 'F', ch: 'Email', t: 'Fit-out noise in F4 continues after 6pm on weekdays.', d: '06 Nov' },
    { s: 4, z: 'B', ch: 'Resident app', t: 'Gym equipment is excellent; it gets busy around 7pm.', d: '05 Nov' },
    { s: 1, z: 'C', ch: 'Call centre', t: 'Water bill doubled this month and nobody can explain why.', d: '05 Nov' },
    { s: 5, z: 'E', ch: 'Front desk', t: 'Security team handled a delivery issue quickly and politely.', d: '04 Nov' },
  ];
  const ENGAGE = { appUsers: 78, appUsersPrev: 74, events: 9, attendance: 1240, surveys: 612, clubMembers: 1310 };
  const EVENTS = [['Family movie night', 260], ['Padel tournament', 96], ['Kids art workshop', 72], ['Sunset yoga', 54], ['Residents town hall', 188], ['Farmers market', 410]];

  // ---------- demographics & unit mix (demo shares) ----------
  const MIX = { Apartments: [['Studio', .06, .8], ['1 bedroom', .2, 1], ['2 bedroom', .38, 1], ['3 bedroom', .28, 1.1], ['Penthouse', .08, 1.8]], Townhouses: [['Townhouse', 1, 1]], Villas: [['Villa', 1, 1]] };
  const AGE = [['Under 18', .26], ['18–30', .16], ['31–45', .31], ['46–60', .18], ['Over 60', .09]];
  const HOUSE = [['Families with children', .57], ['Couples', .21], ['Single professionals', .13], ['Seniors', .09]];
  const TENURE = { A: .76, B: .74, C: .7, D: .8, E: .86, F: .58 }; // owner-occupied share

  // ---------- aggregation helpers ----------
  function agg(f, m) {
    const bs = sel(f);
    const g = k => sum(bs.map(b => b.s[k][m]));
    const units = g('units'), occ = g('occ');
    const vacant = units - occ;
    const billed = g('billed'), coll = g('coll');
    const all = isAll(f);
    const other = all ? OTHER_REV['Amenities & memberships'][m] + OTHER_REV['Parking, events & other'][m] : 0;
    const kwhRes = g('kwh'), commonKwh = all ? sum(Object.values(COMMON).map(s => s[m])) * 1000 : 0;
    const irrig = all ? sum(IRR.map(z => z.s[m])) + POOLWATER[m] : (f.zone && !f.bld ? IRR.find(z => z.zone === f.zone).s[m] : 0);
    let arrears = sum(bs.map(b => b.openingArrears));
    for (let i = 0; i <= m; i++) arrears += sum(bs.map(b => b.s.billed[i] - b.s.coll[i])) * .62; // partial late recovery
    const cs = bs.map(b => [b.s.csat[m], b.s.occ[m]]).filter(x => x[0] != null);
    const csat = cs.length ? r1(sum(cs.map(x => x[0] * x[1])) / Math.max(1, sum(cs.map(x => x[1])))) : null;
    const tix = TICKETS.filter(t => bs.some(b => b.id === t.bld));
    return {
      units, occ, vacant, available: Math.round(vacant * .68), reserved: Math.round(vacant * .19), fitout: vacant - Math.round(vacant * .68) - Math.round(vacant * .19),
      occRate: units ? occ / units * 100 : 0, residents: g('res'),
      revenue: billed + other, billed, collected: coll + other * .97, collRate: billed ? (coll + other * .97) / (billed + other) * 100 : 0,
      outstanding: Math.round(arrears), kwh: kwhRes + commonKwh, kwhRes, commonKwh, m3: g('m3') + irrig, m3Res: g('m3'), irrig,
      openTix: m === CUR ? tix.length : Math.round(g('tix') * .52), opened: g('tix'), csat, moveIn: g('mi'), moveOut: g('mo'),
    };
  }
  const aggSeries = (f, key) => MONTHS.map((_, m) => agg(f, m)[key]);

  // operational health score (0-100) with components
  function health(f, m) {
    const a = agg(f, m);
    const lifts = LIFTS.filter(l => sel(f).some(b => b.id === l.bld));
    const comps = [
      ['Occupancy', Math.min(100, a.occRate / 95 * 100), .15],
      ['Collections', Math.min(100, a.collRate / 98 * 100), .2],
      ['PPM compliance', PPM[m], .15],
      ['Maintenance SLA', SLA[m], .15],
      ['Equipment availability', lifts.length ? sum(lifts.map(l => l.up)) / lifts.length : 99, .1],
      ['Security systems', CCTV.online / CCTV.total * 100, .1],
      ['Resident satisfaction', a.csat ?? CSAT[m], .15],
    ];
    const score = sum(comps.map(c => c[1] * c[2])) / sum(comps.map(c => c[2]));
    return { score: r1(score), comps: comps.map(c => ({ name: c[0], v: r1(c[1]), w: c[2] })) };
  }

  return { MONTHS, MSHORT, CUR, SEASON, WSEASON, TARIFF, ZONES, ZMAP, CENTRAL_PARK, BUILDINGS, BMAP, sel, isAll, series, agg, aggSeries, health,
    COMMON, IRR, POOLWATER, OTHER_REV, OPEX, PUMPS, TANKS, GENS, HVAC, HVAC_COP, LIFTS, COMMONEQ, CATS, TICKETS, PPM, RESP, RESOL, SLA,
    GATES, CCTV, HOURS, VIS_H, VEH_H, VISITORS_M, FIRE, INCIDENTS, INC_M, ERT, AMEN, BOOK_M, LAND, LAND_COND, LTASKS,
    MIX, AGE, HOUSE, TENURE, CSAT, NPS, COMPL_CAT, COMPL_M, CHANNELS, FEEDBACK, ENGAGE, EVENTS, sum, r1, generatedAt: '2026-11-09' };
})();

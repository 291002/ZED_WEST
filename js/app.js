'use strict';
/* ZED West — Smart Compound Command Center (vanilla JS, no build step). */
(() => {
  const Z = window.ZW, esc = CH.esc, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  const TABS = [
    { id: 'overview', name: 'Overview', full: 'Executive Overview', icon: 'home' },
    { id: 'residential', name: 'Residential', full: 'Residential & Occupancy', icon: 'users' },
    { id: 'utilities', name: 'Utilities', full: 'Utilities & Infrastructure', icon: 'bolt' },
    { id: 'facilities', name: 'Facilities', full: 'Facilities & Maintenance', icon: 'wrench' },
    { id: 'security', name: 'Security', full: 'Security & Safety', icon: 'shield' },
    { id: 'finance', name: 'Financial', full: 'Financial & Billing', icon: 'coins' },
    { id: 'landscape', name: 'Amenities', full: 'Landscape & Amenities', icon: 'leaf' },
    { id: 'experience', name: 'Experience', full: 'Resident Experience', icon: 'smile' },
    { id: 'reports', name: 'Reports', full: 'Reports & Analytics', icon: 'report' },
  ];
  const S = { tab: 'overview', m: Z.CUR, zone: '', bld: '', map: 'occ', sub: {}, rep: 'exec', present: null };

  // ---------- formatting ----------
  const nf = (v, d = 0) => v == null || !isFinite(v) ? '—' : (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + '%';
  const egp = v => v == null ? '—' : Math.abs(v) >= 1e6 ? 'EGP ' + nf(v / 1e6, 2) + 'M' : Math.abs(v) >= 1e3 ? 'EGP ' + nf(v / 1e3, 0) + 'k' : 'EGP ' + nf(v);
  const mwh = v => nf(v / 1000, 0) + ' MWh';
  const ic = n => `<svg><use href="#i-${n}"/></svg>`;
  const at = (c, r, cs = 1, rs = 1) => `grid-column:${c} / span ${cs};grid-row:${r} / span ${rs}`;
  const F = () => ({ zone: S.zone, bld: S.bld });
  const scopeName = () => S.bld ? Z.BMAP[S.bld].name : S.zone ? `Zone ${S.zone} · ${Z.ZMAP[S.zone].name}` : 'All zones';
  const MN = i => Z.MONTHS[i] || (i > 11 ? ['Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027'][i - 12] : '');
  const prevM = () => S.m > 0 ? S.m - 1 : null;
  const compoundTag = () => Z.isAll(F()) ? '' : '<span class="tag" title="This panel is not attributable to a single zone or building">Compound-wide</span>';

  function delta(cur, prev, o = {}) {
    if (cur == null || prev == null) return '<span class="delta">— <em>no prior month</em></span>';
    const mode = o.mode || 'pct';
    const d = mode === 'pct' ? (prev ? (cur - prev) / Math.abs(prev) * 100 : 0) : cur - prev;
    const flat = Math.abs(d) < (mode === 'abs' ? .5 : .05);
    const cls = o.goodUp == null || flat ? '' : (d > 0) === o.goodUp ? 'good' : 'bad';
    const txt = flat ? '0' + (mode === 'pp' ? ' pp' : mode === 'pct' ? '%' : '') : (d > 0 ? '+' : '−') + (mode === 'pp' ? nf(Math.abs(d), 1) + ' pp' : mode === 'abs' ? nf(Math.abs(d), o.dp || 0) + (o.unit || '') : nf(Math.abs(d), 1) + '%');
    return `<span class="delta ${cls}">${flat ? '' : ic(d > 0 ? 'up' : 'down')}${txt}<em>vs ${Z.MSHORT[S.m - 1] || ''}</em></span>`;
  }
  const kpi = o => `<button class="kpi anim ${o.cls || ''}" data-act="${o.open || ''}" style="--i:${o.i || 0}" title="${esc(o.title || o.l)}${o.open ? ' — click for details' : ''}">
    <span class="kpi-ic">${ic(o.ic)}</span><span class="kpi-l">${esc(o.l)}</span>
    <span class="kpi-v">${o.v}${o.u ? `<small>${o.u}</small>` : ''}</span>
    <span class="kpi-f">${o.d || ''}${o.sp ? CH.spark(o.sp) : ''}</span></button>`;
  const panel = o => `<section class="panel anim ${o.cls || ''}" id="${o.id || ''}" style="${o.st || ''};--i:${o.i || 0}">
    <div class="ph"><div><h3>${o.t}</h3>${o.s ? `<small>${o.s}</small>` : ''}</div>${o.r ? `<div class="ph-r">${o.r}</div>` : ''}</div>
    <div class="pb">${o.b}</div></section>`;
  const seg = (key, opts, def) => { const cur = S.sub[key] ?? def; return `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="seg:${key}:${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`; };
  const sub = (key, def) => S.sub[key] ?? def;
  const mini = (l, v, e = '') => `<div class="mini"><small>${l}</small><b>${v}</b>${e ? `<em>${e}</em>` : ''}</div>`;
  const fit = (key, items, total) => `<div class="rows" data-fit="${key}" data-total="${total ?? items.length}">${items.join('')}</div>`;
  const sevIc = s => s === 'crit' ? 'alert' : s === 'warn' ? 'info' : 'check';
  const stTag = st => { const m = { Running: 'good', 'In service': 'good', Normal: 'good', Open: 'good', Auto: 'sage', Standby: 'info', 'Planned maintenance': 'warn', Isolated: 'warn', Fault: 'crit', 'Out of service': 'crit', Closed: 'crit', Online: 'good' }; return `<span class="tag ${m[st] || ''}">${esc(st)}</span>`; };

  // ---------- derived ----------
  const A = (m = S.m, f = F()) => Z.agg(f, m);
  const spk = (key, f = F()) => Z.aggSeries(f, key).slice(0, S.m + 1);
  function liftsIn(f = F()) { const ids = new Set(Z.sel(f).map(b => b.id)); return Z.LIFTS.filter(l => ids.has(l.bld)); }
  function tixIn(f = F()) { const ids = new Set(Z.sel(f).map(b => b.id)); return Z.TICKETS.filter(t => ids.has(t.bld)); }
  function equipAvail(f = F()) {
    const l = liftsIn(f); const lv = l.length ? Z.sum(l.map(x => x.up)) / l.length : null;
    const h = Z.sum(Z.HVAC.map(x => x.avail)) / Z.HVAC.length;
    const c = Z.sum(Z.COMMONEQ.map(x => x.ok)) / Z.sum(Z.COMMONEQ.map(x => x.n)) * 100;
    return lv == null ? (h + c) / 2 : lv * .45 + h * .25 + c * .3;
  }
  const utilCost = a => a.kwh * Z.TARIFF.kwh + a.m3Res * Z.TARIFF.m3 + a.irrig * Z.TARIFF.irrigation;
  function revMix(f, m) {
    const bs = Z.sel(f); let util = 0, billed = 0;
    bs.forEach(b => { util += b.s.kwh[m] * Z.TARIFF.kwh * .92 + b.s.m3[m] * Z.TARIFF.m3; billed += b.s.billed[m]; });
    const out = [['Service charges', billed - util], ['Utility billing', util]];
    if (Z.isAll(f)) Object.entries(Z.OTHER_REV).forEach(([k, v]) => out.push([k, v[m]]));
    return out.map(([k, v]) => [k, Math.round(v)]);
  }
  function aging(f, m) {
    const o = Z.agg(f, m).outstanding, eShare = Z.sel(f).filter(b => b.zone === 'E').length / Math.max(1, Z.sel(f).length);
    const w = [.38 - eShare * .1, .22, .14, .26 + eShare * .1];
    return [['0–30 days', o * w[0]], ['31–60 days', o * w[1]], ['61–90 days', o * w[2]], ['Over 90 days', o * w[3]]].map(([k, v]) => [k, Math.round(v)]);
  }
  function unitMix(f, m) {
    const rows = {};
    Z.sel(f).forEach(b => {
      const u = b.s.units[m], vac = u - b.s.occ[m]; if (!u) return;
      const mix = Z.MIX[b.type], wsum = Z.sum(mix.map(([, s, bias]) => s * bias));
      mix.forEach(([t, s, bias]) => { const r = rows[t] ||= { t, total: 0, vac: 0 }; r.total += u * s; r.vac += vac * s * bias / wsum; });
    });
    return Object.values(rows).map(r => ({ t: r.t, total: Math.round(r.total), vac: Math.round(r.vac), avail: Math.round(r.vac * .68) }));
  }
  const bMetric = (b, m = S.m) => {
    const s = b.s, u = s.units[m], o = s.occ[m];
    return { u, o, rate: u ? o / u * 100 : null, kwh: s.kwh[m], m3: s.m3[m], kpu: o ? s.kwh[m] / o : null, mpu: o ? s.m3[m] / o : null, csat: s.csat[m],
      kwhD: m ? (s.kwh[m] - s.kwh[m - 1]) / Math.max(1, s.kwh[m - 1]) * 100 : 0, m3D: m ? (s.m3[m] - s.m3[m - 1]) / Math.max(1, s.m3[m - 1]) * 100 : 0,
      tix: Z.TICKETS.filter(t => t.bld === b.id), coll: s.billed[m] ? s.coll[m] / s.billed[m] * 100 : null,
      fire: Z.FIRE.find(x => x.bld === b.id), lifts: Z.LIFTS.filter(l => l.bld === b.id) };
  };

  // ---------- alerts & rule-based insights ----------
  function alerts() {
    const L = [];
    const add = (sev, icon, t, s, act, zone, bld) => L.push({ sev, icon, t, s, act, zone, bld });
    Z.LIFTS.filter(l => l.st === 'Out of service').forEach(l => add('crit', 'lift', `Lift ${l.id} out of service`, l.issue, `open:lift:${l.id}`, l.bld[0], l.bld));
    const c3 = bMetric(Z.BMAP.C3, Z.CUR); if (c3.m3D > 15) add('crit', 'drop', `Night-time water flow — Building C3`, `Consumption +${nf(c3.m3D, 0)}% month-on-month; leak survey in progress (WO open)`, 'open:bld:C3', 'C', 'C3');
    Z.PUMPS.filter(p => p.vib > 7).forEach(p => add('crit', 'pump', `Pump ${p.id} vibration alarm`, p.issue, `open:pump:${p.id}`));
    Z.AMEN.filter(a => a.st === 'Closed').forEach(a => add('crit', 'pool', `${a.name} closed`, a.issue, `open:amen:${a.id}`));
    Z.GATES.filter(g => g.issue).forEach(g => add('warn', 'camera', `${g.name}: ${g.cams - g.camsOn} cameras offline`, g.issue, `open:gate:${g.id}`));
    Z.FIRE.filter(f => f.st !== 'Normal').forEach(f => add(f.st === 'Fault' ? 'warn' : 'info', 'fire', `Fire panel ${f.panel} — ${f.st.toLowerCase()}`, f.issue, `open:fire:${f.panel}`, f.zone, f.bld));
    Z.TANKS.filter(t => t.issue).forEach(t => add('warn', 'tank', `${t.name} at ${t.lvl}%`, t.issue, `open:tank:${t.id}`));
    Z.GENS.filter(g => g.issue).forEach(g => add('warn', 'gen', `Generator ${g.id} service due`, g.issue, `open:gen:${g.id}`));
    Z.HVAC.filter(h => h.issue).forEach(h => add('warn', 'thermo', `${h.name} below performance`, h.issue, `open:hvac:${h.id}`));
    Z.PUMPS.filter(p => p.issue && p.vib <= 7).forEach(p => add('warn', 'fire', `Fire pump ${p.id}`, p.issue, `open:pump:${p.id}`));
    const b4 = bMetric(Z.BMAP.B4, Z.CUR); if (b4.kwhD > 10) add('warn', 'bolt', 'Electricity spike — Building B4', `+${nf(b4.kwhD, 0)}% vs October; common-area lighting schedule overridden in BMS`, 'open:bld:B4', 'B', 'B4');
    const ze = Z.agg({ zone: 'E' }, Z.CUR); add('warn', 'coins', 'Collections falling — Signature Villas', `Zone E collection rate ${pct(ze.collRate)} (portfolio ${pct(Z.agg({}, Z.CUR).collRate)})`, 'open:zone:E', 'E');
    const tOver = Z.TICKETS.filter(t => t.overdue).length; add('warn', 'clock', `${tOver} work orders past SLA`, 'Oldest items are plumbing and civil & finishing requests', 'list:tickets');
    return L;
  }
  function insights() {
    const cur = Z.CUR, all = Z.agg({}, cur), prev = Z.agg({}, cur - 1);
    const zE = Z.aggSeries({ zone: 'E' }, 'collRate');
    const b4 = Z.BMAP.B4, excessKwh = b4.s.kwh[cur] - b4.s.kwh[cur - 1] * (Z.SEASON[cur] / Z.SEASON[cur - 1]);
    const irrD = Z.IRR.find(z => z.zone === 'D').s, excessM3 = irrD[cur] - irrD[cur - 1] * (Z.WSEASON[cur] / Z.WSEASON[cur - 1]);
    const p5 = Z.PUMPS.find(p => p.id === 'P-05'), risk = Math.round(Math.min(99, p5.vib / 7.1 * 55 + p5.hrs / 15000 * 30));
    const zs = Z.ZONES.map(z => [z.id, Z.agg({ zone: z.id }, cur).csat]).sort((a, b) => a[1] - b[1]);
    return [
      { cat: 'Unusual consumption', sev: 'crit', icon: 'drop', t: 'Building C3 water use up ' + nf(bMetric(Z.BMAP.C3, cur).m3D, 0) + '% with flow between 01:00–04:00', s: 'Rule: monthly m³ > 115% of prior month AND night flow > 0. Pattern matches a riser leak, not occupancy (occupancy unchanged).', act: 'open:bld:C3', rule: 'Δm³ MoM > 15% while Δoccupancy < 2%' },
      { cat: 'Maintenance risk', sev: 'crit', icon: 'pump', t: `Irrigation pump P-05 risk score ${risk}/100`, s: `Vibration ${p5.vib} mm/s above the 7.1 alarm with ${nf(p5.hrs)} run hours. Swap duty to P-06 and schedule bearing replacement.`, act: 'open:pump:P-05', rule: 'score = 55 × vibration/alarm + 30 × run-hours/15,000' },
      { cat: 'Collections trend', sev: 'warn', icon: 'coins', t: `Zone E collections down 3 months running (${pct(zE[cur - 3])} → ${pct(zE[cur])})`, s: 'Other zones are stable or improving. Prioritise statement reconciliation — two billing-query complaints from Zone E this week.', act: 'open:zone:E', rule: 'collection rate declining ≥ 3 consecutive months' },
      { cat: 'Cost opportunity', sev: 'good', icon: 'bolt', t: `Restore B4 lighting schedule — save ≈ ${egp(excessKwh * Z.TARIFF.kwh)}/month`, s: `≈ ${nf(excessKwh)} kWh above the seasonal baseline after a BMS override. Zone D irrigation is also ${nf(excessM3)} m³ above baseline (≈ ${egp(excessM3 * Z.TARIFF.irrigation)}).`, act: 'open:bld:B4', rule: 'actual − (last month × seasonal factor) at assumed tariffs' },
      { cat: 'Satisfaction trend', sev: 'good', icon: 'smile', t: `Satisfaction ${pct(Z.CSAT[cur])}, up ${nf(Z.CSAT[cur] - Z.CSAT[0], 1)} pp in 12 months`, s: `Lowest zone: ${Z.ZMAP[zs[0][0]].name} (${pct(zs[0][1])}). Drivers there: billing queries and response times.`, act: 'tab:experience', rule: 'CSAT trend + lowest-zone ranking' },
      { cat: 'Operational performance', sev: 'sage', icon: 'wrench', t: `PPM compliance ${pct(Z.PPM[cur])}; maintenance SLA ${pct(Z.SLA[cur])}`, s: `First response ${nf(Z.RESP[cur], 1)} h (was ${nf(Z.RESP[0], 1)} h in Dec). Occupancy ${pct(all.occRate)} (${delta(all.occRate, prev.occRate, { mode: 'pp' }).replace(/<[^>]+>/g, '').replace(/vs.*/, '').trim()}).`, act: 'tab:facilities', rule: 'monthly KPI roll-up' },
    ];
  }

  // ---------- masterplan ----------
  const MODES = [['occ', 'Occupancy'], ['energy', 'Energy'], ['water', 'Water'], ['maint', 'Maint.'], ['sec', 'Security']];
  const PAL = { g3: '#5f7f42', g2: '#8fab6c', g1: '#b9cb9d', sand: '#d8c7a2', warn: '#d39a45', crit: '#b24a37', none: '#b7b3a8' };
  function bColor(b, mode) {
    const x = bMetric(b);
    if (!x.u) return [PAL.none, 'Handover pending'];
    const med = (k) => { const v = Z.BUILDINGS.map(bb => bMetric(bb)[k]).filter(v => v != null).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    if (mode === 'occ') return x.rate >= 92 ? [PAL.g3, '≥ 92%'] : x.rate >= 82 ? [PAL.g2, '82–92%'] : x.rate >= 65 ? [PAL.g1, '65–82%'] : [PAL.sand, '< 65%'];
    if (mode === 'energy' || mode === 'water') {
      const k = mode === 'energy' ? 'kwhD' : 'm3D', d = x[k];
      return d > 15 ? [PAL.crit, '> +15% MoM'] : d > 6 ? [PAL.warn, '+6–15%'] : d > -6 ? [PAL.g2, 'Normal (±6%)'] : [PAL.g3, '< −6%'];
    }
    if (mode === 'maint') { const n = x.tix.length, cr = x.tix.some(t => t.prio === 'Critical'); return cr ? [PAL.crit, 'Critical open'] : n >= 4 ? [PAL.warn, '4+ open'] : n >= 2 ? [PAL.g1, '2–3 open'] : [PAL.g3, '0–1 open']; }
    if (mode === 'sec') { const f = x.fire; return f?.st === 'Fault' ? [PAL.crit, 'Fire panel fault'] : f?.st === 'Isolated' ? [PAL.warn, 'Zone isolated'] : [PAL.g3, 'Normal']; }
  }
  const legendFor = mode => ({
    occ: [[PAL.g3, '≥ 92%'], [PAL.g2, '82–92%'], [PAL.g1, '65–82%'], [PAL.sand, '< 65%'], [PAL.none, 'Not handed over']],
    energy: [[PAL.g3, '< −6% MoM'], [PAL.g2, 'Normal'], [PAL.warn, '+6–15%'], [PAL.crit, '> +15%']],
    water: [[PAL.g3, '< −6% MoM'], [PAL.g2, 'Normal'], [PAL.warn, '+6–15%'], [PAL.crit, '> +15%']],
    maint: [[PAL.g3, '0–1 open'], [PAL.g1, '2–3 open'], [PAL.warn, '4+ open'], [PAL.crit, 'Critical open']],
    sec: [[PAL.g3, 'Normal'], [PAL.warn, 'Isolated'], [PAL.crit, 'Fault']],
  }[mode]);
  const ZBOX = { A: [282, 34, 438, 66], B: [770, 106, 138, 320], C: [352, 450, 326, 60], D: [86, 98, 96, 274], E: [80, 418, 150, 116], F: [672, 428, 290, 98] };
  let treeCache = null;
  function trees() {
    if (treeCache) return treeCache;
    let s = 7, r = () => (s = (s * 9301 + 49297) % 233280) / 233280, out = '';
    for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); const x = 500 + Math.cos(a) * 205 * d, y = 272 + Math.sin(a) * 120 * d; if (Math.hypot((x - 515) / 95, (y - 300) / 52) < 1.15 || (y < 230 && x > 400 && x < 690)) continue; out += `<circle class="tree" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(4 + r() * 5).toFixed(1)}"/>`; }
    return treeCache = out;
  }
  function plan() {
    const mode = S.map, crit = new Set(alerts().filter(a => a.sev === 'crit' && a.bld).map(a => a.bld));
    let g = `<rect class="land" x="0" y="0" width="1000" height="560" rx="18"/>
      <ellipse class="road" cx="500" cy="272" rx="268" ry="172"/><ellipse class="road-c" cx="500" cy="272" rx="268" ry="172"/>
      <path class="road" d="M500 444V556M232 272H10M712 170 952 40M300 400 40 530"/>
      <ellipse class="park" cx="500" cy="272" rx="232" ry="142"/>${trees()}
      <path class="lake" d="M420 300c10-40 70-56 120-46s96 18 104 48-30 54-88 56-150 2-136-58z"/>
      <rect class="amen" x="376" y="176" width="100" height="38" rx="8"/><text class="amen-t" x="426" y="200" text-anchor="middle">Clubhouse</text>
      <ellipse class="amen" cx="522" cy="196" rx="38" ry="17"/><text class="amen-t" x="522" y="200" text-anchor="middle">Pools</text>
      <rect class="amen" x="568" y="176" width="104" height="38" rx="6"/><text class="amen-t" x="620" y="200" text-anchor="middle">Sports courts</text>
      <text class="amen-t" x="535" y="304" text-anchor="middle" style="fill:#4f6f78">Lagoon</text>
      <text class="amen-t" x="500" y="388" text-anchor="middle">Central Park</text>`;
    Object.entries(ZBOX).forEach(([z, [x, y, w, h]]) => {
      g += `<rect class="zonearea ${S.zone === z ? 'on' : ''}" data-act="zone:${z}" x="${x}" y="${y}" width="${w}" height="${h}" rx="14" style="--zc:var(--sage)"><title>Zone ${z} · ${Z.ZMAP[z].name} — click to filter</title></rect>`;
      const lp = { A: [500, 22], B: [839, 98], C: [515, 530], D: [134, 88], E: [155, 408], F: [817, 548] }[z];
      g += `<text class="zl" x="${lp[0]}" y="${lp[1]}" text-anchor="middle">Zone ${z} · ${Z.ZMAP[z].name}</text>`;
    });
    Z.BUILDINGS.forEach((b, i) => {
      const [c] = bColor(b, mode); const [w, h] = b.type === 'Apartments' ? [60, 32] : b.type === 'Townhouses' ? [52, 28] : [42, 28];
      const dim = (S.zone && b.zone !== S.zone) || (S.bld && b.id !== S.bld);
      const light = c === PAL.g1 || c === PAL.sand || c === PAL.none;
      g += `<g class="bld ${dim ? 'dim' : ''} ${light ? 'light' : ''} ${S.bld === b.id ? 'on' : ''}" data-act="bld:${b.id}" style="--bc:${c};--d:${i}" tabindex="0" role="button" aria-label="${esc(b.name)}">
        ${crit.has(b.id) ? `<rect class="pulse" x="${b.x - w / 2}" y="${b.y - h / 2}" width="${w}" height="${h}" rx="6"/>` : ''}
        <rect x="${b.x - w / 2}" y="${b.y - h / 2}" width="${w}" height="${h}" rx="6"/><text x="${b.x}" y="${b.y + 5}">${b.id}</text></g>`;
    });
    Z.GATES.forEach(gt => { g += `<g class="gate ${gt.issue ? 'warn' : ''}" data-act="open:gate:${gt.id}" role="button" aria-label="${esc(gt.name)}"><circle cx="${gt.x}" cy="${gt.y}" r="15"/><text x="${gt.x}" y="${gt.y + 4}">${gt.id}</text><title>${esc(gt.name)}</title></g>`; });
    return `<div class="mp" id="mp"><svg class="plan" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Conceptual compound masterplan">${g}</svg></div>
      <div class="mp-legend legend">${legendFor(mode).map(([c, l]) => `<span class="lg"><i class="sw" style="--c:${c}"></i>${l}</span>`).join('')}<span class="lg" style="color:var(--ink-3)">· Not to scale</span></div>`;
  }
  function showPop(id, ev) {
    const b = Z.BMAP[id], x = bMetric(b), pop = $('#pop');
    const al = alerts().filter(a => a.bld === id);
    pop.innerHTML = `<button class="ibtn pop-x" data-act="popclose" aria-label="Close">${ic('x')}</button>
      <h4>${esc(b.name)}</h4><div class="pop-s">Zone ${b.zone} · ${Z.ZMAP[b.zone].name} · ${b.type}${b.floors ? ' · ' + b.floors + ' floors' : ''}</div>
      ${x.u ? `<div class="minis">${mini('Occupancy', pct(x.rate, 0), `${x.o}/${x.u} units`)}${mini('Electricity', nf(x.kwh / 1000, 1) + ' MWh', `${x.kwhD >= 0 ? '+' : ''}${nf(x.kwhD, 0)}% MoM`)}${mini('Water', nf(x.m3) + ' m³', `${x.m3D >= 0 ? '+' : ''}${nf(x.m3D, 0)}% MoM`)}${mini('Open work orders', x.tix.length, x.tix.filter(t => t.overdue).length + ' overdue')}${mini('Fire panel', x.fire.st)}${mini('Satisfaction', pct(x.csat, 0))}</div>` : '<p class="muted">Handover pending — no operating data yet.</p>'}
      ${al.length ? `<div style="margin-top:8px">${al.map(a => `<div class="tag ${a.sev}" style="white-space:normal;text-transform:none;letter-spacing:0;font-weight:600;margin-top:4px">${esc(a.t)}</div>`).join('')}</div>` : ''}
      <div class="pop-a"><button class="lnk" data-act="fbld:${id}">Filter dashboard</button><button class="btn pri" data-act="open:bld:${id}">Building details ${ic('right')}</button></div>`;
    pop.hidden = false;
    const r = ev?.target?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let lx = r.left + r.width + 12, ly = r.top - 20;
    if (lx + pw > innerWidth - 10) lx = r.left - pw - 12;
    ly = Math.max(10, Math.min(innerHeight - ph - 10, ly));
    pop.style.left = Math.max(10, lx) + 'px'; pop.style.top = ly + 'px';
  }
  const hidePop = () => { $('#pop').hidden = true; };

  // ---------- views ----------
  const V = {};

  V.overview = () => {
    const a = A(), p = prevM() != null ? A(S.m - 1) : null, f = F();
    const xi = (l, v, act, cls = '') => `<span class="kx-i ${cls}" data-act="open:kpi:${act}" title="${esc(l)} — click for details"><small>${l}</small><b>${v}</b></span>`;
    const chg = (c, q) => q ? (c >= q ? '+' : '−') + nf(Math.abs(c / q * 100 - 100), 1) + '%' : '—';
    const ks = [
      { ic: 'gauge', l: 'Occupancy', v: nf(a.occRate, 1), u: '%', d: delta(a.occRate, p?.occRate, { mode: 'pp', goodUp: true }), sp: spk('occRate'), open: 'open:kpi:occRate',
        x: [xi('Units', nf(a.units), 'units'), xi('Occupied', nf(a.occ), 'occ'), xi('Available', nf(a.available), 'available'), xi('Residents', nf(a.residents), 'residents')] },
      { ic: 'coins', l: 'Revenue', v: nf(a.revenue / 1e6, 2), u: 'M EGP', d: delta(a.revenue, p?.revenue, { goodUp: true }), sp: spk('revenue'), open: 'open:kpi:revenue',
        x: [xi('Collection rate', pct(a.collRate, 1), 'collRate'), xi('Outstanding', nf(a.outstanding / 1e6, 2) + ' M EGP', 'outstanding', 'warn')] },
      { ic: 'bolt', l: 'Energy', v: nf(a.kwh / 1e3, 0), u: 'MWh', d: delta(a.kwh, p?.kwh, { goodUp: false }), sp: spk('kwh'), open: 'open:kpi:kwh',
        x: [xi('Water', nf(a.m3) + ' m³', 'm3'), xi('Water vs prior month', p ? chg(a.m3, p.m3) : '—', 'm3')] },
      { ic: 'smile', l: 'Satisfaction', v: nf(a.csat, 1), u: '%', d: delta(a.csat, p?.csat, { mode: 'pp', goodUp: true }), sp: spk('csat'), open: 'open:kpi:csat',
        x: [xi('Maintenance requests', nf(a.openTix), 'openTix', a.openTix > 40 ? 'warn' : ''), xi('Requests vs prior', p ? chg(a.openTix, p.openTix) : '—', 'openTix')] },
    ].map((k, i) => `<div class="kpi sum anim" role="button" tabindex="0" data-act="${k.open}" style="--i:${i}" title="${esc(k.l)} — click for details">
      <span class="kpi-ic">${ic(k.ic)}</span><span class="kpi-l">${esc(k.l)}</span>
      <span class="kpi-v">${k.v}<small>${k.u || ''}</small>${k.d}</span>
      <span class="kpi-sp">${CH.spark(k.sp)}</span>
      <span class="kx">${k.x.join('')}</span></div>`);
    const h = Z.health(f, S.m), hp = S.m ? Z.health(f, S.m - 1) : null;
    const tr = sub('ovtrend', 'rev');
    const trSpec = tr === 'rev' ? { series: [{ name: 'Revenue', values: spk('revenue').concat(Array(11 - S.m).fill(null)), color: 'var(--s1)' }], fmt: egp, yFmt: v => nf(v / 1e6, 0) + 'M' }
      : tr === 'occ' ? { series: [{ name: 'Occupancy', values: Z.aggSeries(f, 'occRate').map(v => +v.toFixed(1)), color: 'var(--s2)', kind: 'area' }], fmt: v => pct(v), yFmt: v => nf(v, 0) + '%', yMax: 100, yMin: 60, target: { name: 'Target 92%', value: 92 } }
      : { series: [{ name: 'Collection rate', values: Z.aggSeries(f, 'collRate').map(v => +v.toFixed(1)), color: 'var(--s3)', kind: 'line' }], fmt: v => pct(v), yFmt: v => nf(v, 0) + '%', yMax: 100, yMin: 70, target: { name: 'Target 95%', value: 95 } };
    const al = alerts().filter(x => !S.zone || !x.zone || x.zone === S.zone).filter(x => !S.bld || !x.bld || x.bld === S.bld);
    const ins = insights();
    return `<div class="lay" style="grid-template-columns:minmax(0,1.62fr) minmax(0,1fr) minmax(0,1.02fr);grid-template-rows:var(--ovk,minmax(104px,17%)) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis k4" style="${at(1, 1, 3)}">${ks.join('')}</div>
      ${panel({ id: 'p-map', st: at(1, 2, 1, 2), i: 3, t: 'Compound masterplan', s: `Conceptual layout · click a building for live KPIs`, r: seg('map', MODES, S.map).replace(/seg:map:/g, 'mp:'),
        b: `<div class="mp-bar"><div class="mp-zones"><button class="${!S.zone ? 'on' : ''}" data-act="zone:">All</button>${Z.ZONES.map(z => `<button class="${S.zone === z.id ? 'on' : ''}" data-act="zone:${z.id}" title="Zone ${z.id} · ${esc(z.name)}">${z.id}</button>`).join('')}</div><span class="note">${scopeName()} · ${MN(S.m)}</span></div>${plan()}` })}
      ${panel({ id: 'p-health', cls: 'dark', st: at(2, 2), i: 4, t: 'Operational health', s: `${scopeName()} · ${MN(S.m)}`, r: `<button class="lnk" style="color:var(--sage-2)" data-act="open:health:">Breakdown ${ic('right')}</button>`,
        b: `<div class="health"><div class="ringbox">${CH.ring(h.score, { color: 'var(--sage-2)' })}<div class="rv"><b>${nf(h.score, 0)}</b><small>of 100 ${hp ? `· ${h.score - hp.score >= 0 ? '+' : '−'}${nf(Math.abs(h.score - hp.score), 1)}` : ''}</small></div></div>
        <div class="hc">${h.comps.map(c => `<div class="hc-r"><span>${c.name}</span><b>${nf(c.v, 0)}</b><div class="meter"><i style="width:${c.v}%;--c:${c.v >= 95 ? 'var(--sage-2)' : c.v >= 88 ? '#d6c48f' : '#e0a548'}"></i></div></div>`).join('')}</div></div>` })}
      ${panel({ id: 'p-trend', st: at(2, 3), i: 5, t: 'Performance trend', s: 'Last 12 months · click a month to drill in', r: seg('ovtrend', [['rev', 'Revenue'], ['occ', 'Occupancy'], ['coll', 'Collections']], 'rev'),
        b: CH.xy({ ...trSpec, labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], now: S.m, nowLabel: 'Selected', height: 140, xName: 'Month', pick: i => openD('month', i) }) })}
      ${panel({ id: 'p-alerts', st: at(3, 2), i: 6, t: 'Critical alerts', s: `${al.filter(x => x.sev === 'crit').length} critical · ${al.filter(x => x.sev !== 'crit').length} warnings`, r: `<button class="lnk" data-act="alerts">All ${ic('right')}</button>`,
        b: fit('alerts', al.map((x, i) => `<button class="row" style="grid-template-columns:auto minmax(0,1fr)" data-act="${x.act}"><span class="ic-b ${x.sev}">${ic(x.icon)}</span><span style="min-width:0"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></span></button>`)) })}
      ${panel({ id: 'p-ins', cls: 'dark', st: at(3, 3), i: 7, t: 'Executive intelligence', s: 'Rule-based insights · demo data', r: `<button class="lnk" style="color:var(--sage-2)" data-act="insights">Open ${ic('right')}</button>`,
        b: fit('insights', ins.map(x => `<button class="ins" data-act="${x.act}"><span class="ic-b ${x.sev}">${ic(x.icon)}</span><span class="t">${esc(x.t)}</span><span class="s">${esc(x.cat)} · ${esc(x.s)}</span></button>`)) + aiBox() })}
    </div>`;
  };
  const aiBox = () => `<div class="ai-box slim" title="No predictive model is attached, so nothing on this panel is AI-generated">${ic('cpu')}<span><b>AI predictions: not connected</b> · <button class="lnk" data-act="sources" style="color:inherit;text-decoration:underline;font-size:11px">set up</button></span></div>`;

  V.residential = () => {
    const f = F(), a = A(), p = S.m ? A(S.m - 1) : null;
    const hh = a.occ ? a.residents / a.occ : 0, hhp = p?.occ ? p.residents / p.occ : null;
    const ks = [
      { ic: 'building', l: 'Residential inventory', v: nf(a.units), u: 'units', d: delta(a.units, p?.units, { mode: 'abs' }), sp: spk('units') },
      { ic: 'home', l: 'Occupied', v: nf(a.occ), u: pct(a.occRate), d: delta(a.occ, p?.occ, { goodUp: true }), sp: spk('occ') },
      { ic: 'door', l: 'Vacant', v: nf(a.vacant), d: delta(a.vacant, p?.vacant, { goodUp: false }), sp: spk('vacant') },
      { ic: 'key', l: 'Available to let / resell', v: nf(a.available), d: delta(a.available, p?.available, { goodUp: false }), sp: spk('available') },
      { ic: 'users', l: 'Residents', v: nf(a.residents), d: delta(a.residents, p?.residents, { goodUp: true }), sp: spk('residents') },
      { ic: 'walk', l: 'Avg household size', v: nf(hh, 2), u: 'people', d: delta(hh, hhp, { mode: 'abs', dp: 2 }) },
    ].map((k, i) => kpi({ ...k, i, open: 'open:kpi:' + ['units', 'occ', 'vacant', 'available', 'residents', 'residents'][i] }));
    const zones = Z.ZONES.map(z => { const x = Z.agg({ zone: z.id }, S.m); return { label: `${z.id} · ${z.name}`, sub: `${nf(x.occ)} / ${nf(x.units)}`, value: +x.occRate.toFixed(1), display: pct(x.occRate), color: S.zone && S.zone !== z.id ? 'var(--s4)' : 'var(--s2)', open: 'zone:' + z.id, target: 92 }; });
    const bl = Z.sel(S.bld ? { zone: Z.BMAP[S.bld].zone } : f).map(b => { const x = bMetric(b); const [c] = bColor(b, 'occ'); return `<button class="bcell" style="--bc:${c};--bt:${c === PAL.g1 || c === PAL.sand || c === PAL.none ? '#222' : '#fff'};${S.bld && S.bld !== b.id ? 'opacity:.35' : ''}" data-act="open:bld:${b.id}" title="${esc(b.name)}"><b>${b.id}</b><small>${x.u ? pct(x.rate, 0) : 'Pending'}</small></button>`; });
    const um = unitMix(f, S.m);
    const mv = sub('move', 'in');
    const mvv = mv === 'in' ? Z.series(f, 'mi') : mv === 'out' ? Z.series(f, 'mo') : Z.series(f, 'mi').map((v, i) => v - Z.series(f, 'mo')[i]);
    const dem = sub('dem', 'age');
    const zsel = Z.sel(f), ownShare = Z.sum(zsel.map(b => b.s.res[S.m] * Z.TENURE[b.zone])) / Math.max(1, a.residents);
    const demB = dem === 'age' ? CH.bars(Z.AGE.map(([l, s]) => ({ label: l, value: Math.round(a.residents * s), display: nf(a.residents * s) + ' · ' + pct(s * 100, 0), color: 'var(--s2)' })))
      : dem === 'house' ? CH.bars(Z.HOUSE.map(([l, s]) => ({ label: l, value: Math.round(a.occ * s), display: nf(a.occ * s) + ' households', color: 'var(--s3)' })))
      : CH.stack([{ label: 'Owner-occupied', value: Math.round(a.occ * ownShare), color: 'var(--s1)' }, { label: 'Tenant', value: Math.round(a.occ * (1 - ownShare)), color: 'var(--s2)' }], v => nf(v) + ' units') + `<p class="note" style="margin-top:8px">Tenant share is highest in Gateway Residences (Zone F), which is still in its first year after handover.</p>`;
    return `<div class="lay" style="grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: 'Occupancy trend', s: `${scopeName()} · 12 months`, b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: 'Occupancy', values: Z.aggSeries(f, 'occRate').map(v => +v.toFixed(1)), color: 'var(--s2)', kind: 'area' }], target: { name: 'Target 92%', value: 92 }, fmt: v => pct(v), yFmt: v => nf(v, 0) + '%', yMax: 100, yMin: 60, now: S.m, nowLabel: 'Selected', height: 140, pick: i => openD('month', i) }) })}
      ${panel({ st: at(1, 3), i: 7, t: 'Occupancy by building', s: 'Click a building for detail', b: `<div class="bgrid">${bl.join('')}</div>` })}
      ${panel({ st: at(2, 2), i: 8, t: 'Occupancy by zone', s: 'Marker = 92% target', b: CH.bars(zones, { max: 100 }) })}
      ${panel({ st: at(2, 3), i: 9, t: 'Move-in & move-out tracking', s: `${nf(a.moveIn)} in · ${nf(a.moveOut)} out in ${MN(S.m)}`, r: seg('move', [['in', 'Move-ins'], ['out', 'Move-outs'], ['net', 'Net']], 'in'),
        b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: mv === 'in' ? 'Move-ins' : mv === 'out' ? 'Move-outs' : 'Net change', values: mvv.map(v => Math.max(0, v)), color: mv === 'out' ? 'var(--s3)' : 'var(--s1)' }], height: 130, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(3, 2), i: 10, t: 'Unit availability', s: `${nf(a.available)} available · ${nf(a.reserved)} reserved · ${nf(a.fitout)} in fit-out`,
        b: '<div class="nolg">' + CH.stack([{ label: 'Occupied', value: a.occ, color: 'var(--s1)' }, { label: 'Available', value: a.available, color: 'var(--s2)' }, { label: 'Reserved', value: a.reserved, color: 'var(--s3)' }, { label: 'Fit-out', value: a.fitout, color: 'var(--s4)' }], v => nf(v) + ' units') + '</div>' +
          `<div class="tfit" data-fit="unitmix" style="flex:1;min-height:0;overflow:hidden"><table class="tbl compact"><thead><tr><th>Unit type</th><th class="num">Total</th><th class="num">Vacant</th><th class="num">Available</th></tr></thead><tbody>${um.map(r => `<tr data-fi><td>${r.t}</td><td class="num">${nf(r.total)}</td><td class="num">${nf(r.vac)}</td><td class="num">${nf(r.avail)}</td></tr>`).join('')}</tbody></table></div>` })}
      ${panel({ st: at(3, 3), i: 11, t: 'Resident demographics', s: `${nf(a.residents)} residents · demo profile`, r: seg('dem', [['age', 'Age'], ['house', 'Household'], ['ten', 'Tenure']], 'age'), b: demB })}
    </div>`;
  };

  V.utilities = () => {
    const f = F(), a = A(), p = S.m ? A(S.m - 1) : null;
    const cost = utilCost(a), costP = p ? utilCost(p) : null;
    const kpu = a.occ ? a.kwhRes / a.occ : 0, kpuP = p?.occ ? p.kwhRes / p.occ : null;
    const anomalies = Z.BUILDINGS.map(b => ({ b, x: bMetric(b) })).filter(o => o.x.u && (Math.abs(o.x.kwhD) > 10 || o.x.m3D > 10));
    const ks = [
      { ic: 'bolt', l: 'Electricity', v: nf(a.kwh / 1e3, 0), u: 'MWh', d: delta(a.kwh, p?.kwh, { goodUp: false }), sp: spk('kwh'), open: 'open:kpi:kwh' },
      { ic: 'drop', l: 'Water', v: nf(a.m3), u: 'm³', d: delta(a.m3, p?.m3, { goodUp: false }), sp: spk('m3'), open: 'open:kpi:m3' },
      { ic: 'coins', l: 'Utility cost', v: nf(cost / 1e6, 2), u: 'M EGP', d: delta(cost, costP, { goodUp: false }), title: 'At assumed tariffs: EGP 2.14/kWh, 9.5/m³ potable, 4.75/m³ irrigation' },
      { ic: 'gauge', l: 'Energy intensity', v: nf(kpu, 0), u: 'kWh / home', d: delta(kpu, kpuP, { goodUp: false }), sp: Z.MONTHS.slice(0, S.m + 1).map((_, i) => { const x = Z.agg(f, i); return x.occ ? x.kwhRes / x.occ : 0; }) },
      { ic: 'layers', l: 'Common-area share', v: Z.isAll(f) ? nf(a.commonKwh / a.kwh * 100, 1) : '—', u: Z.isAll(f) ? '%' : 'compound only', d: Z.isAll(f) ? delta(a.commonKwh / a.kwh * 100, p ? p.commonKwh / p.kwh * 100 : null, { mode: 'pp', goodUp: false }) : '' },
      { ic: 'alert', l: 'Usage anomalies', title: 'Consumption anomalies', v: anomalies.length, u: 'buildings', cls: anomalies.length ? 'crit' : '', open: 'list:anomalies' },
    ].map((k, i) => kpi({ ...k, i }));
    const tm = sub('utrend', 'e');
    const by = sub('uby', 'e');
    const rowsBy = (S.zone || S.bld ? Z.sel({ zone: S.zone || Z.BMAP[S.bld].zone }).map(b => ({ id: b.id, label: b.name, v: by === 'e' ? b.s.kwh[S.m] : b.s.m3[S.m], open: 'open:bld:' + b.id }))
      : Z.ZONES.map(z => ({ id: z.id, label: `${z.id} · ${z.name}`, v: Z.sum(Z.sel({ zone: z.id }).map(b => by === 'e' ? b.s.kwh[S.m] : b.s.m3[S.m])), open: 'zone:' + z.id })))
      .sort((x, y) => y.v - x.v).map(r => ({ label: r.label, value: r.v, display: by === 'e' ? nf(r.v / 1000, 1) + ' MWh' : nf(r.v) + ' m³', color: S.bld && r.id !== S.bld ? 'var(--s4)' : by === 'e' ? 'var(--s1)' : 'var(--s5)', open: r.open }));
    const common = Object.entries(Z.COMMON).map(([k, v]) => ({ label: k, value: v[S.m], display: nf(v[S.m]) + ' MWh', color: 'var(--s3)' }));
    const pumps = Z.PUMPS.map(pp => `<tr data-fi class="click" data-act="open:pump:${pp.id}" title="${esc(pp.sys)}"><td><b>${pp.id}</b> <span class="muted">${esc(pp.sys.replace('Domestic booster', 'Domestic').replace('Fire — ', 'Fire '))}</span></td><td>${stTag(pp.st)}</td><td class="num">${pp.flow ? nf(pp.flow) + ' m³/h' : '—'}</td><td class="num">${pp.bar ? nf(pp.bar, 1) + ' bar' : '—'}</td><td class="num" style="${pp.vib > 7 ? 'color:var(--crit);font-weight:700' : ''}">${pp.vib ? nf(pp.vib, 1) : '—'}</td><td class="num">${pp.health}</td></tr>`);
    const us = sub('uside', 'anom');
    const side = us === 'anom' ? fit('anomalies', anomalies.sort((x, y) => Math.max(y.x.m3D, y.x.kwhD) - Math.max(x.x.m3D, x.x.kwhD)).map(o => { const w = o.x.m3D > Math.abs(o.x.kwhD); const v = w ? o.x.m3D : o.x.kwhD; return `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:bld:${o.b.id}"><span class="ic-b ${v > 15 ? 'crit' : 'warn'}">${ic(w ? 'drop' : 'bolt')}</span><span style="min-width:0"><div class="t">${o.b.name} — ${w ? 'water' : 'electricity'}</div><div class="s">${w ? nf(o.x.m3) + ' m³' : nf(o.x.kwh / 1000, 1) + ' MWh'} in ${Z.MSHORT[S.m]} · occupancy ${pct(o.x.rate, 0)}</div></span><span class="v" style="color:var(--${v > 15 ? 'crit' : 'warn'})">${v > 0 ? '+' : ''}${nf(v, 0)}%</span></button>`; }).concat(Z.IRR.filter(z => z.zone === 'D').map(z => { const d = (z.s[S.m] - z.s[S.m - 1]) / z.s[S.m - 1] * 100; return d > 10 ? `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="tab:landscape"><span class="ic-b warn">${ic('leaf')}</span><span style="min-width:0"><div class="t">Zone D irrigation</div><div class="s">${nf(z.s[S.m])} m³ · soil still dry — valve or schedule fault</div></span><span class="v" style="color:var(--warn)">+${nf(d, 0)}%</span></button>` : ''; })))
      : fit('gens', Z.GENS.map(g => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:gen:${g.id}"><span class="ic-b ${g.issue ? 'warn' : 'sage'}">${ic('gen')}</span><span style="min-width:0"><div class="t">${g.id} · ${nf(g.kva)} kVA</div><div class="s">${esc(g.serves)} · fuel ${g.fuel}% · service ${g.due}</div></span>${stTag(g.st)}</button>`).concat([`<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto"><span class="ic-b sage">${ic('cpu')}</span><span><div class="t">Sewage treatment plant</div><div class="s">${nf(Z.COMMON['Sewage treatment plant'][S.m])} MWh · effluent reused for irrigation</div></span>${stTag('Running')}</button>`, `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto"><span class="ic-b sage">${ic('plug')}</span><span><div class="t">Smart-meter gateways</div><div class="s">23 of 24 reporting · GW-17 last seen 06:40</div></span><span class="tag warn">1 offline</span></button>`]));
    return `<div class="lay" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: tm === 'e' ? 'Electricity consumption' : 'Water consumption', s: `${scopeName()} · 12 months · click a month`, r: seg('utrend', [['e', 'Electricity'], ['w', 'Water']], 'e'),
        b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: tm === 'e' ? 'Electricity' : 'Water', values: tm === 'e' ? Z.aggSeries(f, 'kwh').map(v => Math.round(v / 1000)) : Z.aggSeries(f, 'm3'), color: tm === 'e' ? 'var(--s1)' : 'var(--s5)' }], fmt: v => tm === 'e' ? nf(v) + ' MWh' : nf(v) + ' m³', now: S.m, nowLabel: 'Selected', height: 140, pick: i => openD('month', i) }) })}
      ${panel({ st: at(2, 2), i: 7, t: S.zone || S.bld ? 'Usage by building' : 'Usage by zone', s: `${MN(S.m)} · click to drill down`, r: seg('uby', [['e', 'Electricity'], ['w', 'Water']], 'e'), b: CH.bars(rowsBy) })}
      ${panel({ st: at(3, 2), i: 8, t: 'Energy breakdown', s: `${MN(S.m)} · residential vs common systems`, r: compoundTag(),
        b: CH.stack([{ label: 'Residential', value: Math.round(Z.agg({}, S.m).kwhRes / 1000), color: 'var(--s1)' }, { label: 'Common systems', value: Math.round(Z.agg({}, S.m).commonKwh / 1000), color: 'var(--s3)' }], v => nf(v) + ' MWh') + CH.bars(common) })}
      ${panel({ st: at(1, 3), i: 9, t: 'Pump monitoring', s: '9 pumps · live snapshot · vibration mm/s', r: compoundTag(),
        b: `<div class="tfit" data-fit="pumps" style="flex:1;min-height:0;overflow:hidden"><table class="tbl compact"><thead><tr><th>Pump</th><th>Status</th><th class="num">Flow</th><th class="num">Pressure</th><th class="num">Vib.</th><th class="num">Health</th></tr></thead><tbody>${pumps.join('')}</tbody></table></div>` })}
      ${panel({ st: at(2, 3), i: 10, t: 'Water tanks', s: `${nf(Z.sum(Z.TANKS.map(t => t.cap * t.lvl / 100)))} m³ stored of ${nf(Z.sum(Z.TANKS.map(t => t.cap)))} m³`, r: compoundTag(),
        b: `<div class="tanks">${Z.TANKS.map(t => `<button class="tank ${t.lvl < 35 ? 'low' : ''}" data-act="open:tank:${t.id}"><div class="tank-v"><i style="height:${t.lvl}%"></i><b>${t.lvl}%</b></div><strong>${t.id}</strong><small>${esc(t.name)}<br>${nf(t.cap)} m³</small></button>`).join('')}</div>` })}
      ${panel({ st: at(3, 3), i: 11, t: us === 'anom' ? 'Consumption anomalies' : 'Infrastructure performance', s: us === 'anom' ? 'Buildings > ±10% month-on-month' : 'Generators, STP & metering', r: seg('uside', [['anom', 'Anomalies'], ['infra', 'Infrastructure']], 'anom'), b: side })}
    </div>`;
  };

  V.facilities = () => {
    const f = F(), tix = tixIn(f), a = A(), p = S.m ? A(S.m - 1) : null;
    const mc = Z.OPEX.find(o => o.name === 'Maintenance & repairs');
    const ea = equipAvail(f);
    const ks = [
      { ic: 'wrench', l: 'Open work orders', v: nf(tix.length), u: `${tix.filter(t => t.overdue).length} overdue`, d: delta(a.openTix, p?.openTix, { goodUp: false }), cls: 'alert', open: 'list:tickets' },
      { ic: 'calendar', l: 'PPM compliance', title: 'Preventive maintenance (PPM) compliance', v: nf(Z.PPM[S.m], 1), u: '%', d: delta(Z.PPM[S.m], Z.PPM[S.m - 1], { mode: 'pp', goodUp: true }), sp: Z.PPM.slice(0, S.m + 1) },
      { ic: 'gauge', l: 'Equipment availability', v: nf(ea, 1), u: '%', d: '<span class="delta">Lifts, HVAC & plant</span>' },
      { ic: 'clock', l: 'Avg first response', v: nf(Z.RESP[S.m], 1), u: 'hours', d: delta(Z.RESP[S.m], Z.RESP[S.m - 1], { goodUp: false }), sp: Z.RESP.slice(0, S.m + 1) },
      { ic: 'check', l: 'Avg resolution time', v: nf(Z.RESOL[S.m], 1), u: 'hours', d: delta(Z.RESOL[S.m], Z.RESOL[S.m - 1], { goodUp: false }), sp: Z.RESOL.slice(0, S.m + 1) },
      { ic: 'coins', l: 'Maintenance spend', v: nf(mc.actual[S.m] / 1e6, 2), u: 'M EGP', d: `<span class="delta ${mc.actual[S.m] > mc.budget[S.m] ? 'bad' : 'good'}">${mc.actual[S.m] > mc.budget[S.m] ? '+' : '−'}${pct(Math.abs(mc.actual[S.m] / mc.budget[S.m] - 1) * 100)}<em>vs budget</em></span>`, sp: mc.actual.slice(0, S.m + 1) },
    ].map((k, i) => kpi({ ...k, i }));
    const rows = tix.map(t => `<tr data-fi class="click" data-act="open:tix:${t.id}"><td><b>${t.id.replace('WO-', '')}</b></td><td>${t.bld}</td><td><div style="overflow:hidden;text-overflow:ellipsis">${esc(t.desc)}</div><div class="muted" style="font-size:10.5px;overflow:hidden;text-overflow:ellipsis">${esc(t.cat)} · ${esc(t.st)}</div></td><td><span class="tag ${t.prio === 'Critical' ? 'crit' : t.prio === 'High' ? 'warn' : t.prio === 'Medium' ? 'info' : ''}">${t.prio}</span></td><td class="num" style="${t.overdue ? 'color:var(--crit);font-weight:700' : ''}">${t.ageH < 48 ? t.ageH + ' h' : nf(t.ageH / 24, 1) + ' d'}</td></tr>`);
    const cats = Z.CATS.map(c => ({ label: c, value: tix.filter(t => t.cat === c).length, color: 'var(--s1)', sub: tix.filter(t => t.cat === c && t.overdue).length ? tix.filter(t => t.cat === c && t.overdue).length + ' overdue' : '' })).filter(r => r.value).sort((x, y) => y.value - x.value);
    const tr = sub('ftrend', 'resp');
    const trS = { resp: { n: 'First response (h)', v: Z.RESP, c: 'var(--s1)', fmt: v => nf(v, 1) + ' h', t: { name: 'Target 4 h', value: 4 } }, resol: { n: 'Resolution (h)', v: Z.RESOL, c: 'var(--s3)', fmt: v => nf(v, 1) + ' h', t: { name: 'Target 24 h', value: 24 } }, sla: { n: 'SLA met', v: Z.SLA, c: 'var(--s2)', fmt: v => pct(v), t: { name: 'Target 90%', value: 90 }, max: 100, min: 70 }, ppm: { n: 'PPM compliance', v: Z.PPM, c: 'var(--s2)', fmt: v => pct(v), t: { name: 'Target 95%', value: 95 }, max: 100, min: 80 } }[tr];
    const costSpec = { series: [{ name: 'Actual', values: mc.actual, color: 'var(--s1)' }, { name: 'Budget', values: mc.budget, color: 'var(--s4)' }], fmt: egp, yFmt: v => nf(v / 1e6, 1) + 'M' };
    const lifts = liftsIn(f);
    const hs = sub('fhv', 'hvac');
    const assets = [...Z.PUMPS.map(x => ({ n: 'Pump ' + x.id, h: x.health, a: 'open:pump:' + x.id })), ...Z.HVAC.map(x => ({ n: x.name, h: Math.round(x.avail - (x.issue ? 22 : 8)), a: 'open:hvac:' + x.id })), ...Z.GENS.map(x => ({ n: 'Generator ' + x.id, h: x.issue ? 71 : 90, a: 'open:gen:' + x.id })), ...lifts.map(l => ({ n: 'Lift ' + l.id, h: Math.round(l.st === 'Out of service' ? 42 : l.up - 6), a: 'open:lift:' + l.id }))].sort((x, y) => x.h - y.h);
    return `<div class="lay" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2, 1, 2), i: 6, t: 'Open maintenance tickets', s: `${scopeName()} · sorted by priority, then age`, r: `<button class="lnk" data-act="list:tickets">All ${ic('right')}</button>`,
        b: `<div class="tfit" data-fit="tickets" data-total="${tix.length}" style="flex:1;min-height:0;overflow:hidden"><table class="tbl" style="table-layout:fixed"><colgroup><col style="width:58px"><col style="width:42px"><col><col style="width:88px"><col style="width:50px"></colgroup><thead><tr><th>WO</th><th>Bldg</th><th>Issue · category · status</th><th>Priority</th><th class="num">Age</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` })}
      ${panel({ st: at(2, 2), i: 7, t: 'Open tickets by category', s: `${tix.length} open`, b: CH.bars(cats) })}
      ${panel({ st: at(3, 2), i: 8, t: tr === 'cost' ? 'Maintenance cost trend' : 'Response & resolution', s: '12 months · compound-wide', r: seg('ftrend', [['resp', 'Response'], ['resol', 'Resolution'], ['sla', 'SLA'], ['ppm', 'PPM'], ['cost', 'Cost']], 'resp'),
        b: tr === 'cost' ? CH.xy({ ...costSpec, labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], height: 130, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) })
          : CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: trS.n, values: trS.v, color: trS.c, kind: 'line' }], target: trS.t, fmt: trS.fmt, yMax: trS.max, yMin: trS.min, height: 130, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(2, 3), i: 9, t: 'Elevators & common-area equipment', s: `${lifts.filter(l => l.st === 'In service').length} of ${lifts.length} lifts in service`,
        b: fit('lifts', lifts.filter(l => l.st !== 'In service').map(l => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:lift:${l.id}"><span class="ic-b ${l.st === 'Out of service' ? 'crit' : 'warn'}">${ic('lift')}</span><span style="min-width:0"><div class="t">Lift ${l.id}</div><div class="s">${esc(l.issue || 'Quarterly service by OEM — back 16:00')}</div></span>${stTag(l.st)}</button>`)
          .concat(Z.COMMONEQ.map(c => `<div class="row" data-fi style="grid-template-columns:minmax(0,1fr) 90px 50px"><span class="t" style="font-weight:600">${c.name}</span><div class="meter"><i style="width:${c.ok / c.n * 100}%;--c:${c.ok === c.n ? 'var(--s2)' : 'var(--warn)'}"></i></div><span class="v">${c.ok}/${c.n}</span></div>`))) })}
      ${panel({ st: at(3, 3), i: 10, t: hs === 'hvac' ? 'HVAC performance' : 'Asset health', s: hs === 'hvac' ? `Clubhouse & lobbies · chiller COP ${nf(Z.HVAC_COP[S.m], 2)} in ${Z.MSHORT[S.m]}` : 'Lowest health first (rule-based index)', r: seg('fhv', [['hvac', 'HVAC'], ['asset', 'Asset health']], 'hvac'),
        b: hs === 'hvac' ? fit('hvac', Z.HVAC.map(h => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto auto" data-act="open:hvac:${h.id}"><span class="ic-b ${h.issue ? 'warn' : 'sage'}">${ic('thermo')}</span><span style="min-width:0"><div class="t">${esc(h.name)}</div><div class="s">${h.kw ? h.kw + ' kW' : 'Idle'}${h.sup ? ' · supply ' + nf(h.sup, 1) + ' °C' : ''}${h.cop ? ' · COP ' + h.cop : ''} · avail. ${pct(h.avail)}</div></span>${stTag(h.st)}</button>`))
          : fit('assets', assets.map(x => `<button class="row" style="grid-template-columns:minmax(0,1fr) 90px 34px" data-act="${x.a}"><span class="t" style="font-weight:600">${esc(x.n)}</span><div class="meter"><i style="width:${x.h}%;--c:${x.h < 60 ? 'var(--crit)' : x.h < 80 ? 'var(--warn)' : 'var(--s2)'}"></i></div><span class="v">${x.h}</span></button>`), assets.length) })}
    </div>`;
  };

  V.security = () => {
    const vis = Z.sum(Z.GATES.map(g => g.visitors)), veh = Z.sum(Z.GATES.map(g => g.vehicles)), lpr = Z.sum(Z.GATES.map(g => g.lpr * g.vehicles)) / veh;
    const ks = [
      { ic: 'shield', l: 'Security incidents', v: Z.INC_M[S.m], u: 'this month', d: delta(Z.INC_M[S.m], Z.INC_M[S.m - 1], { goodUp: false }), sp: Z.INC_M.slice(0, S.m + 1), open: 'list:incidents' },
      { ic: 'camera', l: 'CCTV availability', v: nf(Z.CCTV.online / Z.CCTV.total * 100, 1), u: `% · ${Z.CCTV.online}/${Z.CCTV.total}`, cls: 'alert', open: 'open:gate:G3' },
      { ic: 'key', l: 'Access success', title: 'Access control success', v: nf(lpr, 1), u: '% LPR read', d: '<span class="delta">Plate recognition, all gates</span>' },
      { ic: 'walk', l: 'Visitors today', v: nf(vis), d: '<span class="delta">Pre-registered 64%</span>' },
      { ic: 'car', l: 'Vehicles today', v: nf(veh), d: `<span class="delta">${nf(Z.sum(Z.GATES.map(g => g.denied)))} denied entries</span>` },
      { ic: 'clock', l: 'Emergency response', v: nf(Z.ERT[S.m], 1), u: 'min avg', d: delta(Z.ERT[S.m], Z.ERT[S.m - 1], { goodUp: false }), sp: Z.ERT.slice(0, S.m + 1) },
    ].map((k, i) => kpi({ ...k, i }));
    const th = sub('traffic', 'veh');
    const fs = Z.FIRE, fOk = fs.filter(x => x.st === 'Normal').length;
    const it = sub('inct', 'n');
    const dk = x => (x.day <= 9 ? 100 : 0) + x.day;
    const incs = Z.INCIDENTS.filter(x => !S.zone || x.zone === S.zone).slice().sort((p, q) => dk(q) - dk(p));
    const secAlerts = alerts().filter(x => ['camera', 'fire', 'shield', 'key'].includes(x.icon));
    return `<div class="lay" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: 'Visitor & vehicle traffic', s: 'Today by hour · all gates', r: seg('traffic', [['veh', 'Vehicles'], ['vis', 'Visitors']], 'veh'),
        b: CH.xy({ labels: Z.HOURS, series: [{ name: th === 'veh' ? 'Vehicles' : 'Visitors', values: th === 'veh' ? Z.VEH_H : Z.VIS_H, color: th === 'veh' ? 'var(--s1)' : 'var(--s2)' }], xFmt: (l, i) => i % 3 === 0 ? l.slice(0, 2) : '', xw: 18, height: 140, now: new Date().getHours(), nowLabel: 'Now', pick: i => openD('hour', i) }) })}
      ${panel({ st: at(2, 2), i: 7, t: 'Access control & gates', s: 'Today · live status', r: compoundTag(),
        b: `<div class="tfit" data-fit="gates" style="flex:1;min-height:0;overflow:hidden"><table class="tbl compact"><thead><tr><th>Gate</th><th class="num">Vehicles</th><th class="num">Visitors</th><th class="num">LPR</th><th class="num">Denied</th><th class="num">CCTV</th></tr></thead><tbody>${Z.GATES.map(g => `<tr data-fi class="click" data-act="open:gate:${g.id}"><td><b>${g.name.replace(' Gate', '')}</b></td><td class="num">${nf(g.vehicles)}</td><td class="num">${nf(g.visitors)}</td><td class="num">${pct(g.lpr)}</td><td class="num">${g.denied}</td><td class="num" style="${g.camsOn < g.cams ? 'color:var(--warn);font-weight:700' : ''}">${g.camsOn}/${g.cams}</td></tr>`).join('')}</tbody></table></div>` })}
      ${panel({ st: at(3, 2), i: 8, t: 'Fire alarm & firefighting', s: `${fOk} of ${fs.length} panels normal`,
        b: `<div class="minis" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px">${mini('Fire pumps', '3 / 3', 'auto · 8.6 bar')}${mini('Fire water', '100%', '1,200 m³')}${mini('Last drill', '21 Oct', 'Zone B')}</div>` +
          fit('fire', fs.filter(x => x.st !== 'Normal').map(x => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:fire:${x.panel}"><span class="ic-b ${x.st === 'Fault' ? 'crit' : 'warn'}">${ic('fire')}</span><span style="min-width:0"><div class="t">${x.panel} · ${x.bld}</div><div class="s">${esc(x.issue)}</div></span>${stTag(x.st)}</button>`).concat(Z.PUMPS.filter(pp => pp.sys.startsWith('Fire') && pp.issue).map(pp => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:pump:${pp.id}"><span class="ic-b warn">${ic('pump')}</span><span style="min-width:0"><div class="t">${pp.id} diesel fire pump</div><div class="s">${esc(pp.issue)}</div></span><span class="tag warn">Test due</span></button>`))) })}
      ${panel({ st: at(1, 3), i: 9, t: it === 'n' ? 'Security incidents' : 'Emergency response time', s: '12 months · compound-wide', r: seg('inct', [['n', 'Incidents'], ['ert', 'Response']], 'n'),
        b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [it === 'n' ? { name: 'Incidents', values: Z.INC_M, color: 'var(--s1)' } : { name: 'Avg response (min)', values: Z.ERT, color: 'var(--s3)', kind: 'line' }], target: it === 'ert' ? { name: 'Target 6 min', value: 6 } : null, fmt: v => it === 'n' ? nf(v) : nf(v, 1) + ' min', height: 130, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(2, 3), i: 10, t: 'Incident history', s: 'Last 30 days · newest first', r: `<button class="lnk" data-act="list:incidents">All ${ic('right')}</button>`,
        b: fit('incidents', incs.map(x => `<button class="row" style="grid-template-columns:auto minmax(0,1fr) auto" data-act="open:inc:${x.id}"><span class="ic-b ${x.sev === 'High' ? 'crit' : x.sev === 'Medium' ? 'warn' : ''}">${ic('shield')}</span><span style="min-width:0"><div class="t">${esc(x.type)}</div><div class="s">${esc(x.loc)} · ${String(x.day).padStart(2, '0')} ${x.day > 9 ? 'Oct' : 'Nov'} · response ${nf(x.resp, 1)} min</div></span><span class="tag ${x.st === 'Open' ? 'warn' : ''}">${x.st}</span></button>`), incs.length) })}
      ${panel({ st: at(3, 3), i: 11, t: 'Security alerts', s: `${secAlerts.length} active`, b: fit('secalerts', secAlerts.map(x => `<button class="row" style="grid-template-columns:auto minmax(0,1fr)" data-act="${x.act}"><span class="ic-b ${x.sev}">${ic(x.icon)}</span><span style="min-width:0"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></span></button>`)) })}
    </div>`;
  };

  function forecast(vals, upto, n = 3) {
    const ys = vals.slice(Math.max(0, upto - 5), upto + 1), xs = ys.map((_, i) => i), k = ys.length;
    const mx = Z.sum(xs) / k, my = Z.sum(ys) / k, b = Z.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Math.max(1e-9, Z.sum(xs.map(x => (x - mx) ** 2)));
    return Array.from({ length: n }, (_, i) => Math.round(my + b * (k - 1 + i + 1 - mx)));
  }
  V.finance = () => {
    const f = F(), a = A(), p = S.m ? A(S.m - 1) : null;
    const mix = revMix(f, S.m), mixP = S.m ? revMix(f, S.m - 1) : null;
    const scColl = mix[0][1] * a.collRate / 100;
    const mc = Z.OPEX.find(o => o.name === 'Maintenance & repairs');
    const ks = [
      { ic: 'coins', l: 'Total revenue', v: nf(a.revenue / 1e6, 2), u: 'M EGP', d: delta(a.revenue, p?.revenue, { goodUp: true }), sp: spk('revenue'), open: 'open:kpi:revenue' },
      { ic: 'home', l: 'Service charges', title: 'Service charges collected', v: nf(scColl / 1e6, 2), u: 'M EGP', d: mixP ? delta(scColl, mixP[0][1] * p.collRate / 100, { goodUp: true }) : '' },
      { ic: 'check', l: 'Collection rate', v: nf(a.collRate, 1), u: '%', d: delta(a.collRate, p?.collRate, { mode: 'pp', goodUp: true }), sp: spk('collRate'), open: 'open:kpi:collRate' },
      { ic: 'clock', l: 'Outstanding balances', v: nf(a.outstanding / 1e6, 2), u: 'M EGP', d: delta(a.outstanding, p?.outstanding, { goodUp: false }), sp: spk('outstanding'), cls: 'alert', open: 'open:kpi:outstanding' },
      { ic: 'bolt', l: 'Utility billing', v: nf(mix[1][1] / 1e6, 2), u: 'M EGP', d: mixP ? delta(mix[1][1], mixP[1][1]) : '' },
      { ic: 'wrench', l: 'Maintenance spend', title: 'Maintenance expenditure', v: nf(mc.actual[S.m] / 1e6, 2), u: 'M EGP', d: `<span class="delta ${mc.actual[S.m] > mc.budget[S.m] ? 'bad' : 'good'}">${pct(mc.actual[S.m] / mc.budget[S.m] * 100, 0)}<em>of budget</em></span>`, sp: mc.actual.slice(0, S.m + 1) },
    ].map((k, i) => kpi({ ...k, i }));
    const rev = Z.aggSeries(f, 'revenue').map(Math.round), fc = forecast(rev, S.m);
    const labels = Z.MSHORT.slice(0, S.m + 1).concat([1, 2, 3].map(i => MN(S.m + i).slice(0, 3)));
    const act = rev.slice(0, S.m + 1).concat([null, null, null]);
    const fcs = Array(S.m).fill(null).concat([rev[S.m], ...fc]);
    const bud = Z.MONTHS.map((_, m) => Z.sum(Z.OPEX.map(o => o.budget[m]))), actO = Z.MONTHS.map((_, m) => Z.sum(Z.OPEX.map(o => o.actual[m])));
    const ag = aging(f, S.m);
    return `<div class="lay" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: 'Revenue trend & forecast', s: 'Dashed = statistical projection (6-month linear trend) — not an AI forecast',
        b: CH.xy({ labels, tipLabel: (l, i) => MN(i), series: [{ name: 'Revenue', values: act, color: 'var(--s1)', kind: 'area' }, { name: 'Projection', values: fcs, color: 'var(--s3)', kind: 'line', dash: true }], fmt: egp, yFmt: v => nf(v / 1e6, 0) + 'M', height: 140, pick: i => i <= S.m ? openD('month', i) : toast('Projected month — no actuals yet') }) })}
      ${panel({ st: at(2, 2), i: 7, t: 'Revenue overview', s: `${MN(S.m)} · ${egp(a.revenue)}`, b: CH.stack(mix.map(([l, v], i) => ({ label: l, value: v, color: `var(--s${[1, 2, 3, 4][i]})` })), egp) + CH.bars(mix.map(([l, v], i) => ({ label: l, value: v, display: egp(v), color: `var(--s${[1, 2, 3, 4][i]})` }))) })}
      ${panel({ st: at(3, 2), i: 8, t: 'Outstanding balances', s: `${egp(a.outstanding)} · ageing`, b: CH.bars(ag.map(([l, v], i) => ({ label: l, value: v, display: egp(v), color: i === 3 ? 'var(--crit)' : i === 2 ? 'var(--warn)' : 'var(--s1)' }))) + `<p class="note" style="margin:6px 0 0">Over-90-day balances are concentrated in Signature Villas (Zone E).</p>` })}
      ${panel({ st: at(1, 3), i: 9, t: 'Budget vs actual — operating costs', s: '12 months · compound-wide', r: compoundTag(), b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: 'Actual', values: actO, color: 'var(--s1)' }, { name: 'Budget', values: bud, color: 'var(--s4)' }], fmt: egp, yFmt: v => nf(v / 1e6, 0) + 'M', height: 130, pick: i => openD('month', i), tipExtra: i => `Variance ${actO[i] > bud[i] ? '+' : '−'}${egp(Math.abs(actO[i] - bud[i]))}` }) })}
      ${panel({ st: at(2, 3), i: 10, t: 'Cost centres', s: `${MN(S.m)} · marker = budget`, r: compoundTag(), b: CH.bars(Z.OPEX.map(o => ({ label: o.name, value: o.actual[S.m], target: o.budget[S.m], display: egp(o.actual[S.m]), color: o.actual[S.m] > o.budget[S.m] ? 'var(--warn)' : 'var(--s2)', sub: (o.actual[S.m] > o.budget[S.m] ? '+' : '−') + pct(Math.abs(o.actual[S.m] / o.budget[S.m] - 1) * 100) }))) })}
      ${panel({ st: at(3, 3), i: 11, t: 'Collections by zone', s: `${MN(S.m)} · marker = 95% target`, b: CH.bars(Z.ZONES.map(z => { const x = Z.agg({ zone: z.id }, S.m); return { label: `${z.id} · ${z.name}`, value: +x.collRate.toFixed(1), display: pct(x.collRate), target: 95, color: x.collRate < 90 ? 'var(--crit)' : x.collRate < 94 ? 'var(--warn)' : 'var(--s2)', open: 'open:zone:' + z.id }; }), { max: 100 }) })}
    </div>`;
  };

  V.landscape = () => {
    const green = Z.sum(Z.LAND.map(l => l.area)), irr = Z.sum(Z.IRR.map(z => z.s[S.m])), irrP = S.m ? Z.sum(Z.IRR.map(z => z.s[S.m - 1])) : null;
    const open = Z.AMEN.filter(x => x.st === 'Open'), util = Z.sum(open.map(x => x.util)) / open.length;
    const pools = Z.AMEN.filter(x => x.pool);
    const ks = [
      { ic: 'tree', l: 'Green area', title: 'Green area maintained', v: nf(green / 1000, 1), u: 'k m²', d: '<span class="delta">incl. 38.5k m² Central Park</span>' },
      { ic: 'drop', l: 'Irrigation water', v: nf(irr), u: 'm³', d: delta(irr, irrP, { goodUp: false }), sp: Z.MONTHS.slice(0, S.m + 1).map((_, m) => Z.sum(Z.IRR.map(z => z.s[m]))) },
      { ic: 'leaf', l: 'Landscape condition', v: nf(Z.LAND_COND[S.m], 1), u: '/ 100', d: delta(Z.LAND_COND[S.m], Z.LAND_COND[S.m - 1], { mode: 'abs', dp: 1, goodUp: true }), sp: Z.LAND_COND.slice(0, S.m + 1) },
      { ic: 'users', l: 'Amenity utilisation', v: nf(util, 0), u: '% avg', d: '<span class="delta">Peak 18:00–21:00</span>' },
      { ic: 'pool', l: 'Pools in operation', v: `${pools.filter(x => x.st === 'Open').length}/${pools.length}`, cls: 'crit', d: '<span class="delta bad">Kids pool closed</span>', open: 'open:amen:pool3' },
      { ic: 'calendar', l: 'Facility bookings', v: nf(Z.BOOK_M[S.m]), u: 'this month', d: delta(Z.BOOK_M[S.m], Z.BOOK_M[S.m - 1], { goodUp: true }), sp: Z.BOOK_M.slice(0, S.m + 1) },
    ].map((k, i) => kpi({ ...k, i }));
    const zl = z => z === 'P' ? 'Central Park & Lagoon' : `${z} · ${Z.ZMAP[z].name}`;
    return `<div class="lay" style="grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: 'Irrigation consumption', s: '12 months · treated effluent + potable top-up', b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: 'Irrigation', values: Z.MONTHS.map((_, m) => Z.sum(Z.IRR.map(z => z.s[m]))), color: 'var(--s2)' }], fmt: v => nf(v) + ' m³', height: 140, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(2, 2), i: 7, t: 'Irrigation by zone', s: `${MN(S.m)} · m³ per 1,000 m² in brackets`, b: CH.bars(Z.IRR.map(z => { const ar = Z.LAND.find(l => l.zone === z.zone).area; return { label: zl(z.zone), sub: `(${nf(z.s[S.m] / ar * 1000, 0)})`, value: z.s[S.m], display: nf(z.s[S.m]) + ' m³', color: z.zone === 'D' ? 'var(--warn)' : 'var(--s5)' }; }).sort((x, y) => y.value - x.value)) })}
      ${panel({ st: at(3, 2), i: 8, t: 'Landscape condition', s: 'Audit score by zone · soil moisture in brackets', b: CH.bars(Z.LAND.map(l => ({ label: zl(l.zone), sub: `(${l.moist}% VWC)`, value: l.cond, display: l.cond + ' / 100', color: l.cond < 85 ? 'var(--warn)' : 'var(--s2)', target: 85 })), { max: 100 }) })}
      ${panel({ st: at(1, 3), i: 9, t: 'Amenity utilisation', s: 'Today · % of capacity', b: CH.bars(Z.AMEN.map(x => ({ label: x.name, value: x.util, display: x.st === 'Closed' ? 'Closed' : x.util + '%', color: x.st === 'Closed' ? 'var(--crit)' : x.util > 80 ? 'var(--s3)' : 'var(--s2)', open: 'open:amen:' + x.id, sub: x.book ? x.book + ' bookings' : '' })).sort((x, y) => y.value - x.value), { max: 100 }) })}
      ${panel({ st: at(2, 3), i: 10, t: 'Swimming pool operations', s: 'Live water quality · limits: chlorine 1–3 ppm, pH 7.2–7.8',
        b: `<table class="tbl compact"><thead><tr><th>Pool</th><th class="num">Cl ppm</th><th class="num">pH</th><th class="num">Bathers</th><th>Status</th></tr></thead><tbody>${pools.map(x => `<tr class="click" data-act="open:amen:${x.id}"><td><b>${x.name}</b></td><td class="num" style="${x.pool.cl < 1 ? 'color:var(--crit);font-weight:700' : ''}">${nf(x.pool.cl, 1)}</td><td class="num" style="${x.pool.ph > 7.8 ? 'color:var(--crit);font-weight:700' : ''}">${nf(x.pool.ph, 1)}</td><td class="num">${x.pool.load}</td><td>${stTag(x.st)}</td></tr>`).join('')}</tbody></table>
          <div class="minis opt" style="grid-template-columns:repeat(3,1fr);margin-top:10px">${mini('Lifeguards on duty', '6 / 6')}${mini('Last lab test', '07 Nov')}${mini('Pool energy', nf(Z.COMMON['Pools & filtration'][S.m]) + ' MWh')}</div>` })}
      ${panel({ st: at(3, 3), i: 11, t: 'Grounds & common-area performance', s: `${MN(S.m)} · tasks completed vs planned`,
        b: `<div class="minis" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px">${mini('Cleanliness audit', '94%')}${mini('Lighting availability', pct(209 / 214 * 100))}${mini('Waste on-time', '99%')}</div>` + fit('ltasks', Z.LTASKS.map(t => `<div class="row" style="grid-template-columns:minmax(0,1fr) 90px 44px"><span class="t" style="font-weight:600">${t.name}</span><div class="meter"><i style="width:${t.done / t.plan * 100}%;--c:${t.done / t.plan < .8 ? 'var(--warn)' : 'var(--s2)'}"></i></div><span class="v">${t.done}/${t.plan}</span></div>`)) })}
    </div>`;
  };

  V.experience = () => {
    const f = F(), a = A(), p = S.m ? A(S.m - 1) : null;
    const chV = Z.sum(Z.CHANNELS.map(c => c.vol)), resp = Z.sum(Z.CHANNELS.map(c => c.resp * c.vol)) / chV, fcr = Z.sum(Z.CHANNELS.map(c => c.fcr * c.vol)) / chV;
    const openC = Math.round(Z.COMPL_M[S.m] * .22);
    const ks = [
      { ic: 'smile', l: 'Resident satisfaction', v: nf(a.csat, 1), u: '%', d: delta(a.csat, p?.csat, { mode: 'pp', goodUp: true }), sp: spk('csat'), open: 'open:kpi:csat' },
      { ic: 'star', l: 'Net Promoter Score', v: (Z.NPS[S.m] > 0 ? '+' : '') + Z.NPS[S.m], d: delta(Z.NPS[S.m], Z.NPS[S.m - 1], { mode: 'abs', goodUp: true }), sp: Z.NPS.slice(0, S.m + 1) },
      { ic: 'msg', l: 'Open complaints', v: openC, u: `of ${Z.COMPL_M[S.m]} this month`, d: delta(Z.COMPL_M[S.m], Z.COMPL_M[S.m - 1], { goodUp: false }), sp: Z.COMPL_M.slice(0, S.m + 1) },
      { ic: 'clock', l: 'Avg service response', v: nf(resp, 1), u: 'hours', d: '<span class="delta">All channels, volume-weighted</span>' },
      { ic: 'users', l: 'App active residents', v: Z.ENGAGE.appUsers, u: '%', d: delta(Z.ENGAGE.appUsers, Z.ENGAGE.appUsersPrev, { mode: 'pp', goodUp: true }) },
      { ic: 'check', l: 'First-call resolution', title: 'First-contact resolution', v: nf(fcr, 0), u: '%', d: '<span class="delta">Target 80%</span>' },
    ].map((k, i) => kpi({ ...k, i }));
    const st = sub('xtrend', 'csat');
    const stS = { csat: { n: 'Satisfaction', v: Z.aggSeries(f, 'csat'), c: 'var(--s2)', fmt: v => pct(v), t: { name: 'Target 90%', value: 90 }, k: 'area' }, nps: { n: 'NPS', v: Z.NPS, c: 'var(--s3)', fmt: v => '+' + v, k: 'line' }, compl: { n: 'Complaints', v: Z.COMPL_M, c: 'var(--s1)', fmt: v => nf(v), k: 'bar' } }[st];
    const fb = Z.FEEDBACK.filter(x => !S.zone || x.z === S.zone);
    return `<div class="lay" style="grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(80px,15%) minmax(0,1fr) minmax(0,1fr)">
      <div class="kpis" style="${at(1, 1, 3)};grid-template-columns:repeat(6,minmax(0,1fr))">${ks.join('')}</div>
      ${panel({ st: at(1, 2), i: 6, t: 'Satisfaction & sentiment', s: `${st === 'csat' ? scopeName() : 'Compound-wide'} · 12 months`, r: seg('xtrend', [['csat', 'CSAT'], ['nps', 'NPS'], ['compl', 'Complaints']], 'csat'),
        b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: stS.n, values: stS.v, color: stS.c, kind: stS.k }], target: stS.t, fmt: stS.fmt, yMax: st === 'csat' ? 100 : undefined, yMin: st === 'csat' ? 70 : undefined, height: 140, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(2, 2), i: 7, t: 'Complaints & requests', s: `By category · ${MN(S.m)}`, b: CH.bars(Z.COMPL_CAT.map(([l, v]) => ({ label: l, value: Math.round(v * Z.COMPL_M[S.m] / 130), color: l === 'Billing queries' || l === 'Maintenance delays' ? 'var(--s3)' : 'var(--s1)' }))) })}
      ${panel({ st: at(3, 2), i: 8, t: 'Satisfaction by zone', s: 'Marker = 90% target', b: CH.bars(Z.ZONES.map(z => { const v = Z.agg({ zone: z.id }, S.m).csat; return { label: `${z.id} · ${z.name}`, value: v, display: pct(v), target: 90, color: v < 88 ? 'var(--warn)' : 'var(--s2)', open: 'open:zone:' + z.id }; }), { max: 100 }) })}
      ${panel({ st: at(1, 3), i: 9, t: 'Customer service performance', s: 'By channel · this month',
        b: `<table class="tbl compact"><thead><tr><th>Channel</th><th class="num">Volume</th><th class="num">Response</th><th class="num">CSAT</th><th class="num">FCR</th></tr></thead><tbody>${Z.CHANNELS.map(c => `<tr><td><b>${c.name}</b></td><td class="num">${nf(c.vol)}</td><td class="num">${c.resp < 1 ? nf(c.resp * 60) + ' min' : nf(c.resp, 1) + ' h'}</td><td class="num">${c.csat}%</td><td class="num" style="${c.fcr < 70 ? 'color:var(--warn);font-weight:700' : ''}">${c.fcr}%</td></tr>`).join('')}</tbody></table>
          <div class="minis opt" style="grid-template-columns:repeat(3,1fr);margin-top:10px">${mini('Requests handled', nf(chV))}${mini('Digital share', pct(Z.CHANNELS[0].vol / chV * 100, 0))}${mini('Escalations', '23')}</div>` })}
      ${panel({ st: at(2, 3), i: 10, t: 'Resident feedback', s: 'Latest · anonymised demo comments', r: `<button class="lnk" data-act="list:feedback">All ${ic('right')}</button>`,
        b: fit('feedback', fb.map(x => `<div class="fb" data-fi><q>${esc(x.t)}</q><div class="m"><span class="stars">${'★'.repeat(x.s)}<span style="opacity:.25">${'★'.repeat(5 - x.s)}</span></span><span>Zone ${x.z}</span><span>${x.ch}</span><span>${x.d}</span></div></div>`), fb.length) })}
      ${panel({ st: at(3, 3), i: 11, t: 'Community engagement', s: `${MN(S.m)} · events & participation`,
        b: `<div class="minis" style="grid-template-columns:repeat(4,1fr);margin-bottom:8px">${mini('Events', Z.ENGAGE.events)}${mini('Attendance', nf(Z.ENGAGE.attendance))}${mini('Surveys', nf(Z.ENGAGE.surveys))}${mini('Members', nf(Z.ENGAGE.clubMembers))}</div>` + CH.bars(Z.EVENTS.map(([l, v]) => ({ label: l, value: v, color: 'var(--s2)' })).sort((x, y) => y.value - x.value)) })}
    </div>`;
  };

  // ---------- reports ----------
  const REPORTS = [
    { id: 'exec', t: 'Executive monthly report', s: 'KPIs, health score, alerts, insights, revenue & occupancy', icon: 'report' },
    { id: 'ops', t: 'Operational performance report', s: 'Maintenance, lifts, security, utilities & amenities', icon: 'gauge' },
    { id: 'fin', t: 'Financial report', s: 'Revenue mix, collections, ageing, budget vs actual', icon: 'coins' },
    { id: 'util', t: 'Utility consumption report', s: 'Electricity & water by building, common systems, anomalies', icon: 'bolt' },
    { id: 'maint', t: 'Maintenance report', s: 'Open work orders, categories, response trends, asset health', icon: 'wrench' },
  ];
  function reportData(id) {
    const f = F(), m = S.m, a = Z.agg(f, m), p = m ? Z.agg(f, m - 1) : null, hdr = `${scopeName()} · ${MN(m)}`;
    const row = (l, v, pv, fm) => [l, fm(v), pv == null ? '—' : fm(pv), pv == null ? '—' : ((v - pv) >= 0 ? '+' : '') + nf((v - pv) / (Math.abs(pv) || 1) * 100, 1) + '%'];
    const K = [row('Total residential units', a.units, p?.units, nf), row('Occupied units', a.occ, p?.occ, nf), row('Occupancy rate', a.occRate, p?.occRate, v => pct(v)), row('Available units', a.available, p?.available, nf), row('Total residents', a.residents, p?.residents, nf),
      row('Total revenue', a.revenue, p?.revenue, egp), row('Collection rate', a.collRate, p?.collRate, v => pct(v)), row('Outstanding payments', a.outstanding, p?.outstanding, egp), row('Energy consumption', a.kwh, p?.kwh, v => nf(v) + ' kWh'), row('Water consumption', a.m3, p?.m3, v => nf(v) + ' m³'), row('Active maintenance requests', a.openTix, p?.openTix, nf), row('Resident satisfaction', a.csat, p?.csat, v => pct(v))];
    const KX = [['KPI', 'Value', 'Prior month', 'Change']].concat(K);
    const bRows = Z.sel(f).map(b => { const x = bMetric(b, m); return [b.id, b.name, 'Zone ' + b.zone, b.type, x.u, x.o, x.rate == null ? '' : +x.rate.toFixed(1), x.kwh, x.m3, x.tix.length, x.coll == null ? '' : +x.coll.toFixed(1)]; });
    const bHead = ['ID', 'Building', 'Zone', 'Type', 'Units', 'Occupied', 'Occupancy %', 'Electricity kWh', 'Water m³', 'Open WOs', 'Collection %'];
    const monthly = [['Month', 'Units', 'Occupied', 'Occupancy %', 'Revenue EGP', 'Collection %', 'Outstanding EGP', 'Energy kWh', 'Water m³', 'CSAT %']].concat(Z.MONTHS.map((mm, i) => { const x = Z.agg(f, i); return [mm, x.units, x.occ, +x.occRate.toFixed(1), Math.round(x.revenue), +x.collRate.toFixed(1), x.outstanding, Math.round(x.kwh), x.m3, x.csat]; }));
    const tix = tixIn(f), tHead = ['WO', 'Building', 'Zone', 'Category', 'Description', 'Priority', 'Age (h)', 'SLA (h)', 'Overdue', 'Status', 'Assigned to'];
    const tRows = tix.map(t => [t.id, t.bld, t.zone, t.cat, t.desc, t.prio, t.ageH, t.slaH, t.overdue ? 'Yes' : 'No', t.st, t.tech]);
    const tbl = (h, rows, num = []) => `<table><thead><tr>${h.map((c, i) => `<th${num.includes(i) ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${num.includes(i) ? ' class="n"' : ''}>${esc(typeof c === 'number' ? nf(c, Number.isInteger(c) ? 0 : 1) : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const al = alerts(), ins = insights();
    const S1 = { h: 'Key performance indicators', html: tbl(['KPI', 'Value', 'Prior month', 'Change'], K, [1, 2, 3]) };
    const out = { title: REPORTS.find(r => r.id === id).t, sub: hdr, sections: [], sheets: [] };
    const readme = { name: 'About', rows: [['ZED West — ' + out.title], ['Scope', scopeName()], ['Month', MN(m)], ['Generated', new Date().toLocaleString('en-GB')], ['Data', 'DEMONSTRATION DATA — simulated figures, not ZED West operating data'], ['Layout', 'Zones and buildings follow a conceptual layout, not the verified masterplan']], widths: [16, 80], titleRows: [] };
    if (id === 'exec') {
      const h = Z.health(f, m);
      out.sections = [S1, { h: 'Operational health score: ' + nf(h.score, 1) + ' / 100', html: tbl(['Component', 'Score', 'Weight'], h.comps.map(c => [c.name, nf(c.v, 1), pct(c.w * 100, 0)]), [1, 2]) },
        { h: 'Revenue — last 12 months', html: CH.staticBars(Z.MSHORT, Z.aggSeries(f, 'revenue')) }, { h: 'Occupancy rate — last 12 months', html: CH.staticLine(Z.MSHORT, Z.aggSeries(f, 'occRate')) },
        { h: 'Critical alerts', html: tbl(['Severity', 'Alert', 'Detail'], al.map(x => [x.sev === 'crit' ? 'Critical' : 'Warning', x.t, x.s])) },
        { h: 'Executive insights (rule-based, demo data)', html: tbl(['Category', 'Insight', 'Rule'], ins.map(x => [x.cat, x.t, x.rule])) + '<p class="small">No AI model is connected; the insights above are deterministic rules over demo data.</p>' }];
      out.sheets = [readme, { name: 'KPIs', rows: KX }, { name: 'Monthly trend', rows: monthly }, { name: 'Alerts', rows: [['Severity', 'Alert', 'Detail']].concat(al.map(x => [x.sev, x.t, x.s])) }, { name: 'Insights', rows: [['Category', 'Insight', 'Detail', 'Rule']].concat(ins.map(x => [x.cat, x.t, x.s, x.rule])) }];
    } else if (id === 'ops') {
      const lifts = liftsIn(f);
      const ops = [['Open work orders', tix.length], ['Overdue work orders', tix.filter(t => t.overdue).length], ['PPM compliance %', Z.PPM[m]], ['Maintenance SLA %', Z.SLA[m]], ['First response (h)', Z.RESP[m]], ['Resolution (h)', Z.RESOL[m]], ['Lifts in service', `${lifts.filter(l => l.st === 'In service').length}/${lifts.length}`], ['CCTV online', `${Z.CCTV.online}/${Z.CCTV.total}`], ['Security incidents', Z.INC_M[m]], ['Emergency response (min)', Z.ERT[m]], ['Fire panels normal', `${Z.FIRE.filter(x => x.st === 'Normal').length}/${Z.FIRE.length}`], ['Amenity bookings', Z.BOOK_M[m]]];
      out.sections = [{ h: 'Operational summary', html: tbl(['Measure', 'Value'], ops, [1]) }, { h: 'PPM compliance — 12 months', html: CH.staticLine(Z.MSHORT, Z.PPM) }, { h: 'Security incidents — 12 months', html: CH.staticBars(Z.MSHORT, Z.INC_M) }, { h: 'Active alerts', html: tbl(['Severity', 'Alert', 'Detail'], al.map(x => [x.sev === 'crit' ? 'Critical' : 'Warning', x.t, x.s])) }];
      out.sheets = [readme, { name: 'Operations', rows: [['Measure', 'Value']].concat(ops) }, { name: 'Pumps', rows: [['Pump', 'System', 'Status', 'Flow m3/h', 'Pressure bar', 'Vibration mm/s', 'Run hours', 'Health']].concat(Z.PUMPS.map(x => [x.id, x.sys, x.st, x.flow, x.bar, x.vib, x.hrs, x.health])) }, { name: 'Lifts', rows: [['Lift', 'Building', 'Status', 'Uptime %', 'Trips today']].concat(lifts.map(l => [l.id, l.bld, l.st, l.up, l.trips])) }, { name: 'Gates', rows: [['Gate', 'Vehicles', 'Visitors', 'LPR %', 'Denied', 'Cameras online', 'Cameras']].concat(Z.GATES.map(g => [g.name, g.vehicles, g.visitors, g.lpr, g.denied, g.camsOn, g.cams])) }, { name: 'Incidents', rows: [['ID', 'Type', 'Severity', 'Location', 'Response min', 'Status']].concat(Z.INCIDENTS.map(x => [x.id, x.type, x.sev, x.loc, x.resp, x.st])) }];
    } else if (id === 'fin') {
      const mix = revMix(f, m), ag = aging(f, m);
      out.sections = [{ h: 'Revenue by stream', html: tbl(['Stream', 'Amount'], mix.map(([k, v]) => [k, egp(v)]), [1]) }, { h: 'Revenue — 12 months', html: CH.staticBars(Z.MSHORT, Z.aggSeries(f, 'revenue')) }, { h: 'Collections by zone', html: tbl(['Zone', 'Collection rate', 'Outstanding'], Z.ZONES.map(z => { const x = Z.agg({ zone: z.id }, m); return [z.id + ' · ' + z.name, pct(x.collRate), egp(x.outstanding)]; }), [1, 2]) }, { h: 'Outstanding balance ageing', html: tbl(['Bucket', 'Amount'], ag.map(([k, v]) => [k, egp(v)]), [1]) }, { h: 'Operating costs — budget vs actual (' + MN(m) + ')', html: tbl(['Cost centre', 'Budget', 'Actual', 'Variance'], Z.OPEX.map(o => [o.name, egp(o.budget[m]), egp(o.actual[m]), (o.actual[m] > o.budget[m] ? '+' : '−') + egp(Math.abs(o.actual[m] - o.budget[m]))]), [1, 2, 3]) }, { h: 'Operating costs — 12 months (actual vs budget)', html: CH.staticBars(Z.MSHORT, Z.MONTHS.map((_, i) => Z.sum(Z.OPEX.map(o => o.actual[i]))), { cmp: Z.MONTHS.map((_, i) => Z.sum(Z.OPEX.map(o => o.budget[i]))) }) }];
      out.sheets = [readme, { name: 'Revenue mix', rows: [['Stream', 'EGP']].concat(mix) }, { name: 'Monthly', rows: monthly }, { name: 'Ageing', rows: [['Bucket', 'EGP']].concat(ag) }, { name: 'Budget vs actual', rows: [['Cost centre'].concat(Z.MONTHS.flatMap(mm => [mm + ' budget', mm + ' actual']))].concat(Z.OPEX.map(o => [o.name].concat(Z.MONTHS.flatMap((_, i) => [o.budget[i], o.actual[i]])))) }, { name: 'By building', rows: [bHead].concat(bRows) }];
    } else if (id === 'util') {
      out.sections = [{ h: 'Consumption summary', html: tbl(['Measure', 'Value'], [['Electricity', nf(a.kwh) + ' kWh'], ['of which residential', nf(a.kwhRes) + ' kWh'], ['of which common systems', nf(a.commonKwh) + ' kWh'], ['Water (total)', nf(a.m3) + ' m³'], ['Irrigation & pools', nf(a.irrig) + ' m³'], ['Utility cost (assumed tariffs)', egp(utilCost(a))]], [1]) }, { h: 'Electricity — 12 months (kWh)', html: CH.staticBars(Z.MSHORT, Z.aggSeries(f, 'kwh')) }, { h: 'Water — 12 months (m³)', html: CH.staticLine(Z.MSHORT, Z.aggSeries(f, 'm3'), { color: '#557894' }) }, { h: 'By building', html: tbl(['Building', 'Electricity kWh', 'Δ MoM', 'Water m³', 'Δ MoM'], Z.sel(f).map(b => { const x = bMetric(b, m); return [b.name, nf(x.kwh), nf(x.kwhD, 1) + '%', nf(x.m3), nf(x.m3D, 1) + '%']; }), [1, 2, 3, 4]) }];
      out.sheets = [readme, { name: 'By building', rows: [bHead].concat(bRows) }, { name: 'Common systems MWh', rows: [['System'].concat(Z.MONTHS)].concat(Object.entries(Z.COMMON).map(([k, v]) => [k].concat(v))) }, { name: 'Irrigation m3', rows: [['Zone'].concat(Z.MONTHS)].concat(Z.IRR.map(z => [z.zone === 'P' ? 'Central Park' : 'Zone ' + z.zone].concat(z.s))) }, { name: 'Monthly', rows: monthly }];
    } else {
      out.sections = [{ h: `Open work orders (${tix.length})`, html: tbl(tHead, tRows, [6, 7]) }, { h: 'First response time — 12 months (hours)', html: CH.staticLine(Z.MSHORT, Z.RESP) }, { h: 'Maintenance cost — actual vs budget', html: CH.staticBars(Z.MSHORT, Z.OPEX[0].actual, { cmp: Z.OPEX[0].budget }) }];
      out.sheets = [readme, { name: 'Open work orders', rows: [tHead].concat(tRows) }, { name: 'KPI trends', rows: [['Month', 'PPM %', 'SLA %', 'Response h', 'Resolution h', 'Maint. actual EGP', 'Maint. budget EGP']].concat(Z.MONTHS.map((mm, i) => [mm, Z.PPM[i], Z.SLA[i], Z.RESP[i], Z.RESOL[i], Z.OPEX[0].actual[i], Z.OPEX[0].budget[i]])) }, { name: 'Asset register', rows: [['Asset', 'Type', 'Status', 'Health / uptime']].concat(Z.PUMPS.map(x => [x.id, 'Pump — ' + x.sys, x.st, x.health]), Z.HVAC.map(x => [x.id, 'HVAC — ' + x.name, x.st, x.avail]), Z.LIFTS.map(l => [l.id, 'Lift', l.st, l.up])) }];
    }
    return out;
  }
  const PRINT_CSS = `@page{size:A4 landscape;margin:14mm}body{font:11px/1.45 Manrope,Segoe UI,sans-serif;color:#1d1e1b;margin:0}h1{font:600 26px Georgia,serif;margin:0;letter-spacing:.04em}h2{font:600 15px Georgia,serif;margin:18px 0 6px;break-after:avoid}.sub{color:#666;margin:2px 0 4px}.demo{display:inline-block;background:#e6edda;color:#4b6332;font-weight:700;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:99px}table{border-collapse:collapse;width:100%;break-inside:auto}th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#777;border-bottom:1.5px solid #999;padding:4px 6px}td{border-bottom:1px solid #ddd;padding:4px 6px}tr{break-inside:avoid}.n{text-align:right;font-variant-numeric:tabular-nums}.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2b2b29;padding-bottom:8px;margin-bottom:6px}.small,.foot{color:#777;font-size:9.5px}.foot{margin-top:18px;border-top:1px solid #ccc;padding-top:6px}`;
  function reportHTML(id, forPrint) {
    const r = reportData(id);
    const body = `<div class="hd"><div><h1>ZED WEST</h1><div class="sub">${esc(r.title)} — ${esc(r.sub)}</div></div><div><span class="demo">Demo data</span></div></div>${r.sections.map(s => `<h2>${esc(s.h)}</h2>${s.html}`).join('')}<div class="foot">Generated ${new Date().toLocaleString('en-GB')} · ZED West Smart Compound Command Center · All figures are simulated demonstration data. Compound layout is conceptual.</div>`;
    return forPrint ? `<!doctype html><html><head><meta charset="utf-8"><title>ZED West — ${esc(r.title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>` : body;
  }
  function exportPDF(id) {
    const fr = $('#printFrame'), d = fr.contentDocument;
    d.open(); d.write(reportHTML(id, true)); d.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); }, 250);
    toast('Print dialog opened — choose “Save as PDF”');
  }
  function exportXLS(id) {
    const r = reportData(id);
    XLSX.download(`ZED-West_${id}_${MN(S.m).replace(' ', '-')}${S.zone ? '_Zone-' + S.zone : ''}${S.bld ? '_' + S.bld : ''}.xlsx`, r.sheets);
    toast('Excel workbook downloaded');
  }
  V.reports = () => {
    const f = F(), met = sub('hist', 'occRate');
    const MET = { occRate: ['Occupancy', v => pct(v)], revenue: ['Revenue', egp], collRate: ['Collection', v => pct(v)], kwh: ['Energy', v => nf(v / 1000) + ' MWh'], m3: ['Water', v => nf(v) + ' m³'], csat: ['CSAT', v => pct(v)] };
    const [mn, fm] = MET[met];
    const s = Z.aggSeries(f, met);
    const comp = (z) => { const v = Z.aggSeries(z ? { zone: z } : {}, met); return [v[S.m], S.m >= 3 ? v[S.m - 3] : null, v[0]]; };
    const chg = (a, b) => b == null || !b ? '—' : `${a >= b ? '+' : '−'}${nf(Math.abs((a - b) / b * 100), 1)}%`;
    return `<div class="lay" style="grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr) minmax(0,1fr);grid-template-rows:minmax(0,1.1fr) minmax(0,1fr)">
      ${panel({ st: at(1, 1, 1, 2), i: 0, t: 'Report library', s: `${scopeName()} · ${MN(S.m)} · uses the filters above`,
        b: REPORTS.map(r => `<div class="rep ${S.rep === r.id ? 'on' : ''}" data-act="rep:${r.id}" role="button" tabindex="0"><span class="ic-b sage">${ic(r.icon)}</span><span><div class="t">${r.t}</div><div class="s">${r.s}</div></span><span style="display:flex;gap:4px"><button class="ibtn" data-act="pdf:${r.id}" title="Export PDF">${ic('pdf')}</button><button class="ibtn" data-act="xls:${r.id}" title="Export Excel">${ic('xls')}</button></span></div>`).join('') +
          `<div class="ai-box" style="margin-top:auto">${ic('info')}<span>PDF uses the browser print dialog (choose <b>Save as PDF</b>). Excel exports a native .xlsx workbook with one sheet per section. Every export is stamped <b>Demo data</b>.</span></div>` })}
      ${panel({ st: at(2, 1, 2), i: 1, t: 'Preview — ' + REPORTS.find(r => r.id === S.rep).t, s: 'First page', r: `<button class="btn" data-act="xls:${S.rep}">${ic('xls')}Excel</button><button class="btn pri" data-act="pdf:${S.rep}">${ic('pdf')}PDF</button>`,
        b: `<div class="preview" id="preview"><style>#preview table{width:100%;border-collapse:collapse;font-size:11.5px}#preview th{text-align:left;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--line-2);padding:3px 6px}#preview td{border-bottom:1px solid var(--line);padding:3px 6px}#preview .n{text-align:right}#preview h1{font-size:20px;margin:0}#preview h2{font-size:14px;margin:12px 0 4px}#preview .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid var(--ink);padding-bottom:6px}#preview .sub{color:var(--ink-3);font-size:11px}#preview .demo{font-size:10px;font-weight:700;color:var(--sage-ink);background:var(--sage-soft);padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.08em}#preview svg{max-width:100%;height:auto}#preview svg text{fill:var(--ink-3)}</style>${reportHTML(S.rep)}</div>` })}
      ${panel({ st: at(2, 2), i: 2, t: 'Historical comparison', s: `${mn} · ${scopeName()} · 12 months`, r: seg('hist', Object.entries(MET).map(([k, v]) => [k, v[0]]), 'occRate'),
        b: CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name: mn, values: s.map(v => v == null ? null : +(+v).toFixed(1)), color: 'var(--s1)', kind: met === 'revenue' || met === 'kwh' || met === 'm3' ? 'bar' : 'area' }], fmt: fm, yFmt: met === 'revenue' ? v => nf(v / 1e6, 0) + 'M' : met === 'kwh' ? v => nf(v / 1e6, 1) + 'G' : undefined, yMax: ['occRate', 'collRate', 'csat'].includes(met) ? 100 : undefined, yMin: ['occRate', 'collRate', 'csat'].includes(met) ? 60 : undefined, height: 120, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i) }) })}
      ${panel({ st: at(3, 2), i: 3, t: 'Period comparison by zone', s: `${mn}: ${MN(S.m)} vs 3 months earlier vs Dec 2025`,
        b: `<div class="tfit" style="flex:1;min-height:0;overflow:hidden"><table class="tbl compact"><thead><tr><th>Zone</th><th class="num">${Z.MSHORT[S.m]}</th><th class="num">vs −3 mo</th><th class="num">vs Dec</th></tr></thead><tbody>${[['', 'All zones']].concat(Z.ZONES.map(z => [z.id, z.id + ' · ' + z.name])).map(([z, n]) => { const [c, q, y] = comp(z); return `<tr${z ? ` class="click" data-act="zone:${z}"` : ''}><td><b>${n}</b></td><td class="num">${fm(c)}</td><td class="num">${chg(c, q)}</td><td class="num">${chg(c, y)}</td></tr>`; }).join('')}</tbody></table></div>` })}
    </div>`;
  };

  // ---------- drawer ----------
  let lastFocus = null;
  function openDrawer(kicker, title, html, after) {
    hidePop(); lastFocus = document.activeElement;
    $('#drKicker').textContent = kicker; $('#drTitle').textContent = title; $('#drBody').innerHTML = html; $('#drBody').scrollTop = 0;
    $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false;
    CH.hydrate($('#drBody')); after?.();
    setTimeout(() => $('#drawer .dr-x').focus(), 60);
  }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; CH.hide(); lastFocus?.focus?.(); }
  const line12 = (name, vals, fmt, color = 'var(--s1)', kind = 'area', extra = {}) => CH.xy({ labels: Z.MSHORT, tipLabel: (l, i) => Z.MONTHS[i], series: [{ name, values: vals, color, kind }], fmt, height: 190, now: S.m, nowLabel: 'Selected', pick: i => openD('month', i), ...extra });
  const KPIDEF = {
    units: ['Total residential units', v => nf(v), 'bar', 'Delivered units in the selected scope. Gateway Residences F3 and F4 were handed over in Feb and Jun 2026.'],
    occ: ['Occupied units', v => nf(v), 'area', 'Units with an active resident (owner or tenant).'],
    occRate: ['Occupancy rate', v => pct(v), 'area', 'Occupied ÷ delivered units.'],
    available: ['Available units', v => nf(v), 'bar', '≈ 68% of vacant units are marketable; the rest are reserved or in fit-out.'],
    vacant: ['Vacant units', v => nf(v), 'bar', 'Delivered but unoccupied.'],
    residents: ['Total residents', v => nf(v), 'area', 'Registered residents from the access-card register.'],
    revenue: ['Total revenue', egp, 'bar', 'Service charges + utility re-billing (+ amenity and other income at compound level).'],
    collRate: ['Collection rate', v => pct(v), 'line', 'Cash collected ÷ amount billed in the month.'],
    outstanding: ['Outstanding payments', egp, 'area', 'Opening arrears plus unpaid billing, net of late recoveries.'],
    kwh: ['Energy consumption', v => nf(v) + ' kWh', 'bar', 'Residential meters + common systems (clubhouse, pools, lighting, pumps, STP).'],
    m3: ['Water consumption', v => nf(v) + ' m³', 'bar', 'Potable water to buildings + irrigation and pools.'],
    openTix: ['Active maintenance requests', v => nf(v), 'bar', 'Work orders not yet closed.'],
    csat: ['Resident satisfaction', v => pct(v), 'area', 'Post-service and monthly pulse surveys, occupancy-weighted.'],
  };
  function openD(kind, id) {
    const f = F();
    if (kind === 'kpi') {
      const [t, fm, k, desc] = KPIDEF[id]; const vals = Z.aggSeries(f, id).map(v => v == null ? null : +(+v).toFixed(1));
      const z = Z.ZONES.map(zz => { const v = Z.agg({ zone: zz.id }, S.m)[id]; return { label: `${zz.id} · ${zz.name}`, value: v ?? 0, display: fm(v), color: 'var(--s2)', open: 'zone:' + zz.id }; });
      return openDrawer('KPI · ' + scopeName(), t, `<p>${desc}</p><div class="minis">${mini(MN(S.m), fm(vals[S.m]))}${mini('Prior month', S.m ? fm(vals[S.m - 1]) : '—')}${mini('12-month high', fm(Math.max(...vals.filter(v => v != null))))}</div><h4>Last 12 months</h4>${line12(t, vals, fm, 'var(--s1)', k)}<h4>By zone · ${MN(S.m)}</h4>${CH.bars(z)}<p class="note">Demo data.</p>`);
    }
    if (kind === 'bld') {
      const b = Z.BMAP[id], x = bMetric(b);
      return openDrawer(`Zone ${b.zone} · ${Z.ZMAP[b.zone].name}`, b.name, `<div class="minis">${mini('Occupancy', pct(x.rate, 1), `${x.o} / ${x.u} units`)}${mini('Residents', nf(b.s.res[S.m]))}${mini('Satisfaction', pct(x.csat))}${mini('Electricity', nf(x.kwh) + ' kWh', `${x.kwhD >= 0 ? '+' : ''}${nf(x.kwhD, 1)}% MoM`)}${mini('Water', nf(x.m3) + ' m³', `${x.m3D >= 0 ? '+' : ''}${nf(x.m3D, 1)}% MoM`)}${mini('Collection', pct(x.coll))}</div>
        <dl class="kv" style="margin-top:12px"><dt>Type</dt><dd>${b.type} · ${b.floors} floors · ${b.units} units</dd><dt>Lifts</dt><dd>${x.lifts.length ? x.lifts.map(l => `${l.id} — ${l.st}`).join(' · ') : 'None'}</dd><dt>Fire panel</dt><dd>${x.fire.panel} — ${x.fire.st}${x.fire.issue ? ' (' + esc(x.fire.issue) + ')' : ''}</dd><dt>Service charge</dt><dd>${egp(b.serviceCharge)} / unit / month (demo)</dd></dl>
        <h4>Occupancy</h4>${line12('Occupancy', b.s.occ.map((o, i) => b.s.units[i] ? +(o / b.s.units[i] * 100).toFixed(1) : null), v => pct(v), 'var(--s2)', 'area', { yMax: 100 })}
        <h4>Electricity (kWh)</h4>${line12('Electricity', b.s.kwh, v => nf(v) + ' kWh', 'var(--s1)', 'bar')}<h4>Water (m³)</h4>${line12('Water', b.s.m3, v => nf(v) + ' m³', 'var(--s5)', 'bar')}
        <h4>Open work orders (${x.tix.length})</h4>${x.tix.length ? `<table class="tbl compact"><tbody>${x.tix.map(t => `<tr class="click" data-act="open:tix:${t.id}"><td><b>${t.id}</b></td><td>${esc(t.desc)}</td><td>${t.prio}</td></tr>`).join('')}</tbody></table>` : '<p>None open.</p>'}
        <p style="margin-top:14px"><button class="btn" data-act="fbld:${id}">${ic('map')}Filter dashboard to ${id}</button></p>`);
    }
    if (kind === 'zone') {
      const z = Z.ZMAP[id], a = Z.agg({ zone: id }, S.m);
      return openDrawer('Zone ' + id, z.name, `<div class="minis">${mini('Units', nf(a.units))}${mini('Occupancy', pct(a.occRate))}${mini('Residents', nf(a.residents))}${mini('Revenue', egp(a.revenue))}${mini('Collection', pct(a.collRate))}${mini('Outstanding', egp(a.outstanding))}</div>
        <h4>Collection rate</h4>${line12('Collection rate', Z.aggSeries({ zone: id }, 'collRate').map(v => +v.toFixed(1)), v => pct(v), 'var(--s3)', 'line', { target: { name: 'Target 95%', value: 95 } })}
        <h4>Buildings</h4>${CH.bars(Z.sel({ zone: id }).map(b => { const x = bMetric(b); return { label: b.name, value: x.rate || 0, display: x.u ? pct(x.rate, 0) + ' occupied' : 'Pending', color: 'var(--s2)', open: 'open:bld:' + b.id }; }), { max: 100 })}
        <p style="margin-top:14px"><button class="btn" data-act="zone:${id}">${ic('map')}Filter dashboard to Zone ${id}</button></p>`);
    }
    if (kind === 'month') {
      const a = Z.agg(f, id);
      return openDrawer(scopeName(), Z.MONTHS[id], `<div class="minis">${mini('Occupancy', pct(a.occRate))}${mini('Revenue', egp(a.revenue))}${mini('Collection', pct(a.collRate))}${mini('Energy', mwh(a.kwh))}${mini('Water', nf(a.m3) + ' m³')}${mini('Satisfaction', pct(a.csat))}${mini('Move-ins', nf(a.moveIn))}${mini('Move-outs', nf(a.moveOut))}${mini('PPM', pct(Z.PPM[id]))}</div>
        <h4>Revenue mix</h4>${CH.bars(revMix(f, id).map(([l, v]) => ({ label: l, value: v, display: egp(v), color: 'var(--s1)' })))}
        <p style="margin-top:14px"><button class="btn pri" data-act="month:${id}">${ic('calendar')}Show the dashboard for ${Z.MONTHS[id]}</button></p>`);
    }
    if (kind === 'hour') return openDrawer('Gate traffic · today', Z.HOURS[id], `<div class="minis">${mini('Vehicles', nf(Z.VEH_H[id]))}${mini('Visitors', nf(Z.VIS_H[id]))}${mini('Share of day', pct(Z.VEH_H[id] / Z.sum(Z.VEH_H) * 100))}</div><h4>By gate (estimated split)</h4>${CH.bars(Z.GATES.map(g => ({ label: g.name, value: Math.round(Z.VEH_H[id] * g.vehicles / Z.sum(Z.GATES.map(x => x.vehicles))), color: 'var(--s1)' })))}`);
    if (kind === 'health') {
      const h = Z.health(f, S.m);
      return openDrawer(scopeName() + ' · ' + MN(S.m), 'Operational health score', `<div class="minis">${mini('Score', nf(h.score, 1) + ' / 100')}${mini('Prior month', S.m ? nf(Z.health(f, S.m - 1).score, 1) : '—')}${mini('Method', 'Weighted index')}</div><h4>Components</h4>${CH.bars(h.comps.map(c => ({ label: c.name, sub: `weight ${c.w * 100}%`, value: c.v, display: nf(c.v, 1), color: c.v >= 95 ? 'var(--s2)' : c.v >= 88 ? 'var(--s3)' : 'var(--warn)' })), { max: 100 })}<h4>Trend</h4>${line12('Health score', Z.MONTHS.map((_, i) => Z.health(f, i).score), v => nf(v, 1), 'var(--s2)', 'area')}<p class="note">Occupancy is scored against 95%, collections against 98%; other components are already percentages.</p>`);
    }
    if (kind === 'tix') {
      const t = Z.TICKETS.find(x => x.id === id);
      return openDrawer(`${t.cat} · ${Z.BMAP[t.bld].name}`, t.id, `<div class="minis">${mini('Priority', t.prio)}${mini('Age', t.ageH + ' h')}${mini('SLA', t.slaH + ' h', t.overdue ? 'Overdue' : 'Within SLA')}</div><dl class="kv" style="margin-top:12px"><dt>Issue</dt><dd>${esc(t.desc)}</dd><dt>Status</dt><dd>${t.st}</dd><dt>Assigned to</dt><dd>${t.tech}</dd><dt>Zone</dt><dd>${t.zone} · ${Z.ZMAP[t.zone].name}</dd></dl><p class="note" style="margin-top:12px">In production this opens the CMMS work order.</p>`);
    }
    if (kind === 'pump') {
      const p = Z.PUMPS.find(x => x.id === id), risk = Math.round(Math.min(99, p.vib / 7.1 * 55 + p.hrs / 15000 * 30));
      return openDrawer(p.sys, 'Pump ' + p.id, `<div class="minis">${mini('Status', p.st)}${mini('Flow', p.flow ? p.flow + ' m³/h' : '—')}${mini('Pressure', p.bar ? p.bar + ' bar' : '—')}${mini('Vibration', p.vib ? p.vib + ' mm/s' : '—', 'alarm 7.1')}${mini('Run hours', nf(p.hrs))}${mini('Health index', p.health)}</div>${p.issue ? `<p><span class="tag ${p.vib > 7 ? 'crit' : 'warn'}">Issue</span> ${esc(p.issue)}</p>` : ''}<h4>Rule-based risk score: ${risk} / 100</h4><p>55 × vibration ÷ alarm + 30 × run hours ÷ 15,000. This is a deterministic rule, not a machine-learning prediction.</p>`);
    }
    if (kind === 'tank') { const t = Z.TANKS.find(x => x.id === id); return openDrawer('Water storage', t.name, `<div class="minis">${mini('Level', t.lvl + '%')}${mini('Volume', nf(t.cap * t.lvl / 100) + ' m³')}${mini('Capacity', nf(t.cap) + ' m³')}</div>${t.issue ? `<p><span class="tag warn">Alert</span> ${esc(t.issue)}</p>` : ''}`); }
    if (kind === 'gen') { const g = Z.GENS.find(x => x.id === id); return openDrawer('Standby power', 'Generator ' + g.id, `<div class="minis">${mini('Rating', nf(g.kva) + ' kVA')}${mini('Fuel', g.fuel + '%')}${mini('Status', g.st)}${mini('Last test', g.lastTest)}${mini('Service due', g.due)}</div><p>Serves: ${esc(g.serves)}</p>${g.issue ? `<p><span class="tag warn">Due</span> ${esc(g.issue)}</p>` : ''}`); }
    if (kind === 'hvac') { const h = Z.HVAC.find(x => x.id === id); return openDrawer('HVAC', h.name, `<div class="minis">${mini('Status', h.st)}${mini('Power', h.kw + ' kW')}${mini('Availability', pct(h.avail))}${mini('Supply temp', h.sup ? h.sup + ' °C' : '—')}${mini('COP', h.cop ?? '—')}</div>${h.issue ? `<p><span class="tag warn">Issue</span> ${esc(h.issue)}</p>` : ''}${h.id.startsWith('CH') ? '<h4>Chiller plant COP — 12 months</h4>' + line12('COP', Z.HVAC_COP, v => nf(v, 2), 'var(--s2)', 'line') : ''}`); }
    if (kind === 'lift') { const l = Z.LIFTS.find(x => x.id === id); return openDrawer(Z.BMAP[l.bld].name, 'Lift ' + l.id, `<div class="minis">${mini('Status', l.st)}${mini('Uptime (30 d)', pct(l.up))}${mini('Trips today', nf(l.trips))}${mini('Last PM', l.lastPM + ' days ago')}</div>${l.issue ? `<p><span class="tag crit">Fault</span> ${esc(l.issue)}</p>` : ''}`); }
    if (kind === 'gate') { const g = Z.GATES.find(x => x.id === id); return openDrawer('Access control', g.name, `<div class="minis">${mini('Vehicles today', nf(g.vehicles))}${mini('Visitors today', nf(g.visitors))}${mini('Card entries', nf(g.cards))}${mini('LPR read rate', pct(g.lpr))}${mini('Denied', g.denied)}${mini('Cameras', `${g.camsOn}/${g.cams}`)}</div>${g.issue ? `<p><span class="tag warn">Alert</span> ${esc(g.issue)}</p>` : ''}<p class="note">CCTV compound total: ${Z.CCTV.online} of ${Z.CCTV.total} cameras online.</p>`); }
    if (kind === 'fire') { const x = Z.FIRE.find(y => y.panel === id); return openDrawer('Fire alarm network', x.panel, `<div class="minis">${mini('Status', x.st)}${mini('Devices', nf(x.devices))}${mini('Location', x.bld)}</div>${x.issue ? `<p><span class="tag ${x.st === 'Fault' ? 'crit' : 'warn'}">${x.st}</span> ${esc(x.issue)}</p>` : '<p>No active faults.</p>'}`); }
    if (kind === 'amen') { const x = Z.AMEN.find(y => y.id === id); return openDrawer('Amenity', x.name, `<div class="minis">${mini('Status', x.st)}${mini('Utilisation', x.util + '%')}${mini('Capacity', nf(x.cap))}${x.book ? mini('Bookings (month)', x.book) : ''}${x.pool ? mini('Free chlorine', x.pool.cl + ' ppm', '1.0–3.0') + mini('pH', x.pool.ph, '7.2–7.8') + mini('Water temp', x.pool.temp + ' °C') + mini('Turbidity', x.pool.turb + ' NTU') : ''}</div>${x.issue ? `<p><span class="tag crit">Closed</span> ${esc(x.issue)}</p>` : ''}`); }
    if (kind === 'inc') { const x = Z.INCIDENTS.find(y => y.id === id); return openDrawer('Security incident · ' + x.sev, x.type, `<dl class="kv"><dt>Reference</dt><dd>${x.id}</dd><dt>Location</dt><dd>${esc(x.loc)}</dd><dt>Response</dt><dd>${nf(x.resp, 1)} minutes</dd><dt>Status</dt><dd>${x.st}</dd></dl>`); }
  }
  function openList(key) {
    if (key === 'tickets') return openDrawer(scopeName(), 'Open work orders', `<table class="tbl compact"><thead><tr><th>WO</th><th>Bldg</th><th>Issue</th><th>Priority</th><th class="num">Age</th></tr></thead><tbody>${tixIn().map(t => `<tr class="click" data-act="open:tix:${t.id}"><td><b>${t.id}</b></td><td>${t.bld}</td><td style="white-space:normal">${esc(t.desc)}</td><td>${t.prio}</td><td class="num" style="${t.overdue ? 'color:var(--crit)' : ''}">${t.ageH} h</td></tr>`).join('')}</tbody></table>`);
    if (key === 'incidents') return openDrawer('Last 30 days', 'Incident history', `<table class="tbl compact"><tbody>${Z.INCIDENTS.slice().reverse().map(x => `<tr class="click" data-act="open:inc:${x.id}"><td><b>${x.type}</b><br><span class="muted">${esc(x.loc)}</span></td><td>${x.sev}</td><td class="num">${nf(x.resp, 1)} min</td><td>${x.st}</td></tr>`).join('')}</tbody></table>`);
    if (key === 'feedback') return openDrawer('Resident app, call centre, front desk', 'Resident feedback', Z.FEEDBACK.map(x => `<div class="fb"><q>${esc(x.t)}</q><div class="m"><span class="stars">${'★'.repeat(x.s)}</span><span>Zone ${x.z}</span><span>${x.ch}</span><span>${x.d}</span></div></div>`).join(''));
    if (key === 'alerts' || key === 'secalerts') return openAlerts();
    if (key === 'insights') return openInsights();
    if (key === 'anomalies') return openDrawer(MN(S.m), 'Consumption anomalies', CH.bars(Z.BUILDINGS.map(b => ({ b, x: bMetric(b) })).filter(o => o.x.u).sort((p, q) => Math.max(q.x.m3D, q.x.kwhD) - Math.max(p.x.m3D, p.x.kwhD)).map(o => ({ label: o.b.name, sub: `elec ${o.x.kwhD >= 0 ? '+' : ''}${nf(o.x.kwhD, 0)}%`, value: Math.max(0, o.x.m3D), display: `water ${o.x.m3D >= 0 ? '+' : ''}${nf(o.x.m3D, 0)}%`, color: o.x.m3D > 15 ? 'var(--crit)' : 'var(--s5)', open: 'open:bld:' + o.b.id }))));
    const el = document.querySelector(`[data-fit="${key}"]`);
    if (el) { const tag = el.tagName === 'UL' ? 'ul class="hbars"' : 'div class="rows"'; openDrawer('Full list', el.closest('.panel').querySelector('h3').textContent, `<${tag}>${el.innerHTML.replace(/style="display:\s*none;?"/g, '')}</${tag.split(' ')[0]}>`); }
  }
  function openAlerts() {
    const al = alerts();
    openDrawer(`${al.filter(x => x.sev === 'crit').length} critical · ${al.length} total`, 'Alerts & notifications', al.map(x => `<button class="row" style="grid-template-columns:auto minmax(0,1fr)" data-act="${x.act}"><span class="ic-b ${x.sev}">${ic(x.icon)}</span><span style="min-width:0"><div class="t" style="white-space:normal">${esc(x.t)}</div><div class="s" style="white-space:normal">${esc(x.s)}</div></span></button>`).join(''));
  }
  function openInsights() {
    openDrawer('Executive intelligence', 'Insights & predictions', `<div class="sect">${ic('layers')}Rule-based insights · demo data</div>${insights().map(x => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;gap:8px;align-items:center"><span class="ic-b ${x.sev}">${ic(x.icon)}</span><b style="font-family:'Source Serif 4',Georgia,serif;font-size:14px">${esc(x.t)}</b></div><p>${esc(x.s)}</p><p class="note">Category: ${esc(x.cat)} · Rule: ${esc(x.rule)}</p><button class="lnk" data-act="${x.act}">View source ${ic('right')}</button></div>`).join('')}
      <div class="sect" style="margin-top:18px">${ic('cpu')}AI-generated predictions</div><div class="ai-box" style="border-color:var(--line-2);color:var(--ink-2)">${ic('cpu')}<span><b style="color:var(--ink)">No predictive model is connected.</b> When a model service is connected (see Data sources → <i>Predictive model service</i>), its predictions appear here with confidence and time horizon, kept separate from the rules above.</span></div>`);
  }
  function openSources() {
    openDrawer('Integration layer', 'Data sources', `<p>Every panel reads from one data model (<code>window.ZW</code>). Each source below can be replaced with a live adapter in <code>js/integrations.js</code>. All are in demo mode.</p>${window.ZW_SOURCES.map(s => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(s.name)}</b><span class="tag ${s.mode === 'live' ? 'good' : s.mode === 'none' ? '' : 'sage'}">${s.mode === 'none' ? 'Not connected' : s.mode}</span></div><div class="note" style="margin-top:3px">Feeds: ${esc(s.feeds.join(', '))}</div><div class="note"><code>${esc(s.example)}</code></div></div>`).join('')}`);
  }

  // ---------- render ----------
  function renderTabs() {
    $('#tabs').innerHTML = `<span class="tab-pill" id="tabPill"></span>` + TABS.map(t => `<button class="tab" role="tab" id="tab-${t.id}" aria-selected="${t.id === S.tab}" aria-controls="main" data-act="tab:${t.id}" title="${t.full}">${ic(t.icon)}${t.name}</button>`).join('');
    placePill();
  }
  function placePill() {
    const b = $(`#tab-${S.tab}`), p = $('#tabPill'); if (!b || !p) return;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', t === b));
    p.style.left = b.offsetLeft + 'px'; p.style.width = b.offsetWidth + 'px';
  }
  function renderFilters() {
    $('#fMonth').innerHTML = Z.MONTHS.map((m, i) => `<option value="${i}" ${i === S.m ? 'selected' : ''}>${m}${i === Z.CUR ? ' · now' : ''}</option>`).join('');
    $('#fZone').innerHTML = `<option value="">All zones</option>` + Z.ZONES.map(z => `<option value="${z.id}" ${z.id === S.zone ? 'selected' : ''}>Zone ${z.id} · ${z.name}</option>`).join('');
    $('#fBld').innerHTML = `<option value="">All buildings</option>` + Z.sel({ zone: S.zone }).map(b => `<option value="${b.id}" ${b.id === S.bld ? 'selected' : ''}>${b.name}</option>`).join('');
    $('#fMonth').closest('.fsel').classList.toggle('active', S.m !== Z.CUR);
    $('#fZone').closest('.fsel').classList.toggle('active', !!S.zone);
    $('#fBld').closest('.fsel').classList.toggle('active', !!S.bld);
    $('#fClear').hidden = !(S.zone || S.bld || S.m !== Z.CUR);
  }
  let animT = 0;
  function render(anim = true) {
    hidePop(); CH.hide();
    const main = $('#main'), scroll = main.scrollTop;
    try { main.innerHTML = V[S.tab](); }
    catch (e) { console.error(e); main.innerHTML = `<div class="panel" style="height:100%;align-items:center;justify-content:center;text-align:center"><h3>This view could not be drawn</h3><p class="muted">${esc(e.message)}</p><button class="btn" data-act="tab:overview">Back to overview</button></div>`; }
    CH.prune(); CH.hydrate(main); fitLists();
    if (anim) { main.classList.remove('tab-in'); void main.offsetWidth; main.classList.add('tab-in'); clearTimeout(animT); animT = setTimeout(() => main.classList.remove('tab-in'), 1800); }
    else main.scrollTop = scroll;
    $('#alertCount').textContent = alerts().filter(a => a.sev === 'crit').length || '';
    document.title = `ZED West · ${TABS.find(t => t.id === S.tab).full}`;
  }
  /* Clip lists/tables to their box and offer "View all N" (no scrolling inside panels on desktop). */
  function fitLists() {
    const desk = matchMedia('(min-width: 1181px) and (min-height: 641px)').matches;
    // bar lists: switch to one-line rows when the stacked layout does not fit the panel
    $$('#main .pb > .hbars').forEach((ul, k) => {
      ul.classList.remove('dense'); if (!ul.dataset.fit) ul.dataset.fit = 'hb' + k;
      if (desk && ul.scrollHeight > ul.clientHeight + 1) ul.classList.add('dense');
    });
    $$('#main [data-fit]').forEach(box => {
      const items = [...box.querySelectorAll(':scope > *, :scope tbody > tr')].filter(el => el.tagName !== 'TABLE');
      items.forEach(it => it.style.display = '');
      box.parentElement.querySelector(':scope > .more')?.remove();
      if (!desk) return;
      const total = +box.dataset.total || items.length;
      const pb = box.closest('.pb'), limit = Math.min(box.getBoundingClientRect().bottom, pb.getBoundingClientRect().bottom);
      const over = box.scrollHeight > box.clientHeight + 1 || pb.scrollHeight > pb.clientHeight + 1;
      if (!over && items.length >= total) return;
      const reserve = 22; let shown = items.length;
      for (let i = 0; i < items.length; i++) { if (items[i].getBoundingClientRect().bottom > limit - reserve) { shown = i; break; } }
      if (shown >= items.length && items.length >= total) return;
      items.slice(shown).forEach(it => it.style.display = 'none');
      const more = document.createElement('button'); more.className = 'lnk more';
      more.dataset.act = 'list:' + box.dataset.fit; more.innerHTML = `View all ${total} ${ic('right')}`;
      box.after(more);
    });
  }

  // ---------- intro ----------
  const intro = $('#intro'), vid = $('#introVideo');
  let introDone = false, rafI = 0;
  function enterDashboard() {
    if (introDone) return; introDone = true;
    intro.classList.add('out'); document.body.classList.add('ready'); $('#app').setAttribute('aria-hidden', 'false');
    cancelAnimationFrame(rafI);
    setTimeout(() => { if (introDone) { vid.pause(); render(true); } }, 500);
  }
  function playIntro() {
    introDone = false; intro.classList.remove('out'); document.body.classList.remove('ready'); $('#app').setAttribute('aria-hidden', 'true');
    $('#introPlay').hidden = true; closeDrawer(); stopPresent();
    try { vid.currentTime = 0; } catch {}
    const pr = vid.play(); if (pr?.catch) pr.catch(() => { $('#introPlay').hidden = false; });
    const tick = () => { if (vid.duration) $('#introProg').style.transform = `scaleX(${vid.currentTime / vid.duration})`; if (!introDone) rafI = requestAnimationFrame(tick); };
    tick();
    setTimeout(() => $('#introSkip').focus(), 100);
  }
  vid.addEventListener('ended', enterDashboard);
  vid.addEventListener('error', () => setTimeout(enterDashboard, 2500));
  $('#introSkip').addEventListener('click', enterDashboard);
  $('#introPlay').addEventListener('click', () => { $('#introPlay').hidden = true; vid.play(); });

  // ---------- presentation mode ----------
  const PDUR = 15000;
  function startPresent() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    document.body.classList.add('presenting'); $('#present').hidden = false;
    S.present = { t0: performance.now(), paused: false, acc: 0 }; pLoop(); placeSoon();
  }
  function stopPresent() {
    if (!S.present) return; S.present = null; document.body.classList.remove('presenting'); $('#present').hidden = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    placeSoon();
  }
  function pStep(d) { const i = TABS.findIndex(t => t.id === S.tab); go(TABS[(i + d + TABS.length) % TABS.length].id); if (S.present) { S.present.t0 = performance.now(); S.present.acc = 0; } }
  function pLoop() {
    if (!S.present) return;
    const P = S.present, el = P.paused ? P.acc : P.acc + performance.now() - P.t0;
    $('#pbFill').style.transform = `scaleX(${Math.min(1, el / PDUR)})`;
    $('#pbLabel').textContent = `${TABS.findIndex(t => t.id === S.tab) + 1} / ${TABS.length} · ${TABS.find(t => t.id === S.tab).full}`;
    if (el >= PDUR && !P.paused) pStep(1);
    requestAnimationFrame(pLoop);
  }
  function pPause() { const P = S.present; if (!P) return; if (P.paused) { P.paused = false; P.t0 = performance.now(); } else { P.acc += performance.now() - P.t0; P.paused = true; } $('#pbPause use').setAttribute('href', P.paused ? '#i-play' : '#i-pause'); }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.present) stopPresent(); placeSoon(); });
  const placeSoon = () => setTimeout(() => { placePill(); fitLists(); }, 380);

  // ---------- navigation & events ----------
  function go(tab) { if (!V[tab]) tab = 'overview'; S.tab = tab; if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); placePill(); render(true); $('#main').scrollTop = 0; }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
  function setTheme(t) { document.documentElement.dataset.theme = t; LS.set('zedwest-theme', t); }

  function act(a, ev, el) {
    const [k, v, w] = a.split(':');
    switch (k) {
      case 'tab': closeDrawer(); return go(v);
      case 'open': if (v === 'kpi' || v === 'bld' || v === 'zone' || v === 'health' || v === 'tix' || v === 'pump' || v === 'tank' || v === 'gen' || v === 'hvac' || v === 'lift' || v === 'gate' || v === 'fire' || v === 'amen' || v === 'inc') return openD(v, a.slice(k.length + v.length + 2)); return;
      case 'seg': S.sub[v] = w; return render(false);
      case 'mp': S.map = v; return render(false);
      case 'zone': S.zone = v || ''; S.bld = ''; closeDrawer(); renderFilters(); return render(false);
      case 'fbld': S.bld = v; S.zone = Z.BMAP[v].zone; closeDrawer(); renderFilters(); return render(false);
      case 'bld': return el.closest('#mp') ? showPop(v, ev) : openD('bld', v);
      case 'popclose': return hidePop();
      case 'month': S.m = +v; closeDrawer(); renderFilters(); return render(false);
      case 'list': return openList(v);
      case 'alerts': return openAlerts();
      case 'insights': return openInsights();
      case 'sources': return openSources();
      case 'close': return closeDrawer();
      case 'replay': return playIntro();
      case 'present': return S.present ? stopPresent() : startPresent();
      case 'pnext': return pStep(1);
      case 'pprev': return pStep(-1);
      case 'ppause': return pPause();
      case 'theme': return setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night');
      case 'rep': S.rep = v; return render(false);
      case 'pdf': return exportPDF(v);
      case 'xls': return exportXLS(v);
    }
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) { if (!e.target.closest('#pop')) hidePop(); return; }
    const a = el.dataset.act; if (!a) return;
    e.stopPropagation(); act(a, e, el);
  });
  document.addEventListener('keydown', e => {
    if (!introDone) { if (e.key === 'Escape' || e.key === 'Enter') enterDashboard(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); act(e.target.dataset.act, e, e.target); return; }
    if (e.key === 'Escape') { if ($('#drawer').classList.contains('open')) return closeDrawer(); if (!$('#pop').hidden) return hidePop(); if (S.present) return stopPresent(); }
    if (e.target.matches('input, select, textarea')) return;
    if (S.present) { if (e.key === 'ArrowRight') pStep(1); if (e.key === 'ArrowLeft') pStep(-1); if (e.key === ' ') { e.preventDefault(); pPause(); } return; }
    if (e.key === 'p' || e.key === 'P') startPresent();
  });
  document.addEventListener('chartpick', e => { const sp = CH.spec(e.detail.id); if (sp?.pick) sp.pick(e.detail.i); });
  $('#scrim').addEventListener('click', closeDrawer);
  $('#fMonth').addEventListener('change', e => { S.m = +e.target.value; renderFilters(); render(false); });
  $('#fZone').addEventListener('change', e => { S.zone = e.target.value; S.bld = ''; renderFilters(); render(false); });
  $('#fBld').addEventListener('change', e => { S.bld = e.target.value; if (S.bld) S.zone = Z.BMAP[S.bld].zone; renderFilters(); render(false); });
  $('#fClear').addEventListener('click', () => { S.zone = ''; S.bld = ''; S.m = Z.CUR; renderFilters(); render(false); });
  $('#modeChip').addEventListener('click', openSources);
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== S.tab && V[t]) go(t); });
  // The reference photo (1672x941) shows the dashboard inside a glass frame at x 157-1527, y 70-880.
  // Place the app over that frame so the compound shows around it exactly as in the photo.
  function fitFrame() {
    const W = innerWidth, H = innerHeight, IW = 1672, IH = 941, sc = Math.max(W / IW, H / IH);
    const ox = (W - IW * sc) / 2, oy = (H - IH * sc) / 2, r = document.documentElement.style;
    let l = ox + 157 * sc, rr = W - (ox + 1527 * sc), t = oy + 70 * sc, bt = H - (oy + 880 * sc);
    const minW = Math.min(W - 24, 1180); if (W - l - rr < minW) { const k = (W - minW) / (l + rr); l *= k; rr *= k; }
    t = Math.max(8, t); bt = Math.max(8, bt);
    r.setProperty('--fl', l + 'px'); r.setProperty('--fr', rr + 'px'); r.setProperty('--ft', t + 'px'); r.setProperty('--fb', bt + 'px');
    const h = H - t - bt; document.body.classList.toggle('short', h < 760); document.body.classList.toggle('xshort', h < 640); document.body.classList.toggle('narrow', W - l - rr < 1320);
  }
  fitFrame();
  let rT = 0; window.addEventListener('resize', () => { fitFrame(); clearTimeout(rT); rT = setTimeout(() => { placePill(); fitLists(); }, 150); });
  const clock = () => { const d = new Date(); $('#clock').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

  // ---------- boot ----------
  setTheme(LS.get('zedwest-theme') || 'day');
  const h0 = location.hash.slice(1); if (V[h0]) S.tab = h0;
  if (window.ZW_SOURCE_MODE() === 'live') { $('#modeChip').textContent = 'Live'; $('#modeChip').classList.add('live'); }
  renderTabs(); renderFilters(); clock(); setInterval(clock, 30000);
  render(false);
  if (/[?&]nointro\b/.test(location.search)) { intro.style.transition = 'none'; enterDashboard(); }
  else playIntro();
  document.fonts?.ready.then(() => { placePill(); fitLists(); });
  window.ZW_APP = { S, go, render, openD, exportXLS, exportPDF, reportData };
})();

// Writes the full demo dataset to data/sample-dataset.json (node tools/export-dataset.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const here = new URL('..', import.meta.url);
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('js/data.js', here), 'utf8'), ctx);
const Z = ctx.window.ZW;
const out = { _note: 'ZED West DEMONSTRATION dataset — simulated, deterministic. Layout is conceptual, not the verified masterplan.', generatedAt: Z.generatedAt, months: Z.MONTHS, tariffsAssumed: Z.TARIFF,
  zones: Z.ZONES, buildings: Z.BUILDINGS.map(({ s, ...b }) => ({ ...b, monthly: s })),
  compound: { commonSystemsMWh: Z.COMMON, irrigationM3: Z.IRR, poolWaterM3: Z.POOLWATER, otherRevenueEGP: Z.OTHER_REV, opex: Z.OPEX, ppm: Z.PPM, slaPct: Z.SLA, responseH: Z.RESP, resolutionH: Z.RESOL, csat: Z.CSAT, nps: Z.NPS, complaints: Z.COMPL_M, incidents: Z.INC_M, emergencyResponseMin: Z.ERT, bookings: Z.BOOK_M },
  assets: { pumps: Z.PUMPS, tanks: Z.TANKS, generators: Z.GENS, hvac: Z.HVAC, lifts: Z.LIFTS, commonEquipment: Z.COMMONEQ, firePanels: Z.FIRE, gates: Z.GATES, cctv: Z.CCTV, amenities: Z.AMEN, landscape: Z.LAND },
  tickets: Z.TICKETS, securityIncidents: Z.INCIDENTS, feedback: Z.FEEDBACK, channels: Z.CHANNELS,
  monthlySummary: Z.MONTHS.map((m, i) => ({ month: m, ...Z.agg({}, i), health: Z.health({}, i).score })) };
writeFileSync(new URL('data/sample-dataset.json', here), JSON.stringify(out, null, 1));
console.log('wrote data/sample-dataset.json', (JSON.stringify(out).length / 1024).toFixed(0) + ' KB');

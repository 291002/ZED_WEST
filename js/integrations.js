'use strict';
/* Integration layer — where live systems plug in.
   The UI only reads data through window.ZW (js/data.js). Each source below lists the ZW fields it would
   replace and the shape it must return. Today every source is in DEMO mode (the seeded generator).
   To go live: implement fetchLive() for a source, map the payload onto the same shape, and set mode: 'live'.
   The header badge switches from "Demo data" to "Live" automatically once every source on screen is live. */
window.ZW_SOURCES = [
  { id: 'pms',      name: 'Property management system',  feeds: ['BUILDINGS[].s.units/occ/res/mi/mo', 'BUILDINGS[].s.billed/coll', 'openingArrears'], example: 'GET /api/pms/occupancy?month=YYYY-MM  → [{building, units, occupied, residents, moveIns, moveOuts}]', mode: 'demo' },
  { id: 'billing',  name: 'Billing & collections (ERP)', feeds: ['BUILDINGS[].s.billed/coll', 'OTHER_REV', 'OPEX'], example: 'GET /api/erp/ledger?month=YYYY-MM  → [{costCentre, budget, actual}]', mode: 'demo' },
  { id: 'cmms',     name: 'CMMS / work orders',          feeds: ['TICKETS', 'PPM', 'RESP', 'RESOL', 'SLA'], example: 'GET /api/cmms/workorders?status=open  → [{id, building, category, priority, ageH, slaH, status}]', mode: 'demo' },
  { id: 'bms',      name: 'BMS (BACnet / Modbus via gateway)', feeds: ['PUMPS', 'TANKS', 'HVAC', 'GENS', 'COMMONEQ'], example: 'WS  /api/bms/points  → {pointId, value, unit, quality, ts}', mode: 'demo' },
  { id: 'meters',   name: 'Smart meters (electricity & water)', feeds: ['BUILDINGS[].s.kwh/m3', 'COMMON', 'IRR', 'POOLWATER'], example: 'GET /api/meters/consumption?group=building&month=YYYY-MM', mode: 'demo' },
  { id: 'lifts',    name: 'Elevator remote monitoring',  feeds: ['LIFTS'], example: 'GET /api/lifts/status', mode: 'demo' },
  { id: 'security', name: 'VMS / access control / LPR', feeds: ['GATES', 'CCTV', 'VIS_H', 'VEH_H', 'INCIDENTS'], example: 'GET /api/security/gates?date=YYYY-MM-DD', mode: 'demo' },
  { id: 'fire',     name: 'Fire alarm network',          feeds: ['FIRE'], example: 'GET /api/fire/panels', mode: 'demo' },
  { id: 'iot',      name: 'IoT (pools, soil moisture, irrigation)', feeds: ['AMEN[].pool', 'LAND'], example: 'MQTT zedwest/iot/+/telemetry', mode: 'demo' },
  { id: 'crm',      name: 'Resident app & CRM',          feeds: ['CSAT', 'NPS', 'COMPL_CAT', 'CHANNELS', 'FEEDBACK', 'ENGAGE'], example: 'GET /api/crm/feedback?since=ISO8601', mode: 'demo' },
  { id: 'ai',       name: 'Predictive model service',    feeds: ['AI predictions panel'], example: 'POST /api/ai/predict {asset|building|portfolio}  → [{insight, confidence, horizon}]', mode: 'none' },
];
window.ZW_SOURCE_MODE = () => window.ZW_SOURCES.every(s => s.mode === 'live' || s.mode === 'none') ? 'live' : 'demo';

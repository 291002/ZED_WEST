# ZED West — Smart Compound Executive Dashboard

Interactive executive dashboard for the ZED West compound. It is plain HTML, CSS and JavaScript with no build step and no frameworks.

> **Status: demo.** Every number comes from a seeded demo model, and the dashboard marks it **DEMO DATA**.
> The masterplan is a **conceptual layout**. The verified site plan was not supplied, so the building positions are illustrative and not to scale.
> **AI predictions are not connected.** The insights are rule-based, and each one shows its rule. The revenue forecast is a 6-month linear projection, not an AI forecast.

## Run

Double-click `start-dashboard.bat`, or run:

```
python serve.py        # http://localhost:5186
```

The server sends `no-store` headers and supports HTTP Range requests, so the intro video can seek. Opening `index.html` directly from disk also works in most browsers.

URL options:

- `?nointro` skips the intro video.
- `#finance` (or any tab id) opens that tab directly.

## Using it

| Control | What it does |
|---|---|
| Month / zone / building filters (header) | Every tab, chart and export follows them |
| Masterplan | Occupancy, Energy, Water, Maint. and Security colour modes; click a building to see its KPIs; zone chips filter |
| Any KPI card, bar, month or row | Opens a drill-down drawer |
| "View all N" | Shows the full list in a drawer. Tabs never scroll. |
| Left rail | Alerts, insights, reports, data sources, replay intro, presentation mode, Day/Evening theme |
| Presentation mode | Changes tab every 15 s. ← → move, Space pauses, Esc exits. `P` toggles the mode. |
| Reports tab | 5 report templates. PDF uses the browser's print dialog (choose "Save as PDF"). Excel downloads a native .xlsx file. |

The layout is designed for 16:9 desktop screens. It was checked without page scroll at 1920×960, 1536×730, 1440×810, 1440×790 and 1366×657. Below 1180 px wide, or under 640 px tall, it switches to a scrolling layout.

## Folder structure

```
index.html              shell, icon sprite, intro, header, tabs, drawer
css/styles.css          design tokens (day + evening), layout, components
js/data.js              window.ZW  demo data model (seeded; all tabs agree)
js/charts.js            window.CH  dependency-free SVG charts
js/integrations.js      window.ZW_SOURCES  data-source descriptors (API/BMS/IoT/PMS)
js/xlsx.js              window.XLSX  minimal .xlsx writer
js/app.js               views, masterplan, drawers, alerts, insights, reports
assets/                 intro video, poster frame, compound photo
data/sample-dataset.json  export of the demo model (regenerate: node tools/export-dataset.mjs)
serve.py, start-dashboard.bat
```

## Connecting real data

Every view reads from one object, `window.ZW`. To go live, replace the parts of `js/data.js` that a source feeds, keeping the same shapes, and set that source's `mode` from `'demo'` to `'live'` in `js/integrations.js`. The demo badge and the Data sources drawer read those modes.

| Source | Feeds | Example endpoint |
|---|---|---|
| PMS (property management) | units, occupancy, residents, move-ins/outs | `GET /api/pms/occupancy?month=YYYY-MM` |
| ERP / billing | billed, collected, ageing, OPEX budget vs actual | `GET /api/erp/ledger?month=YYYY-MM` |
| CMMS | work orders, PPM, response/resolution, SLA | `GET /api/cmms/workorders?status=open` |
| BMS (BACnet/Modbus gateway) | pumps, tanks, HVAC, generators | `WS /api/bms/points` |
| Smart meters | electricity and water by building, common systems, irrigation | `GET /api/meters/consumption` |
| Lift monitoring | lift status | `GET /api/lifts/status` |
| VMS / access control / LPR | gates, CCTV health, visitors, vehicles, incidents | `GET /api/security/gates` |
| Fire alarm network | panels, pumps, drills | `GET /api/fire/panels` |
| IoT sensors | soil moisture, pool chemistry | `GET /api/iot/...` |
| CRM / resident app | CSAT, NPS, complaints, channels, feedback | `GET /api/crm/...` |
| Predictive model service | AI predictions (currently **none**) | — |

`js/integrations.js` lists, for each source, exactly which `ZW` fields it feeds and the response shape.

## Notes

- The intro video is shown scaled to 1.15× from its bottom edge. This crops the generator watermark in the top-right corner of the source clip. Replace `assets/zedwest-intro.mp4` with a clean master to remove the crop (the `#introVideo` transform in `css/styles.css`).
- The compound photo is the background, full-bleed and in its original colours. The dashboard is placed exactly over the glass frame drawn in the photo (`fitFrame()` in `js/app.js`), so the compound shows around it as in the reference image. On narrow or short screens the frame is widened and a compact style (`body.narrow` / `body.short`) keeps every panel's content inside its box.
- The Overview shows the 12 KPIs as 4 summary cards: Occupancy (units, occupied, available, residents), Revenue (collection rate, outstanding), Energy (water) and Satisfaction (maintenance requests). Every figure is clickable.
- Fonts are loaded from Google Fonts (Manrope, Source Serif 4). Without a network connection the dashboard falls back to system fonts.

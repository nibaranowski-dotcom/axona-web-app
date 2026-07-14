# Axona — deck screen export · SALES deck

Simplified, deck-ready crops of built product screens for the sales deck
(`sales-content.md` + `sales-content-addon-product.md`). Each block has a self-contained
HTML snippet (~1200×750, inline CSS, v2 tokens, no external deps) the deck designer drops
into a browser frame on the named slide.

**Built/designed line (honest):** every screen below is **built** in the app and verified
live (Procurement, Manufacturing genealogy, Quality SPC/NCR, Fleet, Field Service, Audit).
#6 Cross-module ripple is a **diagram in v2 style, not a literal screen** — labelled as such.

**Human gate:** anonymization + "sample data — illustrative" labels are for Nicolas to
sign off before anything goes external. All companies/people anonymized (Tier-1 Auto OEM /
OEM-2 / role labels); every crop carries a sample-data chip.

## Screen → slide map
| # | Screen | Slide | Proves |
|---|--------|-------|--------|
| 1 | Procurement PO queue (agent-drafted vs sent; approve/edit) | Slide 4 · Underlying Magic | Agents draft, humans approve — safe autonomy |
| 2 | Build genealogy (per-serial parts/serials/firmware) | Slide 3 · Value Prop | Know every unit you ship |
| 3 | Quality SPC chart → NCR (torque vs control limits; out-of-spec) | Slide 4 · value tiles | Catch drift, open the NCR, trace the lot |
| 4 | Fleet map + Field-Service dispatch (uptime → SLA → dispatch) | Slide 3 / 6 | Uptime SLAs met with the right tech |
| 5 | propose→approve→audit + audit trail (inputs·output·model·confidence·approver) | Slide 4 / 6 | The trust mechanic, on the record |
| 6 | Cross-module ripple diagram | Slide 7 | Why an OS, not point tools |

---

### PROCUREMENT PO QUEUE → Slide 4 · Underlying Magic
- **Purpose on the slide:** the underlying magic — agents draft POs, a human approves or edits; never auto-placed.
- **Crop:** the PO queue contrasting agent-drafted (awaiting) vs sent, with the Approve / Edit actions and the model·confidence·approver line. Hide sidebar/topbar.
- **Caption (on-slide):** "Procurement — agents draft, humans approve or edit · sample data"

```html
<div id="sales1" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 40px">
  <style>
    #sales1 *{box-sizing:border-box}
    #sales1 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales1 .h1{font-size:26px;font-weight:700;margin:2px 0 0}
    #sales1 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #sales1 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #sales1 table{width:100%;border-collapse:collapse}
    #sales1 th{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,10,10,.45);text-align:left;padding:11px 14px;border-bottom:1px solid rgba(10,10,10,.12)}
    #sales1 td{font-size:14.5px;padding:15px 14px;border-bottom:1px solid rgba(10,10,10,.08)}
    #sales1 .badge{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;padding:3px 9px;border-radius:6px;display:inline-flex;align-items:center;gap:6px}
    #sales1 .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
    #sales1 .btn{font-family:inherit;font-size:12.5px;border-radius:6px;padding:7px 12px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Value chain · Procurement</div><div class="h1">Agents draft. You approve.</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>
  <div class="mono" style="font-size:12.5px;color:rgba(10,10,10,.55);margin-top:10px">Guardrail: an order is never auto-placed — every PO clears a human gate with model · confidence · approver logged.</div>

  <table style="margin-top:20px">
    <tr><th>PO</th><th>Item</th><th>Vendor</th><th>Value</th><th style="text-align:right">Status / action</th></tr>
    <tr style="background:rgba(198,242,79,.10)">
      <td class="mono">PO-9007</td>
      <td>DRIVE-205 · qty 24<br><span class="mono" style="font-size:11px;color:rgba(10,10,10,.5)">Drafted by agent · model claude-sonnet · conf 0.83 · approver: Ops lead</span></td>
      <td>Actuator Co (T1)</td>
      <td class="mono">$91,200</td>
      <td style="text-align:right;white-space:nowrap">
        <span class="badge" style="background:#c6f24f;color:#0a0a0a;margin-right:8px">Awaiting approval</span>
        <button class="btn" style="border:1px solid rgba(10,10,10,.18);background:#fff">Edit</button>
        <button class="btn" style="border:none;background:#c6f24f;color:#0a0a0a;font-weight:600">Approve</button>
      </td>
    </tr>
    <tr>
      <td class="mono">PO-9014</td>
      <td>BATT-HX2 · qty 16<br><span class="mono" style="font-size:11px;color:rgba(10,10,10,.5)">Drafted by agent · conf 0.79</span></td>
      <td>Cells Co</td><td class="mono">$51,200</td>
      <td style="text-align:right"><span class="badge" style="background:#c6f24f;color:#0a0a0a">Awaiting approval</span></td>
    </tr>
    <tr><td class="mono">PO-9001</td><td>DRIVE-204 · qty 50</td><td>Bearings Ltd</td><td class="mono">$42,000</td><td style="text-align:right"><span class="badge" style="background:rgba(31,158,111,.12);color:#1f9e6f"><span class="dot" style="background:#1f9e6f"></span>Sent</span></td></tr>
    <tr><td class="mono">PO-9009</td><td>SENSOR-360 · qty 12</td><td>Sensors Inc</td><td class="mono">$54,000</td><td style="text-align:right"><span class="badge" style="background:rgba(31,158,111,.12);color:#1f9e6f"><span class="dot" style="background:#1f9e6f"></span>Sent</span></td></tr>
    <tr><td class="mono">PO-9002</td><td>DRIVE-204 · qty 24</td><td>Actuator Co (T1)</td><td class="mono">$86,400</td><td style="text-align:right"><span class="badge" style="background:rgba(31,158,111,.12);color:#1f9e6f"><span class="dot" style="background:#1f9e6f"></span>Received</span></td></tr>
  </table>

  <div style="margin-top:26px;display:flex;gap:26px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:rgba(10,10,10,.5)">
    <span><span class="dot" style="background:#c6f24f;display:inline-block;margin-right:6px"></span>agent-drafted — needs a human</span>
    <span><span class="dot" style="background:#1f9e6f;display:inline-block;margin-right:6px"></span>approved &amp; sent</span>
  </div>
</div>
```

---

### BUILD GENEALOGY → Slide 3 · Value Prop
- **Purpose on the slide:** know every unit — parts, serials and firmware captured as it's built.
- **Crop:** one serial's as-built station trace; a HOLD station tied to a quality flag. Hide throughput/other panels.
- **Caption (on-slide):** "Know every unit — as-built parts · serials · firmware · sample data"

```html
<div id="sales2" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 44px">
  <style>
    #sales2 *{box-sizing:border-box}
    #sales2 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales2 .h1{font-size:25px;font-weight:700;margin:2px 0 0}
    #sales2 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #sales2 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #sales2 .station{display:flex;align-items:flex-start;gap:16px;padding:16px 0;border-bottom:1px solid rgba(10,10,10,.08)}
    #sales2 .node{width:16px;height:16px;border-radius:50%;flex:none;margin-top:3px}
    #sales2 .st-name{font-size:16px;font-weight:600}
    #sales2 .built{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:rgba(10,10,10,.6);margin-top:4px}
    #sales2 .stat{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;padding:3px 9px;border-radius:6px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Manufacturing · as-built genealogy</div><div class="h1">Every unit, fully traced · SN-0208</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>
  <div class="mono" style="font-size:12px;color:rgba(10,10,10,.55);margin-top:10px">Customer Tier-1 Auto OEM · product HX-2 · captured at each station — not reconstructed later</div>

  <div style="margin-top:18px">
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Frame build</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">FRM-88 · s/n F88-0208 · 2026-06-27</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Drive integration</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">DRIVE-204 · s/n D204-1183 · lot 88421 · 2026-06-29</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Actuators</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">ACT-205 ×2 · s/n A205-0461 / 0462 · 2026-07-01</div></div></div>
    <div class="station"><span class="node" style="background:#1f9e6f"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name">Firmware</span><span class="stat" style="background:rgba(31,158,111,.12);color:#1f9e6f">Done</span></div><div class="built">flashed fw v4.2.1 · signed · 2026-07-02</div></div></div>
    <div class="station" style="background:rgba(198,242,79,.12);border-radius:10px;padding:16px 12px"><span class="node" style="background:#0a0a0a"></span><div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:center"><span class="st-name">Test</span><span class="stat" style="background:#0a0a0a;color:#fff">HOLD</span></div><div class="built">payload torque +4% over UCL → NCR-118 · lot 88421</div></div></div>
    <div class="station" style="border-bottom:none"><span class="node" style="background:rgba(10,10,10,.15)"></span><div style="flex:1"><div style="display:flex;justify-content:space-between"><span class="st-name" style="color:rgba(10,10,10,.5)">Pack-out</span><span class="stat" style="background:rgba(10,10,10,.06);color:rgba(10,10,10,.5)">Pending</span></div><div class="built" style="color:rgba(10,10,10,.4)">blocked on Test</div></div></div>
  </div>
</div>
```

---

### QUALITY SPC CHART → NCR → Slide 4 · value tiles
- **Purpose on the slide:** catch drift early — a control chart flags an out-of-spec point that opens an NCR tied to the exact lot.
- **Crop:** the SPC control chart (UCL / x̄ / LCL, one out-of-spec point in ink) + the linked NCR card. Hide the Pareto/cert panels.
- **Caption (on-slide):** "Quality — SPC breach opens NCR-118, traced to the lot · sample data"

```html
<div id="sales3" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 40px">
  <style>
    #sales3 *{box-sizing:border-box}
    #sales3 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales3 .h1{font-size:25px;font-weight:700;margin:2px 0 0}
    #sales3 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #sales3 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #sales3 .bar{flex:1;background:rgba(10,10,10,.42);border-radius:2px 2px 0 0;align-self:flex-end}
    #sales3 .limit{position:absolute;left:0;right:0;border-top:1px dashed rgba(10,10,10,.35);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:rgba(10,10,10,.5)}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Quality &amp; testing · drive torque · SPC</div><div class="h1">Catch drift before it ships</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:24px;margin-top:22px;align-items:start">
    <!-- SPC chart -->
    <div style="border:1px solid rgba(10,10,10,.12);border-radius:14px;padding:20px 20px 14px;background:#f4f3ef">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:15px;font-weight:600">Drive torque · control chart</span><span class="mono" style="font-size:11px;color:rgba(10,10,10,.55)">n=24 · 2 out of spec</span></div>
      <div style="position:relative;height:230px;padding:14px 0">
        <div class="limit" style="top:22px">UCL 4.2</div>
        <div class="limit" style="top:112px;border-top-style:solid;border-top-color:rgba(10,10,10,.25)">x̄ 3.8</div>
        <div class="limit" style="top:200px">LCL 3.4</div>
        <div style="position:absolute;inset:0;display:flex;gap:4px;align-items:flex-end">
          <div class="bar" style="height:44%"></div><div class="bar" style="height:56%"></div><div class="bar" style="height:50%"></div>
          <div class="bar" style="height:62%"></div><div class="bar" style="height:54%"></div><div class="bar" style="height:66%"></div>
          <div class="bar" style="height:48%"></div><div class="bar" style="height:58%"></div><div class="bar" style="height:52%"></div>
          <div class="bar" style="height:64%"></div><div class="bar" style="height:56%"></div><div class="bar" style="height:60%"></div>
          <div class="bar" style="height:50%"></div><div class="bar" style="height:62%"></div><div class="bar" style="height:58%"></div>
          <div class="bar" style="height:68%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:70%"></div>
          <div class="bar" style="height:64%"></div><div class="bar" style="height:72%"></div><div class="bar" style="height:68%"></div>
          <div class="bar" style="height:74%"></div>
          <div class="bar" style="height:88%;background:#0a0a0a"></div><div class="bar" style="height:96%;background:#0a0a0a"></div>
        </div>
      </div>
      <div style="display:flex;gap:20px;margin-top:8px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:rgba(10,10,10,.5)">
        <span><span style="display:inline-block;width:9px;height:9px;background:rgba(10,10,10,.42);margin-right:6px"></span>within control</span>
        <span><span style="display:inline-block;width:9px;height:9px;background:#0a0a0a;margin-right:6px"></span>out of spec</span>
      </div>
    </div>

    <!-- linked NCR card -->
    <div style="border:1px solid rgba(10,10,10,.14);border-left:3px solid #0a0a0a;border-radius:14px;padding:20px">
      <div class="mono" style="font-size:10px;letter-spacing:.08em;color:rgba(10,10,10,.5)">NON-CONFORMANCE · AUTO-OPENED</div>
      <div style="font-size:19px;font-weight:700;margin-top:6px">NCR-118</div>
      <div style="font-size:14px;margin-top:4px">Drive torque over UCL (stiff actuator)</div>
      <div style="margin-top:16px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;line-height:1.9;color:rgba(10,10,10,.6)">
        severity &nbsp;· <span style="color:#0a0a0a">CRITICAL</span><br>
        linked lot · 88421<br>
        part &nbsp;&nbsp;&nbsp;· DRIVE-204 · s/n D204-1183<br>
        unit &nbsp;&nbsp;&nbsp;· SN-0208 · held at Test<br>
        source &nbsp;· SPC agent · conf 0.91
      </div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(10,10,10,.1);font-size:12.5px;color:rgba(10,10,10,.6)">Ripples to Engineering (ECO-318) and Procurement (re-source) — one flag, tracked everywhere.</div>
    </div>
  </div>
</div>
```

---

### FLEET MAP + FIELD-SERVICE DISPATCH → Slide 3 / 6
- **Purpose on the slide:** uptime SLAs met end-to-end — telemetry flags a unit, the SLA countdown starts, the right certified tech is dispatched.
- **Crop:** fleet health + site map (left) → a unit's SLA countdown (middle) → the dispatch board with a certified tech (right). Anonymized sites/customers.
- **Caption (on-slide):** "Fleet → SLA → dispatch — uptime met with the right tech · sample data"

```html
<div id="sales4" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:32px 40px">
  <style>
    #sales4 *{box-sizing:border-box}
    #sales4 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales4 .h1{font-size:24px;font-weight:700;margin:2px 0 0}
    #sales4 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #sales4 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #sales4 .panel{border:1px solid rgba(10,10,10,.12);border-radius:14px;padding:16px 18px}
    #sales4 .plabel{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,10,10,.5)}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Robotics · fleet + field service</div><div class="h1">Uptime, met with the right tech</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:16px;margin-top:20px;align-items:start">
    <!-- fleet health + map -->
    <div class="panel">
      <div class="plabel">Fleet health · 15 units</div>
      <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:10px">
        <div style="flex:9;background:#1f9e6f"></div><div style="flex:4;background:#c6f24f"></div><div style="flex:1;background:#0a0a0a"></div><div style="flex:1;background:rgba(10,10,10,.15)"></div>
      </div>
      <div class="mono" style="font-size:10.5px;color:rgba(10,10,10,.55);margin-top:8px">nominal 9 · attention 4 · critical 1 · offline 1</div>
      <div style="margin-top:14px;height:150px;border-radius:10px;background:#f4f3ef;background-image:radial-gradient(rgba(10,10,10,.10) 1px,transparent 1px);background-size:16px 16px;position:relative">
        <div style="position:absolute;left:26%;top:38%"><span style="width:12px;height:12px;border-radius:50%;background:rgba(10,10,10,.4);display:inline-block"></span> <span class="mono" style="font-size:10px">Site-1 · 5</span></div>
        <div style="position:absolute;left:52%;top:22%"><span style="width:12px;height:12px;border-radius:50%;background:#0a0a0a;display:inline-block"></span> <span class="mono" style="font-size:10px">Site-2 · 5</span></div>
        <div style="position:absolute;left:60%;top:66%"><span style="width:12px;height:12px;border-radius:50%;background:#c6f24f;display:inline-block"></span> <span class="mono" style="font-size:10px">Site-3 · 5</span></div>
      </div>
    </div>

    <!-- SLA countdown -->
    <div class="panel" style="border-left:3px solid #0a0a0a">
      <div class="plabel">Unit on watch · SLA</div>
      <div style="font-size:19px;font-weight:700;margin-top:8px">SN-2196 · Site-3</div>
      <div class="mono" style="font-size:12px;color:rgba(10,10,10,.55);margin-top:3px">Tier-1 Auto OEM · thermal anomaly</div>
      <div style="margin-top:18px;font-size:34px;font-weight:700;letter-spacing:-.02em">3h 42m</div>
      <div class="plabel" style="margin-top:2px">to SLA breach</div>
      <div style="height:8px;border-radius:4px;background:rgba(10,10,10,.1);margin-top:14px;overflow:hidden"><div style="width:78%;height:100%;background:#0a0a0a"></div></div>
      <div style="margin-top:16px;font-size:12.5px;color:rgba(10,10,10,.6)">Predictive agent flagged cell-4 ΔV · 36h to limit · conf 0.91</div>
    </div>

    <!-- dispatch board -->
    <div class="panel">
      <div class="plabel">Today's dispatch · 6 techs</div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px"><span class="mono" style="font-size:11px;width:44px;color:rgba(10,10,10,.6)">Tech A</span><div style="flex:1;height:16px;border-radius:4px;background:rgba(10,10,10,.06);position:relative"><div style="position:absolute;left:8%;width:34%;top:0;bottom:0;background:#0a0a0a;border-radius:4px"></div></div></div>
        <div style="display:flex;align-items:center;gap:10px"><span class="mono" style="font-size:11px;width:44px;color:rgba(10,10,10,.6)">Tech B</span><div style="flex:1;height:16px;border-radius:4px;background:rgba(10,10,10,.06);position:relative"><div style="position:absolute;left:30%;width:28%;top:0;bottom:0;background:#c6f24f;border-radius:4px"></div></div></div>
        <div style="display:flex;align-items:center;gap:10px"><span class="mono" style="font-size:11px;width:44px;color:rgba(10,10,10,.6)">Tech C</span><div style="flex:1;height:16px;border-radius:4px;background:rgba(10,10,10,.06);position:relative"><div style="position:absolute;left:52%;width:30%;top:0;bottom:0;background:#0a0a0a;border-radius:4px"></div></div></div>
      </div>
      <div style="margin-top:16px;border:1px solid rgba(10,10,10,.12);border-radius:10px;padding:12px 14px;background:rgba(198,242,79,.10)">
        <div style="font-size:14px;font-weight:600">WO-5521 → Tech B</div>
        <div class="mono" style="font-size:11px;color:rgba(10,10,10,.6);margin-top:3px">battery swap · HV cert valid · en route · ETA 41m</div>
      </div>
      <div class="mono" style="font-size:10.5px;color:rgba(10,10,10,.5);margin-top:12px">dispatch gated on certification — only a qualified tech is offered</div>
    </div>
  </div>
</div>
```

---

### PROPOSE → APPROVE → AUDIT + AUDIT TRAIL → Slide 4 / 6
- **Purpose on the slide:** the trust mechanic — every agent action logs inputs · output · model · confidence · approver to an immutable trail.
- **Crop:** the three-state mechanic (propose → approve → audit) with the fields, plus the audit trail table. Hide filters/other chrome.
- **Caption (on-slide):** "Propose → approve → audit — every action on the record · sample data"

```html
<div id="sales5" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:#0a0a0a;box-sizing:border-box;padding:34px 40px">
  <style>
    #sales5 *{box-sizing:border-box}
    #sales5 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales5 .h1{font-size:24px;font-weight:700;margin:2px 0 0}
    #sales5 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px}
    #sales5 .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    #sales5 .stage{flex:1;border:1px solid rgba(10,10,10,.12);border-radius:12px;padding:14px 16px}
    #sales5 .slabel{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales5 table{width:100%;border-collapse:collapse}
    #sales5 th{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:rgba(10,10,10,.45);text-align:left;padding:9px 12px;border-bottom:1px solid rgba(10,10,10,.12)}
    #sales5 td{font-size:12.5px;padding:10px 12px;border-bottom:1px solid rgba(10,10,10,.07)}
    #sales5 .mn{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Governance · immutable event log</div><div class="h1">Every agent action, on the record</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <!-- mechanic -->
  <div style="display:flex;gap:12px;align-items:stretch;margin-top:20px">
    <div class="stage" style="border-left:3px solid #c6f24f"><div class="slabel">1 · Propose</div><div style="font-size:14px;font-weight:600;margin-top:6px">Agent drafts PO-9007</div><div class="mono" style="font-size:11px;color:rgba(10,10,10,.6);margin-top:6px;line-height:1.7">inputs · reorder + BOM<br>output · DRIVE-205 ×24<br>model · claude-sonnet<br>confidence · 0.83</div></div>
    <div style="align-self:center;color:rgba(10,10,10,.35);font-family:'JetBrains Mono',ui-monospace,monospace">→</div>
    <div class="stage"><div class="slabel">2 · Approve</div><div style="font-size:14px;font-weight:600;margin-top:6px">Human gate</div><div class="mono" style="font-size:11px;color:rgba(10,10,10,.6);margin-top:6px;line-height:1.7">approver · Ops lead<br>decision · approved<br>at · 09:42 · today<br>never auto-placed</div></div>
    <div style="align-self:center;color:rgba(10,10,10,.35);font-family:'JetBrains Mono',ui-monospace,monospace">→</div>
    <div class="stage" style="background:#0a0a0a;color:#fff"><div class="slabel" style="color:rgba(255,255,255,.55)">3 · Audit</div><div style="font-size:14px;font-weight:600;margin-top:6px">Immutable entry written</div><div class="mono" style="font-size:11px;color:rgba(255,255,255,.65);margin-top:6px;line-height:1.7">append-only · hashed<br>inputs · output · model<br>confidence · approver<br>replayable</div></div>
  </div>

  <!-- audit trail -->
  <div style="margin-top:22px;border:1px solid rgba(10,10,10,.12);border-radius:12px;overflow:hidden">
    <div class="slabel" style="padding:12px 14px">Audit trail · append-only</div>
    <table>
      <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Confidence</th><th>Approver</th><th>Summary</th></tr>
      <tr><td class="mn">09:42</td><td>Ops lead</td><td class="mn">po.approve</td><td class="mn">PO-9007</td><td class="mn">—</td><td>Ops lead</td><td>Re-source DRIVE-205 approved</td></tr>
      <tr><td class="mn">09:41</td><td>sourcing-agent</td><td class="mn">po.draft</td><td class="mn">PO-9007</td><td class="mn">0.83</td><td class="mn">—</td><td>Drafted · awaiting approval</td></tr>
      <tr><td class="mn">09:38</td><td>spc-agent</td><td class="mn">ncr.open</td><td class="mn">NCR-118</td><td class="mn">0.91</td><td class="mn">—</td><td>Torque over UCL · lot 88421</td></tr>
      <tr><td class="mn">09:30</td><td>wf-orchestrator</td><td class="mn">workflow.run</td><td class="mn">WF-04</td><td class="mn">0.90</td><td class="mn">—</td><td>Reorder workflow → succeeded</td></tr>
      <tr><td class="mn">08:55</td><td>change-agent</td><td class="mn">eco.review</td><td class="mn">ECO-318</td><td class="mn">0.78</td><td class="mn">—</td><td>Supersede DRIVE-204 → 205</td></tr>
      <tr><td class="mn">08:40</td><td>QA lead</td><td class="mn">ncr.review</td><td class="mn">NCR-118</td><td class="mn">—</td><td>QA lead</td><td>Contained · disposition set</td></tr>
    </table>
  </div>
</div>
```

---

### CROSS-MODULE RIPPLE → Slide 7
- **Purpose on the slide:** why an operating system beats point tools — one event reasoned across every module. **Diagram in v2 style, not a literal screen.**
- **Crop:** a left-to-right cascade of 7 module nodes from a single quality flag; the origin is the lime signal.
- **Caption (on-slide):** "One quality flag, seven modules — one system · sample data"

```html
<div id="sales6" style="width:1200px;height:750px;font-family:'Archivo',system-ui,sans-serif;background:#f4f3ef;color:#0a0a0a;box-sizing:border-box;padding:40px 44px;background-image:radial-gradient(rgba(10,10,10,.05) 1px,transparent 1px);background-size:22px 22px">
  <style>
    #sales6 *{box-sizing:border-box}
    #sales6 .eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales6 .h1{font-size:25px;font-weight:700;margin:2px 0 0}
    #sales6 .chip{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(10,10,10,.5);border:1px solid rgba(10,10,10,.14);border-radius:999px;padding:4px 10px;background:#fff}
    #sales6 .node{background:#fff;border:1px solid rgba(10,10,10,.14);border-radius:12px;padding:14px 15px}
    #sales6 .mlabel{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(10,10,10,.5)}
    #sales6 .eff{font-size:13.5px;font-weight:600;margin-top:6px;line-height:1.3}
    #sales6 .arrow{font-family:'JetBrains Mono',ui-monospace,monospace;color:rgba(10,10,10,.35);font-size:18px;text-align:center;align-self:center}
  </style>

  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div><div class="eyebrow">Why an OS, not point tools</div><div class="h1">One flag, reasoned across every module</div></div>
    <span class="chip">sample data — illustrative</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 22px 1fr 22px 1fr 22px 1fr;gap:12px 4px;margin-top:34px">
    <div class="node" style="border-left:3px solid #c6f24f"><div class="mlabel">Quality</div><div class="eff">Torque over UCL → NCR-118</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Engineering</div><div class="eff">ECO-318 supersede DRIVE-204→205</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Procurement</div><div class="eff">Re-source PO drafted, gated</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Fulfillment</div><div class="eff">Delivery flagged at-risk</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 22px 1fr 22px 1fr;gap:12px 4px;margin-top:20px">
    <div class="node"><div class="mlabel">Field service</div><div class="eff">Dispatch scheduled under SLA</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Finance</div><div class="eff">Unit margin −2.1pt from ECO</div></div>
    <div class="arrow">→</div>
    <div class="node"><div class="mlabel">Legal</div><div class="eff">Contract obligation checked</div></div>
  </div>

  <div style="margin-top:30px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:rgba(10,10,10,.55);text-align:center">
    captured once · reasoned everywhere — <span style="color:#0a0a0a">point tools stop at the module edge</span>
  </div>
</div>
```

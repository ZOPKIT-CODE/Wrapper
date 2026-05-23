# Zopkit B2B CRM — Product Demo Video Brief

**Format:** Polished 60–90 second marketing video (Remotion)
**Target:** Enterprise-grade SaaS launch reel
**Coverage:** All 21 product modules
**Style:** Mirrors the inline SVG style used on the marketing product page
**Source SVGs:** `frontend/src/features/landing/pages/getCRMFeatureSvg.tsx`

---

## 1. Brand & Design Tokens

Pull these from the existing SVGs — the video must look like the same product:

```
NAV (collapsed sidebar rail) #0d1f3a
W   (content background)     #FFFFFF
BD  (borders)                #E2E8F0
H   (heading text)            #0F172A
M   (muted text)             #64748B
PRM (primary CTA / accents)  #1B2E5A
POS (success / positive)     #10B981
WARN (attention)             #F59E0B
NEG (danger / overdue)       #EF4444
Accent palette for stages:
  Blue   #3B82F6
  Violet #8B5CF6
  Amber  #F59E0B
  Teal   #06B6D4
  Pink   #EC4899
  Green  #10B981
Font family: system-ui, -apple-system, sans-serif
SVG canvas: 800 x 480 (5:3)
Video canvas: 1920 x 1080 @ 30fps
```

App-window chrome that wraps every module shot:
- macOS-style traffic lights (red/amber/green dots)
- URL pill: `app.zopkit.com/<route>`
- Subtle border + soft shadow, no harsh outlines
- Background: light gradient (#f8faff → #eef2ff or per-section accent)

Motion language:
- Soft parallax, 100–300ms eases (cubic-bezier(0.16, 1, 0.3, 1))
- Cards lift into view, never bounce
- Text reveals: word-by-word fade-up, ~40ms stagger
- Cursor sweeps when illustrating an interaction
- Transitions between modules: a 250ms "slide-and-blur" wipe in the brand-primary color

Audio:
- Music: cinematic-corporate, restrained, ~90 BPM (think early Notion / Linear launch videos)
- Music ducks under voiceover by 12dB
- Voiceover: confident, warm, mid-30s, North American or neutral British
- Sound design: very light UI tics on transitions, no chimes

---

## 2. Hero Cold Open (0:00 – 0:06)

**On-screen:** Zopkit wordmark appears, then the tagline animates in word-by-word.

**Tagline:** *"One platform. Three teams. Zero tab-switching."*

**Voiceover:** "Most companies pay three vendors to track one customer."

---

## 3. The Problem Beat (0:06 – 0:12)

**On-screen:** Three CRM logos / tool-stack icons (Sales tool, Help desk, Marketing tool) sit apart with broken connector lines between them. They turn red one by one and dissolve.

**Voiceover:** "A sales tool. A help desk. A marketing platform. None of them talking. All of them billing you."

---

## 4. The Promise (0:12 – 0:18)

**On-screen:** Single unified record fades up — one customer card with three colored ribbons (Sales / Support / Marketing) attached.

**Voiceover:** "Zopkit B2B CRM runs your entire customer lifecycle in one system — from first webform to closed invoice to open ticket."

---

## 5. Module Walkthrough (0:18 – 1:18)

**Layout per beat:** 2.5–3 seconds per module on average. Use the matching SVG (case index in `getCRMFeatureSvg.tsx`) as the central artifact, with one floating callout chip and one stat chip.

For every module below, the agent should:
1. Render the corresponding SVG inside the browser-chrome window.
2. Animate one element (a card lifting, a stage filling, a number ticking up).
3. Display the **Callout** as a chip + the **Stat** as a pill.
4. Voiceover reads the **VO** line.

### Module 0 — Leads *(SVG case 0)*
- **Headline:** Capture every lead. Convert the right ones.
- **Callout:** Kanban + score in one view
- **Stat:** 47 active leads · $2.4M pipeline
- **VO:** "Capture, score, and route every lead — kanban or list, your call."

### Module 1 — Contacts *(case 1)*
- **Headline:** A complete picture of every person.
- **Callout:** Activity timeline that writes itself
- **Stat:** 1,284 contacts · 312 active in 30 days
- **VO:** "Every email, call, and meeting — logged automatically to one profile."

### Module 2 — Accounts *(case 2)*
- **Headline:** Roll revenue up the org chart.
- **Callout:** Group hierarchy with consolidated rollup
- **Stat:** $8.2M YTD across 412 accounts
- **VO:** "Manage parent companies and subsidiaries with revenue that rolls up cleanly."

### Module 3 — Opportunities *(case 3)*
- **Headline:** Forecast you can actually defend.
- **Callout:** Weighted by probability
- **Stat:** $4.8M weighted forecast · 34% win rate
- **VO:** "Configurable stages. Weighted forecasts. Win-loss baked in."

### Module 4 — Quotations *(case 4)*
- **Headline:** Branded quotes in a click.
- **Callout:** Multi-step approval + one-click PDF
- **Stat:** Q-2026-0184 · $12,820
- **VO:** "Build quotes with taxes, discounts, and approval routing — branded PDF on send."

### Module 5 — Invoices *(case 5)*
- **Headline:** Get paid faster.
- **Callout:** Aging buckets at a glance
- **Stat:** $420K paid MTD · DSO 27 days
- **VO:** "Convert accepted quotes to invoices. Track every dollar from sent to paid."

### Module 6 — Sales Orders *(case 6)*
- **Headline:** Won deal to delivered, end to end.
- **Callout:** 5-stage fulfilment flow
- **Stat:** 96% on-time rate · 41 shipped this week
- **VO:** "Confirmed, picked, shipped, delivered — every order traceable to the deal that won it."

### Module 7 — Approval Processes *(case 7)*
- **Headline:** Big deals get a second look.
- **Callout:** Sequential or parallel chains
- **Stat:** Avg approval time 4.2 hours
- **VO:** "Route deals, quotes, and orders through configurable approval chains."

### Module 8 — Products & Inventory *(case 8)*
- **Headline:** One catalog. Every quote, every invoice.
- **Callout:** Stock alerts + price lists
- **Stat:** 284 SKUs · 87% in stock
- **VO:** "Centralized catalog with stock levels, price tiers, and bulk import."

### Module 9 — Tickets *(case 9)*
- **Headline:** Support customers where you sold them.
- **Callout:** SLA timers that don't miss
- **Stat:** 18 min avg response · 78% first-contact resolution
- **VO:** "Tickets with priorities, SLAs, and the full customer history attached."

### Module 10 — Communications *(case 10)*
- **Headline:** One inbox for the whole relationship.
- **Callout:** Email · calls · meetings · notes — one timeline
- **Stat:** 1,284 interactions logged this quarter
- **VO:** "Every conversation across every channel — auto-linked to the right record."

### Module 11 — Marketing Campaigns *(case 11)*
- **Headline:** Prove what marketing is worth.
- **Callout:** Source-to-revenue attribution
- **Stat:** $1.8M attributed revenue · CPL $42
- **VO:** "Run campaigns, attribute pipeline, and measure revenue — without leaving the CRM."

### Module 12 — Webforms *(case 12)*
- **Headline:** Capture demand on any site.
- **Callout:** Drag-build · embed anywhere
- **Stat:** 1,284 submissions · 26.8% conversion
- **VO:** "Embed a form on any site. Every submission becomes a lead, tagged with source."

### Module 13 — Email Templates & Cadences *(case 13)*
- **Headline:** Outbound at scale, without the burnout.
- **Callout:** 5-step sequences with conditional branching
- **Stat:** 62% open rate · 38% reply rate
- **VO:** "Templates and multi-step cadences — personalized at scale, tracked end to end."

### Module 14 — Bulk Upload *(case 14)*
- **Headline:** Migrate a million rows. Lose nothing.
- **Callout:** Column-to-field mapping + duplicate detection
- **Stat:** 1,284 rows · 12 columns · zero data loss
- **VO:** "Upload CSVs with field mapping, validation, and duplicate handling built in."

### Module 15 — Calendar & Events *(case 15)*
- **Headline:** Every meeting linked to the work it does.
- **Callout:** Day · Week · Month · Agenda
- **Stat:** 12 events this week · 4 meetings · 3 milestones
- **VO:** "Schedule directly against accounts, contacts, and opportunities."

### Module 16 — Tasks & Activities *(case 16)*
- **Headline:** Follow-ups never slip.
- **Callout:** Due today · Overdue · This week
- **Stat:** 94% follow-up rate · 32 completed this week
- **VO:** "Assign tasks against any record. Stay on top of every commitment."

### Module 17 — Notes & Documents *(case 17)*
- **Headline:** Context where the work is.
- **Callout:** Rich text · mentions · attachments
- **Stat:** 5 notes · 3 documents on one deal
- **VO:** "Rich notes, mentions, and document attachments — on every record."

### Module 18 — Custom Fields & Layouts *(case 18)*
- **Headline:** Shape the CRM to your workflow.
- **Callout:** Drag-drop layout editor, 16 field types
- **Stat:** Zero-code customization
- **VO:** "Add fields, rearrange layouts, control visibility by role — without writing code."

### Module 19 — Custom Buttons & Functions *(case 19)*
- **Headline:** One click. Any action.
- **Callout:** Code-based functions on any record
- **Stat:** 142 executions today · 1.2s avg runtime
- **VO:** "Build one-click automations that call any external API — right from the record."

### Module 20 — Webhooks *(case 20)*
- **Headline:** Real-time outbound, anywhere.
- **Callout:** Event-driven delivery + auto-retry
- **Stat:** 2,418 deliveries / 24h · 99.4% success
- **VO:** "Push CRM events to Slack, HubSpot, Zapier, or any internal system in real time."

---

## 6. Outcome Section (1:18 – 1:25)

**On-screen:** Four large stat tiles fade up in a row.

| Stat | Label |
|---|---|
| **60%** | Average CRM spend cut |
| **3-in-1** | Tools replaced |
| **1,000+** | Companies running on it |
| **Same-day** | Time to first workflow live |

**Voiceover:** "Companies replacing three tools with one are cutting CRM spend by sixty percent — and getting their first workflow live the same day."

---

## 7. Final CTA (1:25 – 1:30)

**On-screen:** Zopkit logo lockup. Primary button: **Start Free Trial**. Secondary text: zopkit.com/crm

**Voiceover:** "Zopkit B2B CRM. One record. Three teams. Get started free."

End frame: 1.5 seconds of static logo + URL, music tail.

---

## 8. Production Notes for the Remotion Agent

1. **Composition structure:** one `<Composition>` per section (Hero, Problem, Promise, Module-00 … Module-20, Outcome, CTA) inside a parent `<Series>` so timing is editable.
2. **Reusable components to build:**
   - `<BrowserFrame>` — wraps any module SVG with macOS chrome + URL pill
   - `<CalloutChip>` — top-right floating chip with dot + label + value
   - `<StatChip>` — bottom-left pill showing the headline metric
   - `<ModuleSlide>` — combines headline, browser frame, callout, stat, VO
   - `<TransitionWipe>` — 250ms slide-and-blur between modules
3. **Inline the SVGs:** copy the case bodies from `getCRMFeatureSvg.tsx` into Remotion `<svg>` components. Add `<Sequence>` wrappers to animate substructures (e.g., kanban cards lifting in).
4. **Voiceover:** generate WAV files per beat using ElevenLabs or similar; offline-cache them under `public/vo/`. Total VO ~80–85s.
5. **Music:** royalty-free corporate cinematic, e.g. Artlist or Epidemic Sound. Loop + tail to match 90s.
6. **Captions:** burned-in for accessibility, brand-primary text on white pill. Toggle via prop.
7. **Render targets:**
   - `1920x1080 30fps` MP4 (master)
   - `1080x1080` square cut for social
   - `1080x1920` vertical cut for LinkedIn / mobile
8. **File outputs:**
   - `out/zopkit-crm-demo-landscape.mp4`
   - `out/zopkit-crm-demo-square.mp4`
   - `out/zopkit-crm-demo-vertical.mp4`

---

## 9. Voiceover Master Script (one block, ~85 seconds at 175 wpm)

> Most companies pay three vendors to track one customer.
>
> A sales tool. A help desk. A marketing platform. None of them talking. All of them billing you.
>
> Zopkit B2B CRM runs your entire customer lifecycle in one system — from first webform to closed invoice to open ticket.
>
> Capture, score, and route every lead. Every email, call, and meeting logs to one profile automatically. Manage parent companies and subsidiaries with revenue that rolls up cleanly. Configurable stages, weighted forecasts, and win-loss baked in.
>
> Build branded quotes with approval routing. Convert them to invoices in a click. Track every order from confirmed to delivered.
>
> Approval chains for the deals that matter. One catalog feeding every quote and invoice. SLA-tracked tickets with the full customer history attached. Every conversation across every channel, auto-linked to the right record.
>
> Run campaigns with real revenue attribution. Embed webforms anywhere. Run multi-step email cadences. Migrate from your old CRM with bulk upload.
>
> Schedule meetings against deals, manage every follow-up, attach rich notes and documents.
>
> Reshape the CRM to your workflow with custom fields and layouts. Build one-click automations with code. Push events to any system in real time with webhooks.
>
> Companies replacing three tools with one are cutting CRM spend by sixty percent — and getting their first workflow live the same day.
>
> Zopkit B2B CRM. One record. Three teams. Get started free.

---

## 10. Acceptance Criteria

- 60–90s total runtime (target 85s)
- All 21 modules visible, each on screen ≥ 2 seconds
- SVG fidelity matches `getCRMFeatureSvg.tsx` exactly (same data, same layout)
- Voiceover audible, music ducked, captions on
- No third-party logos other than illustrative HubSpot/Slack/Zapier inside the Webhooks scene
- Renders cleanly to 1920×1080 MP4
- Composition is editable — each module is its own `<Sequence>` inside `<Series>`

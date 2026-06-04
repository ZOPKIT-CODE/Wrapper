# Webforms — Hands-on UI QA Report

**App:** B2B CRM (Zopkit) — `http://localhost:5173`
**Area:** Admin → Webforms (list, editor, integration, submissions, public form)
**Method:** Visual UI testing driven through the live browser
**Date:** 2026-05-26

---

## Executive summary

The **admin authoring experience is strong** — the list page, field builder, design tab, and settings tab are polished and mostly work as designed. However, the feature has **three critical, ship-blocking defects** on the parts that actually deliver value:

1. **Public forms never load** — every `/forms/<slug>` returns 401, so no visitor can ever see or submit a form.
2. **The Submissions page crashes** to a blank white screen on load.
3. **Any form containing a Page break (multi-step) cannot be saved** — "Create Webform" silently does nothing.

Because of these, no end-to-end flow (publish → submit → view submission) can complete today.

---

## ✅ Passing

**T1 — List page**
- Page loads cleanly, no error toasts. Header complete: globe icon, "Webforms" heading, subtitle, search input, "Use Template" + "New Webform" buttons.
- Card renders well (name, slug, Live badge, Lead chip, submissions count, sparkline, "No submissions yet").
- Overflow (⋯) menu opens on click with Edit form / View submissions / Integration & setup / Disable / Delete.
- Filter tabs **All** and **Live** work; **Disabled** correctly shows the empty state ("No forms yet" + CTA).
- Search filters correctly (matching query keeps the card; non-matching shows empty state).
- "Use Template" modal opens with 5 templates (Request a Demo, Construction RFQ, Patient Intake, Property Inquiry, Service Quote); selecting a card enables the "Use Template" button and opens the editor pre-filled.

**T2 — Fields tab**
- Sticky header (back arrow, globe, name input, Draft chip, Create Webform). Three segmented tabs.
- 260px palette with "Field types" label, search, and BASIC / ADVANCED / STRUCTURAL groups.
- Adding Short text / Email / Dropdown / Page break works; config panel (Label, Field key, Field type, Options for dropdown) opens on expand.
- Conditional "Show only if…" opens a builder with Match ALL/ANY, field picker, operator (equals…), value, and Add/Remove controls.
- Name → slug auto-populates ("Test Form" → "test-form").

**T3 — Design tab**
- Brand Colors card (Accent #2563EB / Background / Text) and Branding & Typography card (Logo URL, Font family).
- Accent swatch opens a full color picker; changing the hex (#E11D48) updated the preview's Submit button live.
- Live preview shows the actual fields, renders only step-1 fields, and shows the exact note: *"This form has 2 steps. Multi-step preview shows step 1."*
- Font family change (Inter → JetBrains Mono) updated the preview typography live.

**T4 — Settings tab (UI)**
- All four cards present and interactive: Security (Captcha, Rate limit, Allowed origins), Behavior (Duplicate submissions select with 5 options, Keep submissions days), Submission Notifications (+Email / +Webhook add removable rows), Visitor Acknowledgement (toggle reveals Subject + Body with `{{template}}` placeholders).
- **Create Webform works for forms *without* a page break** — POST `/api/webforms` 200, redirect to list, new card appears.

**T5 — Integration page**
- Header with form name, "Not connected" chip, Preview form. Three tabs: Install / Connection Status / Field Mapping.
- Install: platform picker (HTML/WordPress/Webflow/React/Squarespace/+More), dark syntax-highlighted embed snippet, Copy button → "✓ Copied!", Direct Link + Open on mobile, Webhook secret masked → Reveal shows full secret.
- Connection Status: metric cards + legend + activity chart with 7d/30d/90d/All toggles.
- Field Mapping: coverage bar + legend, Required CRM fields checklist (first_name/email/phone/company/source), and the All-fields mapping table with proper column headers.

---

## 🐛 Bugs Found

### CRITICAL

**BUG-1 — Public forms never load (401 on public endpoint)** · *T7 / steps 1–2*
- **Expected:** Visiting `/forms/<slug>` renders the public form for anonymous visitors.
- **Actual:** Page shows "Form not found. This form may have been disabled or removed." with a "No token, authorization denied" toast. Network: `GET /public/webforms/<slug>` → **401**. Reproduced on `qa-smoke-form` AND `request-a-demo-template`.
- **Root cause:** The public form API is behind authentication; it must be anonymous (forms are meant to be embedded on external sites). This single bug means **no form can ever be filled or submitted** — and explains why every form shows 0 submissions.
- **Severity:** Critical (feature is non-functional end-to-end).

**BUG-2 — Submissions page crashes to a blank white screen** · *T6 / step 3*
- **Expected:** Submissions table (or empty state) renders.
- **Actual:** Header + segment tabs flash briefly, then the entire page goes white. Console: `TypeError: (submissions ?? []).filter is not a function` (WebformSubmissionsPage.tsx:97). The API returns **200** but with a non-array body (wrapper object); `?? []` only guards null/undefined, and there is no error boundary, so the page dies.
- **Severity:** Critical (page unusable; could not test tabs/columns/Export CSV).

**BUG-3 — Forms with a Page break cannot be saved (silent failure)** · *T4 / step 7, T2*
- **Expected:** "Create Webform" saves a multi-step form and redirects.
- **Actual:** Clicking Create does nothing — no `POST /api/webforms`, no navigation, no error/toast. Proven by isolation: an identical form *without* a page break saved instantly (200 + redirect + card); *with* a page break (all field keys valid) it never submits. Multi-step forms therefore cannot be created at all.
- **Severity:** Critical/High.

### HIGH

**BUG-4 — No feedback when Create fails validation** · *T4 / step 7*
- **Expected:** A failed save shows an error / scrolls to / highlights the invalid field.
- **Actual:** The "Create Webform" button silently does nothing. The blocking error ("Field key is required") is rendered *inside collapsed field accordions* and is invisible unless you manually expand each field. No toast, no scroll-to-error, no field-array highlight.
- **Severity:** High (button appears dead; users have no path to resolution).

### MEDIUM

**BUG-5 — Manually-added fields don't auto-generate a Field key** · *T2*
Field key is required but left blank for hand-added fields (placeholder only), which combined with BUG-4 makes the editor feel broken.

**BUG-6 — Conditional logic condition can't be removed** · *T2 / step 7*
After adding a "Show only if…" condition, neither "Remove all" nor the row "×" clears it (a blank condition row persists), and clicking "Show only if…" only collapses while the ✓ stays active. Console shows a related React warning: *"Encountered two children with the same key"* in `ConditionBuilder`.

**BUG-7 — "Drafts" filter shows non-draft forms** · *T1 / step 5*
With the Drafts tab active, a **Live** form ("Request a Demo") still appears. (All/Live/Disabled filter correctly; Drafts does not.)

**BUG-8 — Connection Status chart shows mock data** · *T5 / step 5*
The "Submission activity" chart renders fabricated daily bars (up to ~78/day) while the metric cards and status say **0 submissions / "No submissions recorded yet."** Misleading.

**BUG-9 — "Rotate" webhook secret uses a native browser `confirm()`** · *T5 / step 4*
Rotate triggers a blocking native `confirm()` dialog rather than an in-app styled modal (froze the page until dismissed). Inconsistent with the rest of the styled UI.

### LOW

- **BUG-10** — Template "Service Quote" is listed as **2 fields** in the Use-Template modal, but opens with **6 fields** in the editor. *(T1)*
- **BUG-11** — Integration page header shows **"Loading…"** as the form name on initial load and is slow to resolve. *(T5)*
- **BUG-12** — Behavior card: the helper text under "Duplicate submissions" doesn't update to match the selected option (still references "Update existing" after choosing "Always create new"). *(T4)*
- **BUG-13** — Field key input placeholder is always **"full_name"** regardless of field type (e.g., on a Dropdown). *(T2)*
- **BUG-14** — Forms are created **Live** immediately even though the editor shows a "Draft" chip (and template creation publishes instantly). Worth confirming this is intended. *(T1/T4)*
- **Spec note** — The public route is **`/forms/<slug>`**, not `/f/<slug>` (the latter 404s). Update test scripts/embeds accordingly.

---

## 🎨 Visual / UX Issues

- **Card hover lift / overflow visibility:** the overflow (⋯) button is `opacity:0` until hover; the lift/shadow is very subtle and the menu icon is effectively invisible until interacted with — discoverability is low.
- **Color-picker popover** closes on any outside click, making fine adjustments fiddly; a hex field is the reliable path.
- **No error boundary anywhere in the Webforms area** — a single bad API shape white-screens the whole page (BUG-2). Each route should fail gracefully.
- **Validation visibility:** errors hidden inside collapsed accordions (BUG-4/5) is the single biggest UX trap in the editor.
- Overall spacing, typography, and the segmented controls are clean and consistent across tabs.

---

## 💡 Improvement Suggestions

- **Auto-generate field keys** from the label (slugify) the moment a field is added, with an "advanced" override — this is how Tally and HubSpot Forms behave and would eliminate BUG-4/5 entirely.
- **Surface save errors:** on a failed Create, auto-expand the first invalid field, scroll to it, and show a toast ("Fix 1 field before publishing"). Disable/spinner the button while validating.
- **Page break must be saveable** — a multi-step builder that can't persist multi-step forms is the headline gap. Ensure structural fields (page break, section break) are excluded from the per-field "key required" rule server- and client-side.
- **Public endpoint must be anonymous** — Typeform/Tally/HubSpot all serve the public form with zero auth and a per-form public token; mirror that. This is the #1 fix.
- **Submission activity chart** should bind to real data (and show an honest empty state at 0), not placeholder bars.
- **Use a styled confirm modal** for destructive/secret-rotation actions instead of native `confirm()`.
- **"Drafts" tab** should filter on `status === 'draft'`; today it leaks Live forms.
- Consider a **"Draft vs Publish" step** so authors can save work-in-progress without it going Live immediately (matches Tally/Typeform).

---

## 📊 Overall Assessment (1–10)

| Area | Score | Notes |
|------|:----:|-------|
| List page | **8** | Polished and functional; only the Drafts filter leaks Live forms. |
| Editor — Fields tab | **5** | Excellent builder UX, but page-break-save failure, un-removable conditions, and hidden validation are serious. |
| Editor — Design tab | **9** | Clean, live preview + color/font binding all work; best area tested. |
| Editor — Settings tab | **7** | All controls work; loses points for the silent/feedback-less Create flow that surfaces here. |
| Integration page | **7** | Rich and useful; mock-data chart, native confirm, and slow name load drag it down. |
| Submissions page | **2** | Crashes to a white screen on load; effectively unusable. |
| Public form / multi-step | **1** | Completely blocked — 401 on every public form; nothing could be exercised. |

**Headline:** the authoring UI is genuinely good, but the feature cannot ship until the public-form 401, the submissions-page crash, and the page-break save failure are fixed — those three break the core publish → collect → review loop.

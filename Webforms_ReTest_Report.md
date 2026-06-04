# Webforms — Bug-Fix Re-Test Report

**App:** B2B CRM (Zopkit) — `http://localhost:5173`
**Scope:** Verify 8 previously-reported bugs are fixed, via end-to-end UI testing
**Date:** 2026-05-26
**Result:** **7 of 8 fixed.** One critical bug remains (BUG-1, public form 401), which also blocks the end-to-end submit path.

---

## Results at a glance

| Test | Bug | Result |
|------|-----|:------:|
| TEST 1 — Drafts filter no longer leaks Live forms | BUG-7 | ✅ PASS |
| TEST 2 — Multi-step form (page break) can be saved | BUG-3 | ✅ PASS |
| TEST 3 — Validation surfaces on missing field key | BUG-4 / BUG-5 | ✅ PASS |
| TEST 4 — Public form loads for anonymous visitors | BUG-1 | ❌ **FAIL** |
| TEST 5 — Submit public form end-to-end | — | ⛔ BLOCKED (by BUG-1) |
| TEST 6 — Submissions page renders without crashing | BUG-2 | ✅ PASS |
| TEST 7 — Conditional logic add/remove | BUG-6 | ✅ PASS |
| TEST 8 — Webhook secret rotate uses inline confirm | BUG-9 | ✅ PASS |
| TEST 9 — Regression smoke (list/editor/design) | — | ✅ PASS |

---

## Detail

### ✅ TEST 1 — BUG-7 (Drafts filter) — PASS
There are 4 Live forms (Multi-step QA Test, QA Smoke Form, Service Quote, Request a Demo). The **Drafts** tab shows the "No forms yet" empty state — none of the Live forms leak into it. (All / Live / Disabled filters also behave correctly.)

### ✅ TEST 2 — BUG-3 (Multi-step save) — PASS
Built a form with **Your name → Email address → Page break → Company**. Field keys auto-generated (`text_1`, `email_2`, `text_4`). Clicking **Create Webform** fired `POST /api/webforms` → **200**, redirected to the list with a "Webform created" toast, and the **Multi-step QA Test** card appeared (Live, `/forms/multi-step-qa-test`). Forms with page breaks now save.

### ✅ TEST 3 — BUG-4 / BUG-5 (validation feedback) — PASS
Two improvements confirmed:
- **Field keys now auto-fill** when a field is added (e.g. `text_1`).
- Clearing a field key and clicking **Create Webform** produced a red toast **"Fix required fields before saving"** *and* auto-expanded the offending field accordion, showing inline **"Label is required" / "Field key is required"** errors. No more silent dead button.

### ❌ TEST 4 — BUG-1 (public form load) — FAIL
`http://localhost:5173/forms/multi-step-qa-test` still renders **"Form not found — This form may have been disabled or removed."** with a **"No token, authorization denied"** toast. Network confirms the backend call `GET http://localhost:4000/public/webforms/multi-step-qa-test` returns **401 Unauthorized**. The public form endpoint still requires authentication — it must be anonymous so embedded/public visitors can load the form. **Not fixed.**

### ⛔ TEST 5 — Submit end-to-end — BLOCKED
Cannot be performed: the public form never renders (BUG-1), so there are no fields or Submit button to interact with. Will be testable once BUG-1 is fixed.

### ✅ TEST 6 — BUG-2 (submissions crash) — PASS
"View submissions" for Multi-step QA Test now renders cleanly: header, **All / Starred / Trash** tabs, table columns (★, Date, IP Address, Spam Score, Payload, Entry Created), and a proper **"No submissions found."** empty state. No white-screen, no new `(submissions ?? []).filter` TypeError. (The error needed an array-safe guard; it now handles the empty case.)
*Note:* the bonus check — seeing a real submission row — could not be done because no submission could be created (BUG-1).

### ✅ TEST 7 — BUG-6 (conditional logic) — PASS
On a field's **Show only if…**, adding a condition set the label to **"✓ Show only if…"**. Clicking **Remove all** closed the condition panel and reverted the label to plain **"Show only if…"** (no ✓, no leftover blank row). Add/remove now works symmetrically.

### ✅ TEST 8 — BUG-9 (webhook rotate) — PASS
On the Integration page, clicking **Rotate** now shows an **inline** confirmation inside the Webhook secret card ("Invalidates current secret." + red **Confirm** + **Cancel**) — no native OS dialog (the renderer no longer freezes the way a native `confirm()` did). **Cancel** reverts the card to just the **Rotate** button.

### ✅ TEST 9 — Regression smoke — PASS
List page loads with cards, filter tabs work. In the editor: added a **Dropdown** with options "A, B, C"; **Design** tab accent color change (#16A34A) updated the live preview Submit button; **Settings** captcha dropdown opens (None / reCAPTCHA v3 / hCaptcha / Cloudflare Turnstile). No white screens, no error toasts.

---

## Bottom line

The fixes for **BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-7, and BUG-9 all verified as resolved.** The form-authoring, validation, multi-step save, submissions view, and integration flows are now solid.

**The one remaining blocker is BUG-1:** the public form endpoint (`GET /public/webforms/:slug`) still returns **401**, so no visitor can load or submit a form. Until that endpoint is made anonymous, the core publish → submit → collect loop cannot complete end-to-end (and TEST 5 plus the TEST 6 bonus remain untestable).

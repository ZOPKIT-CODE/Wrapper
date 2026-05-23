// 21 CRM module data entries — one per ModuleSlide in the full composition
import { BLUE, VIOLET, TEAL, POS, WARN, PRM } from "./tokens";

export interface ModuleData {
  headline: string;
  url: string;
  calloutLabel: string;
  calloutValue: string;
  calloutColor: string;
  stat: string;
  vo: string;
}

export const MODULES: ModuleData[] = [
  // 0 — Leads
  {
    headline: "Pipeline starts with every lead",
    url: "app.zopkit.com/leads",
    calloutLabel: "Pipeline",
    calloutValue: "$2.4M",
    calloutColor: BLUE,
    stat: "47 active leads",
    vo: "Leads arrive from webforms, LinkedIn, and referrals — each scored, routed, and tracked in a single kanban pipeline.",
  },
  // 1 — Contacts
  {
    headline: "Every contact, complete",
    url: "app.zopkit.com/contacts",
    calloutLabel: "Engaged",
    calloutValue: "24% active",
    calloutColor: VIOLET,
    stat: "1,284 contacts",
    vo: "Full profile, activity timeline, and open deals — no more digging across tools to understand who you're talking to.",
  },
  // 2 — Accounts
  {
    headline: "Group, parent, roll up",
    url: "app.zopkit.com/accounts",
    calloutLabel: "Group Revenue",
    calloutValue: "$4.2M YTD",
    calloutColor: TEAL,
    stat: "412 accounts",
    vo: "Parent-child account hierarchies with revenue and deal rollups — so enterprise reps see the full picture at a glance.",
  },
  // 3 — Opportunities
  {
    headline: "Track every deal to close",
    url: "app.zopkit.com/opportunities",
    calloutLabel: "Win Rate",
    calloutValue: "34%",
    calloutColor: POS,
    stat: "$4.8M weighted",
    vo: "Stage-by-stage pipeline with probability weighting and one-click forecasting — no spreadsheets required.",
  },
  // 4 — Quotations
  {
    headline: "Quotes built, approved, sent",
    url: "app.zopkit.com/quotations",
    calloutLabel: "Quote Total",
    calloutValue: "$12,820",
    calloutColor: PRM,
    stat: "Q-2026-0184",
    vo: "Build multi-line quotes, route for internal approval, and convert to invoice — all in the same system.",
  },
  // 5 — Invoices
  {
    headline: "Revenue recognized on time",
    url: "app.zopkit.com/invoices",
    calloutLabel: "Paid MTD",
    calloutValue: "$420K",
    calloutColor: POS,
    stat: "27-day avg DSO",
    vo: "Invoice status, aging, and collection in one view — so nothing slips past due unnoticed.",
  },
  // 6 — Sales Orders
  {
    headline: "Quote to delivery, tracked",
    url: "app.zopkit.com/orders",
    calloutLabel: "On-Time Rate",
    calloutValue: "96%",
    calloutColor: TEAL,
    stat: "94 open orders",
    vo: "Sales orders flow straight from accepted quotes through picking, shipping, and delivery without leaving Zopkit.",
  },
  // 7 — Approvals
  {
    headline: "Multi-step, fully audited",
    url: "app.zopkit.com/approvals",
    calloutLabel: "Pending for me",
    calloutValue: "16",
    calloutColor: WARN,
    stat: "4.2 hr avg time",
    vo: "Configure approval chains for deals, quotes, and orders — with a full audit trail and real-time notifications.",
  },
  // 8 — Products
  {
    headline: "Catalog synced to every quote",
    url: "app.zopkit.com/products",
    calloutLabel: "In Stock",
    calloutValue: "87%",
    calloutColor: POS,
    stat: "284 SKUs",
    vo: "Products and pricing live in one catalog so your quotes always use the right rate, with real-time stock visibility.",
  },
  // 9 — Tickets
  {
    headline: "Support that stays in context",
    url: "app.zopkit.com/tickets",
    calloutLabel: "SLA Met",
    calloutValue: "97%",
    calloutColor: POS,
    stat: "18 min avg response",
    vo: "Every support ticket links to the account and open deal — so your team sees full customer context at a glance.",
  },
  // 10 — Communications
  {
    headline: "One inbox for every channel",
    url: "app.zopkit.com/communications",
    calloutLabel: "Logged emails",
    calloutValue: "1,284",
    calloutColor: BLUE,
    stat: "All channels unified",
    vo: "Emails, calls, and meetings are logged automatically to the record — no copy-pasting, no missed context.",
  },
  // 11 — Marketing Campaigns
  {
    headline: "Campaigns with deal attribution",
    url: "app.zopkit.com/marketing",
    calloutLabel: "Influenced Rev.",
    calloutValue: "$1.8M",
    calloutColor: VIOLET,
    stat: "428 leads generated",
    vo: "Every lead knows its source — so your marketing team can see which campaigns actually close revenue.",
  },
  // 12 — Webforms
  {
    headline: "Forms that route to records",
    url: "app.zopkit.com/webforms",
    calloutLabel: "Submissions",
    calloutValue: "1,284",
    calloutColor: BLUE,
    stat: "26.8% conversion",
    vo: "Embed a webform and watch leads appear in your pipeline — no manual entry, no Zapier required.",
  },
  // 13 — Cadences
  {
    headline: "Sequences that remember context",
    url: "app.zopkit.com/cadences",
    calloutLabel: "Reply Rate",
    calloutValue: "38%",
    calloutColor: VIOLET,
    stat: "412 enrolled",
    vo: "Multi-step email and call cadences that pause when a prospect replies — and log every touch to the record.",
  },
  // 14 — Bulk Upload
  {
    headline: "Import clean, map fast",
    url: "app.zopkit.com/bulk-upload",
    calloutLabel: "Rows ready",
    calloutValue: "1,284",
    calloutColor: PRM,
    stat: "7 columns auto-mapped",
    vo: "Upload a CSV and Zopkit auto-maps your columns to CRM fields — with duplicate detection before you commit.",
  },
  // 15 — Calendar
  {
    headline: "Meetings linked to records",
    url: "app.zopkit.com/calendar",
    calloutLabel: "This week",
    calloutValue: "12 meetings",
    calloutColor: VIOLET,
    stat: "Synced to all records",
    vo: "Your calendar connects to your CRM — every meeting is linked to the account and deal it belongs to.",
  },
  // 16 — Tasks
  {
    headline: "Follow-ups you won't miss",
    url: "app.zopkit.com/tasks",
    calloutLabel: "Due today",
    calloutValue: "8 tasks",
    calloutColor: WARN,
    stat: "94% follow-up rate",
    vo: "Tasks, calls, and follow-ups are assigned to records with due dates — so nothing falls through between stages.",
  },
  // 17 — Notes
  {
    headline: "Meeting intel, on record",
    url: "app.zopkit.com/notes",
    calloutLabel: "Linked to",
    calloutValue: "$340K deal",
    calloutColor: TEAL,
    stat: "Discovery recap",
    vo: "Notes live on the record, not in someone's notebook — so the whole team stays aligned on what was said.",
  },
  // 18 — Custom Fields
  {
    headline: "Shape data to your process",
    url: "app.zopkit.com/custom-fields",
    calloutLabel: "Custom Fields",
    calloutValue: "18 configured",
    calloutColor: VIOLET,
    stat: "No code required",
    vo: "Add custom fields to any record type and lay them out exactly the way your team works — no developer needed.",
  },
  // 19 — Custom Buttons
  {
    headline: "Automate in one click",
    url: "app.zopkit.com/functions",
    calloutLabel: "Avg runtime",
    calloutValue: "1.2s",
    calloutColor: POS,
    stat: "142 executions today",
    vo: "Write JavaScript functions triggered by a button click on any record — sync to HubSpot, call any API, fire Slack.",
  },
  // 20 — Webhooks
  {
    headline: "Events out, in real time",
    url: "app.zopkit.com/webhooks",
    calloutLabel: "24h deliveries",
    calloutValue: "2,418",
    calloutColor: POS,
    stat: "99.4% success rate",
    vo: "Push CRM events to any external system the moment they happen — no polling, no middleware, just reliable webhooks.",
  },
];

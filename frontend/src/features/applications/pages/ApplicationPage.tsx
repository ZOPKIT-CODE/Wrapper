import {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApplications } from "@/hooks/useApplications";
import { useUserContextSafe } from "@/contexts/UserContextProvider";
import { useAuth } from "@/lib/auth/cognito-auth";
import { LoadingState } from "@/features/applications/components/LoadingState";
import { Application } from "@/types/application";
import { config } from "@/lib/config";
import * as Popover from "@radix-ui/react-popover";

const S = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// ─── Reuse-tracking hook ───────────────────────────────────────────────────────

function useRecentlyUsedApps() {
    const [recentlyUsedApps, setRecentlyUsedApps] = useState<any[]>([])
    useEffect(() => {
        const stored = localStorage.getItem('recentlyUsedApps')
        if (stored) {
            try { setRecentlyUsedApps(JSON.parse(stored)) } catch { /* ignore */ }
        }
    }, [])
    const trackAppUsage = useCallback((app: any) => {
        setRecentlyUsedApps(current => {
            const appId = app.appId || app.id
            const filtered = current.filter(i => i.appId !== appId)
            const updated = [
                { appId, appData: app, lastUsed: Date.now(), usageCount: (current.find(i => i.appId === appId)?.usageCount || 0) + 1 },
                ...filtered.slice(0, 9),
            ]
            localStorage.setItem('recentlyUsedApps', JSON.stringify(updated))
            return updated
        })
    }, [])
    return { recentlyUsedApps, trackAppUsage }
}

// ─── Interactive-state styles ───────────────────────────────────────────────────
// Hover/focus live in CSS (not React state) so pointer movement never triggers a
// re-render — the page stays smooth no matter how many cards are on screen.
// Transitions are colour/border/background only and capped at 120ms; there are no
// transforms, keyframes, or motion. prefers-reduced-motion removes them entirely.

const STYLES = `
.zkm-root, .zkm-root *, .zkm-pop, .zkm-pop * { box-sizing: border-box; }
.zkm-root :focus-visible { outline: 2px solid #2754c5; outline-offset: 2px; }

.zkm-hero { padding: 90px 64px 150px; }
.zkm-herogrid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.05fr); gap: 56px; align-items: center; max-width: 1280px; margin: 0 auto; position: relative; z-index: 1; }
.zkm-h1 { font-size: 56px; }
.zkm-section { padding: 36px 64px 100px; }
@media (max-width: 980px) {
  .zkm-hero { padding: 56px 28px 110px; }
  .zkm-herogrid { grid-template-columns: 1fr; gap: 36px; }
  .zkm-section { padding: 28px 28px 72px; }
  .zkm-h1 { font-size: 44px; }
}
@media (max-width: 560px) {
  .zkm-hero { padding: 40px 18px 86px; }
  .zkm-section { padding: 22px 18px 56px; }
  .zkm-h1 { font-size: 34px; }
}

.zkm-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 20px; }
@media (max-width: 1120px) { .zkm-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 720px) { .zkm-grid { grid-template-columns: 1fr; } }

.zkm-card { position: relative; display: grid; grid-template-columns: 174px 1fr; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; min-height: 174px; cursor: pointer; box-shadow: 0 1px 0 rgba(15,28,58,0.03); transition: border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease; color: inherit; }
.zkm-card:hover, .zkm-card:focus-visible { border-color: #cbd2dc; box-shadow: 0 4px 20px rgba(15,28,58,0.08); }
@media (max-width: 560px) { .zkm-card { grid-template-columns: 120px 1fr; } }

.zkm-iconbtn { transition: background-color 120ms ease, color 120ms ease; }
.zkm-iconbtn:hover, .zkm-iconbtn[data-state="open"] { background: #e4e9f8; color: #1e3a8a; }

.zkm-cta { transition: background-color 120ms ease, border-color 120ms ease; }
.zkm-cta:hover { background: #1e3a8a; border-color: #1e3a8a; }

.zkm-search { transition: border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease; }
.zkm-search:focus-within { border-color: #2754c5; box-shadow: 0 0 0 3px rgba(39,84,197,0.12); background: #fff; }
.zkm-searchinput { border: none; outline: none; background: transparent; }

.zkm-chip { transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease; }
.zkm-chip:hover { background: #e9eefb; border-color: #c7d2ec; }
.zkm-chip[aria-pressed="true"] { background: #142a5e; color: #fff; border-color: #142a5e; }

.zkm-tab { transition: background-color 120ms ease, color 120ms ease; }
.zkm-tab:hover { color: #0b1220; }
.zkm-tab[aria-selected="true"] { background: #fff; color: #0b1220; border-color: #e2e4ea; }

.zkm-quick { transition: background-color 120ms ease, border-color 120ms ease; }
.zkm-quick:hover { background: #eef2fb; border-color: #c7d2ec; }

.zkm-input { transition: border-color 120ms ease, box-shadow 120ms ease; }
.zkm-input:focus-within { border-color: #2754c5; box-shadow: 0 0 0 3px rgba(39,84,197,0.12); }
.zkm-textinput { border: none; outline: none; background: transparent; }

.zkm-send { transition: background-color 120ms ease; }
.zkm-send:hover { background: #1e3a8a; }
.zkm-send:disabled { background: #cbd5e1; cursor: not-allowed; }

.zkm-pop { transition: none; }
.zkm-popbtn { transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease; }
.zkm-popbtn-primary:hover { background: #1e3a8a; }
.zkm-popbtn-ghost:hover { background: #f1f5f9; }

@media (prefers-reduced-motion: reduce) {
  .zkm-root *, .zkm-pop * { transition: none !important; }
}
`;

let stylesInjected = false;
function useMarketplaceStyles() {
    // Inject once per document — cheaper than a <style> per card and avoids
    // duplicate rules across re-mounts.
    useEffect(() => {
        if (stylesInjected) return;
        const el = document.createElement("style");
        el.setAttribute("data-zkm", "marketplace");
        el.textContent = STYLES;
        document.head.appendChild(el);
        stylesInjected = true;
    }, []);
}

// ─── SVG icon components ───────────────────────────────────────────────────────

const IconCRM = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 19c1-2.6 3.2-4 6-4s5 1.4 6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15 18.5c.5-1.8 2-2.8 3.5-2.8s3 1 3.5 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconFinance = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 14h4M7 16.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16.5" cy="15" r="1.4" fill="currentColor" />
    </svg>
)
const IconHR = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 20c1-3.4 4-5 7.5-5s6.5 1.6 7.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconInventory = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 12v8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)
const IconProcurement = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h2.5l2 10h10l2-7H8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="10" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17" cy="19.5" r="1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)
const IconHelpdesk = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 18V9a7 7 0 1 1 14 0v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="3" y="13" width="4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
        <rect x="17" y="13" width="4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19 19v.5a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
)
const IconDefault = () => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
)

// ─── Per-app style mapping ─────────────────────────────────────────────────────

interface AppStyle {
    glyphBg: string
    icon: ReactNode
    chip: string
    foot: string
}

const APP_STYLES: Record<string, AppStyle> = {
    crm: {
        glyphBg: 'linear-gradient(160deg, #1e3a8a 0%, #142a5e 100%)',
        icon: <IconCRM />,
        chip: 'Sales',
        foot: 'Included with workspace',
    },
    // Real appCode from API is 'accounting'
    accounting: {
        glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)',
        icon: <IconFinance />,
        chip: 'Finance',
        foot: 'Included with workspace',
    },
    financialaccounting: {
        glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)',
        icon: <IconFinance />,
        chip: 'Finance',
        foot: 'Included with workspace',
    },
    hr: {
        glyphBg: 'linear-gradient(150deg, #ff7a3d 0%, #e85a1c 100%)',
        icon: <IconHR />,
        chip: 'HR',
        foot: 'Included with workspace',
    },
    inventory: {
        glyphBg: '#0b1220',
        icon: <IconInventory />,
        chip: 'Operations',
        foot: 'Included with workspace',
    },
    procurement: {
        glyphBg: 'linear-gradient(160deg, #6c5ce7 0%, #4c3bbf 100%)',
        icon: <IconProcurement />,
        chip: 'Operations',
        foot: 'Included with workspace',
    },
    helpdesk: {
        glyphBg: 'linear-gradient(160deg, #be185d 0%, #831843 100%)',
        icon: <IconHelpdesk />,
        chip: 'Support',
        foot: 'Included with workspace',
    },
}

const FALLBACK_GLYPHS: AppStyle[] = [
    { glyphBg: 'linear-gradient(160deg, #1e3a8a 0%, #142a5e 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
    { glyphBg: 'linear-gradient(160deg, #0e7a6f 0%, #06544c 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
    { glyphBg: 'linear-gradient(150deg, #ff7a3d 0%, #e85a1c 100%)', icon: <IconDefault />, chip: 'Business Suite', foot: 'Included with workspace' },
]

function getAppStyle(appCode: string, index: number): AppStyle {
    const key = appCode.toLowerCase().replace(/[^a-z]/g, '')
    return APP_STYLES[key] ?? FALLBACK_GLYPHS[index % FALLBACK_GLYPHS.length]
}

// ─── Resolve app launch URL (mirrors ApplicationDetailsPage logic) ─────────────

function getAppLaunchUrl(application: Application): string {
    if (application.baseUrl) return application.baseUrl
    const origin = window.location.origin
    const patterns: Record<string, string> = {
        crm: config.CRM_DOMAIN,
        hr: `${origin}/hr`,
        affiliateconnect: `${origin}/affiliate`,
    }
    const key = (application.appCode || '').toLowerCase().replace(/[^a-z]/g, '')
    return patterns[key] || `${origin}/apps/${application.appCode}`
}

function launchHost(application: Application): string {
    try {
        return new URL(getAppLaunchUrl(application)).host
    } catch {
        return ''
    }
}

// ─── Interactive hero agent demo (no animation, instant canned replies) ────────
// A self-contained, illustrative chat surface: switch app tabs, click a quick
// action, or type a prompt — every response is rendered synchronously. There are
// no timers, intervals, or transitions, so it adds zero ongoing work to the page.

type Reply =
    | { kind: "text"; text: string }
    | { kind: "bullets"; title?: string; items: string[] }
    | { kind: "table"; title?: string; columns: string[]; rows: string[][]; badgeCol?: number; note?: string }

interface ChatMessage { id: number; role: "user" | "assistant"; reply: Reply }

interface Scenario {
    id: string
    tab: string
    url: string
    intro: Reply
    quick: string[]
    respond: (prompt: string) => Reply
}

const PIPELINE_ROWS: string[][] = [
    ["1", "Prospecting", "Active"],
    ["2", "Qualification", "Active"],
    ["3", "Demo Scheduled", "Active"],
    ["4", "Proposal Sent", "Active"],
    ["5", "Negotiation", "Negotiation"],
    ["6", "Closed Won", "Won"],
    ["7", "Closed Lost", "Lost"],
]

const INVOICE_ROWS: string[][] = [
    ["#1041", "Acme Corp", "$12,400", "12d"],
    ["#1038", "Globex", "$8,950", "21d"],
    ["#1032", "Initech", "$3,200", "34d"],
]

function crmRespond(prompt: string): Reply {
    const p = prompt.toLowerCase()
    if (/pipe|stage|summar|overview/.test(p))
        return { kind: "table", title: "Sales pipeline", columns: ["#", "Stage", "Status"], rows: PIPELINE_ROWS, badgeCol: 2, note: "7 stages · 42 open opportunities · $1.2M weighted" }
    if (/stuck|stall|stale|idle|risk/.test(p))
        return { kind: "bullets", title: "3 deals stalled over 14 days", items: ["Acme Corp — Negotiation · 18d no activity", "Globex — Proposal Sent · 21d no activity", "Initech — Demo Scheduled · 16d no activity"] }
    if (/follow|draft|email|reply|message/.test(p))
        return { kind: "text", text: "Drafted a follow-up to Acme Corp: “Hi Dana — circling back on the proposal we sent on the 12th. Happy to walk your team through pricing this week. Does Thursday at 2pm work?”" }
    if (/lead|contact|create|add|new/.test(p))
        return { kind: "text", text: "Created lead “New Lead” in Prospecting and assigned it to you. Want me to attach a contact and a first task?" }
    return { kind: "text", text: `On it. For “${prompt}” I can summarize the pipeline, surface stalled deals, draft a follow-up, or create a lead — just pick one or ask.` }
}

function acctRespond(prompt: string): Reply {
    const p = prompt.toLowerCase()
    if (/cash|balance|position|runway/.test(p))
        return { kind: "bullets", title: "Cash position — today", items: ["Operating account: $248,300", "Reserve: $120,000", "Expected Net-30 inflows: $86,400"] }
    if (/overdue|invoice|receivable|\bar\b|owed/.test(p))
        return { kind: "table", title: "Overdue invoices", columns: ["Invoice", "Customer", "Amount", "Overdue"], rows: INVOICE_ROWS, note: "3 invoices · $24,550 outstanding" }
    if (/p&l|pnl|profit|loss|p and l|summar|income|statement/.test(p))
        return { kind: "bullets", title: "P&L — last month", items: ["Revenue: $412,000", "COGS: $173,000", "Operating expenses: $128,000", "Net income: $111,000 (+9% MoM)"] }
    if (/payroll|salary|wages|pay run/.test(p))
        return { kind: "text", text: "Drafted payroll for 24 employees — $96,200 gross, $71,540 net. Nothing is submitted yet; review and approve when you’re ready." }
    return { kind: "text", text: `Sure. For “${prompt}” I can show the cash position, overdue invoices, a P&L summary, or draft payroll — choose one or ask.` }
}

const CRM_SCENARIO: Scenario = {
    id: "crm",
    tab: "CRM",
    url: "app.zopkit.com/crm",
    intro: { kind: "text", text: "Hi — I’m your Zopkit agent for CRM. Ask about your pipeline, deals, or contacts." },
    quick: ["Summarize pipeline", "Stuck deals", "Draft follow-up", "Create lead"],
    respond: crmRespond,
}

const ACCT_SCENARIO: Scenario = {
    id: "acct",
    tab: "Accounting",
    url: "app.zopkit.com/accounting",
    intro: { kind: "text", text: "I’m your Accounting agent. Ask about cash, invoices, P&L, or payroll." },
    quick: ["Cash position", "Overdue invoices", "P&L summary", "Run payroll"],
    respond: acctRespond,
}

function buildScenarios(applications: Application[]): Scenario[] {
    const made: Scenario[] = []
    const seen = new Set<string>()
    for (const app of applications) {
        const key = (app.appCode || "").toLowerCase().replace(/[^a-z]/g, "")
        if (key.includes("crm") && !seen.has("crm")) {
            made.push({ ...CRM_SCENARIO, tab: app.appName || CRM_SCENARIO.tab })
            seen.add("crm")
        } else if ((key.includes("account") || key.includes("finance")) && !seen.has("acct")) {
            made.push({ ...ACCT_SCENARIO, tab: app.appName || ACCT_SCENARIO.tab })
            seen.add("acct")
        }
        if (made.length >= 3) break
    }
    if (made.length === 0) return [CRM_SCENARIO, ACCT_SCENARIO]
    return made
}

function badgeColors(value: string): [string, string] {
    const t = value.toLowerCase()
    if (t === "won") return ["#059669", "#d1fae5"]
    if (t === "lost") return ["#dc2626", "#fee2e2"]
    if (t === "negotiation") return ["#d97706", "#fef3c7"]
    return ["#16a34a", "#dcfce7"]
}

const ReplyBody = memo(function ReplyBody({ reply }: { reply: Reply }) {
    if (reply.kind === "text") {
        return <span>{reply.text}</span>
    }
    if (reply.kind === "bullets") {
        return (
            <div>
                {reply.title && <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>{reply.title}</div>}
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                    {reply.items.map((item, i) => (
                        <li key={i} style={{ paddingLeft: 14, position: "relative", lineHeight: 1.5 }}>
                            <span style={{ position: "absolute", left: 0, color: "#94a3b8" }}>•</span>
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
    // table
    return (
        <div>
            {reply.title && <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>{reply.title}</div>}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                <div style={{ display: "flex", padding: "5px 10px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {reply.columns.map((c, i) => (
                        <span key={i} style={{ flex: i === 0 ? "0 0 34px" : 1, fontSize: 9.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{c}</span>
                    ))}
                </div>
                {reply.rows.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", alignItems: "center", padding: "5px 10px", background: ri % 2 ? "#f8faff" : "#fff", borderBottom: ri < reply.rows.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        {row.map((cell, ci) => {
                            const isBadge = reply.badgeCol === ci
                            if (isBadge) {
                                const [fg, bg] = badgeColors(cell)
                                return (
                                    <span key={ci} style={{ flex: 1, display: "flex" }}>
                                        <span style={{ background: bg, color: fg, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{cell}</span>
                                    </span>
                                )
                            }
                            return (
                                <span key={ci} style={{ flex: ci === 0 ? "0 0 34px" : 1, fontSize: 11, color: ci === 0 ? "#94a3b8" : "#0f172a", fontWeight: ci === 1 ? 500 : 400 }}>{cell}</span>
                            )
                        })}
                    </div>
                ))}
            </div>
            {reply.note && <div style={{ marginTop: 6, fontSize: 10.5, color: "#94a3b8" }}>{reply.note}</div>}
        </div>
    )
})

const MessageRow = memo(function MessageRow({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user"
    return (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexDirection: isUser ? "row-reverse" : "row" }}>
            <div aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 9, fontWeight: 800, background: isUser ? "#142a5e" : "#7c3aed" }}>
                {isUser ? "You" : "Z"}
            </div>
            <div style={{
                maxWidth: "82%",
                fontSize: 11.5,
                lineHeight: 1.5,
                padding: "8px 11px",
                borderRadius: isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                background: isUser ? "#142a5e" : "#f4f6fb",
                color: isUser ? "#fff" : "#334155",
                border: isUser ? "none" : "1px solid #eef0f5",
            }}>
                <ReplyBody reply={message.reply} />
            </div>
        </div>
    )
})

const HeroAgentDemo = memo(function HeroAgentDemo({ scenarios }: { scenarios: Scenario[] }) {
    const [tab, setTab] = useState(0)
    const scenario = scenarios[tab] ?? scenarios[0]
    const idRef = useRef(0)
    const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: 0, role: "assistant", reply: scenarios[0].intro }])
    const [input, setInput] = useState("")
    const threadRef = useRef<HTMLDivElement>(null)

    const nextId = () => (idRef.current += 1)

    const selectTab = useCallback((i: number) => {
        setTab(i)
        idRef.current = 0
        setMessages([{ id: 0, role: "assistant", reply: scenarios[i].intro }])
        setInput("")
    }, [scenarios])

    const send = useCallback((raw: string) => {
        const text = raw.trim()
        if (!text) return
        setMessages(prev => [
            ...prev,
            { id: nextId(), role: "user", reply: { kind: "text", text } },
            { id: nextId(), role: "assistant", reply: scenario.respond(text) },
        ])
        setInput("")
    }, [scenario])

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault()
        send(input)
    }, [input, send])

    // Keep the newest message in view. Instant (no smooth behaviour) so there is
    // no scroll animation and no layout jank.
    useLayoutEffect(() => {
        const el = threadRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages])

    return (
        <div style={{ width: "100%", maxWidth: 640, marginLeft: "auto" }}>
            <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 0 rgba(15,28,58,0.04), 0 24px 60px rgba(15,28,58,0.12), 0 8px 20px rgba(15,28,58,0.05)", overflow: "hidden", border: "1px solid #e2e4ea" }}>
                {/* macOS title bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#f0f1f4", borderBottom: "1px solid #e2e4ea" }}>
                    <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff605c", display: "inline-block" }} />
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd44", display: "inline-block" }} />
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#00ca4e", display: "inline-block" }} />
                    </div>
                    <div style={{ flex: 1, height: 22, background: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b7280", border: "1px solid #e2e4ea" }}>
                        {scenario.url}
                    </div>
                </div>

                {/* App tabs — switch the agent context instantly */}
                {scenarios.length > 1 && (
                    <div role="tablist" aria-label="Demo app" style={{ display: "flex", gap: 4, padding: "8px 12px 0", background: "#f0f1f4" }}>
                        {scenarios.map((sc, i) => (
                            <button
                                key={sc.id}
                                role="tab"
                                aria-selected={i === tab}
                                tabIndex={i === tab ? 0 : -1}
                                className="zkm-tab"
                                onClick={() => selectTab(i)}
                                style={{
                                    border: "1px solid transparent",
                                    borderBottom: "none",
                                    background: i === tab ? "#fff" : "transparent",
                                    color: i === tab ? "#0b1220" : "#6b7280",
                                    fontFamily: S,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    padding: "6px 12px",
                                    borderRadius: "6px 6px 0 0",
                                    cursor: "pointer",
                                }}
                            >
                                {sc.tab}
                            </button>
                        ))}
                    </div>
                )}

                {/* Chat surface */}
                <div style={{ display: "flex", flexDirection: "column", height: 320, background: "#fff" }}>
                    <div style={{ height: 32, display: "flex", alignItems: "center", gap: 6, padding: "0 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} aria-hidden="true" />
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b" }}>connected</span>
                        <span style={{ color: "#e2e8f0" }} aria-hidden="true">·</span>
                        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>live data</span>
                    </div>

                    <div
                        ref={threadRef}
                        role="log"
                        aria-live="polite"
                        aria-label="Agent conversation"
                        style={{ flex: 1, overflowY: "auto", padding: "12px 14px 4px" }}
                    >
                        {messages.map(m => <MessageRow key={m.id} message={m} />)}
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 12px 4px", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
                        {scenario.quick.map(q => (
                            <button
                                key={q}
                                type="button"
                                className="zkm-quick"
                                onClick={() => send(q)}
                                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 100, padding: "3px 10px", fontFamily: S, fontSize: 10.5, fontWeight: 500, color: "#475569", whiteSpace: "nowrap", cursor: "pointer" }}
                            >
                                + {q}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <form onSubmit={onSubmit} style={{ padding: "6px 12px 10px", flexShrink: 0 }}>
                        <div className="zkm-input" style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 6px 5px 11px", background: "#fafafa" }}>
                            <input
                                className="zkm-textinput"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask about a deal, an invoice — or type a request"
                                aria-label="Message the Zopkit agent"
                                style={{ flex: 1, fontFamily: S, fontSize: 11.5, color: "#0f172a", minWidth: 0 }}
                            />
                            <button
                                type="submit"
                                className="zkm-send"
                                disabled={!input.trim()}
                                aria-label="Send message"
                                style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: input.trim() ? "#142a5e" : "#cbd5e1", color: "#fff", display: "grid", placeItems: "center", cursor: input.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
})

// ─── Marketplace app card ──────────────────────────────────────────────────────

interface CardProps {
    application: Application
    index: number
    onLaunch: (app: Application) => void
    onDetails: (app: Application) => void
    canManage: boolean
}

const MarketplaceCard = memo(function MarketplaceCard({ application, index, onLaunch, onDetails, canManage }: CardProps) {
    const style = getAppStyle(application.appCode || '', index)
    const host = launchHost(application)
    const moduleCount = application.enabledModules?.length ?? 0

    const launch = useCallback(() => onLaunch(application), [onLaunch, application])

    const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            launch()
        }
    }, [launch])

    const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

    return (
        <div
            className="zkm-card"
            role="button"
            tabIndex={0}
            aria-label={`Open ${application.appName}`}
            onClick={launch}
            onKeyDown={onKeyDown}
            style={{ fontFamily: S }}
        >
            {/* Icon column */}
            <div style={{ background: '#eef1fb', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 78, height: 78, borderRadius: 14, background: style.glyphBg, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
                    {style.icon}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 16px 16px 22px', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
                {/* Info popover — available to everyone */}
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button
                            type="button"
                            className="zkm-iconbtn"
                            aria-label={`About ${application.appName}`}
                            onClick={stop}
                            onKeyDown={stop}
                            style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                <circle cx="12" cy="7.5" r="1" fill="currentColor" />
                            </svg>
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content
                            className="zkm-pop"
                            side="bottom"
                            align="end"
                            sideOffset={8}
                            collisionPadding={12}
                            onClick={stop}
                            style={{ zIndex: 200, width: 288, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 40px rgba(15,28,58,0.16)', padding: 16, fontFamily: S, color: '#0b1220' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: style.glyphBg, display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
                                    <span style={{ display: 'grid', placeItems: 'center', transform: 'scale(0.55)', transformOrigin: 'center' }}>{style.icon}</span>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.005em', lineHeight: 1.2 }}>{application.appName}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280' }}>{style.chip}</div>
                                </div>
                            </div>

                            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>
                                {application.description || 'Access and manage this application from your workspace.'}
                            </p>

                            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11.5 }}>
                                <div>
                                    <div style={{ color: '#9ca3af', marginBottom: 2 }}>Status</div>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: application.isEnabled ? '#16a34a' : '#d97706' }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} aria-hidden="true" />
                                        {application.isEnabled ? 'Enabled' : 'Disabled'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: '#9ca3af', marginBottom: 2 }}>Modules</div>
                                    <div style={{ fontWeight: 600, color: '#0b1220' }}>{moduleCount > 0 ? moduleCount : '—'}</div>
                                </div>
                                {host && (
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ color: '#9ca3af', marginBottom: 2 }}>Opens at</div>
                                        <div style={{ fontWeight: 600, color: '#0b1220', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{host}</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <Popover.Close asChild>
                                    <button
                                        type="button"
                                        className="zkm-popbtn zkm-popbtn-primary"
                                        onClick={launch}
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', background: '#142a5e', color: '#fff', fontFamily: S, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Open app
                                    </button>
                                </Popover.Close>
                                {canManage && (
                                    <Popover.Close asChild>
                                        <button
                                            type="button"
                                            className="zkm-popbtn zkm-popbtn-ghost"
                                            onClick={() => onDetails(application)}
                                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontFamily: S, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Manage
                                        </button>
                                    </Popover.Close>
                                )}
                            </div>
                            <Popover.Arrow style={{ fill: '#fff' }} width={14} height={7} />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>

                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0b1220', letterSpacing: '-0.005em', margin: '0 0 8px', paddingRight: 36 }}>
                    {application.appName}
                </h3>
                <span style={{ display: 'inline-block', background: '#e4e9f8', color: '#1e3a8a', fontSize: 11.5, fontWeight: 500, padding: '3px 8px', borderRadius: 3, marginBottom: 12, alignSelf: 'flex-start' }}>
                    {style.chip}
                </span>
                <p style={{ fontSize: 13.5, color: '#1f2937', lineHeight: 1.45, margin: '0 0 auto' }}>
                    {application.description || 'Access and manage this application from your workspace.'}
                </p>
                <div style={{ fontSize: 12.5, color: '#6b7280', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {style.foot}
                </div>
            </div>
        </div>
    )
})

// ─── Available-apps section (search + category filter) ─────────────────────────

interface IndexedApp { app: Application; index: number; chip: string }

function AvailableApps({ applications, companyName, onLaunch, onDetails, canManage }: {
    applications: Application[]
    companyName: string
    onLaunch: (app: Application) => void
    onDetails: (app: Application) => void
    canManage: boolean
}) {
    const [query, setQuery] = useState("")
    const [category, setCategory] = useState("All")

    const indexed = useMemo<IndexedApp[]>(
        () => applications.map((app, index) => ({ app, index, chip: getAppStyle(app.appCode || '', index).chip })),
        [applications],
    )

    const categories = useMemo(
        () => ["All", ...Array.from(new Set(indexed.map(x => x.chip)))],
        [indexed],
    )

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return indexed.filter(({ app, chip }) => {
            if (category !== "All" && chip !== category) return false
            if (!q) return true
            return (
                (app.appName || '').toLowerCase().includes(q) ||
                (app.description || '').toLowerCase().includes(q) ||
                (app.appCode || '').toLowerCase().includes(q) ||
                chip.toLowerCase().includes(q)
            )
        })
    }, [indexed, query, category])

    const total = applications.length
    const showControls = total >= 2
    const showCategories = categories.length > 2 // more than just "All" + one
    const isFiltering = query.trim() !== "" || category !== "All"

    const clear = useCallback(() => { setQuery(""); setCategory("All") }, [])

    return (
        <section id="apps" className="zkm-section" style={{ background: '#fff' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: '#0b1220', margin: '0 0 6px' }}>
                            Available apps
                        </h2>
                        <p style={{ fontSize: 14, color: '#4b5563', margin: 0 }} aria-live="polite">
                            {isFiltering
                                ? `Showing ${filtered.length} of ${total} app${total !== 1 ? 's' : ''}`
                                : `${total} module${total !== 1 ? 's' : ''} in your ${companyName} workspace.`}
                        </p>
                    </div>

                    {showControls && (
                        <div className="zkm-search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', minWidth: 240 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9ca3af', flexShrink: 0 }}>
                                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <input
                                className="zkm-searchinput"
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search apps"
                                aria-label="Search apps"
                                style={{ fontFamily: S, fontSize: 13.5, color: '#0b1220', width: 180 }}
                            />
                        </div>
                    )}
                </div>

                {showControls && showCategories && (
                    <div role="group" aria-label="Filter by category" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                className="zkm-chip"
                                aria-pressed={category === cat}
                                onClick={() => setCategory(cat)}
                                style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontFamily: S, fontSize: 12.5, fontWeight: 500, padding: '6px 14px', borderRadius: 100, cursor: 'pointer' }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {filtered.length > 0 ? (
                    <div className="zkm-grid">
                        {filtered.map(({ app, index }) => (
                            <MarketplaceCard
                                key={app.appId}
                                application={app}
                                index={index}
                                onLaunch={onLaunch}
                                onDetails={onDetails}
                                canManage={canManage}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '56px 24px', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 10, color: '#6b7280' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No apps match your search</div>
                        <div style={{ fontSize: 13.5, marginBottom: 16 }}>Try a different term or category.</div>
                        <button
                            type="button"
                            className="zkm-cta"
                            onClick={clear}
                            style={{ padding: '9px 18px', borderRadius: 6, border: '1px solid #142a5e', background: '#142a5e', color: '#fff', fontFamily: S, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}

// ─── Full marketplace view ────────────────────────────────────────────────────

function InvitedMarketplaceView({ applications, onLaunch, onDetails }: {
    applications: Application[]
    onLaunch: (app: Application) => void
    onDetails: (app: Application) => void
}) {
    useMarketplaceStyles()

    const ctx = useUserContextSafe()
    const { user: idpUser } = useAuth()
    const navigate = useNavigate()

    const user = ctx?.user ?? null
    const tenant = ctx?.tenant ?? null

    const isTenantAdmin = user?.isTenantAdmin ?? false

    // Prefer Kinde's explicit name fields (givenName + familyName) over user.name
    // which can hold the company/account name instead of the person's name.
    const idpFullName = [idpUser?.givenName, idpUser?.familyName].filter(Boolean).join(' ')
    const fullName = idpFullName || user?.name || idpUser?.email?.split('@')[0] || 'there'

    const companyName = tenant?.companyName || 'Zopkit'

    const timeGreeting = useMemo(() => {
        const hour = new Date().getHours()
        return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    }, [])

    const scenarios = useMemo(() => buildScenarios(applications), [applications])

    return (
        <div className="zkm-root" style={{ fontFamily: S, color: '#0b1220', background: '#fff', WebkitFontSmoothing: 'antialiased', fontSize: 15, lineHeight: 1.5 }}>
            {/* ── Hero band ── */}
            <section className="zkm-hero" style={{ position: 'relative', background: 'radial-gradient(900px 480px at 92% 30%, #e2eefc 0%, transparent 60%), linear-gradient(180deg, #f5faff 0%, #eaf3fd 90%)', overflow: 'hidden' }}>
                {/* Curved white bottom */}
                <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: -180, height: 300, background: '#fff', borderRadius: '50%', zIndex: 0 }} aria-hidden="true" />

                <div className="zkm-herogrid">
                    {/* Left: copy */}
                    <div>
                        <div style={{ marginBottom: 22 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#0b1220', textTransform: 'uppercase' }}>
                                Welcome to <span style={{ color: '#142a5e' }}>{companyName} Marketplace</span>
                            </span>
                        </div>

                        <h1 className="zkm-h1" style={{ fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.025em', color: '#0b1220', margin: '0 0 10px' }}>
                            {timeGreeting}, {fullName}.
                        </h1>

                        <p style={{ fontWeight: 600, fontSize: 20, lineHeight: 1.3, color: '#142a5e', letterSpacing: '-0.01em', margin: '0 0 18px' }}>
                            The unified suite your business runs on.
                        </p>

                        <p style={{ color: '#1f2937', fontSize: 15, lineHeight: 1.6, maxWidth: 460, margin: '0 0 36px' }}>
                            Zopkit brings your entire operational stack together — scalable, secure, and purpose-built for running every part of your business from a single workspace.
                        </p>

                        {isTenantAdmin && (
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    type="button"
                                    className="zkm-cta"
                                    onClick={() => navigate({ to: '/dashboard/organization' })}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 26px', borderRadius: 4, cursor: 'pointer', background: '#142a5e', color: '#fff', border: '1.5px solid #142a5e', minWidth: 200 }}
                                >
                                    Admin Console →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: interactive agent demo */}
                    <HeroAgentDemo scenarios={scenarios} />
                </div>
            </section>

            {/* ── Available apps ── */}
            <AvailableApps
                applications={applications}
                companyName={companyName}
                onLaunch={onLaunch}
                onDetails={onDetails}
                canManage={isTenantAdmin}
            />
        </div>
    )
}

// ─── Main page component ───────────────────────────────────────────────────────

export function ApplicationPage() {
    const { applications, isLoading } = useApplications();
    const navigate = useNavigate();
    const { trackAppUsage } = useRecentlyUsedApps();

    const handleLaunch = useCallback((app: Application) => {
        trackAppUsage(app)
        const url = getAppLaunchUrl(app)
        window.open(url, '_blank', 'noopener,noreferrer')
    }, [trackAppUsage])

    const handleDetails = useCallback((app: Application) => {
        navigate({ to: `/dashboard/applications/${app.appId}` })
    }, [navigate])

    if (isLoading) return <LoadingState />;

    return <InvitedMarketplaceView applications={applications} onLaunch={handleLaunch} onDetails={handleDetails} />;
}

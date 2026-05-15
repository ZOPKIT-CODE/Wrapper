// CRM product page SVG illustrations
// Visual style matches getFAFeatureSvg() — 800×480 viewBox, collapsed nav rail,
// header bar, KPI cards, tables, status pills. Same design tokens.

import React from 'react';

export function getCRMFeatureSvg(i: number): React.ReactNode {
    // Design tokens — mirror FA brief
    const NAV = "#0d1f3a";
    const W = "#FFFFFF";
    const BD = "#E2E8F0";
    const H = "#0F172A";
    const M = "#64748B";
    const PRM = "#1B2E5A";
    const POS = "#10B981";
    const WARN = "#F59E0B";
    const NEG = "#EF4444";
    const ff = "system-ui,-apple-system,sans-serif";

    // 28px collapsed sidebar
    const Sb = () => (
        <g>
            <rect width="28" height="480" fill={NAV} />
            <rect x="7" y="8" width="14" height="14" rx="3" fill="#3B82F6" />
            {[0, 1, 2, 3, 4].map((j) => (
                <g key={j}>
                    <rect x="8" y={34 + j * 36} width="12" height="2.5" rx="1.25" fill="rgba(255,255,255,0.25)" />
                    <rect x="8" y={39.5 + j * 36} width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.12)" />
                </g>
            ))}
            <circle cx="14" cy="462" r="7" fill="rgba(255,255,255,0.12)" />
        </g>
    );

    // Header bar
    const Hdr = (title: string, crumb: string, btn?: string) => (
        <g>
            <rect x="28" y="0" width="772" height="44" fill={W} />
            <line x1="28" y1="44" x2="800" y2="44" stroke={BD} strokeWidth="0.5" />
            <text x="40" y="18" fontFamily={ff} fontSize="13" fontWeight="700" fill={H}>{title}</text>
            <text x="40" y="34" fontFamily={ff} fontSize="9" fill={M}>{crumb}</text>
            {btn && (
                <>
                    <rect x={796 - btn.length * 6 - 14} y="11" width={btn.length * 6 + 14} height="22" rx="5" fill={PRM} />
                    <text x={796 - btn.length * 3} y="25" fontFamily={ff} fontSize="9" fontWeight="600" fill={W} textAnchor="middle">{btn}</text>
                </>
            )}
        </g>
    );

    // 4-wide KPI
    const K4 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
        <g key={`k${x}`}>
            <rect x={x} y={y} width="182" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1" />
            <text x={x + 12} y={y + 15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
            <text x={x + 12} y={y + 39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
            <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
        </g>
    );

    // 3-wide KPI
    const K3 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
        <g key={`k${x}`}>
            <rect x={x} y={y} width="245" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1" />
            <text x={x + 12} y={y + 15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
            <text x={x + 12} y={y + 39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
            <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
        </g>
    );

    // Status pill
    const Pill = (x: number, y: number, text: string, bg: string, tc: string, pw = 44) => (
        <g key={`p${x}${y}`}>
            <rect x={x} y={y - 11} width={pw} height="15" rx="7" fill={bg} />
            <text x={x + pw / 2} y={y + 1} fontFamily={ff} fontSize="8.5" fontWeight="600" fill={tc} textAnchor="middle">{text}</text>
        </g>
    );

    const ThRow = (y: number, x = 36, w = 752) => (
        <rect x={x} y={y} width={w} height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
    );

    const Tr = (y: number, even: boolean, x = 36, w = 752) => (
        <rect x={x} y={y} width={w} height="32" rx="3" fill={even ? W : "#F8FAFC"} stroke={BD} strokeWidth="0.5" />
    );

    const T = (x: number, y: number, txt: string, sz = 9.5, bold = false, color = H, anchor: "start" | "middle" | "end" = "start") => (
        <text key={`t${x}${y}${txt.slice(0, 8)}`} x={x} y={y} fontFamily={ff} fontSize={sz} fontWeight={bold ? "700" : "400"} fill={color} textAnchor={anchor}>{txt}</text>
    );

    // Avatar circle with initials
    const Avatar = (cx: number, cy: number, ini: string, col: string, r = 9) => (
        <g key={`a${cx}${cy}${ini}`}>
            <circle cx={cx} cy={cy} r={r} fill={col} opacity="0.15" />
            <text x={cx} y={cy + 3} fontFamily={ff} fontSize={r * 0.85} fontWeight="700" fill={col} textAnchor="middle">{ini}</text>
        </g>
    );

    switch (i) {

        // ── 0. Leads — kanban pipeline ─────────────────────────────────────
        case 0: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Leads", "47 active leads · $2.4M weighted pipeline", "+ Add Lead")}
                {K4(36, 52, "TOTAL LEADS", "47", "12 new this week")}
                {K4(226, 52, "QUALIFIED", "18", "38% qualification rate", POS)}
                {K4(416, 52, "AVG SCORE", "72", "+5 vs last week", POS)}
                {K4(606, 52, "PIPELINE VALUE", "$2.4M", "Weighted forecast")}
                {/* Kanban columns */}
                {([
                    { name: "New", count: "15", color: "#3B82F6", bg: "#EFF6FF" },
                    { name: "Contacted", count: "12", color: "#8B5CF6", bg: "#F5F3FF" },
                    { name: "Qualified", count: "10", color: "#F59E0B", bg: "#FFFBEB" },
                    { name: "Proposal", count: "10", color: "#10B981", bg: "#ECFDF5" },
                ] as const).map((col, ci) => (
                    <g key={ci}>
                        <rect x={36 + ci * 190} y="130" width="180" height="334" rx="8" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                        <rect x={36 + ci * 190} y="130" width="180" height="32" rx="8" fill={col.bg} />
                        <rect x={36 + ci * 190} y="154" width="180" height="8" fill={col.bg} />
                        {T(48 + ci * 190, 150, col.name, 10, true, col.color)}
                        <rect x={186 + ci * 190} y="140" width="22" height="14" rx="7" fill={W} stroke={col.color} strokeWidth="0.5" />
                        {T(197 + ci * 190, 150, col.count, 8, true, col.color, "middle")}
                    </g>
                ))}
                {/* Lead cards */}
                {([
                    { col: 0, top: 172, name: "Acme Corp", contact: "Sarah Chen", score: 85, src: "Webform", ini: "SC", col2: "#3B82F6" },
                    { col: 0, top: 244, name: "TechStart Inc", contact: "Raj Patel", score: 68, src: "Cold email", ini: "RP", col2: "#8B5CF6" },
                    { col: 0, top: 316, name: "Bluepeak Ltd", contact: "Maya Singh", score: 91, src: "Referral", ini: "MS", col2: "#10B981" },
                    { col: 1, top: 172, name: "Nordic AB", contact: "Erik Lund", score: 76, src: "LinkedIn", ini: "EL", col2: "#F59E0B" },
                    { col: 1, top: 244, name: "Voltline Co", contact: "Anita Rao", score: 64, src: "Webform", ini: "AR", col2: "#EC4899" },
                    { col: 2, top: 172, name: "Pacific Logix", contact: "Jordan Lee", score: 88, src: "Event", ini: "JL", col2: "#06B6D4" },
                    { col: 2, top: 244, name: "Helix Software", contact: "Priya Iyer", score: 79, src: "Webform", ini: "PI", col2: "#8B5CF6" },
                    { col: 3, top: 172, name: "Mosaic Group", contact: "Tom Williams", score: 94, src: "Referral", ini: "TW", col2: "#10B981" },
                    { col: 3, top: 244, name: "Indus Foods", contact: "Aisha Khan", score: 81, src: "Webform", ini: "AK", col2: "#F59E0B" },
                ]).map((c, ci) => (
                    <g key={ci}>
                        <rect x={44 + c.col * 190} y={c.top} width="164" height="64" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                        {T(52 + c.col * 190, c.top + 16, c.name, 9.5, true, H)}
                        {T(52 + c.col * 190, c.top + 28, c.contact, 8, false, M)}
                        {Avatar(56 + c.col * 190, c.top + 50, c.ini, c.col2, 7)}
                        {T(70 + c.col * 190, c.top + 53, c.src, 7.5, false, M)}
                        <rect x={172 + c.col * 190} y={c.top + 44} width="28" height="14" rx="3" fill={c.score >= 80 ? "#ECFDF5" : c.score >= 70 ? "#FFFBEB" : "#F1F5F9"} />
                        {T(186 + c.col * 190, c.top + 54, String(c.score), 8, true, c.score >= 80 ? "#047857" : c.score >= 70 ? "#B45309" : "#475569", "middle")}
                    </g>
                ))}
            </svg>
        );

        // ── 1. Contacts — profile timeline ─────────────────────────────────
        case 1: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Contacts", "1,284 contacts · 312 active in last 30 days", "+ New Contact")}
                {K4(36, 52, "TOTAL CONTACTS", "1,284", "Across 412 accounts")}
                {K4(226, 52, "ACTIVE (30D)", "312", "24% engagement", POS)}
                {K4(416, 52, "DECISION MAKERS", "184", "Tagged as DM")}
                {K4(606, 52, "WITH OPEN DEALS", "96", "$4.8M influenced")}
                {/* Contact list */}
                <rect x="36" y="130" width="320" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "All Contacts", 11, true, H)}
                <rect x="44" y="160" width="304" height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                <rect x="50" y="166" width="60" height="10" rx="3" fill={W} stroke={BD} strokeWidth="0.5" />
                {T(80, 174, "Search", 8, false, M, "middle")}
                {([
                    { ini: "SC", col: "#3B82F6", name: "Sarah Chen", co: "Acme Corp", role: "VP Sales", active: true },
                    { ini: "RP", col: "#8B5CF6", name: "Raj Patel", co: "TechStart Inc", role: "CTO", active: true },
                    { ini: "MS", col: "#10B981", name: "Maya Singh", co: "Bluepeak", role: "Head of Ops", active: true },
                    { ini: "EL", col: "#F59E0B", name: "Erik Lund", co: "Nordic AB", role: "Director", active: false },
                    { ini: "AR", col: "#EC4899", name: "Anita Rao", co: "Voltline Co", role: "Manager", active: true },
                    { ini: "JL", col: "#06B6D4", name: "Jordan Lee", co: "Pacific Logix", role: "Co-founder", active: true },
                    { ini: "PI", col: "#F97316", name: "Priya Iyer", co: "Helix Software", role: "VP Product", active: false },
                ]).map((c, ci) => (
                    <g key={ci}>
                        <rect x="44" y={190 + ci * 36} width="304" height="32" rx="4" fill={ci === 0 ? "#EFF6FF" : (ci % 2 === 0 ? W : "#F8FAFC")} stroke={ci === 0 ? "#BFDBFE" : BD} strokeWidth="0.5" />
                        {Avatar(60, 207 + ci * 36, c.ini, c.col, 10)}
                        {T(78, 204 + ci * 36, c.name, 9.5, true, H)}
                        {T(78, 217 + ci * 36, `${c.role} · ${c.co}`, 8, false, M)}
                        {c.active && <circle cx={336} cy={206 + ci * 36} r={3} fill={POS} />}
                    </g>
                ))}
                {/* Contact detail panel */}
                <rect x="368" y="130" width="420" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {Avatar(400, 158, "SC", "#3B82F6", 16)}
                {T(424, 156, "Sarah Chen", 13, true, H)}
                {T(424, 170, "VP Sales · Acme Corp · acme.com", 8.5, false, M)}
                <rect x="424" y="178" width="62" height="16" rx="4" fill="#ECFDF5" />
                {T(455, 189, "Decision Maker", 7.5, true, "#047857", "middle")}
                <rect x="492" y="178" width="46" height="16" rx="4" fill="#EFF6FF" />
                {T(515, 189, "Champion", 7.5, true, "#1D4ED8", "middle")}
                {/* Activity timeline */}
                {T(384, 220, "Activity Timeline", 10, true, H)}
                {([
                    { ts: "Today", act: "Email opened — Q2 proposal", col: "#3B82F6" },
                    { ts: "Yesterday", act: "Meeting completed · 45 min", col: "#10B981" },
                    { ts: "Apr 22", act: "Call logged — 22 min", col: "#8B5CF6" },
                    { ts: "Apr 20", act: "Quote sent — $48K", col: "#F59E0B" },
                    { ts: "Apr 18", act: "Lead converted from Webform", col: "#06B6D4" },
                ]).map((ev, ei) => (
                    <g key={ei}>
                        <circle cx={398} cy={244 + ei * 36} r={5} fill={ev.col} opacity="0.18" />
                        <circle cx={398} cy={244 + ei * 36} r={2.5} fill={ev.col} />
                        {ei < 4 && <line x1={398} y1={250 + ei * 36} x2={398} y2={272 + ei * 36} stroke={BD} strokeWidth="1" strokeDasharray="2,2" />}
                        <rect x={412} y={232 + ei * 36} width="362" height="26" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                        {T(420, 244 + ei * 36, ev.ts, 8, true, M)}
                        {T(420, 254 + ei * 36, ev.act, 9, false, H)}
                    </g>
                ))}
                <rect x="376" y="420" width="400" height="32" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="0.5" />
                {T(388, 440, "2 open opportunities · $84,000 total", 9, true, "#1D4ED8")}
            </svg>
        );

        // ── 2. Accounts — company hierarchy ────────────────────────────────
        case 2: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Accounts", "412 accounts · Group hierarchy and revenue rollup", "+ New Account")}
                {K4(36, 52, "TOTAL ACCOUNTS", "412", "118 active deals")}
                {K4(226, 52, "ENTERPRISE", "48", "12 with parent group")}
                {K4(416, 52, "REVENUE (YTD)", "$8.2M", "Across 412 accounts", POS)}
                {K4(606, 52, "AT RISK", "7", "No activity 60+ days", WARN)}
                {/* Account hierarchy */}
                <rect x="36" y="130" width="296" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "Account Hierarchy", 11, true, H)}
                <rect x="88" y="162" width="152" height="34" rx="6" fill={PRM} />
                {T(164, 183, "Acme Holdings", 10, true, W, "middle")}
                <line x1="164" y1="196" x2="164" y2="218" stroke={BD} strokeWidth="1.5" />
                <line x1="76" y1="218" x2="252" y2="218" stroke={BD} strokeWidth="1.5" />
                <line x1="76" y1="218" x2="76" y2="234" stroke={BD} strokeWidth="1.5" />
                <line x1="164" y1="218" x2="164" y2="234" stroke={BD} strokeWidth="1.5" />
                <line x1="252" y1="218" x2="252" y2="234" stroke={BD} strokeWidth="1.5" />
                {([
                    { x: 40, label: "Acme US", sub: "Subsidiary" },
                    { x: 128, label: "Acme EU", sub: "Subsidiary" },
                    { x: 216, label: "Acme APAC", sub: "Subsidiary" },
                ]).map((c, ci) => (
                    <g key={ci}>
                        <rect x={c.x} y="234" width="80" height="40" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                        {T(c.x + 40, 251, c.label, 7.5, true, H, "middle")}
                        {T(c.x + 40, 264, c.sub, 7, false, M, "middle")}
                    </g>
                ))}
                <rect x="44" y="290" width="280" height="22" rx="4" fill="#EFF6FF" />
                {T(52, 304, "Group revenue: $4.2M YTD", 8.5, true, "#1D4ED8")}
                <rect x="44" y="318" width="280" height="22" rx="4" fill="#F8FAFC" />
                {T(52, 332, "Open opportunities: 11 · $1.8M", 8.5, false, M)}
                <rect x="44" y="346" width="280" height="22" rx="4" fill="#ECFDF5" />
                {T(52, 360, "Health score: Excellent ✓", 8.5, true, "#047857")}
                <rect x="44" y="378" width="280" height="74" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                {T(56, 395, "TOP CONTACTS (3)", 7.5, true, M)}
                {[{ ini: "SC", col: "#3B82F6", n: "Sarah Chen" }, { ini: "MK", col: "#8B5CF6", n: "Mark Klein" }, { ini: "JD", col: "#F59E0B", n: "Jen Davis" }].map((c, ci) => (
                    <g key={ci}>
                        {Avatar(64, 416 + ci * 12, c.ini, c.col, 5.5)}
                        {T(74, 419 + ci * 12, c.n, 8, false, H)}
                    </g>
                ))}
                {/* Accounts table */}
                <rect x="344" y="130" width="444" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(360, 150, "Account Registry", 11, true, H)}
                {ThRow(158, 352, 428)}
                {["ACCOUNT", "TYPE", "REVENUE", "DEALS", "OWNER", "STATUS"].map((h, hidx) =>
                    T([364, 488, 540, 600, 644, 700][hidx], 170, h, 7.5, true, M)
                )}
                {([
                    { name: "Acme Holdings", type: "Parent", rev: "$4.2M", deals: "11", owner: "SC", oc: "#3B82F6", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "TechStart Inc", type: "Enterprise", rev: "$1.8M", deals: "5", owner: "RP", oc: "#8B5CF6", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Bluepeak Ltd", type: "Mid-Market", rev: "$680K", deals: "3", owner: "MS", oc: "#10B981", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Nordic AB", type: "Mid-Market", rev: "$520K", deals: "2", owner: "EL", oc: "#F59E0B", st: "At Risk", bg: "#FFFBEB", tc: "#B45309", pw: 44 },
                    { name: "Voltline Co", type: "SMB", rev: "$240K", deals: "4", owner: "AR", oc: "#EC4899", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Helix Software", type: "Mid-Market", rev: "$420K", deals: "2", owner: "PI", oc: "#F97316", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Mosaic Group", type: "Enterprise", rev: "$1.1M", deals: "6", owner: "TW", oc: "#06B6D4", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                ]).map((r, idx) => (
                    <g key={idx}>
                        <rect x="352" y={182 + idx * 38} width="428" height="34" rx="3" fill={idx % 2 === 0 ? W : "#F8FAFC"} stroke={BD} strokeWidth="0.5" />
                        {T(364, 204 + idx * 38, r.name, 9, true, PRM)}
                        {T(488, 204 + idx * 38, r.type, 8.5, false, M)}
                        {T(540, 204 + idx * 38, r.rev, 9, true, H)}
                        {T(610, 204 + idx * 38, r.deals, 9, true, H, "middle")}
                        {Avatar(654, 200 + idx * 38, r.owner, r.oc, 7)}
                        {Pill(700, 204 + idx * 38, r.st, r.bg, r.tc, r.pw)}
                    </g>
                ))}
            </svg>
        );

        // ── 3. Opportunities — weighted pipeline ───────────────────────────
        case 3: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Opportunities", "62 open deals · $4.8M weighted forecast · Q2 2026", "+ New Deal")}
                {K4(36, 52, "OPEN DEALS", "62", "Across all stages")}
                {K4(226, 52, "PIPELINE", "$8.2M", "Total face value")}
                {K4(416, 52, "WEIGHTED", "$4.8M", "Probability-adjusted", POS)}
                {K4(606, 52, "WIN RATE", "34%", "Last 90 days", POS)}
                {/* Stage funnel */}
                <rect x="36" y="130" width="752" height="100" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "Pipeline by Stage", 11, true, H)}
                {T(776, 150, "Q2 2026 · All owners", 9, false, M, "end")}
                {([
                    { stage: "Discover", n: "22", amt: "$1.8M", w: 0.20, col: "#3B82F6" },
                    { stage: "Qualify", n: "18", amt: "$2.1M", w: 0.40, col: "#8B5CF6" },
                    { stage: "Propose", n: "12", amt: "$2.4M", w: 0.65, col: "#F59E0B" },
                    { stage: "Negotiate", n: "7", amt: "$1.4M", w: 0.85, col: "#06B6D4" },
                    { stage: "Closing", n: "3", amt: "$0.5M", w: 0.95, col: "#10B981" },
                ]).map((s, si) => (
                    <g key={si}>
                        <rect x={52 + si * 146} y="166" width="138" height="50" rx="6" fill={W} stroke={s.col} strokeWidth="1" strokeOpacity="0.4" />
                        <rect x={52 + si * 146} y="166" width={138 * s.w} height="50" rx="6" fill={s.col} opacity="0.12" />
                        {T(60 + si * 146, 180, s.stage, 9, true, H)}
                        {T(60 + si * 146, 198, s.n + " deals", 8, false, M)}
                        {T(60 + si * 146, 210, s.amt, 10, true, s.col)}
                        <rect x={170 + si * 146} y="172" width="14" height="14" rx="7" fill={s.col} opacity="0.18" />
                        {T(177 + si * 146, 182, String(Math.round(s.w * 100)), 7.5, true, s.col, "middle")}
                    </g>
                ))}
                {/* Top deals table */}
                <rect x="36" y="246" width="752" height="218" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 266, "Top Open Deals", 11, true, H)}
                {ThRow(272, 44, 736)}
                {["DEAL", "ACCOUNT", "STAGE", "AMOUNT", "PROB", "CLOSE", "OWNER"].map((h, hidx) =>
                    T([56, 188, 320, 444, 528, 588, 668][hidx], 285, h, 7.5, true, M)
                )}
                {([
                    { d: "Acme Q2 Renewal", a: "Acme Holdings", st: "Negotiate", stc: "#06B6D4", amt: "$340K", p: "85%", cl: "May 15", own: "SC", oc: "#3B82F6" },
                    { d: "Bluepeak Migration", a: "Bluepeak Ltd", st: "Propose", stc: "#F59E0B", amt: "$220K", p: "65%", cl: "May 28", own: "MS", oc: "#10B981" },
                    { d: "Nordic Platform Deal", a: "Nordic AB", st: "Qualify", stc: "#8B5CF6", amt: "$180K", p: "40%", cl: "Jun 10", own: "EL", oc: "#F59E0B" },
                    { d: "Mosaic Enterprise", a: "Mosaic Group", st: "Closing", stc: "#10B981", amt: "$420K", p: "95%", cl: "May 8", own: "TW", oc: "#06B6D4" },
                    { d: "Pacific Logix Expand", a: "Pacific Logix", st: "Propose", stc: "#F59E0B", amt: "$155K", p: "65%", cl: "May 22", own: "JL", oc: "#06B6D4" },
                ] as const).map((r, idx) => (
                    <g key={idx}>
                        {Tr(294 + idx * 32, idx % 2 === 0, 44, 736)}
                        {T(56, 314 + idx * 32, r.d, 9.5, true, PRM)}
                        {T(188, 314 + idx * 32, r.a, 9, false, H)}
                        <rect x="320" y={304 + idx * 32} width="62" height="14" rx="3" fill={r.stc} opacity="0.12" />
                        {T(351, 314 + idx * 32, r.st, 8, true, r.stc, "middle")}
                        {T(444, 314 + idx * 32, r.amt, 9.5, true, H)}
                        {T(528, 314 + idx * 32, r.p, 9, true, POS)}
                        {T(588, 314 + idx * 32, r.cl, 9, false, M)}
                        {Avatar(686, 310 + idx * 32, r.own, r.oc, 8)}
                    </g>
                ))}
            </svg>
        );

        // ── 4. Quotations — quote builder ──────────────────────────────────
        case 4: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Quotation Q-2026-0184", "Acme Holdings · Sarah Chen · Sales Q2", "Send Quote")}
                {/* Status strip */}
                <rect x="36" y="52" width="752" height="40" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {([
                    { label: "Draft", hi: false },
                    { label: "Internal review", hi: true },
                    { label: "Approved", hi: true },
                    { label: "Sent", hi: false },
                    { label: "Accepted", hi: false },
                ]).map((s, si) => (
                    <g key={si}>
                        <circle cx={86 + si * 146} cy={72} r={10} fill={s.hi ? PRM : W} stroke={s.hi ? PRM : BD} strokeWidth="1.5" />
                        {s.hi && <text x={86 + si * 146} y={76} fontFamily={ff} fontSize="9" fontWeight="700" fill={W} textAnchor="middle">✓</text>}
                        {!s.hi && <text x={86 + si * 146} y={75} fontFamily={ff} fontSize="9" fontWeight="700" fill={M} textAnchor="middle">{si + 1}</text>}
                        {T(110 + si * 146, 75, s.label, 9, s.hi, s.hi ? H : M)}
                        {si < 4 && <line x1={96 + si * 146} y1={72} x2={172 + si * 146} y2={72} stroke={s.hi ? PRM : BD} strokeWidth="1.5" strokeDasharray={s.hi ? "0" : "2,2"} />}
                    </g>
                ))}
                {/* Quote document */}
                <rect x="36" y="106" width="492" height="358" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {/* Document header */}
                <rect x="36" y="106" width="492" height="62" rx="6" fill="#F8FAFC" />
                <rect x="36" y="158" width="492" height="10" fill="#F8FAFC" />
                {T(52, 132, "QUOTATION", 14, true, PRM)}
                {T(52, 150, "Q-2026-0184 · Apr 26, 2026", 9, false, M)}
                {T(516, 132, "Acme Holdings", 11, true, H, "end")}
                {T(516, 148, "Bill to: Sarah Chen", 8.5, false, M, "end")}
                {T(516, 160, "Valid until May 26, 2026", 8.5, false, M, "end")}
                {/* Line items header */}
                {ThRow(184, 44, 476)}
                {["ITEM", "QTY", "UNIT", "TAX", "AMOUNT"].map((h, hidx) =>
                    T([56, 308, 360, 408, 510][hidx], 197, h, 7.5, true, M, hidx === 0 ? "start" : "end")
                )}
                {/* Line items */}
                {([
                    { item: "Zopkit CRM — Enterprise", qty: "25", unit: "$199", tax: "$497", amt: "$5,472" },
                    { item: "Onboarding Package — 30 days", qty: "1", unit: "$2,400", tax: "$216", amt: "$2,616" },
                    { item: "Custom Integration — API", qty: "2", unit: "$1,800", tax: "$324", amt: "$3,924" },
                    { item: "Training Workshop · Half-day", qty: "1", unit: "$1,200", tax: "$108", amt: "$1,308" },
                ]).map((r, idx) => (
                    <g key={idx}>
                        {Tr(212 + idx * 32, idx % 2 === 0, 44, 476)}
                        {T(56, 232 + idx * 32, r.item, 9, false, H)}
                        {T(308, 232 + idx * 32, r.qty, 9, true, H, "end")}
                        {T(380, 232 + idx * 32, r.unit, 9, false, M, "end")}
                        {T(440, 232 + idx * 32, r.tax, 8.5, false, M, "end")}
                        {T(516, 232 + idx * 32, r.amt, 9.5, true, H, "end")}
                    </g>
                ))}
                {/* Totals */}
                <line x1="44" y1="356" x2="520" y2="356" stroke={BD} strokeWidth="0.5" />
                {T(380, 374, "Subtotal", 9, false, M, "end")}{T(516, 374, "$12,175", 9.5, true, H, "end")}
                {T(380, 392, "Tax (9%)", 9, false, M, "end")}{T(516, 392, "$1,145", 9.5, true, H, "end")}
                {T(380, 410, "Discount", 9, false, M, "end")}{T(516, 410, "−$500", 9.5, true, NEG, "end")}
                <rect x="316" y="420" width="208" height="32" rx="5" fill="#EFF6FF" />
                {T(330, 440, "TOTAL", 11, true, "#1D4ED8")}
                {T(516, 440, "$12,820", 14, true, "#1D4ED8", "end")}
                {/* Side panel */}
                <rect x="540" y="106" width="248" height="358" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(556, 126, "Quote Details", 11, true, H)}
                {[
                    { l: "Account", v: "Acme Holdings" },
                    { l: "Contact", v: "Sarah Chen" },
                    { l: "Opportunity", v: "Acme Q2 Renewal" },
                    { l: "Owner", v: "Jordan Lee" },
                    { l: "Template", v: "Enterprise.pdf" },
                    { l: "Approvals", v: "2 of 2 ✓" },
                    { l: "Expires", v: "May 26, 2026" },
                ].map((d, di) => (
                    <g key={di}>
                        {T(556, 152 + di * 24, d.l, 8, false, M)}
                        {T(776, 152 + di * 24, d.v, 9, true, H, "end")}
                        <line x1="556" y1={160 + di * 24} x2="772" y2={160 + di * 24} stroke={BD} strokeWidth="0.3" />
                    </g>
                ))}
                <rect x="556" y="334" width="220" height="36" rx="5" fill={PRM} />
                {T(666, 357, "📄 Download PDF", 10, true, W, "middle")}
                <rect x="556" y="378" width="220" height="36" rx="5" fill={W} stroke={BD} strokeWidth="1" />
                {T(666, 401, "Convert to Invoice", 10, true, H, "middle")}
                <rect x="556" y="422" width="220" height="32" rx="5" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5" />
                {T(666, 442, "✓ Both approvers signed off", 8.5, true, "#047857", "middle")}
            </svg>
        );

        // ── 5. Invoices — receivables + status ─────────────────────────────
        case 5: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Invoices", "184 invoices this quarter · Payment status & collection", "+ New Invoice")}
                {K4(36, 52, "OUTSTANDING", "$184K", "Across 32 invoices")}
                {K4(226, 52, "PAID (MTD)", "$420K", "62 invoices", POS)}
                {K4(416, 52, "OVERDUE", "$18K", "4 invoices", NEG)}
                {K4(606, 52, "AVG DSO", "27 days", "−4 days YoY", POS)}
                {/* Status bar chart */}
                <rect x="36" y="130" width="752" height="60" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 148, "Receivables aging", 10, true, H)}
                {T(776, 148, "Total: $202,400", 9, true, H, "end")}
                {([
                    { l: "Current", v: 0.62, c: POS, amt: "$125K" },
                    { l: "1–30", v: 0.20, c: "#3B82F6", amt: "$40K" },
                    { l: "31–60", v: 0.10, c: WARN, amt: "$20K" },
                    { l: "61–90", v: 0.05, c: "#F97316", amt: "$10K" },
                    { l: "90+", v: 0.03, c: NEG, amt: "$7K" },
                ]).map((b, bi) => {
                    let x = 52;
                    for (let k = 0; k < bi; k++) x += [0.62, 0.20, 0.10, 0.05, 0.03][k] * 720;
                    return (
                        <g key={bi}>
                            <rect x={x} y={158} width={720 * b.v} height={14} rx={3} fill={b.c} opacity={0.8} />
                            {b.v > 0.05 && <text x={x + 8} y={169} fontFamily={ff} fontSize="8" fontWeight="700" fill={W}>{b.l}</text>}
                            {b.v > 0.07 && <text x={x + 720 * b.v - 8} y={169} fontFamily={ff} fontSize="8" fontWeight="700" fill={W} textAnchor="end">{b.amt}</text>}
                            <text x={x + 720 * b.v / 2} y={186} fontFamily={ff} fontSize="7.5" fill={M} textAnchor="middle">{b.l}</text>
                        </g>
                    );
                })}
                {/* Invoice table */}
                {ThRow(204)}
                {["INVOICE #", "CUSTOMER", "ISSUED", "DUE", "AMOUNT", "BALANCE", "STATUS"].map((h, hidx) =>
                    T([48, 144, 264, 332, 412, 504, 600][hidx], 217, h, 7.5, true, M)
                )}
                {([
                    { no: "INV-1842", cust: "Acme Holdings", iss: "Apr 22", due: "May 22", amt: "$12,820", rem: "$12,820", st: "Sent", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32 },
                    { no: "INV-1841", cust: "Bluepeak Ltd", iss: "Apr 18", due: "May 18", amt: "$6,400", rem: "$3,200", st: "Partial", bg: "#FFFBEB", tc: "#B45309", pw: 40 },
                    { no: "INV-1840", cust: "Mosaic Group", iss: "Apr 12", due: "May 12", amt: "$28,500", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
                    { no: "INV-1839", cust: "Nordic AB", iss: "Mar 30", due: "Apr 29", amt: "$8,200", rem: "$8,200", st: "Overdue", bg: "#FEF2F2", tc: "#B91C1C", pw: 46 },
                    { no: "INV-1838", cust: "Voltline Co", iss: "Mar 28", due: "Apr 27", amt: "$3,600", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
                    { no: "INV-1837", cust: "Pacific Logix", iss: "Mar 22", due: "Apr 21", amt: "$14,200", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
                ] as const).map((r, idx) => (
                    <g key={idx}>
                        {Tr(226 + idx * 38, idx % 2 === 0)}
                        {T(48, 248 + idx * 38, r.no, 9.5, true, PRM)}{T(144, 248 + idx * 38, r.cust, 9)}
                        {T(264, 248 + idx * 38, r.iss, 9, false, M)}{T(332, 248 + idx * 38, r.due, 9, false, M)}
                        {T(412, 248 + idx * 38, r.amt, 9.5, true, H)}
                        {T(504, 248 + idx * 38, r.rem, 9.5, false, r.rem === "$0" ? POS : M)}
                        {Pill(600, 248 + idx * 38, r.st, r.bg, r.tc, r.pw)}
                        <rect x={660} y={238 + idx * 38} width="100" height="18" rx="4" fill="#F1F5F9" stroke={BD} strokeWidth="0.5" />
                        {T(710, 250 + idx * 38, "View · Download", 7.5, true, M, "middle")}
                    </g>
                ))}
            </svg>
        );

        // ── 6. Sales Orders — fulfilment flow ──────────────────────────────
        case 6: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Sales Orders", "94 open orders · Fulfilment & delivery status", "+ New Order")}
                {K4(36, 52, "OPEN ORDERS", "94", "Across 48 accounts")}
                {K4(226, 52, "IN FULFILMENT", "32", "Awaiting dispatch")}
                {K4(416, 52, "SHIPPED (WK)", "41", "On-time rate 96%", POS)}
                {K4(606, 52, "ORDER VALUE", "$642K", "This week")}
                {/* Order workflow strip */}
                <rect x="36" y="130" width="752" height="60" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {T(52, 148, "Order Fulfilment Workflow", 9.5, true, H)}
                {([
                    { l: "Created", n: "94", hi: false },
                    { l: "Confirmed", n: "82", hi: true },
                    { l: "Picked", n: "61", hi: true },
                    { l: "Shipped", n: "41", hi: true },
                    { l: "Delivered", n: "32", hi: false },
                ]).map((s, si) => (
                    <g key={si}>
                        <rect x={56 + si * 142} y="158" width="86" height="24" rx="4" fill={s.hi ? PRM : W} stroke={s.hi ? PRM : BD} strokeWidth="1" />
                        {T(99 + si * 142, 173, s.l, 8.5, true, s.hi ? W : H, "middle")}
                        <rect x={148 + si * 142} y="164" width="32" height="12" rx="6" fill={W} stroke={BD} strokeWidth="0.5" />
                        {T(164 + si * 142, 173, s.n, 7.5, true, M, "middle")}
                        {si < 4 && <line x1={186 + si * 142} y1="170" x2={194 + si * 142} y2="170" stroke={BD} strokeWidth="1.5" />}
                    </g>
                ))}
                {/* Orders table */}
                {ThRow(204)}
                {["ORDER #", "ACCOUNT", "ITEMS", "VALUE", "STAGE", "SHIP DATE", "STATUS"].map((h, hidx) =>
                    T([48, 144, 264, 320, 396, 504, 596][hidx], 217, h, 7.5, true, M)
                )}
                {([
                    { no: "SO-3142", acc: "Acme Holdings", items: "12", val: "$48,200", stage: "Shipped", stc: "#06B6D4", date: "May 2", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
                    { no: "SO-3141", acc: "TechStart Inc", items: "4", val: "$12,800", stage: "Picked", stc: "#F59E0B", date: "May 3", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
                    { no: "SO-3140", acc: "Bluepeak Ltd", items: "8", val: "$24,400", stage: "Confirmed", stc: "#8B5CF6", date: "May 6", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
                    { no: "SO-3139", acc: "Mosaic Group", items: "22", val: "$84,500", stage: "Shipped", stc: "#06B6D4", date: "May 2", st: "Priority", bg: "#FEF2F2", tc: "#B91C1C", pw: 44 },
                    { no: "SO-3138", acc: "Voltline Co", items: "3", val: "$6,800", stage: "Delivered", stc: "#10B981", date: "Apr 28", st: "Closed", bg: "#F1F5F9", tc: "#475569", pw: 40 },
                    { no: "SO-3137", acc: "Helix Software", items: "6", val: "$18,200", stage: "Picked", stc: "#F59E0B", date: "May 4", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
                ] as const).map((r, idx) => (
                    <g key={idx}>
                        {Tr(226 + idx * 38, idx % 2 === 0)}
                        {T(48, 248 + idx * 38, r.no, 9.5, true, PRM)}{T(144, 248 + idx * 38, r.acc, 9)}
                        {T(278, 248 + idx * 38, r.items, 9, true, H, "middle")}
                        {T(320, 248 + idx * 38, r.val, 9.5, true, H)}
                        <rect x="396" y={238 + idx * 38} width="80" height="14" rx="3" fill={r.stc} opacity="0.12" />
                        {T(436, 248 + idx * 38, r.stage, 8, true, r.stc, "middle")}
                        {T(504, 248 + idx * 38, r.date, 9, false, M)}
                        {Pill(596, 248 + idx * 38, r.st, r.bg, r.tc, r.pw)}
                    </g>
                ))}
            </svg>
        );

        // ── 7. Approval Processes — multi-step routing ─────────────────────
        case 7: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Approval Processes", "Configure multi-step approval chains for deals, quotes & orders", "+ New Process")}
                {K3(36, 52, "ACTIVE PROCESSES", "12", "Across 4 record types")}
                {K3(289, 52, "PENDING APPROVALS", "28", "16 waiting on me", WARN)}
                {K3(542, 52, "AVG TIME", "4.2 hrs", "−1.8 hrs vs last month", POS)}
                {/* Approval chain visualization */}
                <rect x="36" y="130" width="500" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "Quote > $50K Approval Chain", 11, true, H)}
                {T(52, 164, "Live · Triggered when quote amount exceeds $50,000", 8.5, false, M)}
                {([
                    { l: "Submitter", ini: "JL", col: "#06B6D4", role: "Sales Rep · Jordan Lee", status: "Submitted", stc: "#1D4ED8", sbg: "#EFF6FF", time: "Apr 26, 10:14", complete: true },
                    { l: "Step 1", ini: "AB", col: "#8B5CF6", role: "Sales Manager · Alex Brown", status: "Approved ✓", stc: "#047857", sbg: "#ECFDF5", time: "Apr 26, 11:42", complete: true },
                    { l: "Step 2", ini: "DK", col: "#F59E0B", role: "Finance · Dan Klein", status: "Approved ✓", stc: "#047857", sbg: "#ECFDF5", time: "Apr 26, 14:21", complete: true },
                    { l: "Step 3", ini: "MR", col: "#EC4899", role: "VP Sales · Maria Rivera", status: "Pending", stc: "#B45309", sbg: "#FFFBEB", time: "Awaiting", complete: false },
                ]).map((step, si) => (
                    <g key={si}>
                        {si < 3 && <line x1={68} y1={196 + si * 70} x2={68} y2={254 + si * 70} stroke={step.complete ? POS : BD} strokeWidth="2" strokeDasharray={step.complete ? "0" : "3,3"} />}
                        <circle cx={68} cy={194 + si * 70} r={18} fill={step.col} opacity="0.15" />
                        {step.complete ? (
                            <text x={68} y={200 + si * 70} fontFamily={ff} fontSize="14" fontWeight="700" fill={POS} textAnchor="middle">✓</text>
                        ) : (
                            <text x={68} y={199 + si * 70} fontFamily={ff} fontSize="11" fontWeight="700" fill={step.col} textAnchor="middle">{step.ini}</text>
                        )}
                        <rect x={96} y={176 + si * 70} width="424" height="48" rx="5" fill={si === 3 ? "#FFFBEB" : "#F8FAFC"} stroke={si === 3 ? "#FDE68A" : BD} strokeWidth="0.5" />
                        {T(108, 192 + si * 70, step.l, 8.5, true, M)}
                        {T(108, 206 + si * 70, step.role, 10, true, H)}
                        <rect x={398} y={184 + si * 70} width={step.status.length * 5 + 16} height="16" rx="4" fill={step.sbg} />
                        {T(398 + (step.status.length * 5 + 16) / 2, 195 + si * 70, step.status, 8, true, step.stc, "middle")}
                        {T(108, 220 + si * 70, step.time, 8, false, M)}
                    </g>
                ))}
                {/* Pending queue */}
                <rect x="548" y="130" width="240" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(560, 150, "My Pending (16)", 11, true, H)}
                {([
                    { rec: "Q-2026-0184", typ: "Quote · Acme", amt: "$58.2K", age: "3h", urg: true },
                    { rec: "DEAL-0042", typ: "Deal · Mosaic", amt: "$420K", age: "5h", urg: true },
                    { rec: "SO-3142", typ: "Order · Acme", amt: "$48.2K", age: "1d", urg: false },
                    { rec: "Q-2026-0181", typ: "Quote · Nordic", amt: "$72.5K", age: "1d", urg: false },
                    { rec: "DEAL-0038", typ: "Deal · Helix", amt: "$155K", age: "2d", urg: false },
                ]).map((p, pi) => (
                    <g key={pi}>
                        <rect x="556" y={168 + pi * 56} width="224" height="48" rx="5" fill={p.urg ? "#FEF2F2" : "#F8FAFC"} stroke={p.urg ? "#FECACA" : BD} strokeWidth="0.5" />
                        {T(566, 184 + pi * 56, p.rec, 9, true, PRM)}
                        <rect x={730} y={172 + pi * 56} width="42" height="14" rx="3" fill={p.urg ? "#FECACA" : BD} opacity="0.7" />
                        {T(751, 182 + pi * 56, p.age + " ago", 7.5, true, p.urg ? "#B91C1C" : "#475569", "middle")}
                        {T(566, 198 + pi * 56, p.typ, 8.5, false, M)}
                        {T(773, 207 + pi * 56, p.amt, 10, true, H, "end")}
                    </g>
                ))}
                <rect x="556" y="450" width="224" height="0" rx="0" fill="none" />
            </svg>
        );

        // ── 8. Products & Inventory ────────────────────────────────────────
        case 8: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Products & Inventory", "284 SKUs · Pricing, stock & catalog", "+ New Product")}
                {K4(36, 52, "TOTAL SKUS", "284", "12 categories")}
                {K4(226, 52, "IN STOCK", "248", "87% availability", POS)}
                {K4(416, 52, "LOW STOCK", "22", "Reorder soon", WARN)}
                {K4(606, 52, "OUT OF STOCK", "14", "Backorder eligible", NEG)}
                {/* Category chips */}
                <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {(["All (284)", "Software (118)", "Services (62)", "Training (24)", "Hardware (44)", "Add-ons (36)"]).map((c, ci) => (
                    <g key={ci}>
                        <rect x={48 + ci * 122} y="138" width={114} height="18" rx="9" fill={ci === 0 ? PRM : W} stroke={ci === 0 ? PRM : BD} strokeWidth="0.5" />
                        {T(105 + ci * 122, 150, c, 8, true, ci === 0 ? W : M, "middle")}
                    </g>
                ))}
                {/* Product table */}
                {ThRow(176)}
                {["SKU", "PRODUCT", "CATEGORY", "PRICE", "STOCK", "STATUS"].map((h, hidx) =>
                    T([48, 132, 360, 488, 564, 660][hidx], 189, h, 7.5, true, M)
                )}
                {([
                    { sku: "CRM-ENT-01", name: "Zopkit CRM — Enterprise", cat: "Software", price: "$199 /seat", stock: "∞", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
                    { sku: "CRM-PRO-01", name: "Zopkit CRM — Professional", cat: "Software", price: "$99 /seat", stock: "∞", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
                    { sku: "ONB-30D", name: "Onboarding Package — 30 days", cat: "Services", price: "$2,400", stock: "12 avail", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
                    { sku: "INT-API-01", name: "Custom Integration — API", cat: "Services", price: "$1,800", stock: "8 avail", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
                    { sku: "TRN-HD-01", name: "Training Workshop · Half-day", cat: "Training", price: "$1,200", stock: "3 left", st: "Low Stock", bg: "#FFFBEB", tc: "#B45309", pw: 60, sc: WARN },
                    { sku: "HW-DOCK-04", name: "Sales Dock — USB-C Hub", cat: "Hardware", price: "$320", stock: "0", st: "Out", bg: "#FEF2F2", tc: "#B91C1C", pw: 28, sc: NEG },
                ]).map((r, idx) => (
                    <g key={idx}>
                        {Tr(198 + idx * 42, idx % 2 === 0)}
                        {T(48, 222 + idx * 42, r.sku, 9, true, PRM)}
                        <rect x="120" y={208 + idx * 42} width="22" height="22" rx="4" fill={W} stroke={BD} strokeWidth="1" />
                        <rect x="124" y={212 + idx * 42} width="14" height="14" rx="2" fill="#F1F5F9" />
                        {T(150, 222 + idx * 42, r.name, 9)}
                        {T(360, 222 + idx * 42, r.cat, 9, false, M)}
                        {T(488, 222 + idx * 42, r.price, 9.5, true, H)}
                        {T(564, 222 + idx * 42, r.stock, 9, true, r.sc)}
                        {Pill(660, 222 + idx * 42, r.st, r.bg, r.tc, r.pw)}
                    </g>
                ))}
            </svg>
        );

        // ── 9. Tickets — support with SLA ──────────────────────────────────
        case 9: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Tickets", "47 open · SLA-tracked support cases", "+ New Ticket")}
                {K4(36, 52, "OPEN TICKETS", "47", "12 high priority", WARN)}
                {K4(226, 52, "SLA AT RISK", "3", "Breach in <2 hrs", NEG)}
                {K4(416, 52, "AVG RESPONSE", "18 min", "Within SLA target", POS)}
                {K4(606, 52, "RESOLVED (24H)", "62", "First-contact 78%", POS)}
                {/* Filter tabs */}
                <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {([{ l: "All", n: "47", a: true }, { l: "Open", n: "31" }, { l: "Pending", n: "9" }, { l: "Resolved", n: "478" }, { l: "Closed", n: "1,284" }]).map((tab, ti) => (
                    <g key={ti}>
                        <rect x={48 + ti * 142} y="138" width="132" height="18" rx="4" fill={tab.a ? PRM : "#F1F5F9"} stroke={tab.a ? PRM : BD} strokeWidth="0.5" />
                        {T(114 + ti * 142, 150, tab.l + " (" + tab.n + ")", 8.5, true, tab.a ? W : M, "middle")}
                    </g>
                ))}
                {/* Tickets table */}
                {ThRow(176)}
                {["TICKET #", "SUBJECT", "ACCOUNT", "PRIORITY", "SLA", "STATUS", "OWNER"].map((h, hidx) =>
                    T([48, 132, 308, 416, 488, 596, 700][hidx], 189, h, 7.5, true, M)
                )}
                {([
                    { no: "TKT-4218", subj: "Cannot sync inbox — Gmail", acc: "Acme Holdings", pr: "High", prc: NEG, sla: 0.18, slaT: "2h 12m", st: "Open", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32, own: "DS", oc: "#3B82F6" },
                    { no: "TKT-4217", subj: "Quote PDF rendering issue", acc: "TechStart Inc", pr: "Medium", prc: WARN, sla: 0.62, slaT: "6h left", st: "In Prog.", bg: "#FFFBEB", tc: "#B45309", pw: 48, own: "MA", oc: "#10B981" },
                    { no: "TKT-4216", subj: "Webhook delivery failing", acc: "Bluepeak Ltd", pr: "High", prc: NEG, sla: 0.08, slaT: "32m left", st: "Open", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32, own: "DS", oc: "#3B82F6" },
                    { no: "TKT-4215", subj: "Add custom field — Industry", acc: "Voltline Co", pr: "Low", prc: M, sla: 0.84, slaT: "2d left", st: "Pending", bg: "#F1F5F9", tc: "#475569", pw: 48, own: "PJ", oc: "#8B5CF6" },
                    { no: "TKT-4214", subj: "User SSO setup help", acc: "Mosaic Group", pr: "Medium", prc: WARN, sla: 0.45, slaT: "9h left", st: "In Prog.", bg: "#FFFBEB", tc: "#B45309", pw: 48, own: "AL", oc: "#F59E0B" },
                    { no: "TKT-4213", subj: "Export CSV truncated", acc: "Helix Software", pr: "Medium", prc: WARN, sla: 0.72, slaT: "1d left", st: "Pending", bg: "#F1F5F9", tc: "#475569", pw: 48, own: "MA", oc: "#10B981" },
                ]).map((r, idx) => (
                    <g key={idx}>
                        {Tr(198 + idx * 42, idx % 2 === 0)}
                        {T(48, 222 + idx * 42, r.no, 9, true, PRM)}
                        {T(132, 222 + idx * 42, r.subj, 9)}
                        {T(308, 222 + idx * 42, r.acc, 9, false, M)}
                        <circle cx={420} cy={218 + idx * 42} r={3} fill={r.prc} />
                        {T(428, 222 + idx * 42, r.pr, 9, true, r.prc)}
                        <rect x={488} y={216 + idx * 42} width="92" height="6" rx="3" fill="#F1F5F9" />
                        <rect x={488} y={216 + idx * 42} width={92 * (1 - r.sla)} height="6" rx="3" fill={r.sla < 0.3 ? NEG : r.sla < 0.6 ? WARN : POS} />
                        {T(488, 234 + idx * 42, r.slaT, 7.5, true, r.sla < 0.3 ? NEG : M)}
                        {Pill(596, 222 + idx * 42, r.st, r.bg, r.tc, r.pw)}
                        {Avatar(720, 218 + idx * 42, r.own, r.oc, 9)}
                    </g>
                ))}
            </svg>
        );

        // ── 10. Communications — unified inbox ─────────────────────────────
        case 10: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Communications", "Unified inbox · Email, calls, meetings logged per record", "+ Compose")}
                {/* Channel tabs */}
                <rect x="36" y="52" width="752" height="36" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {([
                    { l: "All", n: "1,284", a: true, c: PRM },
                    { l: "Email", n: "942", c: "#3B82F6" },
                    { l: "Calls", n: "184", c: "#10B981" },
                    { l: "Meetings", n: "112", c: "#F59E0B" },
                    { l: "Notes", n: "46", c: "#8B5CF6" },
                ]).map((tab, ti) => (
                    <g key={ti}>
                        <rect x={48 + ti * 144} y="60" width="134" height="20" rx="4" fill={tab.a ? tab.c : W} stroke={BD} strokeWidth="0.5" />
                        <circle cx={62 + ti * 144} cy={70} r={3} fill={tab.a ? W : tab.c} />
                        {T(115 + ti * 144, 74, tab.l + " (" + tab.n + ")", 8.5, true, tab.a ? W : M, "middle")}
                    </g>
                ))}
                {/* Inbox list */}
                <rect x="36" y="100" width="300" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {([
                    { ini: "SC", col: "#3B82F6", from: "Sarah Chen", subj: "Re: Q2 Renewal Proposal", prev: "Thanks for sending the updated quote. We…", time: "2m", unread: true, sel: true, type: "📧" },
                    { ini: "JL", col: "#06B6D4", from: "Call · Jordan Lee", subj: "Discovery — Bluepeak Ltd", prev: "Outcome: Qualified. Next step: Send proposal…", time: "1h", unread: false, sel: false, type: "📞" },
                    { ini: "RP", col: "#8B5CF6", from: "Raj Patel", subj: "Pricing question on Enterprise tier", prev: "Quick question — does the Enterprise plan…", time: "3h", unread: true, sel: false, type: "📧" },
                    { ini: "MS", col: "#10B981", from: "Meeting · Bluepeak demo", subj: "Wed 11:00 AM — 45 min", prev: "Attendees: Maya Singh, Jordan Lee. Notes:…", time: "5h", unread: false, sel: false, type: "📅" },
                    { ini: "EL", col: "#F59E0B", from: "Erik Lund", subj: "Implementation timeline?", prev: "Hi team — we're aiming for end of Q2 go-live…", time: "1d", unread: false, sel: false, type: "📧" },
                    { ini: "AR", col: "#EC4899", from: "Anita Rao", subj: "Demo follow-up", prev: "Following up on yesterday's demo. Sharing…", time: "2d", unread: false, sel: false, type: "📧" },
                ]).map((m, mi) => (
                    <g key={mi}>
                        <rect x="44" y={112 + mi * 58} width="284" height="50" rx="4" fill={m.sel ? "#EFF6FF" : W} stroke={m.sel ? "#BFDBFE" : BD} strokeWidth="0.5" />
                        {Avatar(58, 132 + mi * 58, m.ini, m.col, 8)}
                        {m.unread && <circle cx={73} cy={120 + mi * 58} r={3} fill="#3B82F6" />}
                        {T(74, 126 + mi * 58, m.from, 9, m.unread, H)}
                        {T(322, 126 + mi * 58, m.time, 8, false, M, "end")}
                        {T(74, 140 + mi * 58, m.subj, 8.5, true, H)}
                        {T(74, 154 + mi * 58, m.prev, 7.5, false, M)}
                        <text x={306} y={156 + mi * 58} fontFamily={ff} fontSize="10" fill={m.col} textAnchor="end">{m.type}</text>
                    </g>
                ))}
                {/* Thread view */}
                <rect x="344" y="100" width="444" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(360, 120, "Re: Q2 Renewal Proposal", 12, true, H)}
                {T(360, 136, "Sarah Chen → Jordan Lee · acme.com · Apr 26", 8.5, false, M)}
                <rect x="360" y="146" width="80" height="16" rx="4" fill="#EFF6FF" />
                {T(400, 157, "Linked · Acme", 7.5, true, "#1D4ED8", "middle")}
                <rect x="446" y="146" width="76" height="16" rx="4" fill="#ECFDF5" />
                {T(484, 157, "Deal · $340K", 7.5, true, "#047857", "middle")}
                {/* Thread messages */}
                {([
                    { ini: "SC", col: "#3B82F6", who: "Sarah Chen", time: "Today 10:14 AM", body: "Thanks for sending the updated quote. We're aligned on the pricing but need to confirm the migration timeline with our IT team.", outbound: false },
                    { ini: "JL", col: "#06B6D4", who: "Jordan Lee · You", time: "Today 10:42 AM", body: "Got it — happy to set up a call with our solutions architect this week. How does Thursday 2pm work?", outbound: true },
                    { ini: "SC", col: "#3B82F6", who: "Sarah Chen", time: "Today 11:01 AM", body: "Thursday 2pm works on our side. I'll loop in Mark from IT.", outbound: false },
                ]).map((msg, mi) => (
                    <g key={mi}>
                        <rect x={msg.outbound ? 432 : 372} y={180 + mi * 70} width="340" height="62" rx="6" fill={msg.outbound ? "#EFF6FF" : "#F8FAFC"} stroke={msg.outbound ? "#BFDBFE" : BD} strokeWidth="0.5" />
                        {Avatar(msg.outbound ? 752 : 386, 192 + mi * 70, msg.ini, msg.col, 6)}
                        {T(msg.outbound ? 740 : 398, 195 + mi * 70, msg.who, 8.5, true, H, msg.outbound ? "end" : "start")}
                        {T(msg.outbound ? 740 : 398, 205 + mi * 70, msg.time, 7, false, M, msg.outbound ? "end" : "start")}
                        {T(msg.outbound ? 762 : 384, 222 + mi * 70, msg.body.substring(0, 60), 8, false, msg.outbound ? "#1D4ED8" : H, msg.outbound ? "end" : "start")}
                        {T(msg.outbound ? 762 : 384, 234 + mi * 70, msg.body.substring(60, 120), 8, false, msg.outbound ? "#1D4ED8" : H, msg.outbound ? "end" : "start")}
                    </g>
                ))}
                {/* Reply box */}
                <rect x="360" y="402" width="412" height="48" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {T(372, 422, "Reply to thread…", 9, false, M)}
                <rect x="690" y="412" width="74" height="28" rx="4" fill={PRM} />
                {T(727, 430, "Send", 10, true, W, "middle")}
            </svg>
        );

        // ── 11. Marketing Campaigns — attribution dashboard ────────────────
        case 11: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Marketing Campaigns", "18 active · Lead attribution and revenue impact", "+ New Campaign")}
                {K4(36, 52, "ACTIVE CAMPAIGNS", "18", "Across 4 channels")}
                {K4(226, 52, "LEADS GENERATED", "428", "+62% vs last quarter", POS)}
                {K4(416, 52, "ATTRIBUTED REVENUE", "$1.8M", "Closed-won YTD", POS)}
                {K4(606, 52, "COST PER LEAD", "$42", "−$8 vs target", POS)}
                {/* Channel mix donut + legend */}
                <rect x="36" y="130" width="320" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "Lead Source Mix", 11, true, H)}
                {(() => {
                    const cx = 130, cy = 232, r = 56, ir = 36;
                    const segs = [
                        { v: 0.42, c: "#3B82F6", l: "Webform" },
                        { v: 0.24, c: "#8B5CF6", l: "Email" },
                        { v: 0.18, c: "#10B981", l: "Event" },
                        { v: 0.16, c: "#F59E0B", l: "LinkedIn" },
                    ];
                    let acc = 0;
                    return <>{segs.map((s, si) => {
                        const a0 = acc * 2 * Math.PI - Math.PI / 2;
                        const a1 = (acc + s.v) * 2 * Math.PI - Math.PI / 2;
                        acc += s.v;
                        const large = s.v > 0.5 ? 1 : 0;
                        const path = [
                            `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}`,
                            `A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`,
                            `L ${cx + ir * Math.cos(a1)} ${cy + ir * Math.sin(a1)}`,
                            `A ${ir} ${ir} 0 ${large} 0 ${cx + ir * Math.cos(a0)} ${cy + ir * Math.sin(a0)}`,
                            `Z`,
                        ].join(' ');
                        return <path key={si} d={path} fill={s.c} opacity="0.85" />;
                    })}
                        <text x={cx} y={cy - 4} fontFamily={ff} fontSize="11" fill={M} textAnchor="middle">Total</text>
                        <text x={cx} y={cy + 12} fontFamily={ff} fontSize="16" fontWeight="700" fill={H} textAnchor="middle">428</text>
                    </>;
                })()}
                {/* Legend */}
                {[
                    { l: "Webform", n: "180 leads · 42%", c: "#3B82F6" },
                    { l: "Email cadences", n: "104 leads · 24%", c: "#8B5CF6" },
                    { l: "Events", n: "76 leads · 18%", c: "#10B981" },
                    { l: "LinkedIn ads", n: "68 leads · 16%", c: "#F59E0B" },
                ].map((lg, li) => (
                    <g key={li}>
                        <rect x={216} y={176 + li * 30} width="10" height="10" rx="2" fill={lg.c} />
                        {T(232, 184 + li * 30, lg.l, 9, true, H)}
                        {T(232, 196 + li * 30, lg.n, 8, false, M)}
                    </g>
                ))}
                {/* Conversion funnel */}
                <rect x="368" y="130" width="420" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(384, 150, "Campaign Funnel (Q2 2026)", 11, true, H)}
                {([
                    { l: "Reach", v: 24800, w: 1.0, c: "#3B82F6" },
                    { l: "Engaged", v: 4860, w: 0.62, c: "#8B5CF6" },
                    { l: "Leads", v: 428, w: 0.32, c: "#F59E0B" },
                    { l: "Qualified", v: 162, w: 0.18, c: "#10B981" },
                    { l: "Closed-won", v: 38, w: 0.10, c: "#06B6D4" },
                ]).map((f, fi) => {
                    const fullW = 360;
                    const w = fullW * f.w;
                    const x = 384 + (fullW - w) / 2;
                    return (
                        <g key={fi}>
                            <rect x={x} y={172 + fi * 30} width={w} height="22" rx="4" fill={f.c} opacity="0.9" />
                            {T(384 + fullW / 2, 187 + fi * 30, f.l + " · " + f.v.toLocaleString(), 9, true, W, "middle")}
                        </g>
                    );
                })}
                {/* Top campaigns */}
                <rect x="36" y="346" width="752" height="118" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 366, "Top Campaigns by Pipeline Influenced", 11, true, H)}
                {ThRow(372, 44, 736)}
                {["CAMPAIGN", "CHANNEL", "LEADS", "QUALIFIED", "INFLUENCED", "CPL", "ROI"].map((h, hidx) =>
                    T([56, 248, 360, 432, 520, 620, 696][hidx], 385, h, 7.5, true, M)
                )}
                {([
                    { c: "Spring Webinar Series", ch: "Event", l: "162", q: "62", inf: "$420K", cpl: "$38", roi: "11×" },
                    { c: "Q2 LinkedIn Outbound", ch: "LinkedIn", l: "108", q: "42", inf: "$280K", cpl: "$54", roi: "5×" },
                    { c: "Industry Newsletter", ch: "Email", l: "86", q: "28", inf: "$184K", cpl: "$24", roi: "8×" },
                ] as const).map((r, idx) => (
                    <g key={idx}>
                        {Tr(394 + idx * 22, idx % 2 === 0, 44, 736)}
                        {T(56, 410 + idx * 22, r.c, 9, true, PRM)}{T(248, 410 + idx * 22, r.ch, 9, false, M)}
                        {T(380, 410 + idx * 22, r.l, 9, true, H, "middle")}
                        {T(452, 410 + idx * 22, r.q, 9, true, H, "middle")}
                        {T(520, 410 + idx * 22, r.inf, 9.5, true, H)}
                        {T(620, 410 + idx * 22, r.cpl, 9, false, M)}
                        {T(696, 410 + idx * 22, r.roi, 9.5, true, POS)}
                    </g>
                ))}
            </svg>
        );

        // ── 12. Webforms — form builder ────────────────────────────────────
        case 12: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Webform Builder", "Demo Request — embedded on pricing.zopkit.com", "Publish")}
                {/* Tabs */}
                <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {(["Design", "Fields", "Logic", "Routing", "Embed", "Submissions (1,284)"]).map((tab, ti) => (
                    <g key={ti}>
                        <rect x={48 + ti * 122} y="60" width="114" height="18" rx="4" fill={ti === 0 ? PRM : "transparent"} />
                        {T(105 + ti * 122, 72, tab, 8.5, true, ti === 0 ? W : M, "middle")}
                    </g>
                ))}
                {/* Field palette */}
                <rect x="36" y="100" width="180" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 120, "Field Palette", 10, true, H)}
                {([
                    { i: "Aa", l: "Single line text" },
                    { i: "¶", l: "Paragraph" },
                    { i: "@", l: "Email" },
                    { i: "☎", l: "Phone" },
                    { i: "▼", l: "Dropdown" },
                    { i: "☐", l: "Checkbox" },
                    { i: "○", l: "Radio" },
                    { i: "📅", l: "Date" },
                    { i: "↑", l: "File upload" },
                    { i: "#", l: "Number" },
                ]).map((f, fi) => (
                    <g key={fi}>
                        <rect x="44" y={134 + fi * 30} width="164" height="24" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                        <rect x="52" y={140 + fi * 30} width="14" height="14" rx="3" fill="#EFF6FF" />
                        {T(59, 151 + fi * 30, f.i, 9, true, "#1D4ED8", "middle")}
                        {T(74, 151 + fi * 30, f.l, 9, false, H)}
                    </g>
                ))}
                {/* Form preview */}
                <rect x="228" y="100" width="368" height="364" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="1" />
                {T(412, 120, "Live Preview", 10, true, H, "middle")}
                <rect x="244" y="134" width="336" height="316" rx="8" fill={W} stroke={BD} strokeWidth="1" />
                {T(412, 158, "Book a CRM Demo", 14, true, H, "middle")}
                {T(412, 175, "Get a tailored walkthrough in 30 minutes", 9, false, M, "middle")}
                {[
                    { l: "Full name *", v: "Sarah Chen", t: "text" },
                    { l: "Work email *", v: "sarah@acmecorp.com", t: "email" },
                    { l: "Company *", v: "Acme Holdings", t: "text" },
                    { l: "Team size", v: "50–200 employees ▾", t: "select" },
                    { l: "Use case", v: "Sales + Support unified", t: "textarea", h: 40 },
                ].map((fld, fi) => (
                    <g key={fi}>
                        {T(264, 200 + fi * 44, fld.l, 8.5, true, H)}
                        <rect x="264" y={206 + fi * 44} width="296" height={fld.h || 24} rx="4" fill={W} stroke={fi === 1 ? "#3B82F6" : BD} strokeWidth={fi === 1 ? "1" : "0.5"} />
                        {T(274, 222 + fi * 44, fld.v, 8.5, false, fld.v ? H : M)}
                    </g>
                ))}
                <rect x="264" y="416" width="296" height="28" rx="5" fill={PRM} />
                {T(412, 434, "Request Demo →", 10, true, W, "middle")}
                {/* Settings panel */}
                <rect x="608" y="100" width="180" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(624, 120, "Field Settings", 10, true, H)}
                {T(624, 140, "Work email *", 8.5, true, "#1D4ED8")}
                {[
                    { l: "Field type", v: "Email" },
                    { l: "Required", v: "✓ Yes" },
                    { l: "Validation", v: "MX check" },
                    { l: "Maps to", v: "Lead.email" },
                    { l: "Auto-tag", v: "Source: form" },
                ].map((s, si) => (
                    <g key={si}>
                        {T(624, 168 + si * 30, s.l, 7.5, true, M)}
                        {T(624, 182 + si * 30, s.v, 8.5, false, H)}
                        <line x1="624" y1={190 + si * 30} x2="780" y2={190 + si * 30} stroke={BD} strokeWidth="0.3" />
                    </g>
                ))}
                <rect x="616" y="324" width="164" height="64" rx="6" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5" />
                {T(624, 342, "Submissions", 8, true, "#047857")}
                {T(624, 362, "1,284", 22, true, "#047857")}
                {T(624, 378, "+126 this week", 8.5, false, "#047857")}
                <rect x="616" y="394" width="164" height="58" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                {T(624, 412, "Conversion", 8, true, M)}
                {T(624, 432, "26.8%", 16, true, H)}
                {T(624, 446, "Above industry avg", 8, false, M)}
            </svg>
        );

        // ── 13. Email Templates & Cadences — sequence builder ──────────────
        case 13: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Cadence · Outbound — Mid-Market", "5 steps · 412 contacts enrolled · 38% reply rate", "Enroll Contacts")}
                {K4(36, 52, "ENROLLED", "412", "Active in cadence")}
                {K4(226, 52, "OPEN RATE", "62%", "Across all steps", POS)}
                {K4(416, 52, "REPLY RATE", "38%", "+8% vs benchmark", POS)}
                {K4(606, 52, "MEETINGS BOOKED", "48", "12% conversion")}
                {/* Cadence timeline */}
                <rect x="36" y="130" width="752" height="334" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="1" />
                {T(52, 150, "Cadence Steps", 11, true, H)}
                {T(776, 150, "Avg send window: 14 days", 9, false, M, "end")}
                {([
                    { day: "Day 0", type: "Email", subj: "Quick intro · Sales acceleration", body: "Hi {{first_name}}, noticed Acme is hiring SDRs…", open: 78, reply: 22, sent: 412, col: "#3B82F6", icon: "📧" },
                    { day: "Day 2", type: "Email", subj: "Re: {{previous_subject}}", body: "Just floating this back to the top of your inbox…", open: 64, reply: 12, sent: 320, col: "#3B82F6", icon: "📧" },
                    { day: "Day 4", type: "Task", subj: "Call · 5-minute pitch", body: "Manual task — call mobile or office line", open: 0, reply: 0, sent: 220, col: "#10B981", icon: "📞" },
                    { day: "Day 7", type: "LinkedIn", subj: "Connection request + note", body: "Personalized note based on profile", open: 0, reply: 0, sent: 184, col: "#8B5CF6", icon: "🔗" },
                    { day: "Day 12", type: "Email", subj: "Last note — closing your file", body: "Wanted to make one final attempt before…", open: 58, reply: 18, sent: 142, col: "#F59E0B", icon: "📧" },
                ]).map((s, si) => (
                    <g key={si}>
                        <rect x="52" y={172 + si * 56} width="56" height="44" rx="6" fill={s.col} opacity="0.12" />
                        <text x={80} y={194 + si * 56} fontFamily={ff} fontSize="14" textAnchor="middle">{s.icon}</text>
                        {T(80, 210 + si * 56, s.day, 8, true, s.col, "middle")}
                        <rect x="120" y={172 + si * 56} width="500" height="44" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                        {T(132, 188 + si * 56, s.type + " · " + s.subj, 10, true, H)}
                        {T(132, 204 + si * 56, s.body.length > 70 ? s.body.substring(0, 70) + "…" : s.body, 8.5, false, M)}
                        {/* Stats */}
                        <rect x="632" y={172 + si * 56} width="148" height="44" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                        {T(640, 184 + si * 56, "Sent", 7, true, M)}
                        {T(640, 200 + si * 56, s.sent.toString(), 12, true, H)}
                        {s.open > 0 && <>{T(688, 184 + si * 56, "Open %", 7, true, M)}{T(688, 200 + si * 56, s.open + "%", 12, true, POS)}</>}
                        {s.reply > 0 && <>{T(740, 184 + si * 56, "Reply %", 7, true, M)}{T(740, 200 + si * 56, s.reply + "%", 12, true, "#1D4ED8")}</>}
                        {si < 4 && <line x1="80" y1={216 + si * 56} x2="80" y2={228 + si * 56} stroke={BD} strokeWidth="1.5" strokeDasharray="2,2" />}
                    </g>
                ))}
            </svg>
        );

        // ── 14. Bulk Upload — CSV mapping wizard ───────────────────────────
        case 14: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Bulk Upload · contacts_april.csv", "Step 2 of 4 · Map columns to CRM fields", "Run Import")}
                {/* Wizard steps */}
                <rect x="36" y="52" width="752" height="36" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {([
                    { l: "Upload", done: true },
                    { l: "Map fields", done: false, active: true },
                    { l: "Preview", done: false },
                    { l: "Import", done: false },
                ]).map((s, si) => (
                    <g key={si}>
                        <circle cx={92 + si * 188} cy={70} r={11} fill={s.active ? PRM : s.done ? POS : W} stroke={s.active || s.done ? "transparent" : BD} strokeWidth="1.5" />
                        <text x={92 + si * 188} y={74} fontFamily={ff} fontSize="9.5" fontWeight="700" fill={s.active || s.done ? W : M} textAnchor="middle">{s.done ? "✓" : si + 1}</text>
                        {T(110 + si * 188, 74, s.l, 9.5, s.active || s.done, s.active ? H : s.done ? POS : M)}
                        {si < 3 && <line x1={105 + si * 188} y1={70} x2={272 + si * 188 - 80} y2={70} stroke={s.done ? POS : BD} strokeWidth="1.5" />}
                    </g>
                ))}
                {/* File summary */}
                <rect x="36" y="100" width="752" height="48" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
                <rect x="48" y="112" width="24" height="24" rx="4" fill="#3B82F6" />
                {T(60, 129, "📄", 12, false, W, "middle")}
                {T(84, 122, "contacts_april.csv", 11, true, "#1D4ED8")}
                {T(84, 138, "1,284 rows · 12 columns · UTF-8 encoded", 8.5, false, "#1E40AF")}
                <rect x="650" y="110" width="60" height="14" rx="3" fill="#ECFDF5" />
                {T(680, 120, "Valid ✓", 8, true, "#047857", "middle")}
                <rect x="716" y="110" width="60" height="14" rx="3" fill="#FFFBEB" />
                {T(746, 120, "12 dupes", 8, true, "#B45309", "middle")}
                {T(776, 138, "Last imported: 14 days ago · 1,012 records", 8, false, "#1E40AF", "end")}
                {/* Mapping table */}
                <rect x="36" y="160" width="752" height="304" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                <rect x="36" y="160" width="752" height="32" rx="6" fill="#F8FAFC" />
                <rect x="36" y="184" width="752" height="8" fill="#F8FAFC" />
                {T(56, 180, "CSV Column", 9, true, M)}
                {T(248, 180, "Sample", 9, true, M)}
                {T(456, 180, "→", 12, true, M, "middle")}
                {T(496, 180, "CRM Field", 9, true, M)}
                {T(728, 180, "Status", 9, true, M, "middle")}
                {([
                    { col: "full_name", samp: "Sarah Chen", map: "Contact · Full Name", ok: true },
                    { col: "email_address", samp: "sarah@acme.com", map: "Contact · Email", ok: true },
                    { col: "company", samp: "Acme Holdings", map: "Account · Name", ok: true },
                    { col: "phone_mobile", samp: "+1 415-555-2218", map: "Contact · Phone", ok: true },
                    { col: "title", samp: "VP Sales", map: "Contact · Title", ok: true },
                    { col: "industry", samp: "SaaS", map: "Account · Industry", ok: true },
                    { col: "lead_owner_email", samp: "jordan@zopkit.com", map: "Owner (lookup)", ok: true },
                    { col: "notes", samp: "Met at SaaStr…", map: "— Skip column —", ok: false },
                ]).map((r, idx) => (
                    <g key={idx}>
                        <rect x="44" y={202 + idx * 30} width="736" height="26" rx="3" fill={idx % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.3" />
                        {T(56, 218 + idx * 30, r.col, 9, true, PRM)}
                        {T(248, 218 + idx * 30, r.samp, 9, false, M)}
                        {T(456, 218 + idx * 30, "→", 12, true, BD, "middle")}
                        <rect x="488" y={208 + idx * 30} width="200" height="14" rx="3" fill={r.ok ? W : "#F1F5F9"} stroke={r.ok ? "#BFDBFE" : BD} strokeWidth="0.5" />
                        {T(496, 218 + idx * 30, r.map, 8.5, false, r.ok ? "#1D4ED8" : M)}
                        {T(680, 218 + idx * 30, "▾", 8, true, M, "end")}
                        {r.ok ? (
                            <>
                                <circle cx={728} cy={215 + idx * 30} r={6} fill="#ECFDF5" />
                                <text x={728} y={219 + idx * 30} fontFamily={ff} fontSize="9" fontWeight="700" fill="#047857" textAnchor="middle">✓</text>
                            </>
                        ) : (
                            <>
                                <circle cx={728} cy={215 + idx * 30} r={6} fill="#F1F5F9" />
                                <text x={728} y={219 + idx * 30} fontFamily={ff} fontSize="9" fontWeight="700" fill="#64748B" textAnchor="middle">−</text>
                            </>
                        )}
                    </g>
                ))}
            </svg>
        );

        // ── 15. Calendar & Events ──────────────────────────────────────────
        case 15: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Calendar · Week of Apr 26", "12 events · 4 meetings · 3 deal milestones", "+ New Event")}
                {/* View toggle */}
                <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {(["Day", "Week", "Month", "Agenda"]).map((v, vi) => (
                    <g key={vi}>
                        <rect x={48 + vi * 80} y="60" width="72" height="18" rx="4" fill={vi === 1 ? PRM : "transparent"} />
                        {T(84 + vi * 80, 72, v, 8.5, true, vi === 1 ? W : M, "middle")}
                    </g>
                ))}
                {T(776, 72, "Apr 26 – May 2, 2026", 9, true, H, "end")}
                {/* Day headers */}
                {(["MON 26", "TUE 27", "WED 28", "THU 29", "FRI 30", "SAT 1", "SUN 2"]).map((d, di) => (
                    <g key={di}>
                        <rect x={88 + di * 102} y="100" width="100" height="28" rx="0" fill={di === 2 ? "#EFF6FF" : W} stroke={BD} strokeWidth="0.5" />
                        {T(138 + di * 102, 118, d, 8.5, di === 2, di === 2 ? "#1D4ED8" : M, "middle")}
                    </g>
                ))}
                {/* Time column */}
                {(["9 AM", "10", "11", "12 PM", "1", "2", "3", "4", "5"]).map((t, ti) => (
                    <g key={ti}>
                        <rect x="36" y={128 + ti * 36} width="52" height="36" fill={W} stroke={BD} strokeWidth="0.3" />
                        {T(80, 144 + ti * 36, t, 8, false, M, "end")}
                    </g>
                ))}
                {/* Grid cells */}
                {[0, 1, 2, 3, 4, 5, 6].map((d) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
                    <rect key={`c${d}${t}`} x={88 + d * 102} y={128 + t * 36} width="100" height="36" fill={W} stroke={BD} strokeWidth="0.3" />
                )))}
                {/* Events */}
                {([
                    { d: 0, t: 0, dur: 1, name: "Discovery · Acme Corp", col: "#3B82F6", bg: "#EFF6FF" },
                    { d: 0, t: 4, dur: 1, name: "Demo · TechStart", col: "#10B981", bg: "#ECFDF5" },
                    { d: 1, t: 1, dur: 2, name: "Quote review · Q-0184", col: "#F59E0B", bg: "#FFFBEB" },
                    { d: 2, t: 0, dur: 1, name: "Standup · Sales team", col: "#8B5CF6", bg: "#F5F3FF" },
                    { d: 2, t: 3, dur: 2, name: "Close call · Mosaic", col: "#10B981", bg: "#ECFDF5" },
                    { d: 3, t: 2, dur: 1, name: "Cadence review", col: "#06B6D4", bg: "#ECFEFF" },
                    { d: 3, t: 6, dur: 1, name: "1:1 · Manager", col: "#EC4899", bg: "#FDF2F8" },
                    { d: 4, t: 1, dur: 1, name: "QBR · Acme", col: "#3B82F6", bg: "#EFF6FF" },
                    { d: 4, t: 5, dur: 2, name: "Pipeline review", col: "#F59E0B", bg: "#FFFBEB" },
                ]).map((e, ei) => (
                    <g key={ei}>
                        <rect x={90 + e.d * 102} y={130 + e.t * 36} width="96" height={e.dur * 36 - 4} rx="4" fill={e.bg} stroke={e.col} strokeWidth="1" />
                        <rect x={90 + e.d * 102} y={130 + e.t * 36} width="3" height={e.dur * 36 - 4} fill={e.col} />
                        {T(98 + e.d * 102, 144 + e.t * 36, e.name.substring(0, 14), 7.5, true, e.col)}
                        {e.dur > 1 && T(98 + e.d * 102, 156 + e.t * 36, e.name.substring(14), 7.5, false, e.col)}
                    </g>
                ))}
            </svg>
        );

        // ── 16. Tasks & Activities ─────────────────────────────────────────
        case 16: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("My Tasks", "28 open · 8 due today · 3 overdue", "+ New Task")}
                {K4(36, 52, "DUE TODAY", "8", "All assigned to me", WARN)}
                {K4(226, 52, "OVERDUE", "3", "Needs attention", NEG)}
                {K4(416, 52, "COMPLETED (WK)", "32", "On track to goal", POS)}
                {K4(606, 52, "FOLLOWUP RATE", "94%", "+6% vs team avg", POS)}
                {/* Filter pills */}
                <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
                {(["All (28)", "Today (8)", "Overdue (3)", "This week (14)", "Calls (6)", "Emails (12)", "Meetings (4)", "Other (6)"]).map((p, pi) => (
                    <g key={pi}>
                        <rect x={48 + pi * 92} y="138" width="84" height="18" rx="9" fill={pi === 1 ? PRM : W} stroke={pi === 1 ? PRM : BD} strokeWidth="0.5" />
                        {T(90 + pi * 92, 150, p, 7.5, true, pi === 1 ? W : M, "middle")}
                    </g>
                ))}
                {/* Tasks list */}
                {([
                    { done: false, name: "Call Sarah Chen — confirm migration timeline", rec: "Deal · Acme Q2 Renewal", due: "Today 11:00", dueC: WARN, pr: "High", prc: NEG, icon: "📞", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
                    { done: false, name: "Send proposal — Bluepeak migration", rec: "Deal · Bluepeak", due: "Today 2:00 PM", dueC: WARN, pr: "High", prc: NEG, icon: "📧", iconC: "#3B82F6", own: "JL", oc: "#06B6D4" },
                    { done: false, name: "Follow up on quote Q-2026-0181", rec: "Quote · Nordic AB", due: "Today 4:30 PM", dueC: WARN, pr: "Med", prc: WARN, icon: "📞", iconC: "#10B981", own: "EL", oc: "#F59E0B" },
                    { done: false, name: "Demo prep — Voltline deep dive", rec: "Account · Voltline", due: "Tomorrow", dueC: M, pr: "Med", prc: WARN, icon: "📋", iconC: "#8B5CF6", own: "JL", oc: "#06B6D4" },
                    { done: false, name: "Renewal reminder — TechStart Inc", rec: "Account · TechStart", due: "Apr 28", dueC: M, pr: "Med", prc: WARN, icon: "📧", iconC: "#3B82F6", own: "RP", oc: "#8B5CF6" },
                    { done: true, name: "Onboarding kickoff — Mosaic Group", rec: "Account · Mosaic", due: "Done · Apr 25", dueC: POS, pr: "Low", prc: M, icon: "✓", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
                    { done: true, name: "Quarterly business review — Acme", rec: "Account · Acme", due: "Done · Apr 24", dueC: POS, pr: "High", prc: NEG, icon: "✓", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
                ]).map((t, ti) => (
                    <g key={ti}>
                        <rect x="36" y={176 + ti * 40} width="752" height="34" rx="5" fill={ti % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.5" />
                        <rect x="48" y={189 + ti * 40} width="12" height="12" rx="3" fill={t.done ? POS : W} stroke={t.done ? POS : BD} strokeWidth="1.2" />
                        {t.done && <text x={54} y={199 + ti * 40} fontFamily={ff} fontSize="9" fontWeight="700" fill={W} textAnchor="middle">✓</text>}
                        <rect x="70" y={186 + ti * 40} width="20" height="18" rx="4" fill={t.iconC} opacity="0.15" />
                        <text x={80} y={199 + ti * 40} fontFamily={ff} fontSize="10" textAnchor="middle">{t.icon}</text>
                        {T(98, 196 + ti * 40, t.name, 9.5, true, t.done ? M : H)}
                        {T(98, 207 + ti * 40, t.rec, 8, false, M)}
                        <rect x="446" y={186 + ti * 40} width="100" height="18" rx="4" fill={t.dueC === WARN ? "#FFFBEB" : t.dueC === POS ? "#ECFDF5" : "#F1F5F9"} />
                        {T(496, 198 + ti * 40, t.due, 8, true, t.dueC === WARN ? "#B45309" : t.dueC === POS ? "#047857" : "#475569", "middle")}
                        <circle cx={580} cy={195 + ti * 40} r={3} fill={t.prc} />
                        {T(590, 198 + ti * 40, t.pr, 8.5, true, t.prc)}
                        {Avatar(720, 193 + ti * 40, t.own, t.oc, 9)}
                    </g>
                ))}
            </svg>
        );

        // ── 17. Notes & Documents ──────────────────────────────────────────
        case 17: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Deal Notes · Acme Q2 Renewal", "5 notes · 3 documents · Linked to opportunity DEAL-0042", "+ New Note")}
                {/* Notes list */}
                <rect x="36" y="52" width="240" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 72, "Activity Stream", 11, true, H)}
                {([
                    { type: "Note", title: "Discovery call recap", who: "JL", col: "#06B6D4", time: "2h ago", sel: true, icon: "📝" },
                    { type: "Doc", title: "Q2_proposal_v3.pdf", who: "SC", col: "#3B82F6", time: "1d ago", sel: false, icon: "📄" },
                    { type: "Note", title: "Pricing objection — counter $48K", who: "JL", col: "#06B6D4", time: "2d ago", sel: false, icon: "📝" },
                    { type: "Doc", title: "MSA_redlined.docx", who: "Legal", col: "#8B5CF6", time: "3d ago", sel: false, icon: "📄" },
                    { type: "Note", title: "Stakeholder map", who: "JL", col: "#06B6D4", time: "5d ago", sel: false, icon: "📝" },
                    { type: "Doc", title: "Security_questionnaire.xlsx", who: "Sec", col: "#10B981", time: "1w ago", sel: false, icon: "📊" },
                    { type: "Note", title: "Competitor mentions — Salesforce", who: "MR", col: "#F59E0B", time: "1w ago", sel: false, icon: "📝" },
                ]).map((n, ni) => (
                    <g key={ni}>
                        <rect x="44" y={86 + ni * 48} width="224" height="44" rx="5" fill={n.sel ? "#EFF6FF" : W} stroke={n.sel ? "#BFDBFE" : BD} strokeWidth="0.5" />
                        <rect x="52" y={94 + ni * 48} width="22" height="22" rx="4" fill={n.col} opacity="0.15" />
                        <text x={63} y={108 + ni * 48} fontFamily={ff} fontSize="11" textAnchor="middle">{n.icon}</text>
                        {T(82, 102 + ni * 48, n.title, 9, true, H)}
                        {T(82, 114 + ni * 48, n.type + " · " + n.who, 7.5, false, M)}
                        {T(260, 102 + ni * 48, n.time, 7.5, false, M, "end")}
                    </g>
                ))}
                {/* Note editor */}
                <rect x="288" y="52" width="500" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                <rect x="288" y="52" width="500" height="40" rx="6" fill="#FAFBFD" />
                <rect x="288" y="86" width="500" height="6" fill="#FAFBFD" />
                {T(304, 78, "Discovery call recap", 13, true, H)}
                <rect x="690" y="62" width="84" height="22" rx="4" fill={W} stroke={BD} strokeWidth="0.5" />
                {T(732, 76, "+ Attach", 8.5, true, M, "middle")}
                {/* Toolbar */}
                <rect x="304" y="104" width="468" height="28" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                {(["B", "I", "U", "≡", "•", "1.", "🔗", "@"]).map((b, bi) => (
                    <g key={bi}>
                        <rect x={314 + bi * 32} y="110" width="28" height="16" rx="3" fill={W} stroke={BD} strokeWidth="0.3" />
                        {T(328 + bi * 32, 122, b, 9, true, M, "middle")}
                    </g>
                ))}
                {/* Note body */}
                {T(304, 156, "Met with Sarah Chen (VP Sales) and Mark Klein (IT) for 45min", 9.5, true, H)}
                {T(304, 174, "Today, 10:00 AM · Linked: Deal · Acme Q2 Renewal · $340K", 8.5, false, M)}
                {T(304, 204, "Key points:", 10, true, H)}
                {([
                    "• Acme is decision-locked on Q2 renewal — needs sign-off by May 15",
                    "• 25 seats Enterprise + 12 seats Professional confirmed",
                    "• Migration concern: 14 days of parallel data running with Salesforce",
                    "• Next step: Solutions architect call Thu 2pm with Mark Klein (IT)",
                    "",
                    "Pricing: They pushed back on Enterprise rate. Counter-offered $48K",
                    "annual prepay vs. monthly. Awaiting CFO sign-off on their side.",
                ]).map((line, li) => T(304, 224 + li * 18, line, 9, false, H))}
                {/* Mentions/tags */}
                <rect x="304" y="368" width="100" height="20" rx="4" fill="#EFF6FF" />
                {T(354, 381, "@Mark Klein", 8.5, true, "#1D4ED8", "middle")}
                <rect x="412" y="368" width="80" height="20" rx="4" fill="#F5F3FF" />
                {T(452, 381, "#discovery", 8.5, true, "#7E22CE", "middle")}
                {/* Attachments */}
                {T(304, 408, "Attached files (2)", 9, true, H)}
                <rect x="304" y="416" width="220" height="38" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                <rect x="312" y="424" width="22" height="22" rx="3" fill="#FEE2E2" />
                {T(323, 440, "📄", 12, false, "#B91C1C", "middle")}
                {T(342, 432, "Q2_proposal_v3.pdf", 8.5, true, H)}
                {T(342, 444, "1.2 MB · PDF", 7.5, false, M)}
                <rect x="544" y="416" width="220" height="38" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                <rect x="552" y="424" width="22" height="22" rx="3" fill="#DBEAFE" />
                {T(563, 440, "📄", 12, false, "#1E40AF", "middle")}
                {T(582, 432, "MSA_redlined.docx", 8.5, true, H)}
                {T(582, 444, "84 KB · DOCX", 7.5, false, M)}
            </svg>
        );

        // ── 18. Custom Fields & Layouts ────────────────────────────────────
        case 18: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Layout Editor · Contact", "Drag fields to rearrange · 18 custom fields configured", "Save Layout")}
                {/* Field palette */}
                <rect x="36" y="52" width="180" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 72, "Add Field", 10, true, H)}
                <rect x="44" y="82" width="164" height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                {T(52, 96, "🔍 Search field types", 8, false, M)}
                {T(52, 122, "BASIC", 7.5, true, M)}
                {([
                    { i: "Aa", l: "Text" }, { i: "¶", l: "Multi-line" }, { i: "#", l: "Number" }, { i: "$", l: "Currency" },
                    { i: "%", l: "Percent" }, { i: "📅", l: "Date" }, { i: "✓", l: "Checkbox" }, { i: "▼", l: "Picklist" },
                ]).map((f, fi) => (
                    <g key={fi}>
                        <rect x={44 + (fi % 2) * 84} y={132 + Math.floor(fi / 2) * 32} width="80" height="28" rx="4" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
                        <rect x={52 + (fi % 2) * 84} y={140 + Math.floor(fi / 2) * 32} width="16" height="14" rx="3" fill="#EFF6FF" />
                        {T(60 + (fi % 2) * 84, 151 + Math.floor(fi / 2) * 32, f.i, 8.5, true, "#1D4ED8", "middle")}
                        {T(74 + (fi % 2) * 84, 152 + Math.floor(fi / 2) * 32, f.l, 8.5, false, H)}
                    </g>
                ))}
                {T(52, 280, "ADVANCED", 7.5, true, M)}
                {([
                    { i: "🔗", l: "Lookup" }, { i: "📎", l: "File" }, { i: "👤", l: "User" }, { i: "🏷", l: "Multi-tag" },
                    { i: "📍", l: "Address" }, { i: "🔢", l: "Formula" }, { i: "📊", l: "Roll-up" }, { i: "✏", l: "Rich text" },
                ]).map((f, fi) => (
                    <g key={fi}>
                        <rect x={44 + (fi % 2) * 84} y={290 + Math.floor(fi / 2) * 32} width="80" height="28" rx="4" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
                        <rect x={52 + (fi % 2) * 84} y={298 + Math.floor(fi / 2) * 32} width="16" height="14" rx="3" fill="#F5F3FF" />
                        {T(60 + (fi % 2) * 84, 309 + Math.floor(fi / 2) * 32, f.i, 8.5, true, "#7E22CE", "middle")}
                        {T(74 + (fi % 2) * 84, 310 + Math.floor(fi / 2) * 32, f.l, 8.5, false, H)}
                    </g>
                ))}
                {/* Layout canvas */}
                <rect x="228" y="52" width="396" height="412" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="1" />
                {T(244, 72, "Contact Layout · Section: Profile", 11, true, H)}
                {T(608, 72, "Preview · Edit View", 9, false, M, "end")}
                {/* Section: General */}
                <rect x="240" y="86" width="372" height="160" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                <rect x="240" y="86" width="372" height="24" rx="6" fill="#EFF6FF" />
                <rect x="240" y="106" width="372" height="4" fill="#EFF6FF" />
                {T(252, 102, "▾ General Information", 9, true, "#1D4ED8")}
                {T(602, 102, "⋮⋮", 9, true, "#1D4ED8", "end")}
                {/* Fields grid */}
                {([
                    { x: 248, y: 118, l: "Full Name *", v: "Sarah Chen" },
                    { x: 432, y: 118, l: "Title", v: "VP Sales" },
                    { x: 248, y: 156, l: "Email *", v: "sarah@acmecorp.com" },
                    { x: 432, y: 156, l: "Phone", v: "+1 415-555-2218" },
                    { x: 248, y: 194, l: "Account", v: "Acme Holdings 🔗" },
                    { x: 432, y: 194, l: "Owner", v: "Jordan Lee 👤" },
                ]).map((f, fi) => (
                    <g key={fi}>
                        <rect x={f.x} y={f.y} width="172" height="32" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
                        {T(f.x + 8, f.y + 12, f.l, 7.5, true, M)}
                        {T(f.x + 8, f.y + 26, f.v, 9, false, H)}
                    </g>
                ))}
                {/* Section: Custom */}
                <rect x="240" y="256" width="372" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                <rect x="240" y="256" width="372" height="24" rx="6" fill="#F5F3FF" />
                <rect x="240" y="276" width="372" height="4" fill="#F5F3FF" />
                {T(252, 272, "▾ Custom Fields", 9, true, "#7E22CE")}
                {T(602, 272, "⋮⋮", 9, true, "#7E22CE", "end")}
                {([
                    { x: 248, y: 288, l: "Buyer Persona", v: "Champion ▾" },
                    { x: 432, y: 288, l: "Industry vertical", v: "SaaS ▾" },
                    { x: 248, y: 326, l: "Annual Contract Value", v: "$48,000" },
                    { x: 432, y: 326, l: "Last Engagement Score", v: "92 / 100" },
                    { x: 248, y: 364, l: "Subscribed to newsletter", v: "✓ Yes" },
                    { x: 432, y: 364, l: "Preferred contact method", v: "Email ▾" },
                    { x: 248, y: 402, l: "Tags", v: "#decision-maker · #champion · #ent" },
                ]).map((f, fi) => (
                    <g key={fi}>
                        <rect x={f.x} y={f.y} width={fi === 6 ? 356 : 172} height="32" rx="4" fill="#F8FAFC" stroke={fi === 0 ? "#C4B5FD" : BD} strokeWidth={fi === 0 ? "1" : "0.5"} />
                        {T(f.x + 8, f.y + 12, f.l, 7.5, true, M)}
                        {T(f.x + 8, f.y + 26, f.v, 9, false, H)}
                        {fi === 0 && <circle cx={f.x + 168} cy={f.y + 16} r={3} fill="#7E22CE" />}
                    </g>
                ))}
                {/* Field properties */}
                <rect x="636" y="52" width="152" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(648, 72, "Field Properties", 10, true, H)}
                <rect x="644" y="86" width="136" height="22" rx="4" fill="#F5F3FF" />
                {T(652, 100, "Buyer Persona", 8.5, true, "#7E22CE")}
                {[
                    { l: "Field type", v: "Picklist" },
                    { l: "Required", v: "Optional" },
                    { l: "Default value", v: "— None —" },
                    { l: "Options", v: "5 values" },
                    { l: "Visible to", v: "All roles" },
                    { l: "Editable by", v: "Sales only" },
                    { l: "Used in", v: "3 workflows" },
                    { l: "Used in", v: "2 reports" },
                ].map((p, pi) => (
                    <g key={pi}>
                        {T(648, 126 + pi * 34, p.l, 7.5, true, M)}
                        {T(648, 140 + pi * 34, p.v, 9, false, H)}
                        <line x1="648" y1={148 + pi * 34} x2="776" y2={148 + pi * 34} stroke={BD} strokeWidth="0.3" />
                    </g>
                ))}
            </svg>
        );

        // ── 19. Custom Buttons & Functions ─────────────────────────────────
        case 19: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Function · Sync Deal to External CRM", "JavaScript · Triggered by button on Opportunity record", "Save & Deploy")}
                {/* Button placement preview */}
                <rect x="36" y="52" width="320" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 72, "Button Placement", 10, true, H)}
                {/* Mini opportunity record */}
                <rect x="44" y="84" width="304" height="370" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
                <rect x="52" y="96" width="288" height="56" rx="5" fill={W} stroke={BD} strokeWidth="0.5" />
                {T(64, 116, "Acme Q2 Renewal", 11, true, H)}
                {T(64, 132, "DEAL-0042 · Stage: Negotiate · $340K", 8.5, false, M)}
                <rect x="232" y="100" width="100" height="20" rx="4" fill={PRM} />
                {T(282, 113, "↗ Sync to HubSpot", 8, true, W, "middle")}
                <rect x="232" y="124" width="100" height="20" rx="4" fill="#F1F5F9" stroke={BD} strokeWidth="0.5" />
                {T(282, 137, "✉ Send Quote", 8, true, M, "middle")}
                {/* Field rows */}
                {[
                    { l: "Account", v: "Acme Holdings" },
                    { l: "Owner", v: "Jordan Lee" },
                    { l: "Close Date", v: "May 15, 2026" },
                    { l: "Probability", v: "85%" },
                    { l: "Last Activity", v: "Today, 10:42 AM" },
                ].map((f, fi) => (
                    <g key={fi}>
                        <rect x="52" y={164 + fi * 30} width="288" height="26" rx="4" fill={W} stroke={BD} strokeWidth="0.3" />
                        {T(64, 180 + fi * 30, f.l, 8.5, false, M)}
                        {T(328, 180 + fi * 30, f.v, 9, true, H, "end")}
                    </g>
                ))}
                {/* Function log */}
                <rect x="52" y="324" width="288" height="120" rx="5" fill="#0F172A" stroke={BD} strokeWidth="0.5" />
                {T(64, 342, "EXECUTION LOG", 7.5, true, "#64748B")}
                {[
                    { l: "[10:42:18] Function syncDealToHubspot()", c: "#94A3B8" },
                    { l: "[10:42:18] Fetched record DEAL-0042", c: "#94A3B8" },
                    { l: "[10:42:19] POST → api.hubapi.com/deals", c: "#3B82F6" },
                    { l: "[10:42:19] ↳ Status 200 · 248ms", c: "#10B981" },
                    { l: "[10:42:19] Deal synced · ID 8421-XYZ", c: "#10B981" },
                    { l: "[10:42:19] ✓ Function completed (1.2s)", c: "#10B981" },
                ].map((l, li) => T(64, 358 + li * 14, l.l, 7, false, l.c))
                }
                {/* Code editor */}
                <rect x="368" y="52" width="420" height="412" rx="6" fill="#0F172A" stroke={BD} strokeWidth="1" />
                {T(384, 72, "syncDealToHubspot.js", 9, true, "#94A3B8")}
                <rect x="700" y="60" width="76" height="20" rx="4" fill="#10B981" />
                {T(738, 73, "Run Function", 8.5, true, W, "middle")}
                {/* Code lines */}
                {([
                    { ln: 1, c: "async function ", cc: "#7E22CE", c2: "syncDealToHubspot", cc2: "#3B82F6", c3: "({ record, client }) {", cc3: "#E2E8F0" },
                    { ln: 2, c: "  const ", cc: "#7E22CE", c2: "deal", cc2: "#3B82F6", c3: " = record.opportunity;", cc3: "#E2E8F0" },
                    { ln: 3, c: "  ", cc: "#7E22CE", c2: "", cc2: "#3B82F6", c3: "", cc3: "#E2E8F0" },
                    { ln: 4, c: "  // Map CRM fields to HubSpot schema", cc: "#64748B", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 5, c: "  const ", cc: "#7E22CE", c2: "payload", cc2: "#3B82F6", c3: " = {", cc3: "#E2E8F0" },
                    { ln: 6, c: "    dealname: deal.name,", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 7, c: "    amount: deal.amount,", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 8, c: "    closedate: deal.expectedCloseDate,", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 9, c: "    dealstage: ", cc: "#E2E8F0", c2: "mapStage", cc2: "#3B82F6", c3: "(deal.stage),", cc3: "#E2E8F0" },
                    { ln: 10, c: "  };", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 11, c: "  ", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 12, c: "  // POST to HubSpot v3 deals API", cc: "#64748B", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 13, c: "  const ", cc: "#7E22CE", c2: "res", cc2: "#3B82F6", c3: " = await client.fetch(", cc3: "#E2E8F0" },
                    { ln: 14, c: "    ", cc: "#E2E8F0", c2: "\"https://api.hubapi.com/v3/objects/deals\"", cc2: "#A7F3D0", c3: ",", cc3: "#E2E8F0" },
                    { ln: 15, c: "    { method: ", cc: "#E2E8F0", c2: "\"POST\"", cc2: "#A7F3D0", c3: ", body: payload }", cc3: "#E2E8F0" },
                    { ln: 16, c: "  );", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                    { ln: 17, c: "  return { id: res.id, synced: ", cc: "#E2E8F0", c2: "true", cc2: "#F59E0B", c3: " };", cc3: "#E2E8F0" },
                    { ln: 18, c: "}", cc: "#E2E8F0", c2: "", cc2: "", c3: "", cc3: "" },
                ]).map((row, ri) => (
                    <g key={ri}>
                        <text x="384" y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8" fill="#475569">{String(row.ln).padStart(2, " ")}</text>
                        <text x="408" y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8.5" fill={row.cc}>{row.c}</text>
                        {row.c2 && <text x={408 + row.c.length * 4.6} y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8.5" fill={row.cc2}>{row.c2}</text>}
                        {row.c3 && <text x={408 + (row.c.length + row.c2.length) * 4.6} y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8.5" fill={row.cc3}>{row.c3}</text>}
                    </g>
                ))}
                <rect x="376" y="430" width="404" height="28" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="0.5" />
                {T(388, 448, "✓ Saved · Deployed · 1.2s avg runtime · 142 executions today", 8.5, true, "#10B981")}
            </svg>
        );

        // ── 20. Webhooks — event subscriptions ─────────────────────────────
        case 20: return (
            <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <rect width="800" height="480" fill={W} />
                <Sb />{Hdr("Outbound Webhooks", "8 active · Push CRM events to external systems in real time", "+ New Webhook")}
                {K4(36, 52, "ACTIVE WEBHOOKS", "8", "Across 4 destinations")}
                {K4(226, 52, "DELIVERIES (24H)", "2,418", "99.4% success", POS)}
                {K4(416, 52, "FAILED RETRIES", "14", "Auto-retrying", WARN)}
                {K4(606, 52, "AVG LATENCY", "82 ms", "Within SLA", POS)}
                {/* Webhook configs */}
                <rect x="36" y="130" width="380" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(52, 150, "Webhook Endpoints", 11, true, H)}
                {([
                    { name: "HubSpot — Contacts sync", url: "hooks.hubspot.com/...", events: "contact.created, contact.updated", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Slack — #sales-alerts", url: "hooks.slack.com/T0...", events: "deal.won, deal.stage_changed", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Zapier — Lead capture", url: "hooks.zapier.com/...", events: "lead.created", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Internal API — Billing", url: "api.acme.com/crm-events", events: "invoice.paid, invoice.overdue", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
                    { name: "Make.com — Marketing", url: "hook.eu1.make.com/...", events: "contact.tag_added", st: "Paused", bg: "#FFFBEB", tc: "#B45309", pw: 44 },
                ]).map((w, wi) => (
                    <g key={wi}>
                        <rect x="44" y={166 + wi * 58} width="364" height="50" rx="5" fill={W} stroke={BD} strokeWidth="0.5" />
                        <rect x="52" y={174 + wi * 58} width="18" height="34" rx="4" fill={wi === 4 ? "#FFFBEB" : "#EFF6FF"} />
                        {T(61, 195 + wi * 58, "→", 12, true, wi === 4 ? "#B45309" : "#1D4ED8", "middle")}
                        {T(78, 184 + wi * 58, w.name, 9.5, true, H)}
                        {T(78, 196 + wi * 58, w.url, 8, false, M)}
                        {T(78, 208 + wi * 58, w.events, 7.5, false, "#1D4ED8")}
                        {Pill(354, 184 + wi * 58, w.st, w.bg, w.tc, w.pw)}
                    </g>
                ))}
                {/* Event delivery log */}
                <rect x="428" y="130" width="360" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
                {T(444, 150, "Recent Deliveries", 11, true, H)}
                {T(772, 150, "Last 100 events", 8.5, false, M, "end")}
                {([
                    { ts: "14:32:18", evt: "deal.won", dest: "Slack", lat: "78ms", st: "200", ok: true },
                    { ts: "14:31:42", evt: "contact.created", dest: "HubSpot", lat: "112ms", st: "200", ok: true },
                    { ts: "14:30:55", evt: "invoice.paid", dest: "Billing API", lat: "64ms", st: "200", ok: true },
                    { ts: "14:28:11", evt: "lead.created", dest: "Zapier", lat: "92ms", st: "200", ok: true },
                    { ts: "14:24:08", evt: "contact.updated", dest: "HubSpot", lat: "—", st: "503", ok: false },
                    { ts: "14:24:09", evt: "↳ retry 1", dest: "HubSpot", lat: "98ms", st: "200", ok: true },
                    { ts: "14:18:24", evt: "deal.stage_changed", dest: "Slack", lat: "68ms", st: "200", ok: true },
                    { ts: "14:14:02", evt: "contact.created", dest: "HubSpot", lat: "84ms", st: "200", ok: true },
                    { ts: "14:12:50", evt: "invoice.overdue", dest: "Billing API", lat: "72ms", st: "200", ok: true },
                ]).map((d, di) => (
                    <g key={di}>
                        <rect x="436" y={170 + di * 30} width="344" height="26" rx="3" fill={di % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.3" />
                        {T(444, 186 + di * 30, d.ts, 8, false, M)}
                        {T(508, 186 + di * 30, d.evt, 9, true, d.evt.startsWith("↳") ? M : H)}
                        {T(640, 186 + di * 30, d.dest, 8.5, false, M)}
                        {T(728, 186 + di * 30, d.lat, 8, false, M, "end")}
                        <rect x={736} y={177 + di * 30} width="36" height="14" rx="3" fill={d.ok ? "#ECFDF5" : "#FEF2F2"} />
                        {T(754, 187 + di * 30, d.st, 8, true, d.ok ? "#047857" : "#B91C1C", "middle")}
                    </g>
                ))}
                <rect x="436" y="440" width="344" height="0" fill="none" />
            </svg>
        );

        default: return null;
    }
}

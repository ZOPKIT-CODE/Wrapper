// Animated SVG components for CRM modules 0–10
// Each receives lf (localFrame 0-74) and self-animates key elements.
import React from "react";
import { W, BD, H, M, PRM, POS, WARN, NEG, ff } from "../tokens";
import { Sb, Hdr, K4, K3, Pill, ThRow, Tr, T, Avatar } from "./helpers";

// ─── utility ──────────────────────────────────────────────────────────────────
const ap = (lf: number, s: number, e: number) =>
  e <= s ? 1 : Math.max(0, Math.min(1, (lf - s) / (e - s)));

// ── 0. Leads — kanban pipeline ─────────────────────────────────────────────────
export const Svg0: React.FC<{ lf: number }> = ({ lf }) => {
  const cols = [
    { name: "New", count: "15", color: "#3B82F6", bg: "#EFF6FF" },
    { name: "Contacted", count: "12", color: "#8B5CF6", bg: "#F5F3FF" },
    { name: "Qualified", count: "10", color: "#F59E0B", bg: "#FFFBEB" },
    { name: "Proposal", count: "10", color: "#10B981", bg: "#ECFDF5" },
  ];
  const cards = [
    { col: 0, top: 172, name: "Acme Corp", contact: "Sarah Chen", score: 85, src: "Webform", ini: "SC", col2: "#3B82F6" },
    { col: 0, top: 244, name: "TechStart Inc", contact: "Raj Patel", score: 68, src: "Cold email", ini: "RP", col2: "#8B5CF6" },
    { col: 0, top: 316, name: "Bluepeak Ltd", contact: "Maya Singh", score: 91, src: "Referral", ini: "MS", col2: "#10B981" },
    { col: 1, top: 172, name: "Nordic AB", contact: "Erik Lund", score: 76, src: "LinkedIn", ini: "EL", col2: "#F59E0B" },
    { col: 1, top: 244, name: "Voltline Co", contact: "Anita Rao", score: 64, src: "Webform", ini: "AR", col2: "#EC4899" },
    { col: 2, top: 172, name: "Pacific Logix", contact: "Jordan Lee", score: 88, src: "Event", ini: "JL", col2: "#06B6D4" },
    { col: 2, top: 244, name: "Helix Software", contact: "Priya Iyer", score: 79, src: "Webform", ini: "PI", col2: "#8B5CF6" },
    { col: 3, top: 172, name: "Mosaic Group", contact: "Tom Williams", score: 94, src: "Referral", ini: "TW", col2: "#10B981" },
    { col: 3, top: 244, name: "Indus Foods", contact: "Aisha Khan", score: 81, src: "Webform", ini: "AK", col2: "#F59E0B" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Leads", "47 active leads · $2.4M weighted pipeline", "+ Add Lead")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "TOTAL LEADS", "47", "12 new this week")}
        {K4(226, 52, "QUALIFIED", "18", "38% qualification rate", POS)}
        {K4(416, 52, "AVG SCORE", "72", "+5 vs last week", POS)}
        {K4(606, 52, "PIPELINE VALUE", "$2.4M", "Weighted forecast")}
      </g>
      {/* Kanban columns */}
      {cols.map((col, ci) => (
        <g key={ci} opacity={ap(lf, 8 + ci * 4, 20 + ci * 4)}>
          <rect x={36 + ci * 190} y="130" width="180" height="334" rx="8" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
          <rect x={36 + ci * 190} y="130" width="180" height="32" rx="8" fill={col.bg} />
          <rect x={36 + ci * 190} y="154" width="180" height="8" fill={col.bg} />
          {T(48 + ci * 190, 150, col.name, 10, true, col.color)}
          <rect x={186 + ci * 190} y="140" width="22" height="14" rx="7" fill={W} stroke={col.color} strokeWidth="0.5" />
          {T(197 + ci * 190, 150, col.count, 8, true, col.color, "middle")}
        </g>
      ))}
      {/* Lead cards — stagger by column */}
      {cards.map((c, ci) => (
        <g key={ci} opacity={ap(lf, 14 + c.col * 8, 26 + c.col * 8)}>
          <rect x={44 + c.col * 190} y={c.top} width="164" height="64" rx="6" fill={W} stroke={BD} strokeWidth="1" />
          {T(52 + c.col * 190, c.top + 16, c.name, 9.5, true, H)}
          {T(52 + c.col * 190, c.top + 28, c.contact, 8, false, M)}
          {Avatar(56 + c.col * 190, c.top + 50, c.ini, c.col2, 7)}
          {T(70 + c.col * 190, c.top + 53, c.src, 7.5, false, M)}
          <rect x={172 + c.col * 190} y={c.top + 44} width="28" height="14" rx="3"
            fill={c.score >= 80 ? "#ECFDF5" : c.score >= 70 ? "#FFFBEB" : "#F1F5F9"} />
          {T(186 + c.col * 190, c.top + 54, String(c.score), 8, true,
            c.score >= 80 ? "#047857" : c.score >= 70 ? "#B45309" : "#475569", "middle")}
        </g>
      ))}
    </svg>
  );
};

// ── 1. Contacts — profile timeline ─────────────────────────────────────────────
export const Svg1: React.FC<{ lf: number }> = ({ lf }) => {
  const contacts = [
    { ini: "SC", col: "#3B82F6", name: "Sarah Chen", co: "Acme Corp", role: "VP Sales", active: true },
    { ini: "RP", col: "#8B5CF6", name: "Raj Patel", co: "TechStart Inc", role: "CTO", active: true },
    { ini: "MS", col: "#10B981", name: "Maya Singh", co: "Bluepeak", role: "Head of Ops", active: true },
    { ini: "EL", col: "#F59E0B", name: "Erik Lund", co: "Nordic AB", role: "Director", active: false },
    { ini: "AR", col: "#EC4899", name: "Anita Rao", co: "Voltline Co", role: "Manager", active: true },
    { ini: "JL", col: "#06B6D4", name: "Jordan Lee", co: "Pacific Logix", role: "Co-founder", active: true },
    { ini: "PI", col: "#F97316", name: "Priya Iyer", co: "Helix Software", role: "VP Product", active: false },
  ];
  const events = [
    { ts: "Today", act: "Email opened — Q2 proposal", col: "#3B82F6" },
    { ts: "Yesterday", act: "Meeting completed · 45 min", col: "#10B981" },
    { ts: "Apr 22", act: "Call logged — 22 min", col: "#8B5CF6" },
    { ts: "Apr 20", act: "Quote sent — $48K", col: "#F59E0B" },
    { ts: "Apr 18", act: "Lead converted from Webform", col: "#06B6D4" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Contacts", "1,284 contacts · 312 active in last 30 days", "+ New Contact")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "TOTAL CONTACTS", "1,284", "Across 412 accounts")}
        {K4(226, 52, "ACTIVE (30D)", "312", "24% engagement", POS)}
        {K4(416, 52, "DECISION MAKERS", "184", "Tagged as DM")}
        {K4(606, 52, "WITH OPEN DEALS", "96", "$4.8M influenced")}
      </g>
      {/* Contact list panel */}
      <rect x="36" y="130" width="320" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "All Contacts", 11, true, H)}
      <rect x="44" y="160" width="304" height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
      {T(80, 174, "Search", 8, false, M, "middle")}
      {contacts.map((c, ci) => (
        <g key={ci} opacity={ap(lf, 8 + ci * 5, 20 + ci * 5)}>
          <rect x="44" y={190 + ci * 36} width="304" height="32" rx="4"
            fill={ci === 0 ? "#EFF6FF" : ci % 2 === 0 ? W : "#F8FAFC"}
            stroke={ci === 0 ? "#BFDBFE" : BD} strokeWidth="0.5" />
          {Avatar(60, 207 + ci * 36, c.ini, c.col, 10)}
          {T(78, 204 + ci * 36, c.name, 9.5, true, H)}
          {T(78, 217 + ci * 36, `${c.role} · ${c.co}`, 8, false, M)}
          {c.active && <circle cx={336} cy={206 + ci * 36} r={3} fill={POS} />}
        </g>
      ))}
      {/* Detail panel */}
      <rect x="368" y="130" width="420" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <g opacity={ap(lf, 10, 22)}>
        {Avatar(400, 158, "SC", "#3B82F6", 16)}
        {T(424, 156, "Sarah Chen", 13, true, H)}
        {T(424, 170, "VP Sales · Acme Corp · acme.com", 8.5, false, M)}
        <rect x="424" y="178" width="62" height="16" rx="4" fill="#ECFDF5" />
        {T(455, 189, "Decision Maker", 7.5, true, "#047857", "middle")}
        <rect x="492" y="178" width="46" height="16" rx="4" fill="#EFF6FF" />
        {T(515, 189, "Champion", 7.5, true, "#1D4ED8", "middle")}
      </g>
      {T(384, 220, "Activity Timeline", 10, true, H)}
      {events.map((ev, ei) => (
        <g key={ei} opacity={ap(lf, 18 + ei * 7, 30 + ei * 7)}>
          <circle cx={398} cy={244 + ei * 36} r={5} fill={ev.col} opacity="0.18" />
          <circle cx={398} cy={244 + ei * 36} r={2.5} fill={ev.col} />
          {ei < 4 && <line x1={398} y1={250 + ei * 36} x2={398} y2={272 + ei * 36} stroke={BD} strokeWidth="1" strokeDasharray="2,2" />}
          <rect x={412} y={232 + ei * 36} width="362" height="26" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
          {T(420, 244 + ei * 36, ev.ts, 8, true, M)}
          {T(420, 254 + ei * 36, ev.act, 9, false, H)}
        </g>
      ))}
      <g opacity={ap(lf, 55, 68)}>
        <rect x="376" y="420" width="400" height="32" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="0.5" />
        {T(388, 440, "2 open opportunities · $84,000 total", 9, true, "#1D4ED8")}
      </g>
    </svg>
  );
};

// ── 2. Accounts — company hierarchy ────────────────────────────────────────────
export const Svg2: React.FC<{ lf: number }> = ({ lf }) => {
  const accts = [
    { name: "Acme Holdings", type: "Parent", rev: "$4.2M", deals: "11", owner: "SC", oc: "#3B82F6", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "TechStart Inc", type: "Enterprise", rev: "$1.8M", deals: "5", owner: "RP", oc: "#8B5CF6", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Bluepeak Ltd", type: "Mid-Market", rev: "$680K", deals: "3", owner: "MS", oc: "#10B981", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Nordic AB", type: "Mid-Market", rev: "$520K", deals: "2", owner: "EL", oc: "#F59E0B", st: "At Risk", bg: "#FFFBEB", tc: "#B45309", pw: 44 },
    { name: "Voltline Co", type: "SMB", rev: "$240K", deals: "4", owner: "AR", oc: "#EC4899", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Helix Software", type: "Mid-Market", rev: "$420K", deals: "2", owner: "PI", oc: "#F97316", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Mosaic Group", type: "Enterprise", rev: "$1.1M", deals: "6", owner: "TW", oc: "#06B6D4", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Accounts", "412 accounts · Group hierarchy and revenue rollup", "+ New Account")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "TOTAL ACCOUNTS", "412", "118 active deals")}
        {K4(226, 52, "ENTERPRISE", "48", "12 with parent group")}
        {K4(416, 52, "REVENUE (YTD)", "$8.2M", "Across 412 accounts", POS)}
        {K4(606, 52, "AT RISK", "7", "No activity 60+ days", WARN)}
      </g>
      {/* Hierarchy */}
      <rect x="36" y="130" width="296" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "Account Hierarchy", 11, true, H)}
      <g opacity={ap(lf, 10, 22)}>
        <rect x="88" y="162" width="152" height="34" rx="6" fill={PRM} />
        {T(164, 183, "Acme Holdings", 10, true, W, "middle")}
        <line x1="164" y1="196" x2="164" y2="218" stroke={BD} strokeWidth="1.5" />
        <line x1="76" y1="218" x2="252" y2="218" stroke={BD} strokeWidth="1.5" />
        <line x1="76" y1="218" x2="76" y2="234" stroke={BD} strokeWidth="1.5" />
        <line x1="164" y1="218" x2="164" y2="234" stroke={BD} strokeWidth="1.5" />
        <line x1="252" y1="218" x2="252" y2="234" stroke={BD} strokeWidth="1.5" />
      </g>
      {[{ x: 40, label: "Acme US", sub: "Subsidiary" }, { x: 128, label: "Acme EU", sub: "Subsidiary" }, { x: 216, label: "Acme APAC", sub: "Subsidiary" }].map((c, ci) => (
        <g key={ci} opacity={ap(lf, 20 + ci * 4, 32 + ci * 4)}>
          <rect x={c.x} y="234" width="80" height="40" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
          {T(c.x + 40, 251, c.label, 7.5, true, H, "middle")}
          {T(c.x + 40, 264, c.sub, 7, false, M, "middle")}
        </g>
      ))}
      <g opacity={ap(lf, 32, 44)}>
        <rect x="44" y="290" width="280" height="22" rx="4" fill="#EFF6FF" />
        {T(52, 304, "Group revenue: $4.2M YTD", 8.5, true, "#1D4ED8")}
        <rect x="44" y="318" width="280" height="22" rx="4" fill="#F8FAFC" />
        {T(52, 332, "Open opportunities: 11 · $1.8M", 8.5, false, M)}
        <rect x="44" y="346" width="280" height="22" rx="4" fill="#ECFDF5" />
        {T(52, 360, "Health score: Excellent ✓", 8.5, true, "#047857")}
      </g>
      {/* Account table */}
      <rect x="344" y="130" width="444" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(360, 150, "Account Registry", 11, true, H)}
      {ThRow(158, 352, 428)}
      {["ACCOUNT", "TYPE", "REVENUE", "DEALS", "OWNER", "STATUS"].map((h, hidx) =>
        T([364, 488, 540, 600, 644, 700][hidx], 170, h, 7.5, true, M)
      )}
      {accts.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 12 + idx * 5, 24 + idx * 5)}>
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
};

// ── 3. Opportunities — weighted pipeline ────────────────────────────────────────
export const Svg3: React.FC<{ lf: number }> = ({ lf }) => {
  const stages = [
    { stage: "Discover", n: "22", amt: "$1.8M", w: 0.20, col: "#3B82F6" },
    { stage: "Qualify", n: "18", amt: "$2.1M", w: 0.40, col: "#8B5CF6" },
    { stage: "Propose", n: "12", amt: "$2.4M", w: 0.65, col: "#F59E0B" },
    { stage: "Negotiate", n: "7", amt: "$1.4M", w: 0.85, col: "#06B6D4" },
    { stage: "Closing", n: "3", amt: "$0.5M", w: 0.95, col: "#10B981" },
  ];
  const deals = [
    { d: "Acme Q2 Renewal", a: "Acme Holdings", st: "Negotiate", stc: "#06B6D4", amt: "$340K", p: "85%", cl: "May 15", own: "SC", oc: "#3B82F6" },
    { d: "Bluepeak Migration", a: "Bluepeak Ltd", st: "Propose", stc: "#F59E0B", amt: "$220K", p: "65%", cl: "May 28", own: "MS", oc: "#10B981" },
    { d: "Nordic Platform Deal", a: "Nordic AB", st: "Qualify", stc: "#8B5CF6", amt: "$180K", p: "40%", cl: "Jun 10", own: "EL", oc: "#F59E0B" },
    { d: "Mosaic Enterprise", a: "Mosaic Group", st: "Closing", stc: "#10B981", amt: "$420K", p: "95%", cl: "May 8", own: "TW", oc: "#06B6D4" },
    { d: "Pacific Logix Expand", a: "Pacific Logix", st: "Propose", stc: "#F59E0B", amt: "$155K", p: "65%", cl: "May 22", own: "JL", oc: "#06B6D4" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Opportunities", "62 open deals · $4.8M weighted forecast · Q2 2026", "+ New Deal")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "OPEN DEALS", "62", "Across all stages")}
        {K4(226, 52, "PIPELINE", "$8.2M", "Total face value")}
        {K4(416, 52, "WEIGHTED", "$4.8M", "Probability-adjusted", POS)}
        {K4(606, 52, "WIN RATE", "34%", "Last 90 days", POS)}
      </g>
      {/* Stage funnel — bars animate width */}
      <rect x="36" y="130" width="752" height="100" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "Pipeline by Stage", 11, true, H)}
      {T(776, 150, "Q2 2026 · All owners", 9, false, M, "end")}
      {stages.map((s, si) => {
        const barW = 138 * s.w * ap(lf, 10 + si * 4, 30 + si * 4);
        return (
          <g key={si} opacity={ap(lf, 8 + si * 3, 20 + si * 3)}>
            <rect x={52 + si * 146} y="166" width="138" height="50" rx="6" fill={W} stroke={s.col} strokeWidth="1" strokeOpacity="0.4" />
            <rect x={52 + si * 146} y="166" width={barW} height="50" rx="6" fill={s.col} opacity="0.12" />
            {T(60 + si * 146, 180, s.stage, 9, true, H)}
            {T(60 + si * 146, 198, s.n + " deals", 8, false, M)}
            {T(60 + si * 146, 210, s.amt, 10, true, s.col)}
          </g>
        );
      })}
      {/* Top deals */}
      <rect x="36" y="246" width="752" height="218" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 266, "Top Open Deals", 11, true, H)}
      {ThRow(272, 44, 736)}
      {["DEAL", "ACCOUNT", "STAGE", "AMOUNT", "PROB", "CLOSE", "OWNER"].map((h, hidx) =>
        T([56, 188, 320, 444, 528, 588, 668][hidx], 285, h, 7.5, true, M)
      )}
      {deals.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 20 + idx * 6, 34 + idx * 6)}>
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
};

// ── 4. Quotations — quote builder ──────────────────────────────────────────────
export const Svg4: React.FC<{ lf: number }> = ({ lf }) => {
  const steps = [
    { label: "Draft", hi: false },
    { label: "Internal review", hi: true },
    { label: "Approved", hi: true },
    { label: "Sent", hi: false },
    { label: "Accepted", hi: false },
  ];
  const lineItems = [
    { item: "Zopkit CRM — Enterprise", qty: "25", unit: "$199", tax: "$497", amt: "$5,472" },
    { item: "Onboarding Package — 30 days", qty: "1", unit: "$2,400", tax: "$216", amt: "$2,616" },
    { item: "Custom Integration — API", qty: "2", unit: "$1,800", tax: "$324", amt: "$3,924" },
    { item: "Training Workshop · Half-day", qty: "1", unit: "$1,200", tax: "$108", amt: "$1,308" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Quotation Q-2026-0184", "Acme Holdings · Sarah Chen · Sales Q2", "Send Quote")}
      {/* Status strip */}
      <rect x="36" y="52" width="752" height="40" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {steps.map((s, si) => (
        <g key={si} opacity={ap(lf, 6 + si * 3, 18 + si * 3)}>
          <circle cx={86 + si * 146} cy={72} r={10} fill={s.hi ? PRM : W} stroke={s.hi ? PRM : BD} strokeWidth="1.5" />
          {s.hi
            ? <text x={86 + si * 146} y={76} fontFamily={ff} fontSize="9" fontWeight="700" fill={W} textAnchor="middle">✓</text>
            : <text x={86 + si * 146} y={75} fontFamily={ff} fontSize="9" fontWeight="700" fill={M} textAnchor="middle">{si + 1}</text>
          }
          {T(110 + si * 146, 75, s.label, 9, s.hi, s.hi ? H : M)}
          {si < 4 && <line x1={96 + si * 146} y1={72} x2={172 + si * 146} y2={72} stroke={s.hi ? PRM : BD} strokeWidth="1.5" strokeDasharray={s.hi ? "0" : "2,2"} />}
        </g>
      ))}
      {/* Document */}
      <rect x="36" y="106" width="492" height="358" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <rect x="36" y="106" width="492" height="62" rx="6" fill="#F8FAFC" />
      <rect x="36" y="158" width="492" height="10" fill="#F8FAFC" />
      <g opacity={ap(lf, 10, 22)}>
        {T(52, 132, "QUOTATION", 14, true, PRM)}
        {T(52, 150, "Q-2026-0184 · Apr 26, 2026", 9, false, M)}
        {T(516, 132, "Acme Holdings", 11, true, H, "end")}
        {T(516, 148, "Bill to: Sarah Chen", 8.5, false, M, "end")}
        {T(516, 160, "Valid until May 26, 2026", 8.5, false, M, "end")}
      </g>
      {ThRow(184, 44, 476)}
      {["ITEM", "QTY", "UNIT", "TAX", "AMOUNT"].map((h, hidx) =>
        T([56, 308, 360, 408, 510][hidx], 197, h, 7.5, true, M, hidx === 0 ? "start" : "end")
      )}
      {lineItems.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 14 + idx * 8, 26 + idx * 8)}>
          {Tr(212 + idx * 32, idx % 2 === 0, 44, 476)}
          {T(56, 232 + idx * 32, r.item, 9, false, H)}
          {T(308, 232 + idx * 32, r.qty, 9, true, H, "end")}
          {T(380, 232 + idx * 32, r.unit, 9, false, M, "end")}
          {T(440, 232 + idx * 32, r.tax, 8.5, false, M, "end")}
          {T(516, 232 + idx * 32, r.amt, 9.5, true, H, "end")}
        </g>
      ))}
      <g opacity={ap(lf, 48, 60)}>
        <line x1="44" y1="356" x2="520" y2="356" stroke={BD} strokeWidth="0.5" />
        {T(380, 374, "Subtotal", 9, false, M, "end")}{T(516, 374, "$12,175", 9.5, true, H, "end")}
        {T(380, 392, "Tax (9%)", 9, false, M, "end")}{T(516, 392, "$1,145", 9.5, true, H, "end")}
        {T(380, 410, "Discount", 9, false, M, "end")}{T(516, 410, "−$500", 9.5, true, NEG, "end")}
        <rect x="316" y="420" width="208" height="32" rx="5" fill="#EFF6FF" />
        {T(330, 440, "TOTAL", 11, true, "#1D4ED8")}
        {T(516, 440, "$12,820", 14, true, "#1D4ED8", "end")}
      </g>
      {/* Side panel */}
      <rect x="540" y="106" width="248" height="358" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(556, 126, "Quote Details", 11, true, H)}
      <g opacity={ap(lf, 12, 24)}>
        {[
          { l: "Account", v: "Acme Holdings" }, { l: "Contact", v: "Sarah Chen" },
          { l: "Opportunity", v: "Acme Q2 Renewal" }, { l: "Owner", v: "Jordan Lee" },
          { l: "Template", v: "Enterprise.pdf" }, { l: "Approvals", v: "2 of 2 ✓" },
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
      </g>
    </svg>
  );
};

// ── 5. Invoices — receivables + status ─────────────────────────────────────────
export const Svg5: React.FC<{ lf: number }> = ({ lf }) => {
  const aging = [
    { l: "Current", v: 0.62, c: POS, amt: "$125K" },
    { l: "1–30", v: 0.20, c: "#3B82F6", amt: "$40K" },
    { l: "31–60", v: 0.10, c: WARN, amt: "$20K" },
    { l: "61–90", v: 0.05, c: "#F97316", amt: "$10K" },
    { l: "90+", v: 0.03, c: NEG, amt: "$7K" },
  ];
  const invs = [
    { no: "INV-1842", cust: "Acme Holdings", iss: "Apr 22", due: "May 22", amt: "$12,820", rem: "$12,820", st: "Sent", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32 },
    { no: "INV-1841", cust: "Bluepeak Ltd", iss: "Apr 18", due: "May 18", amt: "$6,400", rem: "$3,200", st: "Partial", bg: "#FFFBEB", tc: "#B45309", pw: 40 },
    { no: "INV-1840", cust: "Mosaic Group", iss: "Apr 12", due: "May 12", amt: "$28,500", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
    { no: "INV-1839", cust: "Nordic AB", iss: "Mar 30", due: "Apr 29", amt: "$8,200", rem: "$8,200", st: "Overdue", bg: "#FEF2F2", tc: "#B91C1C", pw: 46 },
    { no: "INV-1838", cust: "Voltline Co", iss: "Mar 28", due: "Apr 27", amt: "$3,600", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
    { no: "INV-1837", cust: "Pacific Logix", iss: "Mar 22", due: "Apr 21", amt: "$14,200", rem: "$0", st: "Paid", bg: "#ECFDF5", tc: "#047857", pw: 32 },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Invoices", "184 invoices this quarter · Payment status & collection", "+ New Invoice")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "OUTSTANDING", "$184K", "Across 32 invoices")}
        {K4(226, 52, "PAID (MTD)", "$420K", "62 invoices", POS)}
        {K4(416, 52, "OVERDUE", "$18K", "4 invoices", NEG)}
        {K4(606, 52, "AVG DSO", "27 days", "−4 days YoY", POS)}
      </g>
      {/* Aging bar */}
      <rect x="36" y="130" width="752" height="60" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 148, "Receivables aging", 10, true, H)}
      {T(776, 148, "Total: $202,400", 9, true, H, "end")}
      {(() => {
        let x = 52;
        return aging.map((b, bi) => {
          const fullW = 720 * b.v;
          const animW = fullW * ap(lf, 10 + bi * 4, 30 + bi * 4);
          const el = (
            <g key={bi}>
              <rect x={x} y={158} width={animW} height={14} rx={3} fill={b.c} opacity={0.8} />
              {b.v > 0.05 && animW > 20 && <text x={x + 8} y={169} fontFamily={ff} fontSize="8" fontWeight="700" fill={W}>{b.l}</text>}
              {b.v > 0.07 && animW > 60 && <text x={x + animW - 8} y={169} fontFamily={ff} fontSize="8" fontWeight="700" fill={W} textAnchor="end">{b.amt}</text>}
              <text x={x + fullW / 2} y={186} fontFamily={ff} fontSize="7.5" fill={M} textAnchor="middle">{b.l}</text>
            </g>
          );
          x += fullW;
          return el;
        });
      })()}
      {/* Invoice table */}
      {ThRow(204)}
      {["INVOICE #", "CUSTOMER", "ISSUED", "DUE", "AMOUNT", "BALANCE", "STATUS"].map((h, hidx) =>
        T([48, 144, 264, 332, 412, 504, 600][hidx], 217, h, 7.5, true, M)
      )}
      {invs.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 16 + idx * 5, 28 + idx * 5)}>
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
};

// ── 6. Sales Orders — fulfilment flow ──────────────────────────────────────────
export const Svg6: React.FC<{ lf: number }> = ({ lf }) => {
  const workflowSteps = [
    { l: "Created", n: "94", hi: false },
    { l: "Confirmed", n: "82", hi: true },
    { l: "Picked", n: "61", hi: true },
    { l: "Shipped", n: "41", hi: true },
    { l: "Delivered", n: "32", hi: false },
  ];
  const orders = [
    { no: "SO-3142", acc: "Acme Holdings", items: "12", val: "$48,200", stage: "Shipped", stc: "#06B6D4", date: "May 2", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
    { no: "SO-3141", acc: "TechStart Inc", items: "4", val: "$12,800", stage: "Picked", stc: "#F59E0B", date: "May 3", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
    { no: "SO-3140", acc: "Bluepeak Ltd", items: "8", val: "$24,400", stage: "Confirmed", stc: "#8B5CF6", date: "May 6", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
    { no: "SO-3139", acc: "Mosaic Group", items: "22", val: "$84,500", stage: "Shipped", stc: "#06B6D4", date: "May 2", st: "Priority", bg: "#FEF2F2", tc: "#B91C1C", pw: 44 },
    { no: "SO-3138", acc: "Voltline Co", items: "3", val: "$6,800", stage: "Delivered", stc: "#10B981", date: "Apr 28", st: "Closed", bg: "#F1F5F9", tc: "#475569", pw: 40 },
    { no: "SO-3137", acc: "Helix Software", items: "6", val: "$18,200", stage: "Picked", stc: "#F59E0B", date: "May 4", st: "On Track", bg: "#ECFDF5", tc: "#047857", pw: 48 },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Sales Orders", "94 open orders · Fulfilment & delivery status", "+ New Order")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "OPEN ORDERS", "94", "Across 48 accounts")}
        {K4(226, 52, "IN FULFILMENT", "32", "Awaiting dispatch")}
        {K4(416, 52, "SHIPPED (WK)", "41", "On-time rate 96%", POS)}
        {K4(606, 52, "ORDER VALUE", "$642K", "This week")}
      </g>
      {/* Workflow strip */}
      <rect x="36" y="130" width="752" height="60" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {T(52, 148, "Order Fulfilment Workflow", 9.5, true, H)}
      {workflowSteps.map((s, si) => (
        <g key={si} opacity={ap(lf, 8 + si * 6, 20 + si * 6)}>
          <rect x={56 + si * 142} y="158" width="86" height="24" rx="4" fill={s.hi ? PRM : W} stroke={s.hi ? PRM : BD} strokeWidth="1" />
          {T(99 + si * 142, 173, s.l, 8.5, true, s.hi ? W : H, "middle")}
          <rect x={148 + si * 142} y="164" width="32" height="12" rx="6" fill={W} stroke={BD} strokeWidth="0.5" />
          {T(164 + si * 142, 173, s.n, 7.5, true, M, "middle")}
          {si < 4 && <line x1={186 + si * 142} y1="170" x2={194 + si * 142} y2="170" stroke={BD} strokeWidth="1.5" />}
        </g>
      ))}
      {ThRow(204)}
      {["ORDER #", "ACCOUNT", "ITEMS", "VALUE", "STAGE", "SHIP DATE", "STATUS"].map((h, hidx) =>
        T([48, 144, 264, 320, 396, 504, 596][hidx], 217, h, 7.5, true, M)
      )}
      {orders.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 18 + idx * 5, 30 + idx * 5)}>
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
};

// ── 7. Approval Processes ───────────────────────────────────────────────────────
export const Svg7: React.FC<{ lf: number }> = ({ lf }) => {
  const approvalSteps = [
    { l: "Submitter", ini: "JL", col: "#06B6D4", role: "Sales Rep · Jordan Lee", status: "Submitted", stc: "#1D4ED8", sbg: "#EFF6FF", time: "Apr 26, 10:14", complete: true },
    { l: "Step 1", ini: "AB", col: "#8B5CF6", role: "Sales Manager · Alex Brown", status: "Approved ✓", stc: "#047857", sbg: "#ECFDF5", time: "Apr 26, 11:42", complete: true },
    { l: "Step 2", ini: "DK", col: "#F59E0B", role: "Finance · Dan Klein", status: "Approved ✓", stc: "#047857", sbg: "#ECFDF5", time: "Apr 26, 14:21", complete: true },
    { l: "Step 3", ini: "MR", col: "#EC4899", role: "VP Sales · Maria Rivera", status: "Pending", stc: "#B45309", sbg: "#FFFBEB", time: "Awaiting", complete: false },
  ];
  const pending = [
    { rec: "Q-2026-0184", typ: "Quote · Acme", amt: "$58.2K", age: "3h", urg: true },
    { rec: "DEAL-0042", typ: "Deal · Mosaic", amt: "$420K", age: "5h", urg: true },
    { rec: "SO-3142", typ: "Order · Acme", amt: "$48.2K", age: "1d", urg: false },
    { rec: "Q-2026-0181", typ: "Quote · Nordic", amt: "$72.5K", age: "1d", urg: false },
    { rec: "DEAL-0038", typ: "Deal · Helix", amt: "$155K", age: "2d", urg: false },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Approval Processes", "Configure multi-step approval chains for deals, quotes & orders", "+ New Process")}
      <g opacity={ap(lf, 6, 18)}>
        {K3(36, 52, "ACTIVE PROCESSES", "12", "Across 4 record types")}
        {K3(289, 52, "PENDING APPROVALS", "28", "16 waiting on me", WARN)}
        {K3(542, 52, "AVG TIME", "4.2 hrs", "−1.8 hrs vs last month", POS)}
      </g>
      <rect x="36" y="130" width="500" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "Quote > $50K Approval Chain", 11, true, H)}
      {approvalSteps.map((step, si) => (
        <g key={si} opacity={ap(lf, 10 + si * 10, 22 + si * 10)}>
          {si < 3 && <line x1={68} y1={196 + si * 70} x2={68} y2={254 + si * 70} stroke={step.complete ? POS : BD} strokeWidth="2" strokeDasharray={step.complete ? "0" : "3,3"} />}
          <circle cx={68} cy={194 + si * 70} r={18} fill={step.col} opacity="0.15" />
          {step.complete
            ? <text x={68} y={200 + si * 70} fontFamily={ff} fontSize="14" fontWeight="700" fill={POS} textAnchor="middle">✓</text>
            : <text x={68} y={199 + si * 70} fontFamily={ff} fontSize="11" fontWeight="700" fill={step.col} textAnchor="middle">{step.ini}</text>
          }
          <rect x={96} y={176 + si * 70} width="424" height="48" rx="5" fill={si === 3 ? "#FFFBEB" : "#F8FAFC"} stroke={si === 3 ? "#FDE68A" : BD} strokeWidth="0.5" />
          {T(108, 192 + si * 70, step.l, 8.5, true, M)}
          {T(108, 206 + si * 70, step.role, 10, true, H)}
          <rect x={398} y={184 + si * 70} width={step.status.length * 5 + 16} height="16" rx="4" fill={step.sbg} />
          {T(398 + (step.status.length * 5 + 16) / 2, 195 + si * 70, step.status, 8, true, step.stc, "middle")}
          {T(108, 220 + si * 70, step.time, 8, false, M)}
        </g>
      ))}
      <rect x="548" y="130" width="240" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(560, 150, "My Pending (16)", 11, true, H)}
      {pending.map((p, pi) => (
        <g key={pi} opacity={ap(lf, 20 + pi * 6, 32 + pi * 6)}>
          <rect x="556" y={168 + pi * 56} width="224" height="48" rx="5" fill={p.urg ? "#FEF2F2" : "#F8FAFC"} stroke={p.urg ? "#FECACA" : BD} strokeWidth="0.5" />
          {T(566, 184 + pi * 56, p.rec, 9, true, PRM)}
          <rect x={730} y={172 + pi * 56} width="42" height="14" rx="3" fill={p.urg ? "#FECACA" : BD} opacity="0.7" />
          {T(751, 182 + pi * 56, p.age + " ago", 7.5, true, p.urg ? "#B91C1C" : "#475569", "middle")}
          {T(566, 198 + pi * 56, p.typ, 8.5, false, M)}
          {T(773, 207 + pi * 56, p.amt, 10, true, H, "end")}
        </g>
      ))}
    </svg>
  );
};

// ── 8. Products & Inventory ─────────────────────────────────────────────────────
export const Svg8: React.FC<{ lf: number }> = ({ lf }) => {
  const products = [
    { sku: "CRM-ENT-01", name: "Zopkit CRM — Enterprise", cat: "Software", price: "$199 /seat", stock: "∞", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
    { sku: "CRM-PRO-01", name: "Zopkit CRM — Professional", cat: "Software", price: "$99 /seat", stock: "∞", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
    { sku: "ONB-30D", name: "Onboarding Package — 30 days", cat: "Services", price: "$2,400", stock: "12 avail", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
    { sku: "INT-API-01", name: "Custom Integration — API", cat: "Services", price: "$1,800", stock: "8 avail", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40, sc: H },
    { sku: "TRN-HD-01", name: "Training Workshop · Half-day", cat: "Training", price: "$1,200", stock: "3 left", st: "Low Stock", bg: "#FFFBEB", tc: "#B45309", pw: 60, sc: WARN },
    { sku: "HW-DOCK-04", name: "Sales Dock — USB-C Hub", cat: "Hardware", price: "$320", stock: "0", st: "Out", bg: "#FEF2F2", tc: "#B91C1C", pw: 28, sc: NEG },
  ];
  const cats = ["All (284)", "Software (118)", "Services (62)", "Training (24)", "Hardware (44)", "Add-ons (36)"];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Products & Inventory", "284 SKUs · Pricing, stock & catalog", "+ New Product")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "TOTAL SKUS", "284", "12 categories")}
        {K4(226, 52, "IN STOCK", "248", "87% availability", POS)}
        {K4(416, 52, "LOW STOCK", "22", "Reorder soon", WARN)}
        {K4(606, 52, "OUT OF STOCK", "14", "Backorder eligible", NEG)}
      </g>
      <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {cats.map((c, ci) => (
        <g key={ci} opacity={ap(lf, 8 + ci * 3, 20 + ci * 3)}>
          <rect x={48 + ci * 122} y="138" width={114} height="18" rx="9" fill={ci === 0 ? PRM : W} stroke={ci === 0 ? PRM : BD} strokeWidth="0.5" />
          {T(105 + ci * 122, 150, c, 8, true, ci === 0 ? W : M, "middle")}
        </g>
      ))}
      {ThRow(176)}
      {["SKU", "PRODUCT", "CATEGORY", "PRICE", "STOCK", "STATUS"].map((h, hidx) =>
        T([48, 132, 360, 488, 564, 660][hidx], 189, h, 7.5, true, M)
      )}
      {products.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 16 + idx * 5, 28 + idx * 5)}>
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
};

// ── 9. Tickets — support with SLA ──────────────────────────────────────────────
export const Svg9: React.FC<{ lf: number }> = ({ lf }) => {
  const tickets = [
    { no: "TKT-4218", subj: "Cannot sync inbox — Gmail", acc: "Acme Holdings", pr: "High", prc: NEG, sla: 0.18, slaT: "2h 12m", st: "Open", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32, own: "DS", oc: "#3B82F6" },
    { no: "TKT-4217", subj: "Quote PDF rendering issue", acc: "TechStart Inc", pr: "Medium", prc: WARN, sla: 0.62, slaT: "6h left", st: "In Prog.", bg: "#FFFBEB", tc: "#B45309", pw: 48, own: "MA", oc: "#10B981" },
    { no: "TKT-4216", subj: "Webhook delivery failing", acc: "Bluepeak Ltd", pr: "High", prc: NEG, sla: 0.08, slaT: "32m left", st: "Open", bg: "#EFF6FF", tc: "#1D4ED8", pw: 32, own: "DS", oc: "#3B82F6" },
    { no: "TKT-4215", subj: "Add custom field — Industry", acc: "Voltline Co", pr: "Low", prc: M, sla: 0.84, slaT: "2d left", st: "Pending", bg: "#F1F5F9", tc: "#475569", pw: 48, own: "PJ", oc: "#8B5CF6" },
    { no: "TKT-4214", subj: "User SSO setup help", acc: "Mosaic Group", pr: "Medium", prc: WARN, sla: 0.45, slaT: "9h left", st: "In Prog.", bg: "#FFFBEB", tc: "#B45309", pw: 48, own: "AL", oc: "#F59E0B" },
    { no: "TKT-4213", subj: "Export CSV truncated", acc: "Helix Software", pr: "Medium", prc: WARN, sla: 0.72, slaT: "1d left", st: "Pending", bg: "#F1F5F9", tc: "#475569", pw: 48, own: "MA", oc: "#10B981" },
  ];
  const tabs = [{ l: "All", n: "47", a: true }, { l: "Open", n: "31" }, { l: "Pending", n: "9" }, { l: "Resolved", n: "478" }, { l: "Closed", n: "1,284" }];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Tickets", "47 open · SLA-tracked support cases", "+ New Ticket")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "OPEN TICKETS", "47", "12 high priority", WARN)}
        {K4(226, 52, "SLA AT RISK", "3", "Breach in <2 hrs", NEG)}
        {K4(416, 52, "AVG RESPONSE", "18 min", "Within SLA target", POS)}
        {K4(606, 52, "RESOLVED (24H)", "62", "First-contact 78%", POS)}
      </g>
      <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {tabs.map((tab, ti) => (
        <g key={ti} opacity={ap(lf, 8 + ti * 2, 18 + ti * 2)}>
          <rect x={48 + ti * 142} y="138" width="132" height="18" rx="4" fill={(tab as {a?: boolean}).a ? PRM : "#F1F5F9"} stroke={(tab as {a?: boolean}).a ? PRM : BD} strokeWidth="0.5" />
          {T(114 + ti * 142, 150, tab.l + " (" + tab.n + ")", 8.5, true, (tab as {a?: boolean}).a ? W : M, "middle")}
        </g>
      ))}
      {ThRow(176)}
      {["TICKET #", "SUBJECT", "ACCOUNT", "PRIORITY", "SLA", "STATUS", "OWNER"].map((h, hidx) =>
        T([48, 132, 308, 416, 488, 596, 700][hidx], 189, h, 7.5, true, M)
      )}
      {tickets.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 16 + idx * 5, 28 + idx * 5)}>
          {Tr(198 + idx * 42, idx % 2 === 0)}
          {T(48, 222 + idx * 42, r.no, 9, true, PRM)}
          {T(132, 222 + idx * 42, r.subj, 9)}
          {T(308, 222 + idx * 42, r.acc, 9, false, M)}
          <circle cx={420} cy={218 + idx * 42} r={3} fill={r.prc} />
          {T(428, 222 + idx * 42, r.pr, 9, true, r.prc)}
          {/* SLA bar — animates fill */}
          <rect x={488} y={216 + idx * 42} width="92" height="6" rx="3" fill="#F1F5F9" />
          <rect x={488} y={216 + idx * 42} width={92 * (1 - r.sla) * ap(lf, 12, 32)} height="6" rx="3"
            fill={r.sla < 0.3 ? NEG : r.sla < 0.6 ? WARN : POS} />
          {T(488, 234 + idx * 42, r.slaT, 7.5, true, r.sla < 0.3 ? NEG : M)}
          {Pill(596, 222 + idx * 42, r.st, r.bg, r.tc, r.pw)}
          {Avatar(720, 218 + idx * 42, r.own, r.oc, 9)}
        </g>
      ))}
    </svg>
  );
};

// ── 10. Communications — unified inbox ─────────────────────────────────────────
export const Svg10: React.FC<{ lf: number }> = ({ lf }) => {
  const chanTabs = [
    { l: "All", n: "1,284", a: true, c: PRM },
    { l: "Email", n: "942", c: "#3B82F6" },
    { l: "Calls", n: "184", c: "#10B981" },
    { l: "Meetings", n: "112", c: "#F59E0B" },
    { l: "Notes", n: "46", c: "#8B5CF6" },
  ];
  const messages = [
    { ini: "SC", col: "#3B82F6", from: "Sarah Chen", subj: "Re: Q2 Renewal Proposal", prev: "Thanks for sending the updated quote. We…", time: "2m", unread: true, sel: true, type: "📧" },
    { ini: "JL", col: "#06B6D4", from: "Call · Jordan Lee", subj: "Discovery — Bluepeak Ltd", prev: "Outcome: Qualified. Next step: Send proposal…", time: "1h", unread: false, sel: false, type: "📞" },
    { ini: "RP", col: "#8B5CF6", from: "Raj Patel", subj: "Pricing question on Enterprise tier", prev: "Quick question — does the Enterprise plan…", time: "3h", unread: true, sel: false, type: "📧" },
    { ini: "MS", col: "#10B981", from: "Meeting · Bluepeak demo", subj: "Wed 11:00 AM — 45 min", prev: "Attendees: Maya Singh, Jordan Lee. Notes:…", time: "5h", unread: false, sel: false, type: "📅" },
    { ini: "EL", col: "#F59E0B", from: "Erik Lund", subj: "Implementation timeline?", prev: "Hi team — we're aiming for end of Q2 go-live…", time: "1d", unread: false, sel: false, type: "📧" },
    { ini: "AR", col: "#EC4899", from: "Anita Rao", subj: "Demo follow-up", prev: "Following up on yesterday's demo. Sharing…", time: "2d", unread: false, sel: false, type: "📧" },
  ];
  const threadMsgs = [
    { ini: "SC", col: "#3B82F6", who: "Sarah Chen", time: "Today 10:14 AM", body: "Thanks for sending the updated quote. We're aligned on the pricing but need to confirm the migration timeline.", outbound: false },
    { ini: "JL", col: "#06B6D4", who: "Jordan Lee · You", time: "Today 10:42 AM", body: "Got it — happy to set up a call this week. How does Thursday 2pm work?", outbound: true },
    { ini: "SC", col: "#3B82F6", who: "Sarah Chen", time: "Today 11:01 AM", body: "Thursday 2pm works. I'll loop in Mark from IT.", outbound: false },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Communications", "Unified inbox · Email, calls, meetings logged per record", "+ Compose")}
      <rect x="36" y="52" width="752" height="36" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {chanTabs.map((tab, ti) => (
        <g key={ti} opacity={ap(lf, 6 + ti * 2, 16 + ti * 2)}>
          <rect x={48 + ti * 144} y="60" width="134" height="20" rx="4" fill={tab.a ? tab.c : W} stroke={BD} strokeWidth="0.5" />
          <circle cx={62 + ti * 144} cy={70} r={3} fill={tab.a ? W : tab.c} />
          {T(115 + ti * 144, 74, tab.l + " (" + tab.n + ")", 8.5, true, tab.a ? W : M, "middle")}
        </g>
      ))}
      {/* Inbox list */}
      <rect x="36" y="100" width="300" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {messages.map((msg, mi) => (
        <g key={mi} opacity={ap(lf, 8 + mi * 5, 20 + mi * 5)}>
          <rect x="44" y={112 + mi * 58} width="284" height="50" rx="4" fill={msg.sel ? "#EFF6FF" : W} stroke={msg.sel ? "#BFDBFE" : BD} strokeWidth="0.5" />
          {Avatar(58, 132 + mi * 58, msg.ini, msg.col, 8)}
          {msg.unread && <circle cx={73} cy={120 + mi * 58} r={3} fill="#3B82F6" />}
          {T(74, 126 + mi * 58, msg.from, 9, msg.unread, H)}
          {T(322, 126 + mi * 58, msg.time, 8, false, M, "end")}
          {T(74, 140 + mi * 58, msg.subj, 8.5, true, H)}
          {T(74, 154 + mi * 58, msg.prev, 7.5, false, M)}
        </g>
      ))}
      {/* Thread view */}
      <rect x="344" y="100" width="444" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <g opacity={ap(lf, 10, 22)}>
        {T(360, 120, "Re: Q2 Renewal Proposal", 12, true, H)}
        {T(360, 136, "Sarah Chen → Jordan Lee · acme.com · Apr 26", 8.5, false, M)}
        <rect x="360" y="146" width="80" height="16" rx="4" fill="#EFF6FF" />
        {T(400, 157, "Linked · Acme", 7.5, true, "#1D4ED8", "middle")}
        <rect x="446" y="146" width="76" height="16" rx="4" fill="#ECFDF5" />
        {T(484, 157, "Deal · $340K", 7.5, true, "#047857", "middle")}
      </g>
      {threadMsgs.map((msg, mi) => (
        <g key={mi} opacity={ap(lf, 14 + mi * 12, 26 + mi * 12)}>
          <rect x={msg.outbound ? 432 : 372} y={180 + mi * 70} width="340" height="62" rx="6"
            fill={msg.outbound ? "#EFF6FF" : "#F8FAFC"} stroke={msg.outbound ? "#BFDBFE" : BD} strokeWidth="0.5" />
          {Avatar(msg.outbound ? 752 : 386, 192 + mi * 70, msg.ini, msg.col, 6)}
          {T(msg.outbound ? 740 : 398, 195 + mi * 70, msg.who, 8.5, true, H, msg.outbound ? "end" : "start")}
          {T(msg.outbound ? 740 : 398, 205 + mi * 70, msg.time, 7, false, M, msg.outbound ? "end" : "start")}
          {T(msg.outbound ? 762 : 384, 222 + mi * 70, msg.body.substring(0, 62), 8, false, msg.outbound ? "#1D4ED8" : H, msg.outbound ? "end" : "start")}
        </g>
      ))}
      <g opacity={ap(lf, 55, 68)}>
        <rect x="360" y="402" width="412" height="48" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
        {T(372, 422, "Reply to thread…", 9, false, M)}
        <rect x="690" y="412" width="74" height="28" rx="4" fill={PRM} />
        {T(727, 430, "Send", 10, true, W, "middle")}
      </g>
    </svg>
  );
};

// Animated SVG components for CRM modules 11–20
import React from "react";
import { W, BD, H, M, PRM, POS, WARN, NEG, ff } from "../tokens";
import { Sb, Hdr, K4, K3, Pill, ThRow, Tr, T, Avatar } from "./helpers";

const ap = (lf: number, s: number, e: number) =>
  e <= s ? 1 : Math.max(0, Math.min(1, (lf - s) / (e - s)));

// ── 11. Marketing Campaigns ─────────────────────────────────────────────────────
export const Svg11: React.FC<{ lf: number }> = ({ lf }) => {
  const funnel = [
    { l: "Reach", v: 24800, w: 1.0, c: "#3B82F6" },
    { l: "Engaged", v: 4860, w: 0.62, c: "#8B5CF6" },
    { l: "Leads", v: 428, w: 0.32, c: "#F59E0B" },
    { l: "Qualified", v: 162, w: 0.18, c: "#10B981" },
    { l: "Closed-won", v: 38, w: 0.10, c: "#06B6D4" },
  ];
  const legend = [
    { l: "Webform", n: "180 leads · 42%", c: "#3B82F6" },
    { l: "Email cadences", n: "104 leads · 24%", c: "#8B5CF6" },
    { l: "Events", n: "76 leads · 18%", c: "#10B981" },
    { l: "LinkedIn ads", n: "68 leads · 16%", c: "#F59E0B" },
  ];
  const campaigns = [
    { c: "Spring Webinar Series", ch: "Event", l: "162", q: "62", inf: "$420K", cpl: "$38", roi: "11×" },
    { c: "Q2 LinkedIn Outbound", ch: "LinkedIn", l: "108", q: "42", inf: "$280K", cpl: "$54", roi: "5×" },
    { c: "Industry Newsletter", ch: "Email", l: "86", q: "28", inf: "$184K", cpl: "$24", roi: "8×" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Marketing Campaigns", "18 active · Lead attribution and revenue impact", "+ New Campaign")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "ACTIVE CAMPAIGNS", "18", "Across 4 channels")}
        {K4(226, 52, "LEADS GENERATED", "428", "+62% vs last quarter", POS)}
        {K4(416, 52, "ATTRIBUTED REVENUE", "$1.8M", "Closed-won YTD", POS)}
        {K4(606, 52, "COST PER LEAD", "$42", "−$8 vs target", POS)}
      </g>
      {/* Donut chart area */}
      <rect x="36" y="130" width="320" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "Lead Source Mix", 11, true, H)}
      <g opacity={ap(lf, 10, 24)}>
        {(() => {
          const cx = 130, cy = 232, r = 56, ir = 36;
          const segs = [
            { v: 0.42, c: "#3B82F6" }, { v: 0.24, c: "#8B5CF6" },
            { v: 0.18, c: "#10B981" }, { v: 0.16, c: "#F59E0B" },
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
        {legend.map((lg, li) => (
          <g key={li}>
            <rect x={216} y={176 + li * 30} width="10" height="10" rx="2" fill={lg.c} />
            {T(232, 184 + li * 30, lg.l, 9, true, H)}
            {T(232, 196 + li * 30, lg.n, 8, false, M)}
          </g>
        ))}
      </g>
      {/* Funnel bars — grow width */}
      <rect x="368" y="130" width="420" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(384, 150, "Campaign Funnel (Q2 2026)", 11, true, H)}
      {funnel.map((f, fi) => {
        const fullW = 360;
        const animW = fullW * f.w * ap(lf, 10 + fi * 5, 30 + fi * 5);
        const x = 384 + (fullW - fullW * f.w) / 2;
        return (
          <g key={fi} opacity={ap(lf, 8 + fi * 4, 20 + fi * 4)}>
            <rect x={x} y={172 + fi * 30} width={animW} height="22" rx="4" fill={f.c} opacity="0.9" />
            {animW > 80 && <text x={384 + fullW / 2} y={187 + fi * 30} fontFamily={ff} fontSize="9" fontWeight="700" fill={W} textAnchor="middle">
              {f.l + " · " + f.v.toLocaleString()}
            </text>}
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
      {campaigns.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 28 + idx * 8, 40 + idx * 8)}>
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
};

// ── 12. Webforms — form builder ─────────────────────────────────────────────────
export const Svg12: React.FC<{ lf: number }> = ({ lf }) => {
  const formTabs = ["Design", "Fields", "Logic", "Routing", "Embed", "Submissions (1,284)"];
  const palette = [
    { i: "Aa", l: "Single line text" }, { i: "¶", l: "Paragraph" }, { i: "@", l: "Email" },
    { i: "☎", l: "Phone" }, { i: "▼", l: "Dropdown" }, { i: "☐", l: "Checkbox" },
    { i: "○", l: "Radio" }, { i: "📅", l: "Date" }, { i: "↑", l: "File upload" }, { i: "#", l: "Number" },
  ];
  const fields = [
    { l: "Full name *", v: "Sarah Chen", t: "text" },
    { l: "Work email *", v: "sarah@acmecorp.com", t: "email" },
    { l: "Company *", v: "Acme Holdings", t: "text" },
    { l: "Team size", v: "50–200 employees ▾", t: "select" },
    { l: "Use case", v: "Sales + Support unified", t: "textarea", h: 40 },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Webform Builder", "Demo Request — embedded on pricing.zopkit.com", "Publish")}
      <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {formTabs.map((tab, ti) => (
        <g key={ti} opacity={ap(lf, 6 + ti * 2, 16 + ti * 2)}>
          <rect x={48 + ti * 122} y="60" width="114" height="18" rx="4" fill={ti === 0 ? PRM : "transparent"} />
          {T(105 + ti * 122, 72, tab, 8.5, true, ti === 0 ? W : M, "middle")}
        </g>
      ))}
      {/* Palette */}
      <rect x="36" y="100" width="180" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 120, "Field Palette", 10, true, H)}
      {palette.map((f, fi) => (
        <g key={fi} opacity={ap(lf, 8 + fi * 3, 20 + fi * 3)}>
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
      {fields.map((fld, fi) => (
        <g key={fi} opacity={ap(lf, 12 + fi * 7, 24 + fi * 7)}>
          {T(264, 200 + fi * 44, fld.l, 8.5, true, H)}
          <rect x="264" y={206 + fi * 44} width="296" height={fld.h || 24} rx="4" fill={W} stroke={fi === 1 ? "#3B82F6" : BD} strokeWidth={fi === 1 ? "1" : "0.5"} />
          {T(274, 222 + fi * 44, fld.v, 8.5, false, H)}
        </g>
      ))}
      <g opacity={ap(lf, 48, 60)}>
        <rect x="264" y="416" width="296" height="28" rx="5" fill={PRM} />
        {T(412, 434, "Request Demo →", 10, true, W, "middle")}
      </g>
      {/* Settings panel */}
      <rect x="608" y="100" width="180" height="364" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(624, 120, "Field Settings", 10, true, H)}
      <g opacity={ap(lf, 10, 22)}>
        {T(624, 140, "Work email *", 8.5, true, "#1D4ED8")}
        {[
          { l: "Field type", v: "Email" }, { l: "Required", v: "✓ Yes" },
          { l: "Validation", v: "MX check" }, { l: "Maps to", v: "Lead.email" },
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
      </g>
    </svg>
  );
};

// ── 13. Email Cadences — sequence builder ───────────────────────────────────────
export const Svg13: React.FC<{ lf: number }> = ({ lf }) => {
  const cadenceSteps = [
    { day: "Day 0", type: "Email", subj: "Quick intro · Sales acceleration", body: "Hi {{first_name}}, noticed Acme is hiring SDRs…", open: 78, reply: 22, sent: 412, col: "#3B82F6", icon: "📧" },
    { day: "Day 2", type: "Email", subj: "Re: {{previous_subject}}", body: "Just floating this back to the top of your inbox…", open: 64, reply: 12, sent: 320, col: "#3B82F6", icon: "📧" },
    { day: "Day 4", type: "Task", subj: "Call · 5-minute pitch", body: "Manual task — call mobile or office line", open: 0, reply: 0, sent: 220, col: "#10B981", icon: "📞" },
    { day: "Day 7", type: "LinkedIn", subj: "Connection request + note", body: "Personalized note based on profile", open: 0, reply: 0, sent: 184, col: "#8B5CF6", icon: "🔗" },
    { day: "Day 12", type: "Email", subj: "Last note — closing your file", body: "Wanted to make one final attempt before…", open: 58, reply: 18, sent: 142, col: "#F59E0B", icon: "📧" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Cadence · Outbound — Mid-Market", "5 steps · 412 contacts enrolled · 38% reply rate", "Enroll Contacts")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "ENROLLED", "412", "Active in cadence")}
        {K4(226, 52, "OPEN RATE", "62%", "Across all steps", POS)}
        {K4(416, 52, "REPLY RATE", "38%", "+8% vs benchmark", POS)}
        {K4(606, 52, "MEETINGS BOOKED", "48", "12% conversion")}
      </g>
      <rect x="36" y="130" width="752" height="334" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="1" />
      {T(52, 150, "Cadence Steps", 11, true, H)}
      {T(776, 150, "Avg send window: 14 days", 9, false, M, "end")}
      {cadenceSteps.map((s, si) => (
        <g key={si} opacity={ap(lf, 10 + si * 10, 22 + si * 10)}>
          <rect x="52" y={172 + si * 56} width="56" height="44" rx="6" fill={s.col} opacity="0.12" />
          <text x={80} y={194 + si * 56} fontFamily={ff} fontSize="14" textAnchor="middle">{s.icon}</text>
          {T(80, 210 + si * 56, s.day, 8, true, s.col, "middle")}
          <rect x="120" y={172 + si * 56} width="500" height="44" rx="6" fill={W} stroke={BD} strokeWidth="1" />
          {T(132, 188 + si * 56, s.type + " · " + s.subj, 10, true, H)}
          {T(132, 204 + si * 56, s.body.length > 68 ? s.body.substring(0, 68) + "…" : s.body, 8.5, false, M)}
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
};

// ── 14. Bulk Upload — CSV mapping wizard ────────────────────────────────────────
export const Svg14: React.FC<{ lf: number }> = ({ lf }) => {
  const wizSteps = [
    { l: "Upload", done: true }, { l: "Map fields", done: false, active: true },
    { l: "Preview", done: false }, { l: "Import", done: false },
  ];
  const mappings = [
    { col: "full_name", samp: "Sarah Chen", map: "Contact · Full Name", ok: true },
    { col: "email_address", samp: "sarah@acme.com", map: "Contact · Email", ok: true },
    { col: "company", samp: "Acme Holdings", map: "Account · Name", ok: true },
    { col: "phone_mobile", samp: "+1 415-555-2218", map: "Contact · Phone", ok: true },
    { col: "title", samp: "VP Sales", map: "Contact · Title", ok: true },
    { col: "industry", samp: "SaaS", map: "Account · Industry", ok: true },
    { col: "lead_owner_email", samp: "jordan@zopkit.com", map: "Owner (lookup)", ok: true },
    { col: "notes", samp: "Met at SaaStr…", map: "— Skip column —", ok: false },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Bulk Upload · contacts_april.csv", "Step 2 of 4 · Map columns to CRM fields", "Run Import")}
      {/* Wizard steps */}
      <rect x="36" y="52" width="752" height="36" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {wizSteps.map((s, si) => (
        <g key={si} opacity={ap(lf, 6 + si * 4, 16 + si * 4)}>
          <circle cx={92 + si * 188} cy={70} r={11}
            fill={(s as {active?: boolean}).active ? PRM : s.done ? POS : W}
            stroke={(s as {active?: boolean}).active || s.done ? "transparent" : BD} strokeWidth="1.5" />
          <text x={92 + si * 188} y={74} fontFamily={ff} fontSize="9.5" fontWeight="700"
            fill={(s as {active?: boolean}).active || s.done ? W : M} textAnchor="middle">
            {s.done ? "✓" : si + 1}
          </text>
          {T(110 + si * 188, 74, s.l, 9.5, (s as {active?: boolean}).active || s.done, (s as {active?: boolean}).active ? H : s.done ? POS : M)}
        </g>
      ))}
      {/* File summary */}
      <g opacity={ap(lf, 10, 22)}>
        <rect x="36" y="100" width="752" height="48" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
        {T(84, 122, "contacts_april.csv", 11, true, "#1D4ED8")}
        {T(84, 138, "1,284 rows · 12 columns · UTF-8 encoded", 8.5, false, "#1E40AF")}
        <rect x="650" y="110" width="60" height="14" rx="3" fill="#ECFDF5" />
        {T(680, 120, "Valid ✓", 8, true, "#047857", "middle")}
        <rect x="716" y="110" width="60" height="14" rx="3" fill="#FFFBEB" />
        {T(746, 120, "12 dupes", 8, true, "#B45309", "middle")}
      </g>
      {/* Mapping table */}
      <rect x="36" y="160" width="752" height="304" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <rect x="36" y="160" width="752" height="32" rx="6" fill="#F8FAFC" />
      <rect x="36" y="184" width="752" height="8" fill="#F8FAFC" />
      {T(56, 180, "CSV Column", 9, true, M)}
      {T(248, 180, "Sample", 9, true, M)}
      {T(456, 180, "→", 12, true, M, "middle")}
      {T(496, 180, "CRM Field", 9, true, M)}
      {T(728, 180, "Status", 9, true, M, "middle")}
      {mappings.map((r, idx) => (
        <g key={idx} opacity={ap(lf, 14 + idx * 5, 26 + idx * 5)}>
          <rect x="44" y={202 + idx * 30} width="736" height="26" rx="3" fill={idx % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.3" />
          {T(56, 218 + idx * 30, r.col, 9, true, PRM)}
          {T(248, 218 + idx * 30, r.samp, 9, false, M)}
          {T(456, 218 + idx * 30, "→", 12, true, BD, "middle")}
          <rect x="488" y={208 + idx * 30} width="200" height="14" rx="3" fill={r.ok ? W : "#F1F5F9"} stroke={r.ok ? "#BFDBFE" : BD} strokeWidth="0.5" />
          {T(496, 218 + idx * 30, r.map, 8.5, false, r.ok ? "#1D4ED8" : M)}
          {r.ok ? (
            <React.Fragment>
              <circle cx={728} cy={215 + idx * 30} r={6} fill="#ECFDF5" />
              <text x={728} y={219 + idx * 30} fontFamily={ff} fontSize="9" fontWeight="700" fill="#047857" textAnchor="middle">✓</text>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <circle cx={728} cy={215 + idx * 30} r={6} fill="#F1F5F9" />
              <text x={728} y={219 + idx * 30} fontFamily={ff} fontSize="9" fontWeight="700" fill="#64748B" textAnchor="middle">−</text>
            </React.Fragment>
          )}
        </g>
      ))}
    </svg>
  );
};

// ── 15. Calendar & Events ───────────────────────────────────────────────────────
export const Svg15: React.FC<{ lf: number }> = ({ lf }) => {
  const days = ["MON 26", "TUE 27", "WED 28", "THU 29", "FRI 30", "SAT 1", "SUN 2"];
  const times = ["9 AM", "10", "11", "12 PM", "1", "2", "3", "4", "5"];
  const events = [
    { d: 0, t: 0, dur: 1, name: "Discovery · Acme Corp", col: "#3B82F6", bg: "#EFF6FF" },
    { d: 0, t: 4, dur: 1, name: "Demo · TechStart", col: "#10B981", bg: "#ECFDF5" },
    { d: 1, t: 1, dur: 2, name: "Quote review · Q-0184", col: "#F59E0B", bg: "#FFFBEB" },
    { d: 2, t: 0, dur: 1, name: "Standup · Sales team", col: "#8B5CF6", bg: "#F5F3FF" },
    { d: 2, t: 3, dur: 2, name: "Close call · Mosaic", col: "#10B981", bg: "#ECFDF5" },
    { d: 3, t: 2, dur: 1, name: "Cadence review", col: "#06B6D4", bg: "#ECFEFF" },
    { d: 3, t: 6, dur: 1, name: "1:1 · Manager", col: "#EC4899", bg: "#FDF2F8" },
    { d: 4, t: 1, dur: 1, name: "QBR · Acme", col: "#3B82F6", bg: "#EFF6FF" },
    { d: 4, t: 5, dur: 2, name: "Pipeline review", col: "#F59E0B", bg: "#FFFBEB" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Calendar · Week of Apr 26", "12 events · 4 meetings · 3 deal milestones", "+ New Event")}
      {/* View toggle */}
      <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {["Day", "Week", "Month", "Agenda"].map((v, vi) => (
        <g key={vi}>
          <rect x={48 + vi * 80} y="60" width="72" height="18" rx="4" fill={vi === 1 ? PRM : "transparent"} />
          {T(84 + vi * 80, 72, v, 8.5, true, vi === 1 ? W : M, "middle")}
        </g>
      ))}
      {T(776, 72, "Apr 26 – May 2, 2026", 9, true, H, "end")}
      {/* Day headers */}
      {days.map((d, di) => (
        <g key={di} opacity={ap(lf, 6 + di * 2, 16 + di * 2)}>
          <rect x={88 + di * 102} y="100" width="100" height="28" rx="0" fill={di === 2 ? "#EFF6FF" : W} stroke={BD} strokeWidth="0.5" />
          {T(138 + di * 102, 118, d, 8.5, di === 2, di === 2 ? "#1D4ED8" : M, "middle")}
        </g>
      ))}
      {/* Time column */}
      {times.map((t, ti) => (
        <g key={ti}>
          <rect x="36" y={128 + ti * 36} width="52" height="36" fill={W} stroke={BD} strokeWidth="0.3" />
          {T(80, 144 + ti * 36, t, 8, false, M, "end")}
        </g>
      ))}
      {/* Grid cells */}
      {[0, 1, 2, 3, 4, 5, 6].map((d) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
        <rect key={`c${d}${t}`} x={88 + d * 102} y={128 + t * 36} width="100" height="36" fill={W} stroke={BD} strokeWidth="0.3" />
      )))}
      {/* Events — stagger */}
      {events.map((e, ei) => (
        <g key={ei} opacity={ap(lf, 12 + ei * 4, 24 + ei * 4)}>
          <rect x={90 + e.d * 102} y={130 + e.t * 36} width="96" height={e.dur * 36 - 4} rx="4" fill={e.bg} stroke={e.col} strokeWidth="1" />
          <rect x={90 + e.d * 102} y={130 + e.t * 36} width="3" height={e.dur * 36 - 4} fill={e.col} />
          {T(98 + e.d * 102, 144 + e.t * 36, e.name.substring(0, 14), 7.5, true, e.col)}
          {e.dur > 1 && T(98 + e.d * 102, 156 + e.t * 36, e.name.substring(14), 7.5, false, e.col)}
        </g>
      ))}
    </svg>
  );
};

// ── 16. Tasks & Activities ──────────────────────────────────────────────────────
export const Svg16: React.FC<{ lf: number }> = ({ lf }) => {
  const tasks = [
    { done: false, name: "Call Sarah Chen — confirm migration timeline", rec: "Deal · Acme Q2 Renewal", due: "Today 11:00", dueC: WARN, pr: "High", prc: NEG, icon: "📞", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
    { done: false, name: "Send proposal — Bluepeak migration", rec: "Deal · Bluepeak", due: "Today 2:00 PM", dueC: WARN, pr: "High", prc: NEG, icon: "📧", iconC: "#3B82F6", own: "JL", oc: "#06B6D4" },
    { done: false, name: "Follow up on quote Q-2026-0181", rec: "Quote · Nordic AB", due: "Today 4:30 PM", dueC: WARN, pr: "Med", prc: WARN, icon: "📞", iconC: "#10B981", own: "EL", oc: "#F59E0B" },
    { done: false, name: "Demo prep — Voltline deep dive", rec: "Account · Voltline", due: "Tomorrow", dueC: M, pr: "Med", prc: WARN, icon: "📋", iconC: "#8B5CF6", own: "JL", oc: "#06B6D4" },
    { done: false, name: "Renewal reminder — TechStart Inc", rec: "Account · TechStart", due: "Apr 28", dueC: M, pr: "Med", prc: WARN, icon: "📧", iconC: "#3B82F6", own: "RP", oc: "#8B5CF6" },
    { done: true, name: "Onboarding kickoff — Mosaic Group", rec: "Account · Mosaic", due: "Done · Apr 25", dueC: POS, pr: "Low", prc: M, icon: "✓", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
    { done: true, name: "Quarterly business review — Acme", rec: "Account · Acme", due: "Done · Apr 24", dueC: POS, pr: "High", prc: NEG, icon: "✓", iconC: "#10B981", own: "JL", oc: "#06B6D4" },
  ];
  const filters = ["All (28)", "Today (8)", "Overdue (3)", "This week (14)", "Calls (6)", "Emails (12)", "Meetings (4)", "Other (6)"];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("My Tasks", "28 open · 8 due today · 3 overdue", "+ New Task")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "DUE TODAY", "8", "All assigned to me", WARN)}
        {K4(226, 52, "OVERDUE", "3", "Needs attention", NEG)}
        {K4(416, 52, "COMPLETED (WK)", "32", "On track to goal", POS)}
        {K4(606, 52, "FOLLOWUP RATE", "94%", "+6% vs team avg", POS)}
      </g>
      <rect x="36" y="130" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1" />
      {filters.map((p, pi) => (
        <g key={pi} opacity={ap(lf, 8 + pi * 2, 18 + pi * 2)}>
          <rect x={48 + pi * 92} y="138" width="84" height="18" rx="9" fill={pi === 1 ? PRM : W} stroke={pi === 1 ? PRM : BD} strokeWidth="0.5" />
          {T(90 + pi * 92, 150, p, 7.5, true, pi === 1 ? W : M, "middle")}
        </g>
      ))}
      {tasks.map((t, ti) => (
        <g key={ti} opacity={ap(lf, 14 + ti * 5, 26 + ti * 5)}>
          <rect x="36" y={176 + ti * 40} width="752" height="34" rx="5" fill={ti % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.5" />
          <rect x="48" y={189 + ti * 40} width="12" height="12" rx="3" fill={t.done ? POS : W} stroke={t.done ? POS : BD} strokeWidth="1.2" />
          {t.done && <text x={54} y={199 + ti * 40} fontFamily={ff} fontSize="9" fontWeight="700" fill={W} textAnchor="middle">✓</text>}
          <rect x="70" y={186 + ti * 40} width="20" height="18" rx="4" fill={t.iconC} opacity="0.15" />
          <text x={80} y={199 + ti * 40} fontFamily={ff} fontSize="10" textAnchor="middle">{t.icon}</text>
          {T(98, 196 + ti * 40, t.name, 9.5, true, t.done ? M : H)}
          {T(98, 207 + ti * 40, t.rec, 8, false, M)}
          <rect x="446" y={186 + ti * 40} width="100" height="18" rx="4"
            fill={t.dueC === WARN ? "#FFFBEB" : t.dueC === POS ? "#ECFDF5" : "#F1F5F9"} />
          {T(496, 198 + ti * 40, t.due, 8, true, t.dueC === WARN ? "#B45309" : t.dueC === POS ? "#047857" : "#475569", "middle")}
          <circle cx={580} cy={195 + ti * 40} r={3} fill={t.prc} />
          {T(590, 198 + ti * 40, t.pr, 8.5, true, t.prc)}
          {Avatar(720, 193 + ti * 40, t.own, t.oc, 9)}
        </g>
      ))}
    </svg>
  );
};

// ── 17. Notes & Documents ───────────────────────────────────────────────────────
export const Svg17: React.FC<{ lf: number }> = ({ lf }) => {
  const notesList = [
    { type: "Note", title: "Discovery call recap", who: "JL", col: "#06B6D4", time: "2h ago", sel: true, icon: "📝" },
    { type: "Doc", title: "Q2_proposal_v3.pdf", who: "SC", col: "#3B82F6", time: "1d ago", sel: false, icon: "📄" },
    { type: "Note", title: "Pricing objection — counter $48K", who: "JL", col: "#06B6D4", time: "2d ago", sel: false, icon: "📝" },
    { type: "Doc", title: "MSA_redlined.docx", who: "Legal", col: "#8B5CF6", time: "3d ago", sel: false, icon: "📄" },
    { type: "Note", title: "Stakeholder map", who: "JL", col: "#06B6D4", time: "5d ago", sel: false, icon: "📝" },
    { type: "Doc", title: "Security_questionnaire.xlsx", who: "Sec", col: "#10B981", time: "1w ago", sel: false, icon: "📊" },
    { type: "Note", title: "Competitor mentions — Salesforce", who: "MR", col: "#F59E0B", time: "1w ago", sel: false, icon: "📝" },
  ];
  const noteLines = [
    "Met with Sarah Chen (VP Sales) and Mark Klein (IT) for 45min",
    "Today, 10:00 AM · Linked: Deal · Acme Q2 Renewal · $340K",
    "",
    "Key points:",
    "• Acme is decision-locked on Q2 renewal — sign-off by May 15",
    "• 25 seats Enterprise + 12 seats Professional confirmed",
    "• Migration concern: 14 days of parallel data running",
    "• Next step: Solutions architect call Thu 2pm with IT team",
    "",
    "Pricing: They pushed back on Enterprise rate. Counter-offered",
    "$48K annual prepay vs. monthly. Awaiting CFO sign-off.",
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Deal Notes · Acme Q2 Renewal", "5 notes · 3 documents · Linked to opportunity DEAL-0042", "+ New Note")}
      {/* Notes list */}
      <rect x="36" y="52" width="240" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 72, "Activity Stream", 11, true, H)}
      {notesList.map((n, ni) => (
        <g key={ni} opacity={ap(lf, 8 + ni * 5, 20 + ni * 5)}>
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
      {/* Toolbar */}
      <rect x="304" y="104" width="468" height="28" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
      {["B", "I", "U", "≡", "•", "1.", "🔗", "@"].map((b, bi) => (
        <g key={bi}>
          <rect x={314 + bi * 32} y="110" width="28" height="16" rx="3" fill={W} stroke={BD} strokeWidth="0.3" />
          {T(328 + bi * 32, 122, b, 9, true, M, "middle")}
        </g>
      ))}
      {/* Note content lines — stagger */}
      {noteLines.map((line, li) => line ? (
        <g key={li} opacity={ap(lf, 12 + li * 4, 24 + li * 4)}>
          {T(304, 156 + li * 18, line, li < 2 ? (li === 0 ? 9.5 : 8.5) : 9, li === 0 || li === 3, li === 0 ? H : li === 1 ? M : H)}
        </g>
      ) : null)}
      <g opacity={ap(lf, 55, 68)}>
        <rect x="304" y="368" width="100" height="20" rx="4" fill="#EFF6FF" />
        {T(354, 381, "@Mark Klein", 8.5, true, "#1D4ED8", "middle")}
        <rect x="412" y="368" width="80" height="20" rx="4" fill="#F5F3FF" />
        {T(452, 381, "#discovery", 8.5, true, "#7E22CE", "middle")}
      </g>
    </svg>
  );
};

// ── 18. Custom Fields & Layouts ─────────────────────────────────────────────────
export const Svg18: React.FC<{ lf: number }> = ({ lf }) => {
  const basicFields = [
    { i: "Aa", l: "Text" }, { i: "¶", l: "Multi-line" }, { i: "#", l: "Number" }, { i: "$", l: "Currency" },
    { i: "%", l: "Percent" }, { i: "📅", l: "Date" }, { i: "✓", l: "Checkbox" }, { i: "▼", l: "Picklist" },
  ];
  const advFields = [
    { i: "🔗", l: "Lookup" }, { i: "📎", l: "File" }, { i: "👤", l: "User" }, { i: "🏷", l: "Multi-tag" },
    { i: "📍", l: "Address" }, { i: "🔢", l: "Formula" }, { i: "📊", l: "Roll-up" }, { i: "✏", l: "Rich text" },
  ];
  const generalFields = [
    { x: 248, y: 118, l: "Full Name *", v: "Sarah Chen" }, { x: 432, y: 118, l: "Title", v: "VP Sales" },
    { x: 248, y: 156, l: "Email *", v: "sarah@acmecorp.com" }, { x: 432, y: 156, l: "Phone", v: "+1 415-555-2218" },
    { x: 248, y: 194, l: "Account", v: "Acme Holdings 🔗" }, { x: 432, y: 194, l: "Owner", v: "Jordan Lee 👤" },
  ];
  const customFields = [
    { x: 248, y: 288, l: "Buyer Persona", v: "Champion ▾", wide: false },
    { x: 432, y: 288, l: "Industry vertical", v: "SaaS ▾", wide: false },
    { x: 248, y: 326, l: "Annual Contract Value", v: "$48,000", wide: false },
    { x: 432, y: 326, l: "Last Engagement Score", v: "92 / 100", wide: false },
    { x: 248, y: 364, l: "Subscribed to newsletter", v: "✓ Yes", wide: false },
    { x: 432, y: 364, l: "Preferred contact method", v: "Email ▾", wide: false },
    { x: 248, y: 402, l: "Tags", v: "#decision-maker · #champion · #ent", wide: true },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Layout Editor · Contact", "Drag fields to rearrange · 18 custom fields configured", "Save Layout")}
      {/* Palette */}
      <rect x="36" y="52" width="180" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 72, "Add Field", 10, true, H)}
      {T(52, 122, "BASIC", 7.5, true, M)}
      {basicFields.map((f, fi) => (
        <g key={fi} opacity={ap(lf, 8 + fi * 2, 18 + fi * 2)}>
          <rect x={44 + (fi % 2) * 84} y={132 + Math.floor(fi / 2) * 32} width="80" height="28" rx="4" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
          <rect x={52 + (fi % 2) * 84} y={140 + Math.floor(fi / 2) * 32} width="16" height="14" rx="3" fill="#EFF6FF" />
          {T(60 + (fi % 2) * 84, 151 + Math.floor(fi / 2) * 32, f.i, 8.5, true, "#1D4ED8", "middle")}
          {T(74 + (fi % 2) * 84, 152 + Math.floor(fi / 2) * 32, f.l, 8.5, false, H)}
        </g>
      ))}
      {T(52, 280, "ADVANCED", 7.5, true, M)}
      {advFields.map((f, fi) => (
        <g key={fi} opacity={ap(lf, 18 + fi * 2, 28 + fi * 2)}>
          <rect x={44 + (fi % 2) * 84} y={290 + Math.floor(fi / 2) * 32} width="80" height="28" rx="4" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
          <rect x={52 + (fi % 2) * 84} y={298 + Math.floor(fi / 2) * 32} width="16" height="14" rx="3" fill="#F5F3FF" />
          {T(60 + (fi % 2) * 84, 309 + Math.floor(fi / 2) * 32, f.i, 8.5, true, "#7E22CE", "middle")}
          {T(74 + (fi % 2) * 84, 310 + Math.floor(fi / 2) * 32, f.l, 8.5, false, H)}
        </g>
      ))}
      {/* Layout canvas */}
      <rect x="228" y="52" width="396" height="412" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="1" />
      {T(244, 72, "Contact Layout · Section: Profile", 11, true, H)}
      <rect x="240" y="86" width="372" height="160" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <rect x="240" y="86" width="372" height="24" rx="6" fill="#EFF6FF" />
      <rect x="240" y="106" width="372" height="4" fill="#EFF6FF" />
      {T(252, 102, "▾ General Information", 9, true, "#1D4ED8")}
      {generalFields.map((f, fi) => (
        <g key={fi} opacity={ap(lf, 10 + fi * 4, 22 + fi * 4)}>
          <rect x={f.x} y={f.y} width="172" height="32" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5" />
          {T(f.x + 8, f.y + 12, f.l, 7.5, true, M)}
          {T(f.x + 8, f.y + 26, f.v, 9, false, H)}
        </g>
      ))}
      <rect x="240" y="256" width="372" height="200" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      <rect x="240" y="256" width="372" height="24" rx="6" fill="#F5F3FF" />
      <rect x="240" y="276" width="372" height="4" fill="#F5F3FF" />
      {T(252, 272, "▾ Custom Fields", 9, true, "#7E22CE")}
      {customFields.map((f, fi) => (
        <g key={fi} opacity={ap(lf, 24 + fi * 4, 36 + fi * 4)}>
          <rect x={f.x} y={f.y} width={f.wide ? 356 : 172} height="32" rx="4" fill="#F8FAFC"
            stroke={fi === 0 ? "#C4B5FD" : BD} strokeWidth={fi === 0 ? "1" : "0.5"} />
          {T(f.x + 8, f.y + 12, f.l, 7.5, true, M)}
          {T(f.x + 8, f.y + 26, f.v, 9, false, H)}
        </g>
      ))}
      {/* Properties panel */}
      <rect x="636" y="52" width="152" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(648, 72, "Field Properties", 10, true, H)}
      <g opacity={ap(lf, 12, 24)}>
        <rect x="644" y="86" width="136" height="22" rx="4" fill="#F5F3FF" />
        {T(652, 100, "Buyer Persona", 8.5, true, "#7E22CE")}
        {[
          { l: "Field type", v: "Picklist" }, { l: "Required", v: "Optional" },
          { l: "Default value", v: "— None —" }, { l: "Options", v: "5 values" },
          { l: "Visible to", v: "All roles" }, { l: "Editable by", v: "Sales only" },
          { l: "Used in", v: "3 workflows" }, { l: "Used in", v: "2 reports" },
        ].map((p, pi) => (
          <g key={pi}>
            {T(648, 126 + pi * 34, p.l, 7.5, true, M)}
            {T(648, 140 + pi * 34, p.v, 9, false, H)}
            <line x1="648" y1={148 + pi * 34} x2="776" y2={148 + pi * 34} stroke={BD} strokeWidth="0.3" />
          </g>
        ))}
      </g>
    </svg>
  );
};

// ── 19. Custom Buttons & Functions ──────────────────────────────────────────────
export const Svg19: React.FC<{ lf: number }> = ({ lf }) => {
  const logLines = [
    { l: "[10:42:18] Function syncDealToHubspot()", c: "#94A3B8" },
    { l: "[10:42:18] Fetched record DEAL-0042", c: "#94A3B8" },
    { l: "[10:42:19] POST → api.hubapi.com/deals", c: "#3B82F6" },
    { l: "[10:42:19] ↳ Status 200 · 248ms", c: "#10B981" },
    { l: "[10:42:19] Deal synced · ID 8421-XYZ", c: "#10B981" },
    { l: "[10:42:19] ✓ Function completed (1.2s)", c: "#10B981" },
  ];
  const codeRows = [
    { ln: 1, c: "async function syncDealToHubspot({ record, client }) {", cc: "#7E22CE" },
    { ln: 2, c: "  const deal = record.opportunity;", cc: "#E2E8F0" },
    { ln: 3, c: "", cc: "#E2E8F0" },
    { ln: 4, c: "  // Map CRM fields to HubSpot schema", cc: "#64748B" },
    { ln: 5, c: "  const payload = {", cc: "#E2E8F0" },
    { ln: 6, c: "    dealname: deal.name,", cc: "#E2E8F0" },
    { ln: 7, c: "    amount: deal.amount,", cc: "#E2E8F0" },
    { ln: 8, c: "    closedate: deal.expectedCloseDate,", cc: "#E2E8F0" },
    { ln: 9, c: "    dealstage: mapStage(deal.stage),", cc: "#E2E8F0" },
    { ln: 10, c: "  };", cc: "#E2E8F0" },
    { ln: 11, c: "", cc: "#E2E8F0" },
    { ln: 12, c: "  // POST to HubSpot v3 deals API", cc: "#64748B" },
    { ln: 13, c: "  const res = await client.fetch(", cc: "#E2E8F0" },
    { ln: 14, c: '    "https://api.hubapi.com/v3/objects/deals",', cc: "#A7F3D0" },
    { ln: 15, c: '    { method: "POST", body: payload }', cc: "#E2E8F0" },
    { ln: 16, c: "  );", cc: "#E2E8F0" },
    { ln: 17, c: "  return { id: res.id, synced: true };", cc: "#E2E8F0" },
    { ln: 18, c: "}", cc: "#E2E8F0" },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Function · Sync Deal to External CRM", "JavaScript · Triggered by button on Opportunity record", "Save & Deploy")}
      {/* Button placement preview */}
      <rect x="36" y="52" width="320" height="412" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 72, "Button Placement", 10, true, H)}
      <g opacity={ap(lf, 8, 20)}>
        <rect x="44" y="84" width="304" height="370" rx="6" fill="#FAFBFD" stroke={BD} strokeWidth="0.5" />
        <rect x="52" y="96" width="288" height="56" rx="5" fill={W} stroke={BD} strokeWidth="0.5" />
        {T(64, 116, "Acme Q2 Renewal", 11, true, H)}
        {T(64, 132, "DEAL-0042 · Stage: Negotiate · $340K", 8.5, false, M)}
        <rect x="232" y="100" width="100" height="20" rx="4" fill={PRM} />
        {T(282, 113, "↗ Sync to HubSpot", 8, true, W, "middle")}
        <rect x="232" y="124" width="100" height="20" rx="4" fill="#F1F5F9" stroke={BD} strokeWidth="0.5" />
        {T(282, 137, "✉ Send Quote", 8, true, M, "middle")}
        {[
          { l: "Account", v: "Acme Holdings" }, { l: "Owner", v: "Jordan Lee" },
          { l: "Close Date", v: "May 15, 2026" }, { l: "Probability", v: "85%" },
          { l: "Last Activity", v: "Today, 10:42 AM" },
        ].map((f, fi) => (
          <g key={fi}>
            <rect x="52" y={164 + fi * 30} width="288" height="26" rx="4" fill={W} stroke={BD} strokeWidth="0.3" />
            {T(64, 180 + fi * 30, f.l, 8.5, false, M)}
            {T(328, 180 + fi * 30, f.v, 9, true, H, "end")}
          </g>
        ))}
      </g>
      {/* Execution log — lines stream in */}
      <rect x="52" y="324" width="288" height="120" rx="5" fill="#0F172A" stroke={BD} strokeWidth="0.5" />
      {T(64, 342, "EXECUTION LOG", 7.5, true, "#64748B")}
      {logLines.map((line, li) => (
        <g key={li} opacity={ap(lf, 20 + li * 6, 30 + li * 6)}>
          {T(64, 358 + li * 14, line.l, 7, false, line.c)}
        </g>
      ))}
      {/* Code editor — lines appear staggered */}
      <rect x="368" y="52" width="420" height="412" rx="6" fill="#0F172A" stroke={BD} strokeWidth="1" />
      {T(384, 72, "syncDealToHubspot.js", 9, true, "#94A3B8")}
      <rect x="700" y="60" width="76" height="20" rx="4" fill="#10B981" />
      {T(738, 73, "Run Function", 8.5, true, W, "middle")}
      {codeRows.map((row, ri) => (
        <g key={ri} opacity={ap(lf, 10 + ri * 2, 22 + ri * 2)}>
          <text x="384" y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8" fill="#475569">{String(row.ln).padStart(2, " ")}</text>
          <text x="408" y={102 + ri * 18} fontFamily="ui-monospace,monospace" fontSize="8.5" fill={row.cc}>{row.c}</text>
        </g>
      ))}
      <g opacity={ap(lf, 55, 68)}>
        <rect x="376" y="430" width="404" height="28" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="0.5" />
        {T(388, 448, "✓ Saved · Deployed · 1.2s avg runtime · 142 executions today", 8.5, true, "#10B981")}
      </g>
    </svg>
  );
};

// ── 20. Webhooks — event subscriptions ─────────────────────────────────────────
export const Svg20: React.FC<{ lf: number }> = ({ lf }) => {
  const webhooks = [
    { name: "HubSpot — Contacts sync", url: "hooks.hubspot.com/...", events: "contact.created, contact.updated", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Slack — #sales-alerts", url: "hooks.slack.com/T0...", events: "deal.won, deal.stage_changed", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Zapier — Lead capture", url: "hooks.zapier.com/...", events: "lead.created", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Internal API — Billing", url: "api.acme.com/crm-events", events: "invoice.paid, invoice.overdue", st: "Active", bg: "#ECFDF5", tc: "#047857", pw: 40 },
    { name: "Make.com — Marketing", url: "hook.eu1.make.com/...", events: "contact.tag_added", st: "Paused", bg: "#FFFBEB", tc: "#B45309", pw: 44 },
  ];
  const deliveries = [
    { ts: "14:32:18", evt: "deal.won", dest: "Slack", lat: "78ms", st: "200", ok: true },
    { ts: "14:31:42", evt: "contact.created", dest: "HubSpot", lat: "112ms", st: "200", ok: true },
    { ts: "14:30:55", evt: "invoice.paid", dest: "Billing API", lat: "64ms", st: "200", ok: true },
    { ts: "14:28:11", evt: "lead.created", dest: "Zapier", lat: "92ms", st: "200", ok: true },
    { ts: "14:24:08", evt: "contact.updated", dest: "HubSpot", lat: "—", st: "503", ok: false },
    { ts: "14:24:09", evt: "↳ retry 1", dest: "HubSpot", lat: "98ms", st: "200", ok: true },
    { ts: "14:18:24", evt: "deal.stage_changed", dest: "Slack", lat: "68ms", st: "200", ok: true },
    { ts: "14:14:02", evt: "contact.created", dest: "HubSpot", lat: "84ms", st: "200", ok: true },
    { ts: "14:12:50", evt: "invoice.overdue", dest: "Billing API", lat: "72ms", st: "200", ok: true },
  ];

  return (
    <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect width="800" height="480" fill={W} />
      <Sb />
      {Hdr("Outbound Webhooks", "8 active · Push CRM events to external systems in real time", "+ New Webhook")}
      <g opacity={ap(lf, 6, 18)}>
        {K4(36, 52, "ACTIVE WEBHOOKS", "8", "Across 4 destinations")}
        {K4(226, 52, "DELIVERIES (24H)", "2,418", "99.4% success", POS)}
        {K4(416, 52, "FAILED RETRIES", "14", "Auto-retrying", WARN)}
        {K4(606, 52, "AVG LATENCY", "82 ms", "Within SLA", POS)}
      </g>
      {/* Webhook configs */}
      <rect x="36" y="130" width="380" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(52, 150, "Webhook Endpoints", 11, true, H)}
      {webhooks.map((w, wi) => (
        <g key={wi} opacity={ap(lf, 10 + wi * 7, 22 + wi * 7)}>
          <rect x="44" y={166 + wi * 58} width="364" height="50" rx="5" fill={W} stroke={BD} strokeWidth="0.5" />
          <rect x="52" y={174 + wi * 58} width="18" height="34" rx="4" fill={wi === 4 ? "#FFFBEB" : "#EFF6FF"} />
          {T(61, 195 + wi * 58, "→", 12, true, wi === 4 ? "#B45309" : "#1D4ED8", "middle")}
          {T(78, 184 + wi * 58, w.name, 9.5, true, H)}
          {T(78, 196 + wi * 58, w.url, 8, false, M)}
          {T(78, 208 + wi * 58, w.events, 7.5, false, "#1D4ED8")}
          {Pill(354, 184 + wi * 58, w.st, w.bg, w.tc, w.pw)}
        </g>
      ))}
      {/* Delivery log — rows stream in */}
      <rect x="428" y="130" width="360" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1" />
      {T(444, 150, "Recent Deliveries", 11, true, H)}
      {T(772, 150, "Last 100 events", 8.5, false, M, "end")}
      {deliveries.map((d, di) => (
        <g key={di} opacity={ap(lf, 8 + di * 4, 18 + di * 4)}>
          <rect x="436" y={170 + di * 30} width="344" height="26" rx="3" fill={di % 2 === 0 ? W : "#FAFBFD"} stroke={BD} strokeWidth="0.3" />
          {T(444, 186 + di * 30, d.ts, 8, false, M)}
          {T(508, 186 + di * 30, d.evt, 9, true, d.evt.startsWith("↳") ? M : H)}
          {T(640, 186 + di * 30, d.dest, 8.5, false, M)}
          {T(728, 186 + di * 30, d.lat, 8, false, M, "end")}
          <rect x={736} y={177 + di * 30} width="36" height="14" rx="3" fill={d.ok ? "#ECFDF5" : "#FEF2F2"} />
          {T(754, 187 + di * 30, d.st, 8, true, d.ok ? "#047857" : "#B91C1C", "middle")}
        </g>
      ))}
    </svg>
  );
};

/**
 * AgentChatDemo — animated recreation of the AgentChat Remotion scene.
 * Pure React + CSS transitions, no Remotion dependency.
 * Loops automatically every ~6.5s.
 */
import { useEffect, useRef, useState } from "react";

const S = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const PRM = "#142a5e";

const ROWS = [
    { order: 1, stage: "Prospecting",    badge: "Active",      bc: "#16A34A", bb: "#DCFCE7" },
    { order: 2, stage: "Qualification",  badge: "Active",      bc: "#16A34A", bb: "#DCFCE7" },
    { order: 3, stage: "Demo Scheduled", badge: "Active",      bc: "#16A34A", bb: "#DCFCE7" },
    { order: 4, stage: "Proposal Sent",  badge: "Active",      bc: "#16A34A", bb: "#DCFCE7" },
    { order: 5, stage: "Negotiation",    badge: "Negotiation", bc: "#D97706", bb: "#FEF3C7" },
    { order: 6, stage: "Closed Won",     badge: "Won",         bc: "#059669", bb: "#D1FAE5" },
    { order: 7, stage: "Closed Lost",    badge: "Lost",        bc: "#DC2626", bb: "#FEE2E2" },
] as const;

const APP_SOURCES = [
    { app: "wrapper", iconBg: "#2563EB", label: "Opportunity synced" },
    { app: "crm",     iconBg: "#7C3AED", label: "Pipeline created" },
    { app: "fa",      iconBg: "#0891B2", label: "Field reps notified" },
] as const;

const QUICK_ACTIONS = ["Summarize pipeline", "Stuck deals", "Draft follow-up", "Create lead"] as const;

// Keys and their reveal times (ms from animation start)
const REVEAL_TIMES: Record<string, number> = {
    nav: 180,
    date: 360,
    user: 560,
    aiMeta: 860,
    aiText: 1420,
    th: 1540,
    r0: 1640, r1: 1720, r2: 1800, r3: 1880, r4: 1960, r5: 2040, r6: 2120,
    confirm: 2380,
    settings: 2560,
    p0: 2640, p1: 2720, p2: 2800,
    q0: 2980, q1: 3060, q2: 3140, q3: 3220,
    input: 3380,
};
const TOTAL_DURATION = 5200; // hold at end then restart

function useReveal(loop: number) {
    const [visible, setVisible] = useState<Set<string>>(new Set());
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        setVisible(new Set());
        timers.current.forEach(clearTimeout);
        timers.current = [];

        for (const [key, delay] of Object.entries(REVEAL_TIMES)) {
            timers.current.push(
                setTimeout(() => setVisible(prev => new Set([...prev, key])), delay)
            );
        }
        return () => { timers.current.forEach(clearTimeout); };
    }, [loop]);

    return (key: string) => visible.has(key);
}

function fadeStyle(shown: boolean, dist = 10): React.CSSProperties {
    return {
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${dist}px)`,
        transition: "opacity 0.32s ease, transform 0.32s ease",
    };
}

function Avatar({ label, bg, size = 26 }: { label: string; bg: string; size?: number }) {
    return (
        <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: S, fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>{label}</span>
        </div>
    );
}

function Badge({ label, bc, bb }: { label: string; bc: string; bb: string }) {
    return (
        <span style={{ display: "inline-block", background: bb, color: bc, borderRadius: 5, padding: "1px 8px", fontFamily: S, fontSize: 10.5, fontWeight: 700 }}>
            {label}
        </span>
    );
}

function TypingDots({ show }: { show: boolean }) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!show) return;
        const id = setInterval(() => setTick(t => t + 1), 120);
        return () => clearInterval(id);
    }, [show]);
    if (!show) return null;

    const ys = [0, 1, 2].map(i => {
        const phase = ((tick + i * 4) % 12) / 12;
        return Math.sin(phase * Math.PI) * 4;
    });

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px 14px 14px 3px", padding: "8px 12px", width: "fit-content" }}>
            {ys.map((y, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#CBD5E1", transform: `translateY(${-y}px)`, transition: "transform 0.12s ease" }} />
            ))}
        </div>
    );
}

export function AgentChatDemo() {
    const [loop, setLoop] = useState(0);
    const is = useReveal(loop);

    // Typing dots visible only between aiMeta and aiText
    const [showDots, setShowDots] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setShowDots(true),  REVEAL_TIMES.aiMeta + 60);
        const t2 = setTimeout(() => setShowDots(false), REVEAL_TIMES.aiText - 80);
        const reset = setTimeout(() => { setLoop(l => l + 1); setShowDots(false); }, TOTAL_DURATION);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(reset); };
    }, [loop]);

    return (
        <div style={{ width: "100%", maxWidth: 620, marginLeft: "auto" }}>
            {/* ── macOS browser chrome ───────────────────────────────────── */}
            <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 0 rgba(15,28,58,0.04), 0 24px 60px rgba(15,28,58,0.14), 0 8px 20px rgba(15,28,58,0.06)", overflow: "hidden", border: "1px solid #e2e4ea" }}>
                {/* Title bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "#f0f1f4", borderBottom: "1px solid #e2e4ea" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff605c", display: "inline-block" }} />
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd44", display: "inline-block" }} />
                        <i style={{ width: 11, height: 11, borderRadius: "50%", background: "#00ca4e", display: "inline-block" }} />
                    </div>
                    <div style={{ flex: 1, height: 22, background: "#fff", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: S, fontSize: 11, color: "#6b7280", border: "1px solid #e2e4ea" }}>
                        app.zopkit.com/ai
                    </div>
                </div>

                {/* ── Chat UI ───────────────────────────────────────────────── */}
                <div style={{ background: "#fff", display: "flex", flexDirection: "column", height: 460 }}>

                    {/* Nav bar */}
                    <div style={{ ...fadeStyle(is("nav")), height: 36, background: "#fff", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0, gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                        <span style={{ fontFamily: S, fontSize: 10.5, fontWeight: 600, color: "#64748B" }}>connected</span>
                        <span style={{ color: "#E2E8F0" }}>·</span>
                        <span style={{ fontFamily: S, fontSize: 10.5, color: "#94A3B8" }}>live data</span>
                        <div style={{ marginLeft: "auto", fontFamily: S, fontSize: 10, fontWeight: 600, color: "#94A3B8", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 5, padding: "1px 7px" }}>Clear session ↑</div>
                    </div>

                    {/* Scrollable area */}
                    <div style={{ flex: 1, overflow: "hidden", padding: "12px 18px 8px", display: "flex", flexDirection: "column" }}>

                        {/* Date separator */}
                        <div style={{ ...fadeStyle(is("date")), textAlign: "center", fontFamily: S, fontSize: 10.5, color: "#94A3B8", marginBottom: 12 }}>
                            Mon 25 May · 1 message
                        </div>

                        {/* User message */}
                        <div style={{ ...fadeStyle(is("user")), display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
                            <Avatar label="ME" bg={PRM} size={24} />
                            <div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
                                    <span style={{ fontFamily: S, fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>You</span>
                                    <span style={{ fontFamily: S, fontSize: 10, color: "#94A3B8" }}>11:11</span>
                                </div>
                                <div style={{ fontFamily: S, fontSize: 11.5, color: "#334155", lineHeight: 1.55 }}>
                                    Create a sales pipeline with stages: Prospecting, Qualification, Demo Scheduled, Proposal Sent, Negotiation, Closed Won, Closed Lost.
                                </div>
                            </div>
                        </div>

                        {/* AI message */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ ...fadeStyle(is("aiMeta"), 8), flexShrink: 0 }}>
                                <Avatar label="ZP" bg="#7C3AED" size={24} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ ...fadeStyle(is("aiMeta"), 8), display: "flex", alignItems: "baseline", gap: 7, marginBottom: 5 }}>
                                    <span style={{ fontFamily: S, fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>Zop</span>
                                    <span style={{ fontFamily: S, fontSize: 10, color: "#94A3B8" }}>11:11</span>
                                </div>

                                <TypingDots show={showDots} />

                                <div style={{ opacity: is("aiText") ? 1 : 0, transition: "opacity 0.3s ease" }}>
                                    <div style={{ fontFamily: S, fontSize: 11.5, color: "#334155", lineHeight: 1.55, marginBottom: 8 }}>
                                        The sales pipeline is live. Here is what was set up:
                                    </div>

                                    {/* Table */}
                                    <div style={{ ...fadeStyle(is("th")), border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                                        {/* Header */}
                                        <div style={{ display: "flex", padding: "5px 12px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                            <span style={{ width: 36, fontFamily: S, fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>Order</span>
                                            <span style={{ flex: 1, fontFamily: S, fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>Stage</span>
                                            <span style={{ fontFamily: S, fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>Type</span>
                                        </div>
                                        {ROWS.map((row, i) => (
                                            <div
                                                key={row.order}
                                                style={{
                                                    ...fadeStyle(is(`r${i}`), 6),
                                                    display: "flex", alignItems: "center",
                                                    padding: "5px 12px",
                                                    background: i % 2 === 1 ? "#F8FAFF" : "#fff",
                                                    borderBottom: i < ROWS.length - 1 ? "1px solid #F1F5F9" : "none",
                                                }}
                                            >
                                                <span style={{ width: 36, fontFamily: S, fontSize: 11, color: "#94A3B8" }}>{row.order}</span>
                                                <span style={{ flex: 1, fontFamily: S, fontSize: 11, color: "#0F172A", fontWeight: 500 }}>{row.stage}</span>
                                                <Badge label={row.badge} bc={row.bc} bb={row.bb} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Confirmation */}
                                    <div style={fadeStyle(is("confirm"))}>
                                        <div style={{ fontFamily: S, fontSize: 11, color: "#334155", lineHeight: 1.6, marginBottom: 5 }}>
                                            This is now the default pipeline for all new opportunity records. You can view or edit it in{" "}
                                            <span style={{ color: "#2563EB", textDecoration: "underline" }}>Pipelines settings</span>.
                                        </div>
                                    </div>

                                    {/* Settings chip */}
                                    <div style={{ ...fadeStyle(is("settings")), display: "inline-flex", alignItems: "center", gap: 4, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", marginBottom: 7 }}>
                                        <span style={{ fontSize: 10.5 }}>⚙</span>
                                        <span style={{ fontFamily: S, fontSize: 10.5, fontWeight: 600, color: "#475569" }}>Pipelines settings</span>
                                        <span style={{ color: "#CBD5E1", fontSize: 9 }}>↗</span>
                                    </div>

                                    {/* App source pills */}
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                        {APP_SOURCES.map((src, i) => (
                                            <div
                                                key={src.app}
                                                style={{ ...fadeStyle(is(`p${i}`), 6), display: "flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 8px" }}
                                            >
                                                <div style={{ width: 13, height: 13, borderRadius: 3, background: src.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <span style={{ fontFamily: S, fontSize: 7, fontWeight: 800, color: "#fff" }}>Z</span>
                                                </div>
                                                <span style={{ fontFamily: S, fontSize: 9.5, fontWeight: 600, color: "#64748B" }}>zopkit · {src.app}</span>
                                                <span style={{ width: 1, height: 8, background: "#E2E8F0" }} />
                                                <span style={{ fontFamily: S, fontSize: 9.5, color: "#94A3B8" }}>{src.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick action chips */}
                    <div style={{ borderTop: "1px solid #F1F5F9", padding: "6px 14px", display: "flex", gap: 6, flexShrink: 0, background: "#fff", flexWrap: "wrap" }}>
                        {QUICK_ACTIONS.map((label, i) => (
                            <div key={label} style={{ ...fadeStyle(is(`q${i}`), 6), background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 100, padding: "3px 10px", fontFamily: S, fontSize: 10.5, fontWeight: 500, color: "#475569", whiteSpace: "nowrap" }}>
                                + {label}
                            </div>
                        ))}
                    </div>

                    {/* Input bar */}
                    <div style={{ ...fadeStyle(is("input")), padding: "6px 12px 8px", background: "#fff", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "6px 10px", gap: 8, background: "#FAFAFA" }}>
                            <span style={{ fontFamily: S, fontSize: 10.5, color: "#94A3B8" }}>🖇 Attach</span>
                            <span style={{ fontFamily: S, fontSize: 10.5, color: "#94A3B8" }}>⚙ Tools</span>
                            <span style={{ flex: 1, fontFamily: S, fontSize: 10.5, color: "#94A3B8", borderLeft: "1px solid #E2E8F0", paddingLeft: 8 }}>
                                Ask about a deal, account — or type / for commands
                            </span>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 11, color: "#94A3B8" }}>↑</span>
                            </div>
                        </div>
                        <div style={{ textAlign: "center", fontFamily: S, fontSize: 9.5, color: "#CBD5E1", marginTop: 4 }}>
                            Zopkit AI · Powered by live data · Responses may be inaccurate
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

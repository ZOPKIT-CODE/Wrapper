import React, { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { ProductData } from '@/types/products';
import { Check, X, Zap, XCircle, CheckCircle, Minus, AlertCircle, Sparkles, LayoutGrid, ChevronRight, Maximize2, ArrowRight, Play, Calendar } from 'lucide-react';
import { MiniSparkline } from '@/components/common/MiniSparkline';
import { productPagesData, productInfo } from '@/data/productPages';
import {
    getPricingAppIdForProductSlug,
    getProductModuleMatrixRows,
} from '@/data/productPricingModuleBridge';
import { NavbarButton } from "@/components/ui/resizable-navbar";
import { LandingFooter } from '@/components/layout/LandingFooter';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { FAMobileProductPage } from './FAMobileProductPage';
import { getCRMFeatureSvg } from './getCRMFeatureSvg';

interface FeatureCardProps {
    feature: {
        icon: any;
        title: string;
        description: string;
        benefits?: string[];
        subFeatures?: string[];
    };
    i: number;
    productId?: string;
}

const cardThemes = [
    {
        bg: "linear-gradient(150deg, #f8faff 0%, #f1f5ff 60%, #eef2ff 100%)",
        orb1: "rgba(59,130,246,0.1)",
        orb2: "rgba(99,102,241,0.07)",
        orb1Pos: "8% 12%",
        orb2Pos: "88% 88%",
        accent: "#3b5bdb",
        accentDim: "rgba(59,91,219,0.08)",
        accentBorder: "rgba(59,91,219,0.18)",
        gradientFrom: "#3b5bdb",
        gradientTo: "#6741d9",
        checkRing: "rgba(59,91,219,0.1)",
        checkColor: "#3b5bdb",
        frameBg: "rgba(255,255,255,0.85)",
        frameBorder: "rgba(0,0,0,0.07)",
        frameGlowColor: "rgba(59,91,219,0.1)",
        fadeColor: "#f1f5ff",
        titleColor: "#0f172a",
        descColor: "rgba(15,23,42,0.58)",
        benefitColor: "rgba(15,23,42,0.52)",
        cardShadow: "0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(59,91,219,0.08)",
        floatChipBg: "rgba(255,255,255,0.95)",
        floatChipBorder: "rgba(0,0,0,0.08)",
        floatChipText: "rgba(15,23,42,0.45)",
        floatChip1: { label: "Entries saved", value: "−60%", color: "#16a34a" },
        floatChip2: { label: "Accuracy", value: "99.9%", color: "#3b5bdb" },
    },
    {
        bg: "linear-gradient(150deg, #f6fdf9 0%, #ecfdf5 60%, #f0fdf4 100%)",
        orb1: "rgba(16,185,129,0.1)",
        orb2: "rgba(6,182,212,0.06)",
        orb1Pos: "12% 15%",
        orb2Pos: "90% 78%",
        accent: "#047857",
        accentDim: "rgba(4,120,87,0.08)",
        accentBorder: "rgba(4,120,87,0.16)",
        gradientFrom: "#047857",
        gradientTo: "#0369a1",
        checkRing: "rgba(4,120,87,0.1)",
        checkColor: "#047857",
        frameBg: "rgba(255,255,255,0.85)",
        frameBorder: "rgba(0,0,0,0.07)",
        frameGlowColor: "rgba(4,120,87,0.09)",
        fadeColor: "#ecfdf5",
        titleColor: "#0f172a",
        descColor: "rgba(15,23,42,0.58)",
        benefitColor: "rgba(15,23,42,0.52)",
        cardShadow: "0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(4,120,87,0.07)",
        floatChipBg: "rgba(255,255,255,0.95)",
        floatChipBorder: "rgba(0,0,0,0.08)",
        floatChipText: "rgba(15,23,42,0.45)",
        floatChip1: { label: "Tasks automated", value: "+3×", color: "#047857" },
        floatChip2: { label: "Time saved", value: "40h/mo", color: "#0369a1" },
    },
    {
        bg: "linear-gradient(150deg, #fffbf5 0%, #fff7ed 60%, #fff4e6 100%)",
        orb1: "rgba(194,65,12,0.09)",
        orb2: "rgba(180,120,0,0.07)",
        orb1Pos: "10% 16%",
        orb2Pos: "85% 82%",
        accent: "#c2410c",
        accentDim: "rgba(194,65,12,0.08)",
        accentBorder: "rgba(194,65,12,0.16)",
        gradientFrom: "#c2410c",
        gradientTo: "#b45309",
        checkRing: "rgba(194,65,12,0.1)",
        checkColor: "#c2410c",
        frameBg: "rgba(255,255,255,0.85)",
        frameBorder: "rgba(0,0,0,0.07)",
        frameGlowColor: "rgba(194,65,12,0.08)",
        fadeColor: "#fff7ed",
        titleColor: "#0f172a",
        descColor: "rgba(15,23,42,0.58)",
        benefitColor: "rgba(15,23,42,0.52)",
        cardShadow: "0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(194,65,12,0.07)",
        floatChipBg: "rgba(255,255,255,0.95)",
        floatChipBorder: "rgba(0,0,0,0.08)",
        floatChipText: "rgba(15,23,42,0.45)",
        floatChip1: { label: "Faster reports", value: "5×", color: "#c2410c" },
        floatChip2: { label: "Data sources", value: "50+", color: "#b45309" },
    },
    {
        bg: "linear-gradient(150deg, #fdf9ff 0%, #faf5ff 60%, #fdf2f8 100%)",
        orb1: "rgba(126,34,206,0.09)",
        orb2: "rgba(190,18,60,0.06)",
        orb1Pos: "7% 18%",
        orb2Pos: "92% 80%",
        accent: "#7e22ce",
        accentDim: "rgba(126,34,206,0.08)",
        accentBorder: "rgba(126,34,206,0.16)",
        gradientFrom: "#7e22ce",
        gradientTo: "#be185d",
        checkRing: "rgba(126,34,206,0.1)",
        checkColor: "#7e22ce",
        frameBg: "rgba(255,255,255,0.85)",
        frameBorder: "rgba(0,0,0,0.07)",
        frameGlowColor: "rgba(126,34,206,0.09)",
        fadeColor: "#faf5ff",
        titleColor: "#0f172a",
        descColor: "rgba(15,23,42,0.58)",
        benefitColor: "rgba(15,23,42,0.52)",
        cardShadow: "0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(126,34,206,0.07)",
        floatChipBg: "rgba(255,255,255,0.95)",
        floatChipBorder: "rgba(0,0,0,0.08)",
        floatChipText: "rgba(15,23,42,0.45)",
        floatChip1: { label: "Compliance", value: "100%", color: "#7e22ce" },
        floatChip2: { label: "Audit trail", value: "Live", color: "#be185d" },
    },
];


function getFAFeatureSvg(i: number): React.ReactNode {
    // Design tokens — per FA screen brief 2026-04-26
    const NAV = "#0d1f3a";  // collapsed sidebar rail
    const W = "#FFFFFF";    // content background
    const BD = "#E2E8F0";
    const H = "#0F172A";
    const M = "#64748B";
    const PRM = "#1B2E5A";
    const POS = "#10B981";
    const WARN = "#F59E0B";
    const NEG = "#EF4444";
    const ff = "system-ui,-apple-system,sans-serif";

    // 28px collapsed sidebar (per brief)
    const Sb = () => (
        <g>
            <rect width="28" height="480" fill={NAV}/>
            <rect x="7" y="8" width="14" height="14" rx="3" fill="#3B82F6"/>
            {[0,1,2,3,4].map(j => (
                <g key={j}>
                    <rect x="8" y={34+j*36} width="12" height="2.5" rx="1.25" fill="rgba(255,255,255,0.25)"/>
                    <rect x="8" y={39.5+j*36} width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.12)"/>
                </g>
            ))}
            <circle cx="14" cy="462" r="7" fill="rgba(255,255,255,0.12)"/>
        </g>
    );

    // Header bar
    const Hdr = (title: string, crumb: string, btn?: string) => (
        <g>
            <rect x="28" y="0" width="772" height="44" fill={W}/>
            <line x1="28" y1="44" x2="800" y2="44" stroke={BD} strokeWidth="0.5"/>
            <text x="40" y="18" fontFamily={ff} fontSize="13" fontWeight="700" fill={H}>{title}</text>
            <text x="40" y="34" fontFamily={ff} fontSize="9" fill={M}>{crumb}</text>
            {btn && <>
                <rect x={796-btn.length*6-14} y="11" width={btn.length*6+14} height="22" rx="5" fill={PRM}/>
                <text x={796-btn.length*3} y="25" fontFamily={ff} fontSize="9" fontWeight="600" fill={W} textAnchor="middle">{btn}</text>
            </>}
        </g>
    );

    // 4-wide KPI (x: 36,226,416,606 | w=182)
    const K4 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
        <g key={`k${x}`}>
            <rect x={x} y={y} width="182" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            <text x={x+12} y={y+15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
            <text x={x+12} y={y+39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
            <text x={x+12} y={y+54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
        </g>
    );

    // 3-wide KPI (x: 36,289,542 | w=245)
    const K3 = (x: number, y: number, lbl: string, val: string, help: string, hc = M) => (
        <g key={`k${x}`}>
            <rect x={x} y={y} width="245" height="66" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            <text x={x+12} y={y+15} fontFamily={ff} fontSize="7.5" fontWeight="700" fill={M} letterSpacing="0.06em">{lbl}</text>
            <text x={x+12} y={y+39} fontFamily={ff} fontSize="17" fontWeight="700" fill={H}>{val}</text>
            <text x={x+12} y={y+54} fontFamily={ff} fontSize="8.5" fill={hc}>{help}</text>
        </g>
    );

    // Status pill
    const Pill = (x: number, y: number, text: string, bg: string, tc: string, pw = 44) => (
        <g key={`p${x}${y}`}>
            <rect x={x} y={y-11} width={pw} height="15" rx="7" fill={bg}/>
            <text x={x+pw/2} y={y+1} fontFamily={ff} fontSize="8.5" fontWeight="600" fill={tc} textAnchor="middle">{text}</text>
        </g>
    );

    const ThRow = (y: number, x = 36, w = 752) => (
        <rect x={x} y={y} width={w} height="22" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5"/>
    );

    const Tr = (y: number, even: boolean, x = 36, w = 752) => (
        <rect x={x} y={y} width={w} height="32" rx="3" fill={even ? W : "#F8FAFC"} stroke={BD} strokeWidth="0.5"/>
    );

    const T = (x: number, y: number, txt: string, sz = 9.5, bold = false, color = H, anchor: "start"|"middle"|"end" = "start") => (
        <text key={`t${x}${y}${txt.slice(0,8)}`} x={x} y={y} fontFamily={ff} fontSize={sz} fontWeight={bold?"700":"400"} fill={color} textAnchor={anchor}>{txt}</text>
    );

    switch(i) {

    // ── 0. General Ledger ───────────────────────────────────────────────────
    case 0: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("General Ledger","0 entries · Complete transaction history with running balances","+ New JV")}
            {K4(36,52,"TOTAL ENTRIES","0","No entries yet")}
            {K4(226,52,"TOTAL DEBITS","₹2,84,50,000","Current period")}
            {K4(416,52,"TOTAL CREDITS","₹2,84,50,000","Current period")}
            {K4(606,52,"PERIOD BALANCE","₹0","✓ Balanced",POS)}
            {ThRow(126)}
            {T(48,141,"DATE",7.5,true,M)}{T(112,141,"ENTRY #",7.5,true,M)}{T(192,141,"ACCOUNT",7.5,true,M)}
            {T(360,141,"DESCRIPTION",7.5,true,M)}{T(530,141,"DEBIT",7.5,true,M)}{T(616,141,"CREDIT",7.5,true,M)}{T(700,141,"BALANCE",7.5,true,M)}
            {([
                {dt:"Apr 26",no:"JE-0142",acct:"1100 Cash",desc:"Customer receipt",dr:"₹1,20,000",cr:"—",bal:"₹50,10,000"},
                {dt:"Apr 25",no:"JE-0141",acct:"4000 Revenue",desc:"Sales invoice INV-22",dr:"—",cr:"₹3,40,000",bal:"₹48,90,000"},
                {dt:"Apr 25",no:"JE-0140",acct:"2100 AP",desc:"Vendor bill BL-7820",dr:"—",cr:"₹80,000",bal:"₹48,10,000"},
                {dt:"Apr 24",no:"JE-0139",acct:"6000 Salaries",desc:"April payroll",dr:"₹2,10,000",cr:"—",bal:"₹50,20,000"},
                {dt:"Apr 24",no:"JE-0138",acct:"3000 Capital",desc:"Owner contribution",dr:"—",cr:"₹5,00,000",bal:"₹55,20,000"},
            ] as const).map((r,idx) => (
                <g key={idx}>
                    {Tr(148+idx*34,idx%2===0)}
                    {T(48,168+idx*34,r.dt,9,false,M)}{T(112,168+idx*34,r.no,9,true,PRM)}
                    {T(192,168+idx*34,r.acct,9)}{T(360,168+idx*34,r.desc,9,false,M)}
                    {T(530,168+idx*34,r.dr,9.5,r.dr!=="—")}{T(616,168+idx*34,r.cr,9.5,r.cr!=="—")}
                    {T(700,168+idx*34,r.bal,9.5,true)}
                </g>
            ))}
            <rect x="36" y="322" width="752" height="26" rx="5" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5"/>
            {T(48,339,"Trial Balance Reconciled ✓",9,true,"#047857")}
            {T(788,339,"Debits = Credits · Apr 2026",9,false,M,"end")}
        </svg>
    );

    // ── 1. Multi-Entity Management ──────────────────────────────────────────
    case 1: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Entity Management","Manage your group structure and consolidations","+ Add Entity")}
            {K4(36,52,"TOTAL ENTITIES","6","All registered")}
            {K4(226,52,"ACTIVE","6","Currently running")}
            {K4(416,52,"SUBSIDIARIES","4","Under group")}
            {K4(606,52,"COUNTRIES","3","IN · US · SG")}
            {/* Org tree */}
            <rect x="36" y="130" width="296" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,150,"Group Structure",11,true,H)}
            <rect x="88" y="162" width="152" height="34" rx="6" fill={PRM}/>
            {T(164,183,"Group HoldCo",10,true,W,"middle")}
            <line x1="164" y1="196" x2="164" y2="218" stroke={BD} strokeWidth="1.5"/>
            <line x1="76" y1="218" x2="252" y2="218" stroke={BD} strokeWidth="1.5"/>
            <line x1="76" y1="218" x2="76" y2="234" stroke={BD} strokeWidth="1.5"/>
            <line x1="164" y1="218" x2="164" y2="234" stroke={BD} strokeWidth="1.5"/>
            <line x1="252" y1="218" x2="252" y2="234" stroke={BD} strokeWidth="1.5"/>
            {([
                {x:40,label:"IN-Subsidiary",sub:"TCS India"},
                {x:128,label:"US-Subsidiary",sub:"Acme LLC"},
                {x:216,label:"SG-Subsidiary",sub:"Acme Pte"},
            ]).map((c,idx) => (
                <g key={idx}>
                    <rect x={c.x} y="234" width="80" height="40" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="1"/>
                    {T(c.x+40,251,c.label,7.5,true,H,"middle")}
                    {T(c.x+40,264,c.sub,7,false,M,"middle")}
                </g>
            ))}
            <rect x="44" y="290" width="280" height="20" rx="4" fill="#EFF6FF"/>
            {T(52,304,"Equity method · Full consolidation",8,false,"#1D4ED8")}
            <rect x="44" y="316" width="280" height="20" rx="4" fill="#F8FAFC"/>
            {T(52,330,"Intercompany eliminations: 3 active",8,false,M)}
            <rect x="44" y="342" width="280" height="20" rx="4" fill="#ECFDF5"/>
            {T(52,356,"Dec 2025 consolidation: complete ✓",8,true,"#047857")}
            {/* Entity table */}
            <rect x="344" y="130" width="444" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(360,150,"Entity Registry",11,true,H)}
            {ThRow(158,352,428)}
            {["CODE","ENTITY NAME","TYPE","CURRENCY","COUNTRY","STATUS"].map((h,hidx) =>
                T([364,440,540,596,644,696][hidx],170,h,7.5,true,M)
            )}
            {([
                {code:"GRP-HQ",name:"Group HoldCo Ltd",type:"Parent",curr:"INR",ctry:"India",st:"Active",bg:"#ECFDF5",tc:"#047857",pw:44},
                {code:"TCS-IN",name:"TCS India Ltd",type:"Subsidiary",curr:"INR",ctry:"India",st:"Active",bg:"#ECFDF5",tc:"#047857",pw:44},
                {code:"AcmeUS-LLC",name:"Acme US LLC",type:"Subsidiary",curr:"USD",ctry:"US",st:"Active",bg:"#ECFDF5",tc:"#047857",pw:44},
                {code:"AcmeSG-Pte",name:"Acme SG Pte",type:"Subsidiary",curr:"SGD",ctry:"SG",st:"Active",bg:"#ECFDF5",tc:"#047857",pw:44},
                {code:"AcmeUK-Ltd",name:"Acme UK Ltd",type:"Associate",curr:"GBP",ctry:"UK",st:"Inactive",bg:"#F1F5F9",tc:"#475569",pw:48},
            ]).map((r,idx) => (
                <g key={idx}>
                    <rect x="352" y={182+idx*32} width="428" height="28" rx="3" fill={idx%2===0?W:"#F8FAFC"} stroke={BD} strokeWidth="0.5"/>
                    {T(364,199+idx*32,r.code,8.5,true,PRM)}{T(440,199+idx*32,r.name,8.5)}
                    {T(540,199+idx*32,r.type,8.5,false,M)}{T(596,199+idx*32,r.curr,8.5,false,M)}
                    {T(644,199+idx*32,r.ctry,8.5,false,M)}
                    {Pill(696,199+idx*32,r.st,r.bg,r.tc,r.pw)}
                </g>
            ))}
        </svg>
    );

    // ── 2. Multi-Currency ───────────────────────────────────────────────────
    case 2: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Multi-Currency","Currency settings and FX rate management")}
            <rect x="36" y="52" width="200" height="36" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1"/>
            {T(48,64,"FUNCTIONAL CURRENCY",7.5,true,"#1D4ED8")}
            {T(48,77,"₹ INR — Indian Rupee",10,true,H)}
            <rect x="248" y="52" width="540" height="36" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1"/>
            {T(260,64,"RATE SOURCE",7.5,true,M)}{T(260,77,"RBI Reference Rate · Updated every 2 hours",9,false,H)}
            {/* 3 currency rate cards */}
            {([
                {curr:"USD",rate:"83.45",chg:"+0.12%",sub:"Updated 2h ago",up:true},
                {curr:"EUR",rate:"89.12",chg:"−0.04%",sub:"Updated 2h ago",up:false},
                {curr:"SGD",rate:"61.78",chg:"+0.21%",sub:"Updated 2h ago",up:true},
            ]).map((c,idx) => (
                <g key={idx}>
                    <rect x={36+idx*256} y="100" width="240" height="78" rx="8" fill={W} stroke={BD} strokeWidth="1"/>
                    {T(52+idx*256,118,c.curr,12,true,H)}
                    {T(52+idx*256,142,`${c.rate} ₹`,20,true,PRM)}
                    {T(52+idx*256,158,c.chg,9,true,c.up?POS:NEG)}
                    {T(268+idx*256,158,c.sub,8,false,M,"end")}
                    {/* sparkline hint */}
                    {[0,1,2,3,4,5].map(k => (
                        <line key={k}
                            x1={182+idx*256+k*8} y1={c.up?138-k*1.5:138+k*1.2}
                            x2={182+idx*256+(k+1)*8} y2={c.up?138-(k+1)*1.5:138+(k+1)*1.2}
                            stroke={c.up?POS:NEG} strokeWidth="1.5"/>
                    ))}
                </g>
            ))}
            {/* Recent FX Postings */}
            <rect x="36" y="190" width="752" height="254" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,210,"Recent FX Postings",11,true,H)}
            {ThRow(216,44,736)}
            {["DATE","DOCUMENT","FROM → TO","RATE","AMOUNT (₹)","GAIN / LOSS"].map((h,hidx) =>
                T([56,144,240,360,468,596][hidx],228,h,7.5,true,M)
            )}
            {([
                {dt:"Apr 26",doc:"INV-000022",fx:"USD → INR",rate:"83.45",amt:"₹4,91,955",gl:"+₹840",pos:true},
                {dt:"Apr 24",doc:"BL-7820",fx:"USD → INR",rate:"83.38",amt:"₹2,83,492",gl:"+₹240",pos:true},
                {dt:"Apr 22",doc:"INV-000019",fx:"EUR → INR",rate:"89.08",amt:"₹2,20,728",gl:"−₹360",pos:false},
                {dt:"Apr 20",doc:"BL-7801",fx:"SGD → INR",rate:"61.72",amt:"₹1,23,440",gl:"+₹600",pos:true},
                {dt:"Apr 18",doc:"INV-000015",fx:"USD → INR",rate:"83.31",amt:"₹2,35,627",gl:"+₹660",pos:true},
            ] as const).map((r,idx) => (
                <g key={idx}>
                    {Tr(238+idx*36,idx%2===0,44,736)}
                    {T(56,256+idx*36,r.dt,9,false,M)}{T(144,256+idx*36,r.doc,9,true,PRM)}
                    {T(240,256+idx*36,r.fx,9)}{T(360,256+idx*36,r.rate,9,true,H)}
                    {T(468,256+idx*36,r.amt,9.5,true,H)}{T(596,256+idx*36,r.gl,9.5,true,r.pos?POS:NEG)}
                </g>
            ))}
            <rect x="44" y="420" width="200" height="20" rx="5" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5"/>
            {T(56,434,"Realized FX Gain ₹2,140 ✓",9,true,"#047857")}
        </svg>
    );

    // ── 3. Accounts Payable ─────────────────────────────────────────────────
    case 3: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Bills · TCS · Apr 2026","AP · Vendor bills, 3-way matching, and payment approvals","+ New Bill")}
            {K4(36,52,"OPEN BILLS","23","Awaiting action")}
            {K4(226,52,"OPEN AMOUNT","₹63,30,315","Across 23 bills")}
            {K4(416,52,"DUE THIS WEEK","7","Urgent payment",WARN)}
            {K4(606,52,"AWAITING APPROVAL","4","Pending sign-off",WARN)}
            {/* Workflow strip */}
            <rect x="36" y="130" width="752" height="54" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1"/>
            {T(48,149,"Procurement Workflow",8,true,M)}
            {([
                {label:"PR",sub:"Requisition",hi:false},
                {label:"PO",sub:"Order",hi:false},
                {label:"GRN",sub:"Goods Receipt",hi:true},
                {label:"Bill",sub:"Invoice",hi:true},
                {label:"Payment",sub:"Settlement",hi:false},
            ]).map((s,idx) => (
                <g key={idx}>
                    <rect x={56+idx*142} y="152" width="86" height="24" rx="4"
                        fill={s.hi?PRM:W} stroke={s.hi?PRM:BD} strokeWidth="1"/>
                    {T(99+idx*142,168,s.label,9,true,s.hi?W:H,"middle")}
                    {idx < 4 && <line x1={142+idx*142} y1="164" x2={194+idx*142} y2="164" stroke={BD} strokeWidth="1.5"/>}
                    {idx < 4 && <polygon points={`${193+idx*142},160 ${199+idx*142},164 ${193+idx*142},168`} fill={BD}/>}
                </g>
            ))}
            <rect x="336" y="145" width="108" height="16" rx="8" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5"/>
            {T(390,156,"3-way matched ✓",7.5,true,"#047857","middle")}
            {/* Bills table */}
            {ThRow(196)}
            {["VENDOR","BILL #","ISSUE DATE","DUE DATE","AMOUNT (₹)","STATUS",""].map((h,hidx) =>
                T([48,196,312,394,482,574,696][hidx],209,h,7.5,true,M)
            )}
            {([
                {vnd:"Infosys Ltd",bill:"BL-7823",iss:"Apr 20",due:"May 20",amt:"₹18,40,000",st:"Approved",bg:"#ECFDF5",tc:"#047857",pw:56},
                {vnd:"TCS Pvt Ltd",bill:"BL-7820",iss:"Apr 18",due:"Apr 28",amt:"₹3,40,000",st:"Pending",bg:"#FFFBEB",tc:"#B45309",pw:52},
                {vnd:"Wipro Ltd",bill:"BL-7818",iss:"Apr 15",due:"Apr 25",amt:"₹12,80,000",st:"Paid",bg:"#ECFDF5",tc:"#047857",pw:36},
                {vnd:"HCL Technologies",bill:"BL-7812",iss:"Apr 10",due:"May 10",amt:"₹28,70,315",st:"Draft",bg:"#F1F5F9",tc:"#475569",pw:40},
            ]).map((r,idx) => (
                <g key={idx}>
                    {Tr(218+idx*38,idx%2===0)}
                    {T(48,238+idx*38,r.vnd,9)}{T(196,238+idx*38,r.bill,9,true,PRM)}
                    {T(312,238+idx*38,r.iss,9,false,M)}{T(394,238+idx*38,r.due,9,false,M)}
                    {T(482,238+idx*38,r.amt,9.5,true,H)}
                    {Pill(574,238+idx*38,r.st,r.bg,r.tc,r.pw)}
                    <rect x="698" y={228+idx*38} width="56" height="16" rx="4" fill="#F1F5F9" stroke={BD} strokeWidth="0.5"/>
                    {T(726,239+idx*38,"Pay Now",8,true,M,"middle")}
                </g>
            ))}
        </svg>
    );

    // ── 4. Accounts Receivable ──────────────────────────────────────────────
    case 4: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Customer Invoices","19 INVOICES · AR · Customer invoice history and receivables","+ New Invoice")}
            {K4(36,52,"TOTAL INVOICES","19","12 draft · 0 active")}
            {K4(226,52,"OUTSTANDING","₹40,00,200","15 unpaid")}
            {K4(416,52,"OVERDUE","₹0","No overdue invoices",POS)}
            {K4(606,52,"PAID (MTD)","₹0","Apr 2026",M)}
            {ThRow(126)}
            {["INVOICE #","CUSTOMER","ISSUE DATE","DUE DATE","AMOUNT","REMAINING","STATUS"].map((h,hidx) =>
                T([48,156,288,368,452,548,644][hidx],139,h,7.5,true,M)
            )}
            {([
                {no:"INV-000022",cust:"Zoho Corp",iss:"Apr 9",due:"May 9",amt:"₹5,90,000",rem:"₹5,90,000",st:"Draft",bg:"#F1F5F9",tc:"#475569",pw:40},
                {no:"INV-000019",cust:"CleverTap",iss:"Mar 2",due:"Apr 1",amt:"₹2,47,800",rem:"₹1,23,900",st:"partially_paid",bg:"#FFFBEB",tc:"#B45309",pw:76},
                {no:"INV-000018",cust:"Chargebee",iss:"Feb 9",due:"Mar 11",amt:"₹88,500",rem:"₹0",st:"Paid",bg:"#ECFDF5",tc:"#047857",pw:36},
                {no:"INV-000016",cust:"PhonePe",iss:"Jan 17",due:"Feb 16",amt:"₹1,12,100",rem:"₹0",st:"Paid",bg:"#ECFDF5",tc:"#047857",pw:36},
                {no:"INV-000015",cust:"Zoho Corp",iss:"Jan 25",due:"Feb 24",amt:"₹2,83,200",rem:"₹0",st:"Paid",bg:"#ECFDF5",tc:"#047857",pw:36},
            ] as const).map((r,idx) => (
                <g key={idx}>
                    {Tr(148+idx*42,idx%2===0)}
                    {T(48,170+idx*42,r.no,9.5,true,PRM)}{T(156,170+idx*42,r.cust,9)}
                    {T(288,170+idx*42,r.iss,9,false,M)}{T(368,170+idx*42,r.due,9,false,M)}
                    {T(452,170+idx*42,r.amt,9.5,true,H)}
                    {T(548,170+idx*42,r.rem,9.5,false,r.rem==="₹0"?POS:M)}
                    {Pill(644,170+idx*42,r.st,r.bg,r.tc,r.pw)}
                </g>
            ))}
        </svg>
    );

    // ── 5. Banking & Cash ───────────────────────────────────────────────────
    case 5: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Banking Dashboard","Monitor bank accounts, transactions, and reconciliations")}
            {/* 3 bank account cards */}
            {([
                {bank:"HDFC Bank",acct:"··2841",bal:"₹38,40,000",st:"Reconciled ✓",stbg:"#ECFDF5",sttc:"#047857",pw:72},
                {bank:"ICICI Bank",acct:"··9012",bal:"₹11,50,000",st:"3 unreconciled",stbg:"#FFFBEB",sttc:"#B45309",pw:80},
                {bank:"Axis Bank",acct:"··5503",bal:"₹20,000",st:"Reconciled ✓",stbg:"#ECFDF5",sttc:"#047857",pw:72},
            ]).map((b,idx) => (
                <g key={idx}>
                    <rect x={36+idx*256} y="52" width="240" height="72" rx="8" fill={W} stroke={BD} strokeWidth="1"/>
                    {T(52+idx*256,70,b.bank,10,true,H)}{T(52+idx*256,84,b.acct,9,false,M)}
                    {T(52+idx*256,106,b.bal,18,true,PRM)}
                    <rect x={268+idx*256-b.pw} y="54" width={b.pw} height="15" rx="7" fill={b.stbg}/>
                    {T(268+idx*256-b.pw/2,64,b.st,7.5,true,b.sttc,"middle")}
                </g>
            ))}
            {/* Transactions */}
            <rect x="36" y="136" width="752" height="236" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,156,"Recent Transactions",11,true,H)}{T(788,156,"HDFC ··2841",9,false,M,"end")}
            {ThRow(162,44,736)}
            {["DATE","DESCRIPTION","RULE MATCHED","AMOUNT","MATCH STATUS"].map((h,hidx) =>
                T([56,148,344,508,620][hidx],174,h,7.5,true,M)
            )}
            {([
                {dt:"Apr 26",desc:"Customer NEFT — Zoho Corp",rule:"Auto: Customer Receipts",amt:"+₹5,90,000",ms:"Matched ✓",mbg:"#ECFDF5",mtc:"#047857",pos:true,pw:60},
                {dt:"Apr 25",desc:"RTGS — AWS India Pvt Ltd",rule:"Recurring · AWS India",amt:"−₹1,42,800",ms:"Matched ✓",mbg:"#ECFDF5",mtc:"#047857",pos:false,pw:60},
                {dt:"Apr 25",desc:"Payroll batch — April",rule:"Auto: Payroll",amt:"−₹18,40,000",ms:"Matched ✓",mbg:"#ECFDF5",mtc:"#047857",pos:false,pw:60},
                {dt:"Apr 24",desc:"NEFT credit — Chargebee",rule:"Reviewing…",amt:"+₹88,500",ms:"Unmatched",mbg:"#FFFBEB",mtc:"#B45309",pos:true,pw:60},
            ] as const).map((r,idx) => (
                <g key={idx}>
                    {Tr(184+idx*42,idx%2===0,44,736)}
                    {T(56,205+idx*42,r.dt,9,false,M)}{T(148,205+idx*42,r.desc,9)}
                    {T(344,205+idx*42,r.rule,9,false,M)}
                    {T(508,205+idx*42,r.amt,9.5,true,r.pos?POS:NEG)}
                    {Pill(620,205+idx*42,r.ms,r.mbg,r.mtc,r.pw)}
                </g>
            ))}
            {/* Cash position */}
            <rect x="36" y="384" width="752" height="80" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1"/>
            {T(52,402,"TOTAL CASH ACROSS ACCOUNTS",7.5,true,"#1D4ED8")}
            {T(52,428,"₹50,10,000",22,true,PRM)}
            {T(788,406,"3 accounts · Last sync 5 min ago",9,false,M,"end")}
            {T(788,424,"HDFC + ICICI + Axis",9,false,M,"end")}
        </svg>
    );

    // ── 6. Fixed Assets ─────────────────────────────────────────────────────
    case 6: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Fixed Assets","Asset register, depreciation, and asset lifecycle management","+ Add Asset")}
            {K3(36,52,"ASSET COUNT","142","Active assets")}
            {K3(289,52,"NET BOOK VALUE","₹2,10,40,000","As at Apr 2026")}
            {K3(542,52,"DEPRECIATION YTD","₹18,60,000","FY 2025–26",WARN)}
            {/* Asset table */}
            <rect x="36" y="130" width="444" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,150,"Asset Register",11,true,H)}
            {ThRow(158,44,428)}
            {["ASSET #","ASSET NAME","CATEGORY","METHOD","NBV (₹)"].map((h,hidx) =>
                T([56,128,268,348,430][hidx],170,h,7.5,true,M)
            )}
            {([
                {id:"FA-0042",name:"Dell PowerEdge R750",cat:"IT Hardware",meth:"SLM",nbv:"₹3,40,000",st:"Active",bg:"#ECFDF5",tc:"#047857"},
                {id:"FA-0089",name:"Office Lease HSR",cat:"Buildings",meth:"SLM",nbv:"₹78,00,000",st:"Active",bg:"#ECFDF5",tc:"#047857"},
                {id:"FA-0114",name:"Toyota Innova 2023",cat:"Vehicles",meth:"DBM",nbv:"₹6,20,000",st:"Active",bg:"#ECFDF5",tc:"#047857"},
                {id:"FA-0001",name:"HP LaserJet M404",cat:"IT Hardware",meth:"SLM",nbv:"₹12,000",st:"Fully Dep.",bg:"#F1F5F9",tc:"#475569"},
                {id:"FA-0072",name:"Boardroom Furniture",cat:"Furniture",meth:"SLM",nbv:"₹1,80,000",st:"Active",bg:"#ECFDF5",tc:"#047857"},
            ]).map((r,idx) => (
                <g key={idx}>
                    <rect x="44" y={182+idx*38} width="428" height="33" rx="3" fill={idx%2===0?W:"#F8FAFC"} stroke={BD} strokeWidth="0.5"/>
                    {T(56,200+idx*38,r.id,8.5,true,PRM)}{T(128,200+idx*38,r.name,8.5)}
                    {T(268,200+idx*38,r.cat,8.5,false,M)}{T(348,200+idx*38,r.meth,8.5,false,M)}
                    {T(460,200+idx*38,r.nbv,9,true,H,"end")}
                </g>
            ))}
            {/* Depreciation line chart */}
            <rect x="492" y="130" width="296" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(508,150,"Depreciation Forecast",11,true,H)}
            {T(508,165,"Net Book Value decline · 12 months",8.5,false,M)}
            <line x1="520" y1="196" x2="520" y2="370" stroke={BD} strokeWidth="1"/>
            <line x1="520" y1="370" x2="770" y2="370" stroke={BD} strokeWidth="1"/>
            {(() => {
                const ys = [370,356,342,328,315,302,290,278,268,258,248,239];
                const ms = ["A","M","J","J","A","S","O","N","D","J","F","M"];
                return <>
                    {ys.map((y,k) => k<11 && (
                        <line key={k} x1={520+k*22} y1={y} x2={520+(k+1)*22} y2={ys[k+1]} stroke={PRM} strokeWidth="1.5"/>
                    ))}
                    {ys.map((y,k) => <circle key={k} cx={520+k*22} cy={y} r="2.5" fill={PRM}/>)}
                    {ms.map((m,k) => <text key={k} x={520+k*22} y="383" fontFamily={ff} fontSize="7" fill={M} textAnchor="middle">{m}</text>)}
                    <text x="508" y="200" fontFamily={ff} fontSize="7" fill={M} textAnchor="end">₹2.1Cr</text>
                    <text x="508" y="374" fontFamily={ff} fontSize="7" fill={M} textAnchor="end">₹0</text>
                    <text x="762" y="235" fontFamily={ff} fontSize="7" fill={M} textAnchor="end">NBV Mar</text>
                    <text x="762" y="248" fontFamily={ff} fontSize="8" fontWeight="700" fill={PRM} textAnchor="end">₹1,91,80,000</text>
                </>;
            })()}
            <rect x="500" y="400" width="280" height="52" rx="5" fill="#F8FAFC" stroke={BD} strokeWidth="0.5"/>
            {T(512,416,"Depreciation method: SLM avg 10%",8.5,true,H)}
            {T(512,432,"₹18,60,000 charged YTD of ₹2,10,40,000 NBV",8.5,false,M)}
        </svg>
    );

    // ── 7. Cost Accounting ──────────────────────────────────────────────────
    case 7: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Cost Accounting","Cost centres, ABC costing, and variance analysis","+ New Cost Centre")}
            {K3(36,52,"COST CENTRES","18","Active cost centres")}
            {K3(289,52,"ALLOCATED YTD","₹1,42,30,000","FY 2025–26")}
            {K3(542,52,"VARIANCE","₹-3,10,000","Under budget 2.1%",NEG)}
            {/* Dept bars */}
            <rect x="36" y="130" width="436" height="240" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,150,"Department-wise Cost (YTD)",11,true,H)}
            {([
                {dept:"Engineering",amt:"₹65L",pct:0.76,color:PRM},
                {dept:"Sales",amt:"₹42L",pct:0.49,color:"#6366F1"},
                {dept:"Operations",amt:"₹35L",pct:0.41,color:"#8B5CF6"},
                {dept:"Admin",amt:"₹18L",pct:0.21,color:"#94A3B8"},
            ]).map((d,idx) => (
                <g key={idx}>
                    {T(52,174+idx*46,d.dept,9,false,M)}
                    <rect x="52" y={179+idx*46} width="350" height="12" rx="6" fill="#F1F5F9"/>
                    <rect x="52" y={179+idx*46} width={350*d.pct} height="12" rx="6" fill={d.color} opacity="0.85"/>
                    {T(408,187+idx*46,d.amt,9,true,H,"end")}
                </g>
            ))}
            <rect x="44" y="350" width="420" height="22" rx="5" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.5"/>
            {T(56,365,"Approval gate: All cost postings require sign-off ✓",9,true,"#047857")}
            {/* Allocation table */}
            <rect x="484" y="130" width="304" height="334" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(500,150,"Cost Allocations",11,true,H)}
            {ThRow(158,492,288)}
            {["CC CODE","DEPARTMENT","METHOD","ALLOCATED"].map((h,hidx) =>
                T([504,564,648,768][hidx],170,h,7.5,true,M)
            )}
            {([
                {cc:"CC-ENG",dept:"Engineering",meth:"Headcount",alloc:"₹65,00,000"},
                {cc:"CC-SLS",dept:"Sales",meth:"Revenue",alloc:"₹42,00,000"},
                {cc:"CC-OPS",dept:"Operations",meth:"Activity",alloc:"₹35,00,000"},
                {cc:"CC-ADM",dept:"Admin",meth:"Direct",alloc:"₹18,00,000"},
                {cc:"CC-RND",dept:"R&D",meth:"Headcount",alloc:"₹14,30,000"},
                {cc:"CC-MKT",dept:"Marketing",meth:"Revenue",alloc:"₹8,00,000"},
                {cc:"CC-FIN",dept:"Finance",meth:"Direct",alloc:"₹6,00,000"},
            ]).map((r,idx) => (
                <g key={idx}>
                    <rect x="492" y={182+idx*34} width="288" height="29" rx="3" fill={idx%2===0?W:"#F8FAFC"} stroke={BD} strokeWidth="0.5"/>
                    {T(504,198+idx*34,r.cc,8.5,true,PRM)}{T(564,198+idx*34,r.dept,8.5)}
                    {T(648,198+idx*34,r.meth,8.5,false,M)}{T(772,198+idx*34,r.alloc,9,true,H,"end")}
                </g>
            ))}
        </svg>
    );

    // ── 8. Financial Reporting ──────────────────────────────────────────────
    case 8: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Reports","Financial statements, analysis, and custom report builder")}
            {/* Toolbar */}
            <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1"/>
            {T(48,72,"Date Range: YTD",9,false,M)}
            {T(168,72,"·",9,false,M)}{T(180,72,"Compare prior period",9,false,M)}
            {T(338,72,"·",9,false,M)}{T(350,72,"Export",9,false,M)}
            <rect x="670" y="57" width="44" height="20" rx="4" fill={W} stroke={BD} strokeWidth="1"/>
            {T(692,71,"PDF",8.5,true,M,"middle")}
            <rect x="718" y="57" width="48" height="20" rx="4" fill={W} stroke={BD} strokeWidth="1"/>
            {T(742,71,"XLSX",8.5,true,M,"middle")}
            {/* 3×3 report grid */}
            {([
                [{n:"Profit & Loss",s:"Income vs Expenses",c:"#EFF6FF"},{n:"Balance Sheet",s:"Assets & Liabilities",c:"#F0FDF4"},{n:"Cash Flow",s:"Cash in & outflows",c:"#FFFBEB"}],
                [{n:"Trial Balance",s:"Debit / Credit listing",c:"#F8FAFC"},{n:"Aged Receivables",s:"Outstanding by age",c:"#F8FAFC"},{n:"Aged Payables",s:"Bills by due date",c:"#F8FAFC"}],
                [{n:"Budget vs Actual",s:"Variance analysis",c:"#F8FAFC"},{n:"Financial Ratios",s:"Liquidity & leverage",c:"#F8FAFC"},{n:"Custom Builder",s:"Build your report",c:"#EFF6FF"}],
            ]).map((row,ri) =>
                row.map((card,ci) => (
                    <g key={`${ri}-${ci}`}>
                        <rect x={36+ci*256} y={94+ri*120} width="240" height="106" rx="8" fill={W} stroke={BD} strokeWidth="1"/>
                        <rect x={52+ci*256} y={108+ri*120} width="36" height="36" rx="8" fill={card.c}/>
                        {T(70+ci*256,130+ri*120,ri===0&&ci===0?"📊":ri===0&&ci===1?"⚖️":ri===0&&ci===2?"💰":ri===1&&ci===0?"📋":ri===1&&ci===1?"📅":ri===1&&ci===2?"📆":ri===2&&ci===0?"📈":ri===2&&ci===1?"🔢":"🛠",13,false,H,"middle")}
                        {T(98+ci*256,120+ri*120,card.n,10,true,H)}
                        {T(98+ci*256,134+ri*120,card.s,8.5,false,M)}
                        <rect x={52+ci*256} y={172+ri*120} width="68" height="18" rx="9" fill={PRM}/>
                        {T(86+ci*256,184+ri*120,"View Report",8,true,W,"middle")}
                        <rect x={224+ci*256} y={104+ri*120} width="36" height="13" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="0.5"/>
                        {T(242+ci*256,114+ri*120,"YTD",7,false,M,"middle")}
                    </g>
                ))
            )}
        </svg>
    );

    // ── 9. Tax Management ───────────────────────────────────────────────────
    case 9: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Indian Tax Management","Comprehensive tax management for GST, TDS, and compliance in India","+ File Return")}
            {K4(36,52,"GST TRANSACTIONS","124","₹4,28,500 collected")}
            {K4(226,52,"TDS TRANSACTIONS","38","₹78,200 deducted")}
            {K4(416,52,"PENDING COMPLIANCE","2","Action required",WARN)}
            {K4(606,52,"OVERDUE","0","All filed ✓",POS)}
            {/* 2-col block */}
            <rect x="36" y="130" width="368" height="176" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,150,"GST Summary",11,true,H)}{T(396,150,"₹4,28,500 collected",9,true,POS,"end")}
            {([
                {type:"CGST",amt:"₹2,14,250",pct:0.5},
                {type:"SGST",amt:"₹2,14,250",pct:0.5},
                {type:"IGST",amt:"₹0",pct:0},
            ]).map((g,idx) => (
                <g key={idx}>
                    {T(52,172+idx*44,g.type,9,true,M)}
                    <rect x="52" y={178+idx*44} width="284" height="10" rx="5" fill="#F1F5F9"/>
                    {g.pct>0 && <rect x="52" y={178+idx*44} width={284*g.pct} height="10" rx="5" fill={POS} opacity="0.7"/>}
                    {T(396,187+idx*44,g.amt,9.5,true,H,"end")}
                </g>
            ))}
            <rect x="416" y="130" width="372" height="176" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(432,150,"TDS Summary",11,true,H)}
            {T(432,170,"TOTAL DEDUCTED",7.5,true,M)}{T(432,190,"₹78,200",18,true,H)}
            {T(432,208,"AVERAGE RATE",7.5,true,M)}{T(432,226,"7.5%",13,true,M)}
            {([
                {sec:"Sec 194C — Contractor",rate:"2%",amt:"₹24,000"},
                {sec:"Sec 194J — Professional",rate:"10%",amt:"₹30,000"},
                {sec:"Sec 194I — Rent",rate:"10%",amt:"₹24,200"},
            ]).map((t,idx) => (
                <g key={idx}>
                    <rect x="424" y={244+idx*24} width="356" height="20" rx="3" fill={idx%2===0?"#F8FAFC":W} stroke={BD} strokeWidth="0.5"/>
                    {T(432,257+idx*24,t.sec,8.5)}{T(600,257+idx*24,t.rate,8.5,false,M)}
                    {T(772,257+idx*24,t.amt,9,true,H,"end")}
                </g>
            ))}
            {/* Recent compliance */}
            <rect x="36" y="318" width="752" height="148" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,338,"Recent Compliance",11,true,H)}
            {ThRow(344,44,736)}
            {["RETURN","PERIOD","AMOUNT","DUE DATE","STATUS"].map((h,hidx) =>
                T([56,196,316,440,556][hidx],356,h,7.5,true,M)
            )}
            {([
                {ret:"GSTR-3B",per:"2024-06",amt:"₹50,000",due:"20 Jul 2024",st:"Due",bg:"#FFFBEB",tc:"#B45309",pw:36},
                {ret:"Form 26Q",per:"2024-Q2",amt:"₹25,000",due:"31 Jul 2024",st:"Filed ✓",bg:"#ECFDF5",tc:"#047857",pw:48},
                {ret:"GSTR-1",per:"2024-06",amt:"₹3,12,000",due:"11 Jul 2024",st:"Pending",bg:"#FFFBEB",tc:"#B45309",pw:52},
            ] as const).map((r,idx) => (
                <g key={idx}>
                    {Tr(364+idx*38,idx%2===0,44,736)}
                    {T(56,383+idx*38,r.ret,9.5,true,PRM)}{T(196,383+idx*38,r.per,9,false,M)}
                    {T(316,383+idx*38,r.amt,9.5,true,H)}{T(440,383+idx*38,r.due,9,false,M)}
                    {Pill(556,383+idx*38,r.st,r.bg,r.tc,r.pw)}
                </g>
            ))}
        </svg>
    );

    // ── 10. Compliance & Audit ──────────────────────────────────────────────
    case 10: return (
        <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect width="800" height="480" fill={W}/>
            <Sb/>{Hdr("Audit Trail","1,284 events this period · Field-level change tracking")}
            {/* Filter tabs */}
            <rect x="36" y="52" width="752" height="32" rx="6" fill="#F8FAFC" stroke={BD} strokeWidth="1"/>
            {T(48,72,"1,284 events this period",10,true,H)}
            {([{l:"All",n:"1284",a:true},{l:"Critical",n:"0"},{l:"High",n:"2"},{l:"Medium",n:"8"},{l:"Info",n:"24"}]).map((tab,ti) => (
                <g key={ti}>
                    <rect x={180+ti*116} y="58" width="88" height="20" rx="4" fill={tab.a?PRM:"#F1F5F9"} stroke={tab.a?PRM:BD} strokeWidth="0.5"/>
                    {T(224+ti*116,71,tab.a?`All (${tab.n})`:tab.l+(tab.n?` (${tab.n})`:""),8,true,tab.a?W:M,"middle")}
                </g>
            ))}
            {/* Timeline */}
            <rect x="36" y="94" width="600" height="380" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(52,114,"Activity Timeline",11,true,H)}
            {([
                {ts:"Apr 26 14:32",ini:"LE",col:"#3B82F6",action:"Posted JE-0142",diff:"debit 1100 · ₹1,20,000",sev:"Info",sbg:"#EFF6FF",stc:"#1D4ED8",pw:28},
                {ts:"Apr 26 11:08",ini:"NK",col:"#8B5CF6",action:"Period locked · 2026-Q1",diff:"status: open → locked",sev:"High",sbg:"#FEF2F2",stc:"#B91C1C",pw:28},
                {ts:"Apr 25 17:45",ini:"LE",col:"#3B82F6",action:"Updated Vendor V-0042",diff:"payment_terms: Net 30 → Net 45",sev:"Medium",sbg:"#FFFBEB",stc:"#B45309",pw:44},
                {ts:"Apr 25 09:12",ini:"NK",col:"#8B5CF6",action:"Approved Bill BL-7820",diff:"₹3,40,000 → POSTED",sev:"Info",sbg:"#EFF6FF",stc:"#1D4ED8",pw:28},
                {ts:"Apr 24 16:01",ini:"SY",col:"#10B981",action:"Banking rule R-08 auto-matched",diff:"12 transactions matched",sev:"Info",sbg:"#EFF6FF",stc:"#1D4ED8",pw:28},
            ] as const).map((ev,idx) => (
                <g key={idx}>
                    {idx < 4 && <line x1="72" y1={143+idx*62} x2="72" y2={160+idx*62} stroke={BD} strokeWidth="1.5"/>}
                    <circle cx="72" cy={133+idx*62} r="13" fill={ev.col} opacity="0.15"/>
                    {T(72,137+idx*62,ev.ini,8.5,true,ev.col,"middle")}
                    <rect x="94" y={120+idx*62} width="490" height="46" rx="4" fill={idx%2===0?"#F8FAFC":W} stroke={BD} strokeWidth="0.5"/>
                    {T(106,136+idx*62,ev.ts,8.5,false,M)}{T(106,150+idx*62,ev.action,9.5,true,H)}
                    <rect x="268" y={126+idx*62} width={ev.diff.length*5+8} height="14" rx="3" fill="#F1F5F9"/>
                    {T(272,137+idx*62,ev.diff,7.5,false,"#475569")}
                    {Pill(546,141+idx*62,ev.sev,ev.sbg,ev.stc,ev.pw+16)}
                </g>
            ))}
            {/* Severity legend */}
            <rect x="648" y="94" width="140" height="380" rx="6" fill={W} stroke={BD} strokeWidth="1"/>
            {T(664,114,"Severity",10,true,H)}
            {([
                {label:"Critical",count:"0",bg:"#FEF2F2",tc:"#B91C1C"},
                {label:"High",count:"2",bg:"#FEF2F2",tc:"#B91C1C"},
                {label:"Medium",count:"8",bg:"#FFFBEB",tc:"#B45309"},
                {label:"Info",count:"24",bg:"#EFF6FF",tc:"#1D4ED8"},
            ]).map((s,idx) => (
                <g key={idx}>
                    <rect x="656" y={128+idx*62} width="124" height="52" rx="4" fill="#F8FAFC" stroke={BD} strokeWidth="0.5"/>
                    <rect x="664" y={136+idx*62} width={s.label.length*5.5+8} height="14" rx="7" fill={s.bg}/>
                    {T(664+(s.label.length*5.5+8)/2,147+idx*62,s.label,7.5,true,s.tc,"middle")}
                    {T(664,168+idx*62,s.count,20,true,H)}
                </g>
            ))}
        </svg>
    );

    default: return null;
    }
}


const FeatureCard: React.FC<FeatureCardProps> = ({ feature, i, productId }) => {
    const stickyTop = 80 + (i * 10);
    const t = cardThemes[i % cardThemes.length];
    const [fullscreen, setFullscreen] = useState(false);

    return (
        <>
        {/* Fullscreen modal */}
        {fullscreen && (
            <div
                className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
                onClick={() => setFullscreen(false)}
            >
                {/* ── Monitor assembly ──
                    max-width: min(1100px, (100vh − chrome) / 0.6)
                    ensures SVG (800×480 = 5:3 ratio) always fits in the viewport.
                    On 900 vh → max 1040px wide; on 1080 vh → max 1100px wide. ── */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 'min(1100px, calc((100vh - 280px) / 0.6))', padding: '0 16px' }} onClick={e => e.stopPropagation()}>

                        {/* Monitor bezel */}
                        <div style={{
                            width: '100%',
                            background: 'linear-gradient(160deg, #23232f 0%, #18181f 60%, #111118 100%)',
                            borderRadius: '18px',
                            padding: '8px 8px 10px',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.10)',
                        }}>
                            {/* Screen — no height cap, SVG renders at its natural size */}
                            <div style={{ borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                                {/* macOS title bar */}
                                <div className="flex items-center px-5 py-3 border-b border-slate-100 bg-white">
                                    <div className="flex gap-[7px] mr-5">
                                        <button
                                            onClick={() => setFullscreen(false)}
                                            className="w-[13px] h-[13px] rounded-full bg-[#FF5F57] hover:brightness-90 transition-all flex items-center justify-center"
                                        >
                                            <X size={7} className="text-red-800 opacity-0 hover:opacity-100" />
                                        </button>
                                        <div className="w-[13px] h-[13px] rounded-full bg-[#FFBD2E]" />
                                        <div className="w-[13px] h-[13px] rounded-full bg-[#28C840]" />
                                    </div>
                                    <div className="flex-1 flex justify-center">
                                        <div className="rounded-[7px] px-4 py-[5px] text-[12px] font-mono text-slate-400 bg-slate-100">
                                            {feature.title} — {productId?.replace(/-/g, ' ')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setFullscreen(false)}
                                        className="ml-5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                {/* Full content — no maxHeight, shows everything */}
                                {productId === 'financial-accounting' ? (
                                    <div style={{ lineHeight: 0 }}>{getFAFeatureSvg(i)}</div>
                                ) : productId === 'b2b-crm' ? (
                                    <div style={{ lineHeight: 0 }}>{getCRMFeatureSvg(i)}</div>
                                ) : (
                                    <div className="p-8 flex flex-col gap-4 bg-slate-50 min-h-[400px] items-center justify-center">
                                        <span className="text-slate-400 text-sm">No full preview available</span>
                                    </div>
                                )}
                            </div>
                            {/* LED chin strip */}
                            <div style={{
                                marginTop: '8px',
                                height: '3px',
                                borderRadius: '3px',
                                background: 'linear-gradient(to right, transparent 10%, rgba(46,79,140,0.5) 40%, rgba(60,105,200,0.75) 50%, rgba(46,79,140,0.5) 60%, transparent 90%)',
                                filter: 'blur(1px)',
                            }} />
                        </div>

                        {/* Monitor neck */}
                        <div style={{
                            width: '56px',
                            height: '22px',
                            background: 'linear-gradient(to bottom, #1e1e28 0%, #141420 100%)',
                            clipPath: 'polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)',
                        }} />

                        {/* Puck base */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                position: 'absolute', bottom: '46px', left: '50%', transform: 'translateX(-50%)',
                                width: '160px', height: '44px',
                                background: 'linear-gradient(to top, rgba(46,79,140,0.55) 0%, rgba(60,100,200,0.14) 70%, transparent 100%)',
                                filter: 'blur(12px)', pointerEvents: 'none', borderRadius: '50% 50% 0 0',
                            }} />
                            <div className="pp-puck-float" style={{ position: 'relative', width: '200px', height: '70px', flexShrink: 0, filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.85)) drop-shadow(0 0 40px rgba(27,46,90,0.65))' }}>
                                <div style={{ position: 'absolute', top: '20%', left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, #212128 0%, #161620 28%, #0d0d14 65%, #070710 100%)', borderRadius: '0 0 50% 50% / 0 0 22% 22%', boxShadow: 'inset 7px 0 22px rgba(255,255,255,0.045),inset -7px 0 22px rgba(0,0,0,0.45),inset 0 -12px 28px rgba(0,0,0,0.75)', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '9%', background: 'linear-gradient(to right, rgba(255,255,255,0.07), transparent)' }} />
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '9%', background: 'linear-gradient(to left, rgba(0,0,0,0.35), transparent)' }} />
                                </div>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'radial-gradient(ellipse at 48% 38%, #2c2c38 0%, #1a1a26 50%, #0e0e18 82%, #08080f 100%)', borderRadius: '50%', zIndex: 2, boxShadow: 'inset 0 9px 22px rgba(255,255,255,0.055),inset 0 -5px 14px rgba(0,0,0,0.65),0 7px 22px rgba(0,0,0,0.65)' }}>
                                    <div style={{ position: 'absolute', top: '7%', left: '7%', right: '7%', bottom: '7%', borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.055),inset 0 0 10px rgba(0,0,0,0.6)' }} />
                                    <div style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 42%, #1e1e2a 0%, #0c0c14 100%)', boxShadow: 'inset 0 5px 14px rgba(0,0,0,0.95)' }} />
                                    <div className="pp-lens-glow" style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', background: 'transparent' }} />
                                    <div className="pp-ring-out"   style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(60,105,200,0.5)' }} />
                                    <div className="pp-ring-out-2" style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(60,105,200,0.3)' }} />
                                    <div style={{ position: 'absolute', top: '32%', left: '32%', right: '32%', bottom: '32%', borderRadius: '50%', background: 'radial-gradient(circle at 44% 38%, #d0e4ff 0%, #88aef0 14%, #243B6E 36%, #1B2E5A 64%, #0F1B3D 100%)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.75)' }} />
                                    <div className="pp-hotspot" style={{ position: 'absolute', top: '42%', left: '42%', right: '42%', bottom: '42%', borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, #d2e8ff 55%, transparent 100%)' }} />
                                </div>
                                <div style={{ position: 'absolute', bottom: '-14%', left: '18%', right: '18%', height: '18%', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', filter: 'blur(14px)' }} />
                            </div>
                        </div>
                    </div>
            </div>
        )}

        <div className="sticky mb-3 last:mb-0" style={{ top: `${stickyTop}px`, zIndex: i + 1 }}>
            <div
                className="relative overflow-hidden rounded-3xl border"
                style={{
                    background: t.bg,
                    borderColor: 'rgba(0,0,0,0.07)',
                }}
            >
                {/* Soft orb tints */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse 60% 60% at ${t.orb1Pos}, ${t.orb1} 0%, transparent 100%)`
                    }} />
                    <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse 55% 55% at ${t.orb2Pos}, ${t.orb2} 0%, transparent 100%)`
                    }} />
                </div>

                <div className="relative z-10 grid lg:grid-cols-[1fr_1.1fr] min-h-[620px]">
                    {/* LEFT — content */}
                    <div className="flex flex-col justify-center px-10 py-14 lg:px-16 order-2 lg:order-1">
                        {/* Overline label */}
                        <div className="flex items-center gap-2.5 mb-7">
                            <div className="w-5 h-px" style={{ background: t.accent }} />
                            <span
                                className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                                style={{ color: t.accent }}
                            >
                                Feature {String(i + 1).padStart(2, '0')}
                            </span>
                        </div>

                        {/* Icon */}
                        <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-8"
                            style={{ background: t.accentDim, color: t.accent }}
                        >
                            <feature.icon size={20} strokeWidth={1.75} />
                        </div>

                        {/* Title */}
                        <h3
                            className="text-[1.85rem] lg:text-[2.1rem] font-bold leading-[1.18] tracking-[-0.025em] mb-4"
                            style={{ color: t.titleColor }}
                        >
                            {feature.title}
                        </h3>

                        <p
                            className="text-[15px] font-normal leading-[1.8] mb-9"
                            style={{ color: t.descColor }}
                        >
                            {feature.description}
                        </p>

                        <ul className="space-y-3.5">
                            {(feature.subFeatures || feature.benefits || []).map((benefit: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <div
                                        className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-[2px]"
                                        style={{ background: t.checkRing }}
                                    >
                                        <Check size={9} strokeWidth={2.5} style={{ color: t.checkColor }} />
                                    </div>
                                    <span className="text-[13.5px] leading-[1.6]" style={{ color: t.benefitColor }}>{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                        {/* RIGHT — tilted browser window */}
                        <div className="order-1 lg:order-2 flex items-center justify-center px-2 py-6 lg:px-4 lg:py-8 overflow-hidden">
                            <div
                                className="relative w-full"
                                style={{ perspective: '1200px' }}
                            >
                                {/* Glow behind frame */}
                                <div
                                    className="absolute inset-4 rounded-2xl"
                                    style={{ background: t.frameGlowColor }}
                                />

                                {/* Browser frame */}
                                <div
                                    className="relative rounded-2xl overflow-hidden border"
                                    style={{
                                        background: t.frameBg,
                                        borderColor: t.frameBorder,
                                        transform: 'rotateY(-4deg) rotateX(2deg)',
                                        transformStyle: 'preserve-3d',
                                    }}
                                >
                                    {/* macOS-style title bar */}
                                    <div
                                        className="flex items-center gap-0 px-4 py-[10px] border-b"
                                        style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(0,0,0,0.07)' }}
                                    >
                                        <div className="flex gap-[6px] mr-4">
                                            <div className="w-[11px] h-[11px] rounded-full bg-[#FF5F57]" />
                                            <div className="w-[11px] h-[11px] rounded-full bg-[#FFBD2E]" />
                                            <div className="w-[11px] h-[11px] rounded-full bg-[#28C840]" />
                                        </div>
                                        <div className="flex-1">
                                            <div
                                                className="rounded-[6px] px-3 py-[5px] text-[11px] font-mono truncate text-center mx-auto"
                                                style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.35)', maxWidth: '220px' }}
                                            >
                                                app.zopkit.com/dashboard
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setFullscreen(true)}
                                            className="ml-2 p-1 rounded-md hover:bg-black/5 transition-colors"
                                            title="Expand"
                                        >
                                            <Maximize2 size={11} style={{ color: 'rgba(0,0,0,0.35)' }} />
                                        </button>
                                    </div>

                                    {/* Screenshot */}
                                    <div className="relative overflow-hidden" style={{ maxHeight: '480px' }}>
                                        {productId === 'financial-accounting' ? (
                                            <div style={{ lineHeight: 0, display: 'block' }}>
                                                {getFAFeatureSvg(i)}
                                            </div>
                                        ) : productId === 'b2b-crm' ? (
                                            <div style={{ lineHeight: 0, display: 'block' }}>
                                                {getCRMFeatureSvg(i)}
                                            </div>
                                        ) : (
                                            <div className="p-5 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.5)', minHeight: '280px' }}>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[{ v: '2.4k', l: 'Users' }, { v: '98%', l: 'Uptime' }, { v: '1.2s', l: 'Response' }, { v: '99.9', l: 'Score' }].map((m, k) => (
                                                        <div key={k} className="rounded-xl p-3 flex flex-col items-center gap-1" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
                                                            <span className="text-base font-bold" style={{ color: t.titleColor }}>{m.v}</span>
                                                            <span className="text-[10px]" style={{ color: t.descColor }}>{m.l}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex-1 rounded-xl p-4 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
                                                    <div className="h-2.5 w-28 rounded-full mb-2" style={{ background: 'rgba(0,0,0,0.08)' }} />
                                                    {[1, 0.8, 0.65, 0.9, 0.55].map((w, k) => (
                                                        <div key={k} className="flex items-center gap-2">
                                                            <div className="h-2 rounded-full" style={{ width: `${w * 100}%`, background: `linear-gradient(90deg, ${t.gradientFrom}80, ${t.gradientTo}50)` }} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
                                                        <Zap size={12} className="text-yellow-500" />
                                                        <span className="text-xs" style={{ color: t.descColor }}>Automated</span>
                                                    </div>
                                                    <div className="flex-1 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
                                                        <Check size={12} className="text-green-600" />
                                                        <span className="text-xs" style={{ color: t.descColor }}>All clear</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Floating stat chips */}
                                <div
                                    className="absolute -bottom-3 -left-2 flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md"
                                    style={{ background: t.floatChipBg, borderColor: t.floatChipBorder, transform: 'translateZ(20px)' }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ background: t.floatChip1.color }} />
                                    <span className="text-[11px]" style={{ color: t.floatChipText }}>{t.floatChip1.label}</span>
                                    <span className="text-[11px] font-bold" style={{ color: t.floatChip1.color }}>{t.floatChip1.value}</span>
                                </div>
                                <div
                                    className="absolute -top-3 -right-2 flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md"
                                    style={{ background: t.floatChipBg, borderColor: t.floatChipBorder, transform: 'translateZ(20px)' }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ background: t.floatChip2.color }} />
                                    <span className="text-[11px]" style={{ color: t.floatChipText }}>{t.floatChip2.label}</span>
                                    <span className="text-[11px] font-bold" style={{ color: t.floatChip2.color }}>{t.floatChip2.value}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
        </>
    );
};

const ProductPage: React.FC = () => {
    const { productId } = useParams({ strict: false });
    const navigate = useNavigate();
    const { login } = useKindeAuth();

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const [isLoading, setIsLoading] = useState(false);

    // Scroll progress for stacking cards
    const container = React.useRef(null);

    // Scroll to top when productId changes (route change)
    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [productId]);

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const googleConnectionId = import.meta.env.VITE_KINDE_GOOGLE_CONNECTION_ID;
            
            if (!googleConnectionId) {
                console.error('❌ VITE_KINDE_GOOGLE_CONNECTION_ID is not configured');
                await login();
            } else {
                await login({ connectionId: googleConnectionId });
            }
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get product data
    const data: ProductData | undefined = productId ? productPagesData[productId] : undefined;

    const pricingAppId = productId ? getPricingAppIdForProductSlug(productId) : undefined;
    const moduleMatrixRows = pricingAppId ? getProductModuleMatrixRows(pricingAppId) : [];
    const usePricingModules = moduleMatrixRows.length > 0;

    /** Legacy marketing comparison when this product is not mapped to `pricingPlanMatrix` apps */
    const legacyComparisonRows =
        data && !usePricingModules
            ? [
                  ...Array.from(new Set(data.pricing.tiers.flatMap((tier) => tier.features))).map((f) => ({
                      name: f,
                      isDynamic: true as const,
                  })),
                  {
                      name: 'Dedicated Support',
                      isDynamic: false as const,
                      values: [false, 'Priority', '24/7 Dedicated'] as const,
                  },
                  {
                      name: 'API Access',
                      isDynamic: false as const,
                      values: [true, true, true] as const,
                  },
                  {
                      name: 'Custom Integrations',
                      isDynamic: false as const,
                      values: [false, true, true] as const,
                  },
                  {
                      name: 'SLA Guarantee',
                      isDynamic: false as const,
                      values: [false, false, '99.9%'] as const,
                  },
              ]
            : [];

    // Dummy data for dashboards
    const lineData = [
        { name: 'Mon', value: 400 },
        { name: 'Tue', value: 300 },
        { name: 'Wed', value: 600 },
        { name: 'Thu', value: 800 },
        { name: 'Fri', value: 500 },
        { name: 'Sat', value: 900 },
        { name: 'Sun', value: 700 },
    ];

    const pieData = [
        { name: 'Group A', value: 400 },
        { name: 'Group B', value: 300 },
        { name: 'Group C', value: 300 },
        { name: 'Group D', value: 200 },
    ];
    const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

    const productName = productInfo.find((p) => p.id === productId)?.name ?? 'Zopkit';

    // If product not found or incomplete, show 404
    // This MUST come after all hooks
    if (!data || !data.hero || !data.problem || !data.solution || !data.features) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-[#1B2E5A] mb-4">Product Not Found</h1>
                    <p className="text-slate-600 mb-8">The product you're looking for doesn't exist or is not yet available.</p>
                    <button
                        onClick={() => navigate({ to: '/' })}
                        className="px-6 py-3 bg-[#1B2E5A] text-white rounded-lg hover:bg-[#162447] transition"
                    >
                        Go to Homepage
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
        {/* FA Mobile — shown only on mobile for financial-accounting */}
        {productId === 'financial-accounting' && (
            <div className="md:hidden">
                <FAMobileProductPage />
            </div>
        )}
        <div className={`w-full bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 ${productId === 'financial-accounting' ? 'hidden md:block' : ''}`}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600&display=swap');
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156,163,175,0.3); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156,163,175,0.5); }

                /* Only opacity + translateY — both GPU-composited, zero jank */
                @keyframes monitorBorn {
                    0%   { opacity: 0; transform: translateY(120px); }
                    100% { opacity: 1; transform: translateY(0);     }
                }
                @keyframes beamUp {
                    0%   { opacity: 0; transform: scaleY(0); }
                    20%  { opacity: 1; }
                    100% { opacity: 0; transform: scaleY(1); }
                }
                @keyframes orbFlare {
                    0%   { opacity: 1; transform: scale(2.2); }
                    100% { opacity: 1; transform: scale(1);   }
                }
                .hero-monitor-born {
                    will-change: transform, opacity;
                    animation: monitorBorn 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .hero-beam {
                    will-change: transform, opacity;
                    animation: beamUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    transform-origin: bottom center;
                }
                .hero-orb-flare {
                    will-change: transform, opacity;
                    animation: orbFlare 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                /* 3-D projector puck */
                @keyframes ppFloat    { 0%,100%{ transform:translateY(0px) } 50%{ transform:translateY(-6px) } }
                @keyframes ppLensGlow {
                    0%,100%{ box-shadow:0 0 0 3px rgba(36,59,110,0.95),0 0 18px 5px rgba(46,79,140,0.9),0 0 44px 10px rgba(36,59,110,0.6),0 0 90px 20px rgba(27,46,90,0.35) }
                    50%{     box-shadow:0 0 0 3px rgba(60,105,190,1),0 0 28px 9px rgba(60,105,190,0.95),0 0 68px 16px rgba(46,79,140,0.75),0 0 140px 28px rgba(36,59,110,0.5) }
                }
                @keyframes ppHotspot  { 0%,100%{ opacity:0.9;filter:blur(1.5px);transform:scale(1) } 50%{ opacity:1;filter:blur(0.5px);transform:scale(1.22) } }
                @keyframes ppRingOut  { 0%{ transform:scale(0.5);opacity:0.75 } 100%{ transform:scale(3.8);opacity:0 } }
                .pp-puck-float  { animation: ppFloat    5.5s ease-in-out infinite; }
                .pp-lens-glow   { animation: ppLensGlow 2.8s ease-in-out infinite; }
                .pp-hotspot     { animation: ppHotspot  2.8s ease-in-out infinite; }
                .pp-ring-out    { animation: ppRingOut  2.8s ease-out   infinite; }
                .pp-ring-out-2  { animation: ppRingOut  2.8s ease-out 1.4s infinite; }
                @keyframes zkConeIn { from { opacity: 0 } to { opacity: 1 } }
                .fa-light-cone  { animation: zkConeIn 0.55s ease-in 0.9s forwards; opacity: 0; }
            `}</style>

            <MarketingNavbar
                desktopRight={
                    <NavbarButton
                        variant="outline"
                        onClick={handleLogin}
                        disabled={isLoading}
                        as="button"
                        className="rounded-xl px-6 py-2.5"
                    >
                        {isLoading ? 'Loading...' : 'Sign In'}
                    </NavbarButton>
                }
                mobileFooter={
                    <NavbarButton
                        variant="outline"
                        onClick={handleLogin}
                        disabled={isLoading}
                        as="button"
                        className="w-full justify-center rounded-xl"
                    >
                        {isLoading ? 'Loading...' : 'Sign In'}
                    </NavbarButton>
                }
            />

            {/* 1. HERO SECTION */}
            <section className="relative pt-28 pb-32 bg-white" style={{ overflow: 'visible' }}>
                {/* Soft background radial gradient */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 20%, #dde4f5 0%, #edf0f8 45%, #ffffff 80%)' }} />
                </div>

                <div className="container mx-auto px-4 lg:px-8 relative z-10">

                    {/* Hero — Monitor born from the orb */}
                    <div className="relative flex flex-col items-center" style={{ marginLeft: '-2rem', marginRight: '-2rem' }}>

                        {/* Light cone — sits behind monitor (zIndex 0 < monitor zIndex 1) */}
                        <div
                            className="fa-light-cone"
                            style={{
                                position: 'absolute',
                                bottom: '35px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '720px',
                                height: '520px',
                                pointerEvents: 'none',
                                zIndex: 0,
                            }}
                        >
                            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
                                <defs>
                                    <linearGradient id="fa-cone-core" x1="50" y1="100" x2="50" y2="68" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"  stopColor="rgba(46,79,140,0.80)" />
                                        <stop offset="30%" stopColor="rgba(36,59,110,0.42)" />
                                        <stop offset="100%" stopColor="rgba(27,46,90,0.08)" />
                                    </linearGradient>
                                    <linearGradient id="fa-cone-wide" x1="50" y1="100" x2="50" y2="65" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"  stopColor="rgba(36,59,110,0.55)" />
                                        <stop offset="50%" stopColor="rgba(27,46,90,0.22)" />
                                        <stop offset="100%" stopColor="rgba(15,27,61,0.04)" />
                                    </linearGradient>
                                    <linearGradient id="fa-ray-l" x1="50" y1="100" x2="12" y2="68" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"  stopColor="rgba(120,160,220,1)" />
                                        <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
                                        <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
                                    </linearGradient>
                                    <linearGradient id="fa-ray-r" x1="50" y1="100" x2="88" y2="68" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"  stopColor="rgba(120,160,220,1)" />
                                        <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
                                        <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
                                    </linearGradient>
                                    <radialGradient id="fa-src-halo" cx="50" cy="100" r="12" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"  stopColor="rgba(140,180,240,0.90)" />
                                        <stop offset="40%" stopColor="rgba(46,79,140,0.55)" />
                                        <stop offset="100%" stopColor="rgba(15,27,61,0.00)" />
                                    </radialGradient>
                                    <linearGradient id="fa-screen-glow" x1="17" y1="68" x2="83" y2="68" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%"   stopColor="rgba(27,46,90,0.00)" />
                                        <stop offset="20%"  stopColor="rgba(36,59,110,0.45)" />
                                        <stop offset="50%"  stopColor="rgba(46,79,140,0.65)" />
                                        <stop offset="80%"  stopColor="rgba(36,59,110,0.45)" />
                                        <stop offset="100%" stopColor="rgba(27,46,90,0.00)" />
                                    </linearGradient>
                                    <filter id="fa-f-soft"  x="-30%" y="-15%" width="160%" height="145%"><feGaussianBlur stdDeviation="2 1.2" /></filter>
                                    <filter id="fa-f-wide"  x="-50%" y="-15%" width="200%" height="145%"><feGaussianBlur stdDeviation="6 3.5" /></filter>
                                    <filter id="fa-f-ray"   x="-200%" y="-30%" width="500%" height="160%"><feGaussianBlur stdDeviation="0.6 0.3" /></filter>
                                    <filter id="fa-f-glow"  x="-200%" y="-30%" width="500%" height="160%"><feGaussianBlur stdDeviation="1.5 0.8" /></filter>
                                    <filter id="fa-f-edge"  x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="0.8 2.5" /></filter>
                                    <filter id="fa-f-halo"  x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3 2" /></filter>
                                </defs>
                                <polygon points="50,100 10,68 90,68"  fill="url(#fa-cone-wide)" filter="url(#fa-f-wide)" opacity="0.85" />
                                <polygon points="50,100 20,68 80,68" fill="url(#fa-cone-core)" filter="url(#fa-f-soft)" opacity="0.9" />
                                <polygon points="50,100 33,68 67,68" fill="url(#fa-cone-core)" filter="url(#fa-f-soft)" opacity="0.75" />
                                <polygon points="50,100 43,68 57,68" fill="url(#fa-cone-core)" filter="url(#fa-f-soft)" opacity="0.9" />
                                <line x1="50" y1="100" x2="20" y2="68" stroke="url(#fa-ray-l)" strokeWidth="0.7" filter="url(#fa-f-ray)" />
                                <line x1="50" y1="100" x2="20" y2="68" stroke="url(#fa-ray-l)" strokeWidth="4"   filter="url(#fa-f-glow)" opacity="0.75" />
                                <line x1="50" y1="100" x2="80" y2="68" stroke="url(#fa-ray-r)" strokeWidth="0.7" filter="url(#fa-f-ray)" />
                                <line x1="50" y1="100" x2="80" y2="68" stroke="url(#fa-ray-r)" strokeWidth="4"   filter="url(#fa-f-glow)" opacity="0.75" />
                                <ellipse cx="50" cy="100" rx="7" ry="2.5" fill="url(#fa-src-halo)" filter="url(#fa-f-halo)" />
                                <line x1="20" y1="68" x2="80" y2="68" stroke="url(#fa-screen-glow)" strokeWidth="1.5" filter="url(#fa-f-edge)" />
                                <circle cx="20" cy="68" r="1.5" fill="rgba(36,59,110,0.7)" filter="url(#fa-f-soft)" />
                                <circle cx="80" cy="68" r="1.5" fill="rgba(36,59,110,0.7)" filter="url(#fa-f-soft)" />
                            </svg>
                        </div>

                        {/* Monitor — starts at orb level and rises up */}
                        <div
                            className="relative w-full hero-monitor-born"
                            style={{
                                maxWidth: '900px',
                                borderRadius: '24px',
                                background: 'linear-gradient(175deg, #1c2035 0%, #0e1120 50%, #090c18 100%)',
                                padding: '8px',
                                boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
                                zIndex: 1,
                            }}
                        >
                            {/* Top bar — single row with logo dot + right dot (matches reference) */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: '36px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b5bdb', boxShadow: '0 0 6px rgba(59,91,219,0.8)' }} />
                                    <div style={{ height: '5px', width: '90px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ height: '5px', width: '70px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)' }} />
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }} />
                                </div>
                            </div>

                            {/* Screen content */}
                            <div style={{ borderRadius: '16px', overflow: 'hidden' }}>
                                {productId === 'financial-accounting' ? (
                                    /* White FA dashboard mock */
                                    <div style={{ display: 'flex', height: '480px', background: '#FFFFFF', overflow: 'hidden' }}>
                                        {/* Sidebar */}
                                        <div style={{ width: '170px', flexShrink: 0, background: '#F5F7FA', borderRight: '1px solid rgba(19,32,74,0.08)', padding: '10px 7px', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ padding: '4px 5px', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                                                <img src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1771698937/Zopkit-full_n7lm0f.png" alt="Zopkit" style={{ height: 26, width: 'auto', display: 'block' }} />
                                            </div>
                                            {['General Ledger','Accounts Payable','Accounts Receivable','Banking & Cash','GST & Tax','Fixed Assets','Financial Reports','Audit Trail','Cost Centers','Budgeting','Compliance'].map((item, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: i === 0 ? 'rgba(27,46,90,0.08)' : 'transparent', borderRadius: 4, borderLeft: `2px solid ${i === 0 ? '#1b2e5a' : 'transparent'}`, marginBottom: 2 }}>
                                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b2e5a', flexShrink: 0, opacity: i === 0 ? 1 : 0.3 }} />
                                                    <span style={{ fontSize: 7, color: i === 0 ? '#1b2e5a' : 'rgba(19,32,74,0.45)', fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Main content */}
                                        <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#1b2e5a' }}>General Ledger</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(27,46,90,0.06)', border: '1px solid rgba(27,46,90,0.15)', borderRadius: 100, padding: '2px 8px' }}>
                                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b2e5a' }} />
                                                        <span style={{ fontSize: 7, color: 'rgba(27,46,90,0.9)', fontWeight: 600 }}>FY 2025-26</span>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: 7, color: 'rgba(19,32,74,0.35)' }}>Period: Apr–May 2025</span>
                                            </div>
                                            {/* Stat cards */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                                                {[
                                                    { label: 'Total Revenue', value: '₹84.2L', sub: '+18% YoY', color: '#1b2e5a' },
                                                    { label: 'GST Filed', value: '100%', sub: 'Aug 2025 ✓', color: '#047857' },
                                                    { label: 'Payables', value: '₹12.4L', sub: '23 pending', color: '#c2410c' },
                                                    { label: 'Cash Balance', value: '₹34.6L', sub: 'Updated today', color: '#0369a1' },
                                                ].map((stat, i) => (
                                                    <div key={i} style={{ background: '#FFFFFF', border: '1px solid rgba(19,32,74,0.08)', borderTop: `2px solid ${stat.color}`, borderRadius: '0 0 8px 8px', padding: '8px 10px' }}>
                                                        <div style={{ fontSize: 6.5, color: 'rgba(19,32,74,0.45)', fontWeight: 500, marginBottom: 4 }}>{stat.label}</div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                                        <div style={{ fontSize: 6, color: 'rgba(19,32,74,0.35)', marginTop: 3 }}>{stat.sub}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Journal entries table */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(19,32,74,0.08)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 0.7fr 0.6fr 0.6fr', gap: 6, padding: '6px 10px', background: 'rgba(19,32,74,0.04)', borderBottom: '1px solid rgba(19,32,74,0.08)' }}>
                                                    {['Journal Entry','Date','Account','Debit','Credit'].map((col, j) => (
                                                        <span key={j} style={{ fontSize: 6, fontWeight: 600, color: 'rgba(19,32,74,0.4)', textTransform: 'uppercase' as const }}>{col}</span>
                                                    ))}
                                                </div>
                                                {[
                                                    { entry: 'JE-2025-0847', date: '15 May', account: 'Sales A/c',      debit: '₹4.2L',  credit: '—',      status: 'posted' },
                                                    { entry: 'JE-2025-0846', date: '14 May', account: 'GST Payable',    debit: '—',       credit: '₹0.76L', status: 'posted' },
                                                    { entry: 'JE-2025-0845', date: '13 May', account: 'Vendor PMT',     debit: '₹1.8L',  credit: '—',      status: 'reconciled' },
                                                    { entry: 'JE-2025-0844', date: '12 May', account: 'Fixed Asset',    debit: '₹6.0L',  credit: '—',      status: 'pending' },
                                                    { entry: 'JE-2025-0843', date: '11 May', account: 'TDS Receivable', debit: '—',       credit: '₹0.34L', status: 'posted' },
                                                    { entry: 'JE-2025-0842', date: '10 May', account: 'Salary Exp',     debit: '₹8.4L',  credit: '—',      status: 'posted' },
                                                ].map((row, i) => (
                                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 0.7fr 0.6fr 0.6fr', gap: 6, padding: '5px 10px', borderBottom: '1px solid rgba(19,32,74,0.04)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(19,32,74,0.015)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: row.status === 'posted' ? '#1b2e5a' : row.status === 'reconciled' ? '#047857' : '#d97706', flexShrink: 0 }} />
                                                            <span style={{ fontSize: 6.5, color: '#1b2e5a', fontWeight: 600 }}>{row.entry}</span>
                                                        </div>
                                                        <span style={{ fontSize: 6.5, color: 'rgba(19,32,74,0.5)' }}>{row.date}</span>
                                                        <span style={{ fontSize: 6.5, color: 'rgba(19,32,74,0.7)', fontWeight: 500 }}>{row.account}</span>
                                                        <span style={{ fontSize: 6.5, color: row.debit !== '—' ? '#047857' : 'rgba(19,32,74,0.3)', fontWeight: row.debit !== '—' ? 600 : 400 }}>{row.debit}</span>
                                                        <span style={{ fontSize: 6.5, color: row.credit !== '—' ? '#c2410c' : 'rgba(19,32,74,0.3)', fontWeight: row.credit !== '—' ? 600 : 400 }}>{row.credit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Bottom panels */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div style={{ background: '#FFFFFF', border: '1px solid rgba(19,32,74,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 7.5, fontWeight: 700, color: '#1b2e5a', marginBottom: 6 }}>GST Compliance</div>
                                                    {[{ name: 'GSTR-1', status: 'Filed', color: '#047857' }, { name: 'GSTR-3B', status: 'Filed', color: '#047857' }, { name: 'E-Invoice', status: 'Active', color: '#1b2e5a' }, { name: 'TDS Return', status: 'Pending', color: '#d97706' }].map((item, i) => (
                                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                            <span style={{ fontSize: 6.5, color: 'rgba(19,32,74,0.6)' }}>{item.name}</span>
                                                            <span style={{ fontSize: 6, fontWeight: 600, color: item.color, background: `${item.color}18`, padding: '1px 5px', borderRadius: 3 }}>{item.status}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ background: '#FFFFFF', border: '1px solid rgba(19,32,74,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: 7.5, fontWeight: 700, color: '#1b2e5a', marginBottom: 6 }}>Module Health</div>
                                                    {[{ name: 'General Ledger', pct: 98 }, { name: 'Accounts Payable', pct: 94 }, { name: 'Accounts Receivable', pct: 87 }, { name: 'Banking & Cash', pct: 100 }].map((mod, i) => (
                                                        <div key={i} style={{ marginBottom: 5 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                                <span style={{ fontSize: 6, color: 'rgba(19,32,74,0.55)' }}>{mod.name}</span>
                                                                <span style={{ fontSize: 6, fontWeight: 600, color: '#1b2e5a' }}>{mod.pct}%</span>
                                                            </div>
                                                            <div style={{ height: 3, background: 'rgba(19,32,74,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${mod.pct}%`, background: 'linear-gradient(90deg, rgba(27,46,90,0.5), #1b2e5a)', borderRadius: 2 }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Dark dashboard mock — sidebar + content matches reference layout */
                                    <div style={{ display: 'flex', height: '480px', background: '#0b0e1a', overflow: 'hidden' }}>
                                        {/* Sidebar */}
                                        <div style={{ width: '190px', flexShrink: 0, background: '#0d1020', borderRight: '1px solid rgba(255,255,255,0.04)', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {/* Logo row */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px 14px' }}>
                                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #3b5bdb, #6366f1)', flexShrink: 0 }} />
                                                <div style={{ height: '6px', width: '70px', borderRadius: '3px', background: 'rgba(255,255,255,0.2)' }} />
                                            </div>
                                            {/* Nav items */}
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
                                                <div key={i} style={{ height: '32px', margin: '0 8px', borderRadius: '7px', background: i === 2 ? 'rgba(59,91,219,0.25)' : 'transparent', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
                                                    <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: i === 2 ? '#5b7fff' : 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                                                    <div style={{ height: '5px', borderRadius: '3px', background: i === 2 ? 'rgba(91,127,255,0.5)' : 'rgba(255,255,255,0.1)', width: `${42 + (i * 17) % 38}px` }} />
                                                </div>
                                            ))}
                                        </div>
                                        {/* Main content */}
                                        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                                            {/* Stat cards row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {data.hero.stats.map((stat, i) => (
                                                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
                                                        <div style={{ height: '5px', width: '55px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', marginBottom: '7px' }} />
                                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.2px' }}>{stat.value}</div>
                                                        <div style={{ height: '2px', width: '30px', borderRadius: '2px', background: 'rgba(59,91,219,0.6)', marginTop: '6px' }} />
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Tab strip */}
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {['Overview', 'Analytics', 'Reports', 'Settings', 'Audit', 'Team'].map((tab, i) => (
                                                    <div key={tab} style={{ height: '26px', borderRadius: '6px', padding: '0 14px', display: 'flex', alignItems: 'center', background: i === 0 ? 'rgba(59,91,219,0.35)' : 'transparent', borderBottom: i === 0 ? '2px solid #5b7fff' : '2px solid transparent' }}>
                                                        <span style={{ fontSize: '10px', color: i === 0 ? '#a0b4ff' : 'rgba(255,255,255,0.3)', fontWeight: i === 0 ? 600 : 400 }}>{tab}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Table */}
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                {/* Header row */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(59,91,219,0.5)' }}>
                                                    {[80, 60, 45, 45, 55].map((w, j) => (
                                                        <div key={j} style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.18)', width: `${w}%` }} />
                                                    ))}
                                                </div>
                                                {/* Data rows */}
                                                {[...Array(7)].map((_, row) => (
                                                    <div key={row} style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr', gap: '6px', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                                                            <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.14)', width: `${48 + (row * 23) % 38}px` }} />
                                                        </div>
                                                        {[55, 42, 38, 50].map((w, c) => (
                                                            <div key={c} style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.09)', width: `${w}%` }} />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Bottom two panels */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                {[0, 1].map(panel => (
                                                    <div key={panel} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', padding: '12px' }}>
                                                        <div style={{ height: '5px', width: '70px', borderRadius: '3px', background: 'rgba(255,255,255,0.14)', marginBottom: '10px' }} />
                                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                            {[...Array(6)].map((_, j) => (
                                                                <div key={j} style={{ height: '22px', borderRadius: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', width: `${36 + (j * 13) % 28}px` }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Projector puck + beam */}
                        <div style={{ position: 'relative', marginTop: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                            {/* Flash beam on entry — fades out as puck activates */}
                            <div
                                className="hero-beam"
                                style={{
                                    position: 'absolute',
                                    bottom: '52px',
                                    left: '50%',
                                    transform: 'translateX(-50%) scaleY(0)',
                                    width: '200px',
                                    height: '240px',
                                    background: 'linear-gradient(to top, rgba(46,79,140,0.60) 0%, rgba(60,100,200,0.28) 35%, transparent 100%)',
                                    filter: 'blur(16px)',
                                    pointerEvents: 'none',
                                    borderRadius: '50% 50% 0 0',
                                }}
                            />

                            {/* ── 3-D Cylindrical Puck (reduced size) ── */}
                            <div
                                className="pp-puck-float"
                                style={{
                                    position: 'relative',
                                    width: '200px',
                                    height: '70px',
                                    flexShrink: 0,
                                    filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.55)) drop-shadow(0 0 44px rgba(27,46,90,0.45))',
                                }}
                            >
                                {/* Cylinder side */}
                                <div style={{
                                    position: 'absolute', top: '20%', left: 0, right: 0, bottom: 0,
                                    background: 'linear-gradient(to bottom, #212128 0%, #161620 28%, #0d0d14 65%, #070710 100%)',
                                    borderRadius: '0 0 50% 50% / 0 0 22% 22%',
                                    boxShadow: 'inset 5px 0 15px rgba(255,255,255,0.045),inset -5px 0 15px rgba(0,0,0,0.45),inset 0 -8px 20px rgba(0,0,0,0.75)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '9%', background: 'linear-gradient(to right, rgba(255,255,255,0.07), transparent)' }} />
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '9%', background: 'linear-gradient(to left, rgba(0,0,0,0.35), transparent)' }} />
                                </div>

                                {/* Top face */}
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                                    background: 'radial-gradient(ellipse at 48% 38%, #2c2c38 0%, #1a1a26 50%, #0e0e18 82%, #08080f 100%)',
                                    borderRadius: '50%', zIndex: 2,
                                    boxShadow: 'inset 0 6px 15px rgba(255,255,255,0.055),inset 0 -4px 10px rgba(0,0,0,0.65),0 5px 15px rgba(0,0,0,0.65)',
                                }}>
                                    <div style={{ position: 'absolute', top: '7%', left: '7%', right: '7%', bottom: '7%', borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.055),inset 0 0 8px rgba(0,0,0,0.6)' }} />
                                    <div style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 42%, #1e1e2a 0%, #0c0c14 100%)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.95)' }} />
                                    <div className="pp-lens-glow" style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', background: 'transparent' }} />
                                    <div className="pp-ring-out"   style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(60,105,200,0.5)' }} />
                                    <div className="pp-ring-out-2" style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(60,105,200,0.3)' }} />
                                    <div style={{ position: 'absolute', top: '32%', left: '32%', right: '32%', bottom: '32%', borderRadius: '50%', background: 'radial-gradient(circle at 44% 38%, #d0e4ff 0%, #88aef0 14%, #243B6E 36%, #1B2E5A 64%, #0F1B3D 100%)', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.75)' }} />
                                    <div className="pp-hotspot" style={{ position: 'absolute', top: '42%', left: '42%', right: '42%', bottom: '42%', borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, #d2e8ff 55%, transparent 100%)' }} />
                                </div>

                                {/* Ground shadow */}
                                <div style={{ position: 'absolute', bottom: '-14%', left: '18%', right: '18%', height: '18%', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(10px)' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. PROBLEM / SOLUTION - COMPACT WINDOW LAYOUT */}
            <section className="py-24 bg-slate-50 relative overflow-hidden" id="perspective">
                {/* Background Decor */}
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-4 block">The Evolution</span>
                        <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-[#1B2E5A] leading-tight">
                            The Shift in Perspective
                        </h2>
                        <p className="text-lg text-slate-600">
                            See how {productName} changes the game by bringing order to chaos.
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch max-w-6xl mx-auto h-[650px] lg:h-[550px]">

                        {/* THE PROBLEM CARD (COMPACT & SCROLLABLE) */}
                        <div className="flex-1 bg-white rounded-2xl border border-red-100 shadow-xl overflow-hidden flex flex-col relative group hover:shadow-2xl hover:shadow-red-900/10 transition-all duration-500">
                            {/* Card Header */}
                            <div className="bg-red-50/80 backdrop-blur-sm p-4 border-b border-red-100 flex items-center justify-between z-20">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-200"></div>
                                    </div>
                                    <span className="text-xs font-bold text-red-700 uppercase ml-2 tracking-wide">Manual Workflow</span>
                                </div>
                                <XCircle size={18} className="text-red-400" />
                            </div>

                            {/* Visualization Background (Chaotic) */}
                            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="absolute animate-pulse"
                                        style={{
                                            top: `${Math.random() * 80 + 10}%`,
                                            left: `${Math.random() * 80 + 10}%`,
                                            animationDuration: `${Math.random() * 3 + 2}s`
                                        }}>
                                        <AlertCircle size={24} className="text-red-500" />
                                    </div>
                                ))}
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 relative z-10">
                                <div className="mb-6">
                                    <h4 className="text-2xl font-bold text-slate-800 mb-2 leading-tight">
                                        {data.problem.headline}
                                    </h4>
                                    <div className="h-1 w-12 bg-red-400 rounded-full"></div>
                                </div>

                                <div className="space-y-4">
                                    {data.problem.painPoints.map((point, i) => (
                                        <div key={i} className="group bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm hover:border-rose-200 hover:shadow-md transition-all duration-200">
                                            <div className="flex gap-3 items-start">
                                                <div className="mt-0.5 w-7 h-7 rounded-lg bg-rose-50 text-rose-500 shrink-0 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                                                    <X size={14} strokeWidth={2.5} />
                                                </div>
                                                <p className="text-slate-700 font-medium text-sm leading-relaxed pt-0.5">{point.text}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Dummy Extra Content to force scroll if needed */}
                                    <div className="opacity-50 space-y-3 pt-4 grayscale">
                                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* THE SOLUTION CARD (COMPACT & SCROLLABLE) */}
                        <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col relative group transform lg:scale-105 z-20 transition-all duration-500">
                            {/* Card Header */}
                            <div className="bg-slate-800/80 backdrop-blur-sm p-4 border-b border-slate-700 flex items-center justify-between z-20">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse"></div>
                                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                                    </div>
                                    <span className="text-xs font-bold text-blue-300 uppercase ml-2 tracking-wide">Automated System</span>
                                </div>
                                <CheckCircle size={18} className="text-green-400" />
                            </div>

                            {/* Visualization Background (Organized) */}
                            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                        </pattern>
                                    </defs>
                                    <rect width="100%" height="100%" fill="url(#grid)" />
                                </svg>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 relative z-10">
                                <div className="mb-6">
                                    <h4 className="text-2xl font-bold text-white mb-2 leading-tight">
                                        {data.solution.headline}
                                    </h4>
                                    <div className="h-1 w-12 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                </div>

                                <div className="space-y-4">
                                    {/* Hero Stat in Solution */}
                                    <div className="flex gap-4 mb-6">
                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                            <div className="text-xs text-slate-400 uppercase">Efficiency</div>
                                            <div className="text-xl font-bold text-green-400">+300%</div>
                                        </div>
                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                            <div className="text-xs text-slate-400 uppercase">Errors</div>
                                            <div className="text-xl font-bold text-blue-400">0%</div>
                                        </div>
                                    </div>

                                    {data.solution.differentiators.map((diff, i) => (
                                        <div key={i} className="bg-gradient-to-r from-blue-900/40 to-slate-800/40 border border-blue-500/30 p-4 rounded-xl shadow-lg backdrop-blur-sm hover:border-blue-400/50 transition-colors">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                                    <diff.icon size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-slate-100 font-medium text-sm">{diff.text}</p>
                                                </div>
                                                <Check size={14} className="text-green-500" />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Interactive-looking elements */}
                                    <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between">
                                        <span className="text-xs text-green-300 font-mono flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                                            System Optimized
                                        </span>
                                        <button className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1 rounded transition-colors">View Logs</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* 4. Marketing features */}
            <section className="py-24 bg-white relative">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center max-w-2xl mx-auto mb-20">
                        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">
                            Capabilities
                        </p>
                        <h2 className="text-[2.25rem] lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.15] text-slate-900 mb-4">
                            Everything you need
                        </h2>
                        <p className="text-[17px] text-slate-500 leading-[1.7] font-normal">
                            Explore the powerful capabilities built into the core of {productName}.
                        </p>
                    </div>

                    <div ref={container} className="pb-32">
                        {data.features.map((feature, idx) => {
                            return (
                                <FeatureCard
                                    key={idx}
                                    i={idx}
                                    feature={feature}
                                    productId={productId}
                                />
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 5. USE CASES TABS */}
            <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px] opacity-30"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] opacity-30"></div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Built for Your Industry</h2>
                        <p className="text-slate-400">Tailored solutions for specific business needs.</p>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {data.useCases.map((useCase, idx) => (
                            <div key={idx} className="relative p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                        {useCase.title} <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all" />
                                    </h3>
                                    <p className="text-slate-300 mb-6 min-h-[3rem]">{useCase.description}</p>

                                    <div className="space-y-3">
                                        {useCase.benefits.map((b, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                {b}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. PLAN COMPARISON — pricing matrix modules or legacy marketing table */}
            <section className="py-24 bg-white" id="comparison">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100">
                            <LayoutGrid size={12} /> Compare Plans
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-[#1B2E5A]">
                            {usePricingModules ? 'Modules by plan' : 'Find the Perfect Fit'}
                        </h2>
                        {!usePricingModules && (
                            <p className="text-lg text-slate-600">
                                Detailed breakdown of features across all plans.
                            </p>
                        )}
                    </div>

                    <div className="max-w-6xl mx-auto">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-20">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px] border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-6 text-left w-1/3 bg-slate-50/50 border-b border-r border-slate-100 sticky left-0 backdrop-blur-sm z-10">
                                                <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                                                    {usePricingModules ? 'Modules' : 'Features'}
                                                </span>
                                            </th>
                                            {usePricingModules
                                                ? (['Starter', 'Professional', 'Enterprise'] as const).map((name, idx) => (
                                                      <th
                                                          key={name}
                                                          className={`p-6 text-center w-1/5 border-b border-slate-100 ${idx === 1 ? 'bg-blue-50/30' : 'bg-white'}`}
                                                      >
                                                          <div className="font-bold text-xl text-[#1B2E5A] mb-1">{name}</div>
                                                          <div className="text-slate-500 font-medium text-xs">Annual plans</div>
                                                      </th>
                                                  ))
                                                : data.pricing.tiers.map((tier, idx) => (
                                                      <th key={idx} className={`p-6 text-center w-1/5 border-b border-slate-100 ${tier.popular ? 'bg-blue-50/30' : 'bg-white'}`}>
                                                          <div className="font-bold text-xl text-[#1B2E5A] mb-1">{tier.name}</div>
                                                          <div className="text-blue-600 font-semibold text-sm">Contact Us</div>
                                                      </th>
                                                  ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usePricingModules
                                            ? moduleMatrixRows.map((row) => (
                                                  <tr key={row.code} className="hover:bg-slate-50 transition-colors group">
                                                      <td className="p-5 border-b border-r border-slate-100 text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                                                          {row.label}
                                                      </td>
                                                      {[row.starter, row.professional, row.enterprise].map((included, colIdx) => (
                                                          <td
                                                              key={colIdx}
                                                              className={`p-5 border-b border-slate-100 ${colIdx === 1 ? 'bg-blue-50/10' : ''}`}
                                                          >
                                                              {included ? (
                                                                  <div className="flex justify-center">
                                                                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                                          <Check size={16} strokeWidth={3} />
                                                                      </div>
                                                                  </div>
                                                              ) : (
                                                                  <div className="flex justify-center">
                                                                      <Minus size={16} className="text-slate-300" />
                                                                  </div>
                                                              )}
                                                          </td>
                                                      ))}
                                                  </tr>
                                              ))
                                            : legacyComparisonRows.map((row, rowIdx) => (
                                                  <tr key={rowIdx} className="hover:bg-slate-50 transition-colors group">
                                                      <td className="p-5 border-b border-r border-slate-100 text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 flex items-center gap-2">
                                                          {row.name}
                                                          <div className="text-slate-300 hover:text-blue-500 cursor-help transition-colors">
                                                              <AlertCircle size={14} />
                                                          </div>
                                                      </td>
                                                      {data.pricing.tiers.map((tier, colIdx) => {
                                                          let cellContent;

                                                          if (row.isDynamic) {
                                                              const hasFeature = tier.features.includes(row.name);
                                                              cellContent = hasFeature ? (
                                                                  <div className="flex justify-center">
                                                                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                                          <Check size={16} strokeWidth={3} />
                                                                      </div>
                                                                  </div>
                                                              ) : (
                                                                  <div className="flex justify-center">
                                                                      <Minus size={16} className="text-slate-300" />
                                                                  </div>
                                                              );
                                                          } else {
                                                              const val = 'values' in row && row.values ? row.values[colIdx] : false;
                                                              if (typeof val === 'boolean') {
                                                                  cellContent = val ? (
                                                                      <div className="flex justify-center">
                                                                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                                              <Check size={16} strokeWidth={3} />
                                                                          </div>
                                                                      </div>
                                                                  ) : (
                                                                      <div className="flex justify-center">
                                                                          <Minus size={16} className="text-slate-300" />
                                                                      </div>
                                                                  );
                                                              } else {
                                                                  cellContent = <div className="text-center font-semibold text-slate-700">{val}</div>;
                                                              }
                                                          }

                                                          return (
                                                              <td key={colIdx} className={`p-5 border-b border-slate-100 ${tier.popular ? 'bg-blue-50/10' : ''}`}>
                                                                  {cellContent}
                                                              </td>
                                                          );
                                                      })}
                                                  </tr>
                                              ))}
                                        <tr>
                                            <td className="p-6 border-r border-slate-100 sticky left-0 bg-white z-10"></td>
                                            {usePricingModules
                                                ? (['Starter', 'Professional', 'Enterprise'] as const).map((_, idx) => (
                                                      <td key={idx} className={`p-6 text-center ${idx === 1 ? 'bg-blue-50/10' : ''}`}>
                                                          <button
                                                              type="button"
                                                              onClick={() => navigate({ to: '/onboarding' })}
                                                              className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                                                                  idx === 1
                                                                      ? 'bg-[#1B2E5A] text-white hover:bg-[#162447] shadow-lg shadow-blue-600/20'
                                                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                              }`}
                                                          >
                                                              Start free trial
                                                          </button>
                                                      </td>
                                                  ))
                                                : data.pricing.tiers.map((tier, idx) => (
                                                      <td key={idx} className={`p-6 text-center ${tier.popular ? 'bg-blue-50/10' : ''}`}>
                                                          <button
                                                              type="button"
                                                              onClick={() => navigate({ to: '/onboarding' })}
                                                              className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                                                                  tier.popular
                                                                      ? 'bg-[#1B2E5A] text-white hover:bg-[#162447] shadow-lg shadow-blue-600/20'
                                                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                              }`}
                                                          >
                                                              {tier.cta}
                                                          </button>
                                                      </td>
                                                  ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {!usePricingModules && (
                            <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200">
                                <h3 className="text-2xl font-bold mb-8 text-center text-slate-800 flex items-center justify-center gap-3">
                                    <Sparkles className="text-amber-400 fill-amber-400" />
                                    Included in All Plans
                                </h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                                    {[
                                        'SSO & 2FA Security',
                                        '99.9% Uptime SLA',
                                        'GDPR Compliance',
                                        'Daily Backups',
                                        'Mobile App Access',
                                        'Custom Branding',
                                        'API Documentation',
                                        'Community Access',
                                        'Email Support',
                                        'Video Tutorials',
                                        'Data Export',
                                        'Audit Logs',
                                    ].map((feature, i) => (
                                        <div key={i} className="flex items-center gap-3 text-slate-700">
                                            <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            <span className="font-medium text-sm">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 7. TESTIMONIAL & FINAL CTA */}
            <section className="py-24 bg-gradient-to-b from-blue-50 to-white">
                <div className="container mx-auto px-4">
                    <div className="relative bg-slate-900 rounded-[2.5rem] p-12 lg:p-24 text-center overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500/30 rounded-full blur-[80px]"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-purple-500/30 rounded-full blur-[80px]"></div>

                        <div className="relative z-10 max-w-3xl mx-auto">
                            <h2 className="text-4xl lg:text-6xl font-bold mb-8 text-white tracking-tight">
                                {data.finalCTA.headline}
                            </h2>
                            <p className="text-xl text-slate-300 mb-12">
                                {data.finalCTA.description}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={() => navigate({ to: '/onboarding' })}
                                    className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-full font-semibold text-base shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-inset ring-white/40"
                                >
                                    {data.finalCTA.primaryCTA}
                                    <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
                                </button>
                                <button className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/15 text-white rounded-full font-semibold text-base hover:bg-white/10 hover:border-white/25 transition-all duration-200 backdrop-blur-sm">
                                    <Calendar size={15} strokeWidth={2.25} className="text-blue-300" />
                                    Schedule a Demo
                                </button>
                            </div>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle size={12} className="text-emerald-400" />
                                    14-day free trial
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle size={12} className="text-emerald-400" />
                                    No credit card required
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle size={12} className="text-emerald-400" />
                                    Cancel anytime
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
        </>
    );
};

export default ProductPage;

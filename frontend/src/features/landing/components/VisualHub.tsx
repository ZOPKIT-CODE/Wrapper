import React, { useEffect, useState, useRef, useCallback } from 'react';

import { Product } from '../../types';
import { DynamicIcon } from './Icons';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface VisualHubProps {
    product: Product;
}

const INSIGHT_FALLBACKS = [
    "System parameters optimized.",
    "Real-time data synchronization complete.",
    "Workflow efficiency increased by 14%.",
    "Predictive analytics module active.",
    "Latency reduced by 40%. Velocity nominal.",
    "Resource allocation optimized. Efficiency at 98%.",
] as const;

const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const generateData = (id: number | string) => {
    let seed = 0;
    if (typeof id === 'number') {
        seed = id;
    } else {
        for (let i = 0; i < id.length; i++) {
            seed = ((seed << 5) - seed) + id.charCodeAt(i);
            seed |= 0;
        }
    }
    const base = Math.abs(seed) % 1000;
    return [
        { name: 'Mon', value: base + seededRandom(seed + 1) * 200 },
        { name: 'Tue', value: base + seededRandom(seed + 2) * 300 + 100 },
        { name: 'Wed', value: base + seededRandom(seed + 3) * 200 + 50 },
        { name: 'Thu', value: base + seededRandom(seed + 4) * 400 + 100 },
        { name: 'Fri', value: base + seededRandom(seed + 5) * 500 + 200 },
        { name: 'Sat', value: base + seededRandom(seed + 6) * 300 + 100 },
        { name: 'Sun', value: base + seededRandom(seed + 7) * 600 + 300 },
    ];
};

export const VisualHub: React.FC<VisualHubProps> = ({ product }) => {
    const [insight, setInsight] = useState<string>("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartData, setChartData] = useState(generateData(product.id));
    const [isMobile, setIsMobile] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        let resizeTimer: ReturnType<typeof setTimeout>;
        const checkMobile = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
        };
        setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            clearTimeout(resizeTimer);
        };
    }, []);

    const disableTilt = isMobile || prefersReducedMotion;

    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useSpring(x, { stiffness: 100, damping: 30 });
    const mouseY = useSpring(y, { stiffness: 100, damping: 30 });
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [50, 40]);
    const rotateZ = useTransform(mouseX, [-0.5, 0.5], [-15, -5]);
    const shadowX = useTransform(mouseX, [-0.5, 0.5], [30, -30]);
    const shadowY = useTransform(mouseY, [-0.5, 0.5], [30, -30]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (disableTilt || !containerRef.current) return;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            const rect = containerRef.current!.getBoundingClientRect();
            x.set((e.clientX - rect.left) / rect.width - 0.5);
            y.set((e.clientY - rect.top) / rect.height - 0.5);
        });
    }, [disableTilt, x, y]);

    const handleMouseLeave = useCallback(() => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
        x.set(0);
        y.set(0);
    }, [x, y]);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    useEffect(() => {
        setChartData(generateData(product.id));
        const hash = typeof product.id === 'number' ? product.id : product.id.length;
        setInsight(INSIGHT_FALLBACKS[Math.abs(hash) % INSIGHT_FALLBACKS.length]);
    }, [product.id]);

    const getFeaturePosition = (index: number, total: number, radius: number) => {
        const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            angle,
        };
    };

    const colorHex = product.color === 'blue' ? '#1B2E5A' :
        product.color === 'green' ? '#10b981' :
            product.color === 'purple' ? '#a855f7' :
                product.color === 'orange' ? '#f97316' :
                    product.color === 'indigo' ? '#1B2E5A' : '#14b8a6';

    // Parse features to always have title + optional description
    const parsedFeatures = product.features.map(f =>
        typeof f === 'string'
            ? { title: f, description: '' }
            : { title: f.title, description: f.description ?? '' }
    );

    // Mobile: show a 2-col grid below instead of orbital bubbles
    if (isMobile) {
        return (
            <div className="w-full">
                {/* Central card — compact on mobile */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden mb-4">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${product.gradient} shadow-sm`}>
                            <DynamicIcon name={product.iconName} className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">{product.name}</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                <p className="text-[10px] text-slate-500 font-medium uppercase">Live</p>
                            </div>
                        </div>
                        <div className="ml-auto">
                            <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${product.gradient}`}>
                                {product.stats[0].value}
                            </span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase text-right">{product.stats[0].label}</p>
                        </div>
                    </div>
                    {/* Mini chart */}
                    <div className="h-20 px-2 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="chartGradientMobile" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colorHex} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke={colorHex} strokeWidth={2} fill="url(#chartGradientMobile)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Feature grid with tooltips */}
                <div className="grid grid-cols-2 gap-2">
                    {parsedFeatures.map((feature, i) => (
                        <div
                            key={i}
                            className="relative group bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-[#1B2E5A]/20 transition-all cursor-default"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${product.gradient} flex-shrink-0`} />
                                <span className="text-xs font-bold text-slate-700 truncate">{feature.title}</span>
                            </div>
                            {feature.description && (
                                <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{feature.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Desktop: full orbital hub
    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative w-full h-[500px] lg:h-[650px] flex items-center justify-center perspective-container cursor-move group z-10"
        >
            {/* Background Glow */}
            <motion.div
                animate={prefersReducedMotion ? undefined : { scale: [0.9, 1.1, 0.9], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] bg-gradient-to-tr ${product.gradient} blur-[120px] rounded-full transition-colors duration-1000 opacity-20 pointer-events-none will-change-transform`}
            />

            {/* Isometric Plane */}
            <motion.div
                style={{ ...(disableTilt ? {} : { rotateX, rotateZ }), transformStyle: 'preserve-3d' }}
                className="relative w-[500px] h-[500px] lg:w-[600px] lg:h-[600px] will-change-transform"
            >
                {/* Dynamic Shadow */}
                {!disableTilt && (
                    <motion.div
                        style={{ x: shadowX, y: shadowY }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-slate-900/10 blur-2xl rounded-[40px]"
                        style={{ transform: 'translateZ(-60px)' }}
                    />
                )}

                {/* Central Dashboard Card */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[78%] bg-white/90 border border-white/60 backdrop-blur-2xl rounded-2xl shadow-2xl flex flex-col z-20 overflow-hidden ring-1 ring-slate-200/50"
                    style={{ transform: 'translate(-50%, -50%) translateZ(20px)' }}
                >
                    {/* Scan Line */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent animate-scan z-50 pointer-events-none opacity-30" />

                    {/* Top Bar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${product.gradient} shadow-sm`}>
                                <DynamicIcon name={product.iconName} className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 tracking-wide">{product.name}</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </span>
                                    <p className="text-[10px] text-slate-500 font-medium font-mono uppercase">Live_View</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 text-slate-400">
                            <div className="h-2 w-2 rounded-full bg-slate-200" />
                            <div className="h-2 w-2 rounded-full bg-slate-200" />
                            <div className="h-2 w-2 rounded-full bg-slate-200" />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col gap-4 bg-gradient-to-b from-white to-slate-50">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[11px] text-slate-400 mb-1 font-bold tracking-widest uppercase font-mono">{product.stats[0].label}</p>
                                <span className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${product.gradient}`}>
                                    {product.stats[0].value}
                                </span>
                            </div>
                            <div className="flex gap-1 items-end h-8 opacity-60">
                                {[40, 70, 50, 80, 60].map((h, i) => (
                                    <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                                        transition={{ delay: i * 0.1, duration: 0.5 }}
                                        className={`w-1 rounded-sm bg-gradient-to-t ${product.gradient}`} />
                                ))}
                            </div>
                        </div>

                        <div className="h-28 w-full -mx-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} key={product.id}>
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={colorHex} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip cursor={{ stroke: colorHex, strokeWidth: 1 }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="value" stroke={colorHex} strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" animationDuration={1500} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={product.id + '-insight'}
                            className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-sm flex gap-3 items-center">
                            <div className="p-1.5 rounded-md bg-slate-50">
                                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">System Insight</p>
                                <p className="text-xs text-slate-700 truncate font-medium">{insight || "System metrics nominal."}</p>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Orbiting Feature Bubbles */}
                <AnimatePresence mode="popLayout">
                    {parsedFeatures.map((feature, index) => {
                        const radius = 310;
                        const pos = getFeaturePosition(index, parsedFeatures.length, radius);
                        const delay = index * 0.08;
                        const isHovered = hoveredIdx === index;

                        // Determine tooltip direction based on position angle
                        const angleRad = pos.angle;
                        const tooltipBelow = angleRad > 0 && angleRad < Math.PI;

                        return (
                            <motion.div
                                key={`${product.id}-${feature.title}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1, z: 40 }}
                                exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
                                transition={{ delay, type: "spring" }}
                                className="absolute top-1/2 left-1/2 z-30 preserve-3d"
                                style={{
                                    marginLeft: pos.x,
                                    marginTop: pos.y,
                                    transform: 'translate(-50%, -50%) translateZ(40px)',
                                }}
                            >
                                {/* Connecting dashed line to center */}
                                <div className="absolute top-1/2 left-1/2 w-0 h-0 overflow-visible pointer-events-none" style={{ transform: 'translateZ(-20px)' }}>
                                    <svg
                                        width={Math.abs(pos.x) * 2 + 20}
                                        height={Math.abs(pos.y) * 2 + 20}
                                        viewBox={`0 0 ${Math.abs(pos.x) * 2 + 20} ${Math.abs(pos.y) * 2 + 20}`}
                                        style={{ transform: 'translate(-50%, -50%)' }}
                                    >
                                        <motion.path
                                            d={`M ${Math.abs(pos.x) + 10} ${Math.abs(pos.y) + 10} L ${Math.abs(pos.x) + 10 + pos.x} ${Math.abs(pos.y) + 10 + pos.y}`}
                                            stroke={colorHex}
                                            strokeOpacity={isHovered ? "0.4" : "0.12"}
                                            strokeWidth={isHovered ? "2" : "1.5"}
                                            strokeDasharray="4 4"
                                            fill="none"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.5, delay }}
                                        />
                                    </svg>
                                </div>

                                {/* Feature Bubble + Tooltip */}
                                <div
                                    className="relative"
                                    onMouseEnter={() => setHoveredIdx(index)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                >
                                    {/* Tooltip */}
                                    <AnimatePresence>
                                        {isHovered && feature.description && (
                                            <motion.div
                                                initial={{ opacity: 0, y: tooltipBelow ? -4 : 4, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: tooltipBelow ? -4 : 4, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                                className={`absolute z-50 w-48 bg-[#1B2E5A] text-white text-[11px] rounded-xl px-3 py-2.5 shadow-xl pointer-events-none
                                                    ${tooltipBelow
                                                        ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
                                                        : 'top-full mt-2 left-1/2 -translate-x-1/2'
                                                    }`}
                                            >
                                                <p className="font-bold mb-0.5 text-white/90">{feature.title}</p>
                                                <p className="text-white/70 leading-relaxed">{feature.description}</p>
                                                {/* Arrow */}
                                                <div className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#1B2E5A] rotate-45
                                                    ${tooltipBelow ? 'top-full -mt-1.5' : 'bottom-full -mb-1.5'}`} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Bubble */}
                                    <motion.div
                                        animate={{ scale: isHovered ? 1.12 : 1 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default
                                            bg-white border shadow-md backdrop-blur-sm transition-colors duration-200
                                            ${isHovered
                                                ? 'border-[#1B2E5A]/30 shadow-lg shadow-[#1B2E5A]/10'
                                                : 'border-white/50 shadow-slate-200/60'
                                            }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${product.gradient} flex-shrink-0`} />
                                        <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                                            {feature.title}
                                        </span>
                                    </motion.div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Decorative Rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] border border-slate-200/40 rounded-full opacity-50" style={{ transform: 'translateZ(-50px)' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-slate-100/30 rounded-full border border-slate-200/50" style={{ transform: 'translateZ(-80px)' }} />
            </motion.div>
        </div>
    );
};

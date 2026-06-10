import React from 'react';
import { ThemeType } from '@/types/application';

interface DecorationProps {
    type: ThemeType;
    className?: string;
}

export const ApplicationCardDecoration: React.FC<DecorationProps> = ({ type, className = "" }) => {
    const renderDecoration = () => {
        switch (type) {
            case 'yellow':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <circle cx="210" cy="190" r="110" fill="url(#gradYellow)" />
                        <path d="M40 200L100 140M60 220L120 160M80 240L140 180" stroke="var(--chart-3)" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case 'red':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <radialGradient id="gradRed" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="var(--destructive)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--destructive)" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <circle cx="220" cy="170" r="120" fill="url(#gradRed)" />
                        <path d="M20 200 C60 140 180 140 240 200" stroke="var(--destructive)" strokeOpacity="0.4" strokeWidth="2.5" />
                    </svg>
                );
            case 'blue':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradBlue" x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="var(--illustration-info)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--illustration-info)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <rect x="140" y="40" width="110" height="170" rx="55" fill="url(#gradBlue)" />
                        <circle cx="100" cy="140" r="60" stroke="var(--illustration-info)" strokeOpacity="0.4" strokeWidth="2" />
                    </svg>
                );
            case 'orange':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--illustration-warning)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--illustration-warning)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <circle cx="170" cy="130" r="110" fill="url(#gradOrange)" />
                        <path d="M20 180 Q140 20 260 180" stroke="var(--illustration-warning)" strokeOpacity="0.4" strokeWidth="1.5" />
                    </svg>
                );
            case 'emerald':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--illustration-success)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--illustration-success)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <rect x="110" y="90" width="150" height="150" rx="40" stroke="var(--illustration-success)" strokeOpacity="0.3" strokeWidth="1.5" transform="rotate(15 170 150)" />
                        <circle cx="170" cy="150" r="100" fill="url(#gradEmerald)" />
                    </svg>
                );
            case 'purple':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradPurple" x1="50%" y1="0%" x2="50%" y2="100%">
                                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d="M50 50 L230 50 L140 200 Z" fill="url(#gradPurple)" stroke="var(--chart-4)" strokeOpacity="0.4" strokeWidth="2" />
                    </svg>
                );
            case 'indigo':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradIndigo" x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <circle cx="200" cy="120" r="110" fill="url(#gradIndigo)" stroke="var(--chart-2)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="10 5" />
                    </svg>
                );
            case 'cyan':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <rect x="80" y="80" width="120" height="120" rx="20" stroke="var(--chart-3)" strokeOpacity="0.3" strokeWidth="2" transform="rotate(45 140 140)" />
                        <circle cx="140" cy="140" r="110" fill="url(#gradCyan)" />
                    </svg>
                );
            case 'rose':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <radialGradient id="gradRose" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="var(--destructive)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--destructive)" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <circle cx="140" cy="120" r="110" fill="url(#gradRose)" />
                        <path d="M140 80 L140 160 M100 120 L180 120" stroke="var(--destructive)" strokeOpacity="0.4" strokeWidth="2" />
                    </svg>
                );
            case 'violet':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradViolet" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <rect x="40" y="40" width="200" height="160" rx="30" fill="url(#gradViolet)" stroke="var(--chart-4)" strokeOpacity="0.2" strokeWidth="1.5" />
                    </svg>
                );
            case 'amber':
                return (
                    <svg width="320" height="280" viewBox="0 0 280 240" fill="none" className={className}>
                        <defs>
                            <linearGradient id="gradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--illustration-warning)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="var(--illustration-warning)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polygon points="140,40 220,100 220,180 140,240 60,180 60,100" fill="url(#gradAmber)" stroke="var(--illustration-warning)" strokeOpacity="0.4" strokeWidth="2" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div className={`absolute bottom-0 right-0 overflow-hidden pointer-events-none select-none transition-all duration-700 ${className}`}>
            {renderDecoration()}
        </div>
    );
};

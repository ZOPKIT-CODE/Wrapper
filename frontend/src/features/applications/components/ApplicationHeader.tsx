import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface ApplicationHeaderProps {
    applicationCount: number;
    isLoading: boolean;
    onRefresh: () => void;
}

export function ApplicationHeader({ applicationCount, isLoading, onRefresh }: ApplicationHeaderProps) {
    const [spinning, setSpinning] = useState(false);

    const handleRefresh = () => {
        setSpinning(true);
        onRefresh();
        setTimeout(() => setSpinning(false), 1200);
    };

    return (
        <section style={{
            paddingBottom: 28,
            marginBottom: 28,
            borderBottom: '1px solid var(--zk-line)',
            animation: 'zk-fadeUp 600ms cubic-bezier(.2,.8,.2,1) both',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 11,
                        fontFamily: 'var(--zk-mono)',
                        color: 'var(--zk-muted-2)',
                        letterSpacing: '0.12em',
                        marginBottom: 12,
                        textTransform: 'uppercase',
                    }}>
                        Applications
                    </div>
                    <h1 style={{
                        margin: 0,
                        fontSize: 'clamp(36px, 4vw, 48px)',
                        fontWeight: 500,
                        letterSpacing: '-0.035em',
                        lineHeight: 1.0,
                        fontFamily: 'var(--zk-display)',
                        color: 'var(--zk-ink)',
                    }}>
                        Welcome to Zopkit
                    </h1>
                    <p style={{
                        margin: '14px 0 0',
                        maxWidth: 520,
                        fontSize: 15,
                        lineHeight: 1.55,
                        color: 'var(--zk-muted)',
                        letterSpacing: '-0.005em',
                    }}>
                        {applicationCount > 0
                            ? `A unified suite of ${applicationCount} business applications — all in one workspace. Pick an app to get started.`
                            : 'A unified suite of business applications — all in one workspace.'}
                    </p>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={isLoading || spinning}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        background: 'var(--zk-paper)',
                        border: '1px solid var(--zk-line)',
                        borderRadius: 999,
                        color: 'var(--zk-ink-2)',
                        fontSize: 12.5,
                        fontWeight: 500,
                        fontFamily: 'var(--zk-mono)',
                        letterSpacing: '0.04em',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 180ms ease',
                        opacity: isLoading ? 0.6 : 1,
                    }}
                >
                    <RefreshCw
                        size={12}
                        style={{ animation: (isLoading || spinning) ? 'zk-spin 800ms linear infinite' : 'none' }}
                    />
                    REFRESH
                </button>
            </div>
        </section>
    );
}

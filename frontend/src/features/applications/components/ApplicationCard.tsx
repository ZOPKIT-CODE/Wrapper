import { memo, useState } from 'react';
import { Application } from '@/types/application';
import { config } from '@/lib/config';
import { Settings, ChevronRight, Users2, Banknote, Users, Share2 } from 'lucide-react';

export function AppIcon({ index, size = 44 }: { index: number; size?: number }) {
  const stroke = 'var(--zk-navy)';
  const icons = [
    /* CRM */
    <Users
      key="crm"
      size={size}
      color={stroke}
      strokeWidth={2.2}
    />,
    /* HR */
    <Users2 key="hr" size={size} color={stroke} strokeWidth={2.2} />,
    /* PM */
    <svg key="pm" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="10" width="32" height="28" rx="3" />
      <path d="M8 18h32" />
      <path d="M14 26h12" stroke={stroke} />
      <path d="M14 32h20" stroke={stroke} />
      <circle cx="36" cy="26" r="2" fill={stroke} stroke="none" />
    </svg>,
    /* Affiliate */
    <Share2
      key="affiliate"
      size={size}
      color={stroke}
      strokeWidth={2.2}
    />,
    /* Ops */
    <Settings key="ops" size={size} color={stroke} strokeWidth={2.2} />,
    /* Finance */
    <Banknote
      key="finance"
      size={size}
      color={stroke}
      strokeWidth={2.2}
    />,
    /* Analytics */
    <svg key="analytics" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="22" width="6" height="18" rx="1" />
      <rect x="20" y="14" width="6" height="26" rx="1" fill={stroke} stroke="none" />
      <rect x="32" y="6" width="6" height="34" rx="1" />
      <path d="M11 22 L23 14 L35 6" stroke={stroke} strokeWidth="1.8" />
    </svg>,
    /* Settings/Config */
    <svg key="settings" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="6" />
      <path d="M24 4v4M24 40v4M4 24h4M40 24h4M8.7 8.7l2.8 2.8M36.5 36.5l2.8 2.8M36.5 11.5l-2.8 2.8M11.5 36.5l-2.8 2.8" />
    </svg>,
    /* Database */
    <svg key="db" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="24" cy="12" rx="14" ry="5" />
      <path d="M38 12v12c0 2.8-6.3 5-14 5s-14-2.2-14-5V12" />
      <path d="M38 24v12c0 2.8-6.3 5-14 5s-14-2.2-14-5V24" />
    </svg>,
    /* Shield */
    <svg key="shield" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 4l16 6v12c0 10-8 16-16 20C16 38 8 32 8 22V10z" />
      <path d="M17 24l5 5 9-10" stroke={stroke} strokeWidth="2.8" />
    </svg>,
  ];
  return icons[index % icons.length];
}

const getApplicationUrl = (application: Application): string => {
  const apiBaseUrl =
    application.baseUrl ||
    (application as any).base_url ||
    (application as any).baseurl;

  if (apiBaseUrl) return apiBaseUrl;

  const baseDomain = window.location.origin;
  const urlPatterns: Record<string, string> = {
    affiliateConnect: `${baseDomain}/affiliate`,
    crm: config.CRM_DOMAIN,
    hr: `${baseDomain}/hr`,
  };

  return urlPatterns[application.appCode] || `${baseDomain}/apps/${application.appCode}`;
};

interface ApplicationCardProps {
  application: Application;
  onView: (app: Application) => void;
  index: number;
}

export const ApplicationCard = memo(function ApplicationCard({ application, onView, index }: ApplicationCardProps) {
  const [hover, setHover] = useState(false);
  const [launching, setLaunching] = useState(false);

  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLaunching(true);
    const url = getApplicationUrl(application);
    setTimeout(() => {
      setLaunching(false);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }, 600);
  };

  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(application);
  };

  const isOperational = application.isEnabled !== false;

  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: hover ? 'var(--zk-paper-2)' : 'var(--zk-paper)',
        borderRadius: 14,
        border: `1px solid ${hover ? 'rgba(15,32,80,0.18)' : 'var(--zk-line)'}`,
        padding: '24px 24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 200,
        transition: 'all 240ms cubic-bezier(.2,.8,.2,1)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hover ? '0 14px 40px -18px rgba(15,32,80,0.18)' : 'none',
        cursor: 'pointer',
        animation: `zk-fadeUp 500ms cubic-bezier(.2,.8,.2,1) ${index * 40}ms both`,
        fontFamily: 'var(--zk-font)',
      }}
    >
      {/* Settings button top-right */}
      <button
        onClick={handleOpenSettings}
        title="Application settings"
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          opacity: hover ? 1 : 0,
          width: 28,
          height: 28,
          borderRadius: 7,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(15,32,80,0.06)',
          color: 'var(--zk-muted)',
          border: 'none',
          cursor: 'pointer',
          transition: 'opacity 160ms ease',
        }}
      >
        <Settings size={13} />
      </button>

      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AppIcon index={index} size={44} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--zk-mono)',
            color: 'var(--zk-muted-2)',
            letterSpacing: '0.04em',
            marginBottom: 1,
          }}>
            zopkit
          </div>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: 'var(--zk-ink)',
            fontFamily: 'var(--zk-display)',
            lineHeight: 1.1,
          }}>
            {application.appName}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: 13,
        color: 'var(--zk-muted)',
        letterSpacing: '-0.005em',
        lineHeight: 1.55,
        flex: 1,
      }}>
        {application.description || 'Access and manage this application from your workspace.'}
      </p>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
      }}>
        <button
          onClick={handleLaunch}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--zk-navy)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: 'var(--zk-mono)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {launching ? (
            <>
              OPENING
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '1.5px solid var(--zk-navy)',
                borderTopColor: 'transparent',
                animation: 'zk-spin 700ms linear infinite',
                display: 'inline-block',
              }} />
            </>
          ) : (
            <>
              TRY NOW
              <ChevronRight
                size={12}
                strokeWidth={2.4}
                style={{
                  transform: hover ? 'translateX(3px)' : 'translateX(0)',
                  transition: 'transform 200ms ease',
                }}
              />
            </>
          )}
        </button>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10.5,
          fontFamily: 'var(--zk-mono)',
          color: isOperational ? 'var(--illustration-success)' : 'var(--illustration-warning)',
          letterSpacing: '0.06em',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'currentColor',
            animation: 'zk-pulseDot 2s ease-in-out infinite',
          }} />
          {isOperational ? 'OPERATIONAL' : 'ATTENTION'}
        </span>
      </div>
    </article>
  );
});

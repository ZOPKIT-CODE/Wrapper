import { memo } from 'react';
import { Application } from '@/types/application';
import { ApplicationCard } from './ApplicationCard';

interface ApplicationGridProps {
  applications: Application[];
  onViewApplication: (app: Application) => void;
}

export const ApplicationGrid = memo(function ApplicationGrid({ applications, onViewApplication }: ApplicationGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
      gap: 18,
    }}>
      {applications.length > 0 ? (
        applications.map((app, index) => (
          <ApplicationCard
            key={app.appId}
            application={app}
            onView={onViewApplication}
            index={index}
          />
        ))
      ) : (
        <div style={{
          gridColumn: '1 / -1',
          padding: '60px 0',
          textAlign: 'center',
          color: 'var(--zk-muted)',
          fontSize: 14,
          fontFamily: 'var(--zk-font)',
        }}>
          No applications available. Contact your administrator to provision access.
        </div>
      )}
    </div>
  );
});
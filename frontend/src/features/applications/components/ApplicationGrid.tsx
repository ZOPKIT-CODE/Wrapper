import { memo } from 'react';
import { Application } from '@/types/application';
import { ApplicationCard } from './ApplicationCard';

interface ApplicationGridProps {
  applications: Application[];
  onViewApplication: (app: Application) => void;
}

export const ApplicationGrid = memo(function ApplicationGrid({ applications, onViewApplication }: ApplicationGridProps) {
  return (
    <div className="space-y-12">
      {/* Main Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {applications.length > 0 ? (
          applications.map((app, index) => (
            <div key={app.appId}>
              <ApplicationCard
                application={app}
                onView={onViewApplication}
                index={index}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full py-40 text-center space-y-8">
            <div className="space-y-2 text-slate-500">
              <h3 className="text-2xl font-black uppercase tracking-tighter">No Applications Available</h3>
              <p className="font-medium max-w-md mx-auto">
                Contact system administration to provision access.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
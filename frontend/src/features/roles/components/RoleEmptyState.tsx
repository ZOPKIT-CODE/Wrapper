import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleEmptyStateProps {
  hasFilters: boolean;
  onCreateRole: () => void;
}

export function RoleEmptyState({ hasFilters, onCreateRole }: RoleEmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <div className="w-14 h-14 rounded-md border border-border bg-secondary flex items-center justify-center mx-auto">
        <Shield className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mt-4">No roles found</h3>
      <p className="text-muted-foreground mt-2 text-sm max-w-sm mx-auto">
        {hasFilters
          ? 'Try adjusting your search filters or create a new role.'
          : 'Create your first role to define permissions for your team.'}
      </p>
      <Button onClick={onCreateRole} className="mt-6">
        <Plus className="w-4 h-4 mr-2" />
        Create role
      </Button>
    </div>
  );
}

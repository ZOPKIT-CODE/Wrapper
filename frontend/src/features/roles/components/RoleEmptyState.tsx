import React from 'react';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleEmptyStateProps {
  hasFilters: boolean;
  onCreateRole: () => void;
}

export function RoleEmptyState({ hasFilters, onCreateRole }: RoleEmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <Shield className="w-12 h-12 mx-auto text-gray-400" />
      <h3 className="text-lg font-semibold text-[#1B2E5A] mt-4">No roles found</h3>
      <p className="text-gray-600 mt-2">
        {hasFilters 
          ? 'Try adjusting your search filters or create a new role.' 
          : 'Get started by creating your first role.'
        }
      </p>
      <Button onClick={onCreateRole} className="mt-4">
        <Plus className="w-4 h-4 mr-2" />
        Create Role
      </Button>
    </div>
  );
}

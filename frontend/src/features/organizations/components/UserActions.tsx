import { Button } from '@/components/ui/button';
import { Edit, ExternalLink, Crown, Trash2 } from 'lucide-react';
import { Employee } from '@/types/organization';
import toast from 'react-hot-toast';

interface UserActionsProps {
  employee: Employee;
  isAdmin: boolean;
  onPromoteUser: (userId: string, userName: string) => void;
  onDeactivateUser: (userId: string, userName: string) => void;
  onResendInvite: (userId: string, userEmail: string) => void;
}

export function UserActions({ 
  employee, 
  isAdmin, 
  onPromoteUser, 
  onDeactivateUser, 
  onResendInvite 
}: UserActionsProps) {
  return (
    <div className="flex items-center space-x-1">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => toast.success('User profile editing coming soon!')}
        title="Edit user"
      >
        <Edit className="h-4 w-4" />
      </Button>
      
      {!employee.onboardingCompleted && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onResendInvite(employee.userId, employee.email)}
          title="Resend invitation"
        >
          <ExternalLink className="h-4 w-4 text-[#1B2E5A]" />
        </Button>
      )}
      
      {isAdmin && !employee.isTenantAdmin && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onPromoteUser(employee.userId, employee.name || employee.email)}
          title="Promote to admin"
        >
          <Crown className="h-4 w-4 text-purple-600" />
        </Button>
      )}
      
      {isAdmin && employee.isActive && !employee.isTenantAdmin && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onDeactivateUser(employee.userId, employee.name || employee.email)}
          title="Deactivate user"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      )}
    </div>
  );
}

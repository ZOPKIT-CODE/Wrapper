import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function RoleLoadingState() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-600 mt-3 font-medium">Loading roles...</p>
      </CardContent>
    </Card>
  );
}

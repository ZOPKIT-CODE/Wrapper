import { Users, Database, CheckCircle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface UserApplicationSummaryCardsProps {
  totalUsers: number;
  totalApplications: number;
  configuredApps: number;
  totalAccessGrants: number;
}

export function UserApplicationSummaryCards({
  totalUsers,
  totalApplications,
  configuredApps,
  totalAccessGrants,
}: UserApplicationSummaryCardsProps) {
  const cards = [
    {
      title: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'text-[#1B2E5A]',
    },
    {
      title: 'Applications',
      value: totalApplications,
      icon: Database,
      color: 'text-green-600',
    },
    {
      title: 'Configured Apps',
      value: configuredApps,
      icon: CheckCircle,
      color: 'text-purple-600',
    },
    {
      title: 'Total Access Grants',
      value: totalAccessGrants,
      icon: Activity,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Icon className={`h-8 w-8 ${card.color}`} />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm text-gray-600">{card.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

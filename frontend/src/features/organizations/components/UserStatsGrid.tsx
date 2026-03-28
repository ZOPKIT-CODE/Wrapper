import { useMemo } from 'react';
import { Users, Crown, Activity, Clock, LucideIcon } from 'lucide-react';
import { Employee } from '@/types/organization';
import { Grid } from '@/components/common/Page';
import { InfoCard } from '@/components/cards';

interface UserStat {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
}

interface UserStatsGridProps {
  employees: Employee[];
}

export function UserStatsGrid({ employees }: UserStatsGridProps) {
  const userStats = useMemo((): UserStat[] => {
    return [
      {
        title: "Total Users",
        value: employees.length,
        icon: Users,
        iconColor: "text-[#1B2E5A]"
      },
      {
        title: "Active Users",
        value: employees.filter(e => e.isActive).length,
        icon: Activity,
        iconColor: "text-green-600"
      },
      {
        title: "Admins",
        value: employees.filter(e => e.isTenantAdmin).length,
        icon: Crown,
        iconColor: "text-purple-600"
      },
      {
        title: "Pending Setup",
        value: employees.filter(e => !e.onboardingCompleted).length,
        icon: Clock,
        iconColor: "text-orange-600"
      }
    ];
  }, [employees]);

  return (
    <Grid columns={{ xs: 1, md: 2, lg: 4 }} autoFit="auto-fit">
      {userStats.map((stat) => (
        <GridItem key={stat.title}>
          <InfoCard 
            title={stat.title} 
            description={stat.value.toString()} 
            icon={stat.icon} 
            iconColor={stat.iconColor} 
          />
        </GridItem>
      ))}
    </Grid>
  );
}

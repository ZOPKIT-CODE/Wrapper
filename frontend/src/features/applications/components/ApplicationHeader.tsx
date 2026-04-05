import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PearlButton } from "@/components/ui/pearl-button";
import { RefreshCw } from "lucide-react";

interface ApplicationHeaderProps {
    applicationCount: number;
    isLoading: boolean;
    onRefresh: () => void;
}

export function ApplicationHeader({ applicationCount: _count, isLoading, onRefresh }: ApplicationHeaderProps) {
    return (
        <div>
            <DashboardPageHeader
                title="Applications"
                description="Manage and access your organization's applications"
                actions={(
                    <PearlButton onClick={onRefresh} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </PearlButton>
                )}
            />
        </div>
    );
}

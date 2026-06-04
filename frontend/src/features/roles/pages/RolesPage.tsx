import { Container } from "@/components/common/Page";
import { RoleManagementDashboard } from "@/features/roles";
import { useAuth } from "@/lib/auth/cognito-auth";
import { AccessDenied } from "@/components/common/feedback/AccessDenied";

export function RolesPage({
    isAdmin = false
}: {
    isAdmin?: boolean
}) {
    const { user } = useAuth();
    return (
        <Container>
            {isAdmin || user?.email ? (
                <RoleManagementDashboard />
            ) : (
                <AccessDenied description="You need admin permissions to view role management." />
            )}
        </Container>
    )
}
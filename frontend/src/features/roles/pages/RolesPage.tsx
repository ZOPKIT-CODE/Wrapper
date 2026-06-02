import { Container } from "@/components/common/Page";
import { RoleManagementDashboard } from "@/features/roles";
import { useKindeAuth } from "@/lib/auth/cognito-auth";
import { AccessDenied } from "@/components/common/feedback/AccessDenied";

export function RolesPage({
    isAdmin = false
}: {
    isAdmin?: boolean
}) {
    const { user } = useKindeAuth();
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
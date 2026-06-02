import { cn } from '@/lib/utils'
import { useKindeAuth } from '@/lib/auth/cognito-auth'

export default function GreetingCard({ className }: { className?: string }) {
    const { user } = useKindeAuth()
    if (!user) {
        return null
    }
    return (
        <div className={cn("flex flex-col", className)}>
            <h1 className="text-3xl font-bold text-[#1B2E5A] leading-tight">
                Welcome back{user?.givenName ? `, ${user.givenName}` : ''}! 👋
            </h1>
            <p className="mt-2 text-gray-600 leading-tight">
                Here's what's happening with your account today
            </p>
        </div>
    )
}

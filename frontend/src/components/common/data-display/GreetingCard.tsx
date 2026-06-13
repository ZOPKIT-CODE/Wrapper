import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/cognito-auth'

export default function GreetingCard({ className }: { className?: string }) {
  const { user } = useAuth()
  if (!user) {
    return null
  }
  return (
    <div className={cn('flex flex-col', className)}>
      <h1 className="text-primary text-3xl leading-tight font-bold">
        Welcome back{user?.givenName ? `, ${user.givenName}` : ''}! 👋
      </h1>
      <p className="mt-2 leading-tight text-gray-600">
        Here's what's happening with your account today
      </p>
    </div>
  )
}

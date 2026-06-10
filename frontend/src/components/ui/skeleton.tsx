import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-gradient-to-r from-blue-50/50 via-blue-100 to-blue-50/50 bg-[length:200%_100%] animate-gradient",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

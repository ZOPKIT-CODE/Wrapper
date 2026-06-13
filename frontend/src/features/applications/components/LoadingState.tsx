import { Grid } from '@/components/common/Page'
import { SkeletonCard } from '@/components/common/feedback/LoadingStates'

export function LoadingState() {
  return (
    <div className="min-h-[200px]">
      <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={6}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} showHeader={false} lines={4} />
        ))}
      </Grid>
    </div>
  )
}

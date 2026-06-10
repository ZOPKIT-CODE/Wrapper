import { Grid } from "@/components/common/Page";
import { Skeleton } from "@/components/ui";

export function LoadingState() {
  return (
    <div className="min-h-[200px]">
      <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={6}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-white border border-slate-200">
            <Skeleton className="w-12 h-12 mb-4" />
            <Skeleton className="h-4 mb-2" />
            <Skeleton className="h-3 mb-4" />
            <Skeleton className="h-8" />
          </div>
        ))}
      </Grid>
    </div>
  );
}

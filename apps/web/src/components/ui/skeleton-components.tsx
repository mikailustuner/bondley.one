import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * A generic loading skeleton for metric/KPI cards.
 * Useful for the dashboard overview section.
 */
export function SkeletonCard() {
    return (
        <Card className="glass-panel overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-center justify-between">
                    <Skeleton className="h-8 w-2/3" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </CardContent>
        </Card>
    );
}

interface SkeletonTableProps {
    columns?: number;
    rows?: number;
}

/**
 * A generic loading skeleton for data tables.
 * Displays a simulated header and multiple simulated rows.
 */
export function SkeletonTable({ columns = 5, rows = 6 }: SkeletonTableProps) {
    return (
        <div className="w-full">
            <div className="flex items-center justify-between py-4">
                {/* Toolbar skeletons (search, filters, etc) */}
                <Skeleton className="h-10 w-[250px]" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-[100px]" />
                    <Skeleton className="h-10 w-[100px]" />
                </div>
            </div>
            <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="border-b bg-muted/50 p-4">
                    <div className="flex w-full items-center justify-between gap-4">
                        {Array.from({ length: columns }).map((_, i) => (
                            <Skeleton key={i} className={`h-4 ${i === 0 ? "w-1/4" : "w-1/6"}`} />
                        ))}
                    </div>
                </div>
                {/* Table Rows */}
                <div className="flex flex-col divide-y">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <div key={rowIndex} className="flex p-4 w-full items-center justify-between gap-4 hover:bg-muted/30">
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <Skeleton
                                    key={colIndex}
                                    className={`h-5 ${colIndex === 0 ? "w-1/3" : "w-1/5"}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

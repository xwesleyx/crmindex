import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export type ActivityWithUser = {
  id: string;
  action: string;
  metadata: string | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

export function EntityTimeline({
  activities,
  describe,
}: {
  activities: ActivityWithUser[];
  describe: (activity: ActivityWithUser) => string;
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem histórico ainda"
        description="As alterações deste registro aparecerão aqui."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {activities.map((activity, index) => (
        <li key={activity.id} className="relative flex gap-3 pb-4 text-sm last:pb-0">
          {index < activities.length - 1 && (
            <div className="absolute top-3 left-[3px] h-full w-px bg-border" />
          )}
          <div className="relative z-10 mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="flex flex-col">
            <span>
              <span className="font-medium">{activity.user?.name ?? "Sistema"}</span>{" "}
              <span className="text-muted-foreground">{describe(activity)}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(activity.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

import type { Priority } from "@prisma/client";

import { StatusBadge } from "@/components/status-badge";
import { PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/priority";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <StatusBadge label={PRIORITY_LABELS[priority]} tone={PRIORITY_TONE[priority]} className={className} />
  );
}

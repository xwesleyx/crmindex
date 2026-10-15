import type { ReactNode } from "react";

import { menuTitleMetadata } from "@/lib/page-title";

export const metadata = menuTitleMetadata("Agenda");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from "react";

import { menuTitleMetadata } from "@/lib/page-title";

// Vendas fica no menu CRM.
export const metadata = menuTitleMetadata("CRM");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

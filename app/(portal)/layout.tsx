import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";

/**
 * Everything behind sign-in shares one shell: header, navigation, the
 * persistent copilot launcher, the toast host and the footer disclaimer.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

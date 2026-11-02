"use client";

import { usePathname } from "next/navigation";

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOperateSurface =
    pathname === "/admin" ||
    pathname.startsWith("/giao-vien") ||
    pathname.startsWith("/hoc-vien") ||
    pathname.startsWith("/luyen-de/");

  return (
    <div className={isOperateSurface ? "" : "route-motion"}>{children}</div>
  );
}

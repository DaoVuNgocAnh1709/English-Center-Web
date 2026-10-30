"use client";

import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Footer } from "./footer";
import { RouteMotion } from "./route-motion";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStaff =
    pathname === "/admin" || pathname.startsWith("/giao-vien/dashboard");
  const hideSiteChrome = isStaff || pathname === "/dang-nhap";
  return (
    <>
      {!hideSiteChrome && <Header />}
      <main><RouteMotion key={pathname}>{children}</RouteMotion></main>
      {!hideSiteChrome && <Footer />}
    </>
  );
}

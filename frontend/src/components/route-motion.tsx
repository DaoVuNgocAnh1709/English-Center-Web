"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const revealSelector = "[data-motion], section > .container-shell";

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motionRoot: HTMLDivElement = root;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observed = new Set<Element>();
    const intersection = reduceMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              intersection?.unobserve(entry.target);
            });
          },
          { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
        );

    function register() {
      const candidates = Array.from(motionRoot.querySelectorAll(revealSelector));
      let delayIndex = 0;
      candidates.forEach((element) => {
        if (observed.has(element) || element.closest("[role='dialog']")) return;
        if (element.parentElement?.closest(".site-reveal")) return;
        observed.add(element);
        element.classList.add("site-reveal");
        (element as HTMLElement).style.setProperty(
          "--reveal-delay",
          `${Math.min(delayIndex % 4, 3) * 70}ms`,
        );
        delayIndex += 1;
        if (reduceMotion) element.classList.add("is-visible");
        else intersection?.observe(element);
      });
    }

    register();
    const mutations = new MutationObserver(register);
    mutations.observe(motionRoot, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      intersection?.disconnect();
    };
  }, [pathname]);

  return <div ref={rootRef} className="route-motion">{children}</div>;
}

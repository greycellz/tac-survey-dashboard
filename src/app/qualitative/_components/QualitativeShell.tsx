"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/qualitative", label: "Participants", prefixMatch: "/qualitative/INT" },
  { href: "/qualitative/codebook", label: "Codebook", prefixMatch: "/qualitative/codebook" },
] as const;

function navActive(pathname: string | null, href: string, prefixMatch: string): boolean {
  if (!pathname) return false;
  if (href === "/qualitative") {
    return pathname === "/qualitative" || pathname.startsWith(prefixMatch);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function QualitativeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Qualitative Workspace</h1>
          <p className="text-xs text-neutral-500">16 wildfire-survivor interviews · citation-anchored</p>
        </div>
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const active = navActive(pathname, n.href, n.prefixMatch);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={
                  "px-3 py-1.5 rounded-md text-sm " +
                  (active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}

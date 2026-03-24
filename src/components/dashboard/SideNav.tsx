"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Flame,
  AlertTriangle,
  Heart,
  Package,
  Bot,
  MessageSquare,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  { label: "Demographics", href: "/dashboard/demographics", icon: Users },
  { label: "Fire Impact", href: "/dashboard/fire-impact", icon: Flame },
  { label: "Recovery Challenges", href: "/dashboard/recovery-challenges", icon: AlertTriangle },
  { label: "Wellbeing & Support", href: "/dashboard/wellbeing", icon: Heart },
  { label: "Resource Access", href: "/dashboard/resource-access", icon: Package },
  { label: "AI Attitudes", href: "/dashboard/ai-attitudes", icon: Bot },
  { label: "Open Responses", href: "/dashboard/open-responses", icon: MessageSquare },
  { label: "Tables & Export", href: "/dashboard/tables", icon: Table2 },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed left-0 bottom-0 bg-nav-bg border-r border-border overflow-y-auto z-20"
      style={{
        top: "calc(var(--header-height) + var(--filterbar-height))",
        width: "var(--nav-width)",
      }}
    >
      <div className="py-3 px-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Analysis
        </p>

        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-accent-light text-accent font-medium"
                  : "text-text-secondary hover:bg-accent-light hover:text-accent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-accent" : "text-text-muted"
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

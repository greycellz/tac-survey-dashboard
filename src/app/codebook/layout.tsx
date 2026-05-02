import { FeatureProvider } from "@/contexts/FeatureContext";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function CodebookLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureProvider>
      <DashboardShell>{children}</DashboardShell>
    </FeatureProvider>
  );
}

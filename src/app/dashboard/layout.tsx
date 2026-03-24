import { SurveyDataProvider } from "@/contexts/SurveyDataContext";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SurveyDataProvider>
      <DashboardShell>{children}</DashboardShell>
    </SurveyDataProvider>
  );
}

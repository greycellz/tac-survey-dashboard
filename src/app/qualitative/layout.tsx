import type { ReactNode } from "react";
import { loadQualitativeData } from "@/lib/qualitative/load-data";
import { QualitativeDataProvider } from "@/contexts/QualitativeDataContext";
import { QualitativeShell } from "./_components/QualitativeShell";

export default function QualitativeLayout({ children }: { children: ReactNode }) {
  const bundle = loadQualitativeData();
  return (
    <QualitativeDataProvider bundle={bundle}>
      <QualitativeShell>{children}</QualitativeShell>
    </QualitativeDataProvider>
  );
}

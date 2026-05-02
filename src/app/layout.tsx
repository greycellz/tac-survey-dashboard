import type { Metadata } from "next";
import "./globals.css";
import AppSurveyProvider from "@/components/providers/AppSurveyProvider";

export const metadata: Metadata = {
  title: "Wildfire Survivor Survey Dashboard — The After Collective",
  description: "Research console for analyzing wildfire survivor survey data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppSurveyProvider>{children}</AppSurveyProvider>
      </body>
    </html>
  );
}

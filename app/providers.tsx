"use client";

import { ThemeProvider } from "@/components/theme-provider";

// for light dark mode : wrap who thing inside themeprovider
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  );
}

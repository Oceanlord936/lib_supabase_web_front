import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

// control the over all layout

export const metadata: Metadata = {
  title: "Good Library - Find Your Next Great Read",
  description: "A student library finder app to discover and explore libraries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

"use client";

import { SiteHeader } from "@/components/site-header";
import { StickyFooter } from "@/components/sticky-footer";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { usePathname } from "next/navigation";
import type React from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const pathWithoutFooter = ["/admin", "/login", "/prelaunch", "/landing"];
  const shouldHideFooter = pathWithoutFooter.some((path) =>
    pathname?.startsWith(path)
  );
  const isAdminRoute = pathname?.startsWith("/admin");
  // const isPrelaunchRoute = pathname === "/prelaunch";

  return (
    <html lang="en" className="dark">
      <head>
        <title>Fork AI</title>
        <meta name="description" content="Fork AI" />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="dark" suppressHydrationWarning>
        {!isAdminRoute && <SiteHeader />}
        {children}
        {!shouldHideFooter && <StickyFooter />}
      </body>
    </html>
  );
}

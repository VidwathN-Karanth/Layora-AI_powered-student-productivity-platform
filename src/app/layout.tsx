import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { SyncProvider } from "@/components/SyncProvider";
import CookieConsent from "@/components/CookieConsent";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Layora — Student Productivity Platform",
  description: "A student productivity workspace for the MITE CSE department: planner, tasks, resources, courses and leaderboard.",
  // The manifest is what lets a phone install Layora to the Home Screen, which
  // on iOS is the only way the Notification API exists at all.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Layora",
    statusBarStyle: "black-translucent",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  }
};

export const viewport: Viewport = {
  themeColor: "#16181C",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available; capping it at 5 keeps a mis-tap from leaving
  // the student stranded at 10x on a phone.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#007AFF', // Apple Blue
          colorBackground: '#121214', // Neutral dark
          colorInputBackground: 'rgba(255, 255, 255, 0.05)',
          colorInputText: '#e2e2e2',
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <SyncProvider>
            {children}
            <CookieConsent />
            <SpeedInsights />
          </SyncProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}


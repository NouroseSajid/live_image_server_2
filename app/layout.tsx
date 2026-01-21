import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { ThemeProvider } from "./components/ThemeProvider";
import Uploader from "./components/Uploader";
import UploadToast from "./components/UploadsToast";
import { AuthProvider } from "./providers/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nourose Repository - Secure Image & Video Sharing Platform",
  description:
    "Share your photos and videos securely with friends and family. Upload, organize, and share your media with ease.",
  keywords: "image sharing, photo gallery, video sharing, secure upload",
  openGraph: {
    title: "Nourose Repository - Secure Image & Video Sharing",
    description: "Share your photos and videos securely",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    noimageindex: true,
    // Block AI bots and crawlers
    "googlebot-news": "noindex",
    "bingbot": "noindex",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <AuthProvider>
            {/* Skip to main content for accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[2000] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
            >
              Skip to main content
            </a>
            <Uploader />
            <UploadToast />
            <Navbar />
            {children}
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

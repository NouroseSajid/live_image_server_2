import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { SelectionProvider } from "./providers/SelectionProvider";
import { SelectionToolbar } from "./components/gallery/SelectionToolbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ImageShare",
  description: "A secure image sharing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <AuthProvider>
            <SelectionProvider>
              <Navbar />
              <main className="flex-1 mt-16 pb-24">{children}</main>
              <SelectionToolbar />
              <Footer />
            </SelectionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

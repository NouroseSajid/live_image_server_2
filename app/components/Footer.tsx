"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { FaInstagram, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { footerLinks, socialLinks } from "../data/siteLinks";

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
  FaTiktok: SiTiktok,
};

export default function Footer() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer className="bg-[var(--background)] text-[var(--foreground)] pt-12 pb-8 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="p-1 dark:bg-white dark:rounded-md">
                <Image
                  src="/icons/Logo.svg"
                  alt="Logo"
                  width={40}
                  height={40}
                />
              </div>
              <span className="text-2xl font-bold"> Nourose Repository </span>
            </Link>
            <p className="text-sm mt-2 opacity-80">
              Share your images securely
            </p>
            <div className="flex gap-3 mt-4">
              {socialLinks.map((s) => {
                const Icon = iconMap[s.icon] || FaInstagram;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="p-2 rounded-md bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary_dark)] transition-colors"
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-2 flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2">
                {footerLinks
                  .filter((l) => !l.footerOnly)
                  .map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="hover:text-[var(--primary)] transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2">
                {footerLinks
                  .filter((l) => l.footerOnly)
                  .map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="hover:text-[var(--primary)] transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-[var(--border)] mt-8 pt-6 text-center text-sm opacity-70">
          &copy; {currentYear} Nourose Repository. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

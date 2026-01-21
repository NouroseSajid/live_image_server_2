"use client";

import Image from "next/image";
import Link from "next/link";
import { mainNavLinks } from "../data/siteLinks";

const Navbar = () => {
  return (
    <nav className="flex justify-between items-center px-4 py-2 bg-[var(--background)] border-b border-[var(--border)] fixed top-0 left-0 w-full z-[1000] shadow-sm">
      {/* Logo - Links to Nourose Home */}
      <div className="flex items-center">
        <Link href="https://nourose.com" className="flex items-center gap-2">
          <div className="p-1 dark:bg-white dark:rounded-md">
            <Image src="/icons/Logo.svg" alt="Logo" width={40} height={40} />
          </div>
          <span className="ml-2 text-2xl font-bold text-[var(--foreground)]">
            Nourose Repository
          </span>
        </Link>
      </div>

      {/* Desktop Navigation Links */}
      <div className="hidden md:flex gap-6">
        {mainNavLinks.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="group relative text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {label}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--primary)] transition-all duration-300 group-hover:w-full" />
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;

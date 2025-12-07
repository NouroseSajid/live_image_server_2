"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { mainNavLinks } from "../data/siteLinks";
import Drawer from "./Drawer";

const Navbar = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { data: session } = useSession();

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  // Lock scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
  }, [isDrawerOpen]);

  return (
    <>
      <nav className="flex justify-between items-center px-4 py-2 bg-gray-900/75 backdrop-blur-lg border-b border-[var(--border)] fixed top-0 left-0 w-full z-[1000] shadow-sm">
        {/* Logo */}
        <div className="flex items-center">
          <div className="p-1 dark:bg-white dark:rounded-md">
            <Image src="/icons/Logo.svg" alt="Logo" width={40} height={40} />
          </div>
          <Link
            href="/"
            className="ml-2 text-2xl font-bold text-[var(--foreground)]"
          >
            Nourose
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Desktop Links */}
          <div className="hidden md:flex gap-6">
            {mainNavLinks
              .filter((item) => !item.drawerOnly)
              .map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="group relative text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  {label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--primary)] transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}

            {session ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="group relative text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
              >
                Sign Out
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--primary)] transition-all duration-300 group-hover:w-full" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signIn("github")}
                className="group relative text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
              >
                Sign In
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--primary)] transition-all duration-300 group-hover:w-full" />
              </button>
            )}
          </div>

          {/* Hamburger Button */}
          <button
            type="button"
            aria-label="Toggle menu"
            className="flex flex-col justify-center items-center w-10 h-10 relative group"
            onClick={toggleDrawer}
          >
            <span
              className={`block w-6 h-0.5 bg-[var(--foreground)] rounded-sm transition-all duration-300 ease-in-out ${
                isDrawerOpen ? "rotate-45 translate-y-[8px]" : ""
              }`}
            ></span>
            <span
              className={`block w-6 h-0.5 bg-[var(--foreground)] rounded-sm my-1 transition-all duration-300 ease-in-out ${
                isDrawerOpen ? "opacity-0" : ""
              }`}
            ></span>
            <span
              className={`block w-6 h-0.5 bg-[var(--foreground)] rounded-sm transition-all duration-300 ease-in-out ${
                isDrawerOpen ? "-rotate-45 -translate-y-[8px]" : ""
              }`}
            ></span>
          </button>
        </div>
      </nav>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={toggleDrawer}
        navItems={mainNavLinks}
        session={session}
      />
    </>
  );
};

export default Navbar;

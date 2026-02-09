"use client";

import Image from "next/image";
import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";
import type { NavLink } from "../data/siteLinks";
import Navigation from "./Navigation";
import ThemeToggle from "./ThemeToggle";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavLink[];
  session: Session | null;
}

const Drawer = ({ isOpen, onClose, navItems, session }: DrawerProps) => {
  return (
    <>
      {/* Overlay with blur */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001] transition-opacity duration-300"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          role="button"
          tabIndex={0}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-[300px] bg-[var(--background)] text-[var(--foreground)] shadow-2xl transition-transform duration-300 ease-in-out z-[1002] flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with logo */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="p-1 dark:bg-white dark:rounded-md">
              <Image src="/icons/Logo.svg" alt="Logo" width={40} height={40} />
            </div>
            <span className="text-xl font-bold">ImageShare</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-[var(--foreground)] text-3xl hover:text-[var(--accent)] transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Main navigation */}
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <ThemeToggle />
          <Navigation onClose={onClose} navItems={navItems} />

          <div className="mt-4 p-4 border-t border-[var(--border)]">
            {session ? (
              <>
                <p className="text-sm mb-2">
                  Signed in as {session.user?.email}
                </p>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full p-2 text-center bg-[var(--primary)] text-white rounded-md hover:bg-opacity-90 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => signIn("github")}
                className="w-full p-2 text-center bg-[var(--primary)] text-white rounded-md hover:bg-opacity-90 transition-colors"
              >
                Sign In with GitHub
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Drawer;

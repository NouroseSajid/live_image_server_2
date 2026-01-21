import Link from "next/link";
import type { NavLink } from "../data/siteLinks";

interface NavigationProps {
  onClose: () => void;
  navItems: NavLink[];
}

const Navigation = ({ onClose, navItems }: NavigationProps) => {
  return (
    <nav className="mt-6">
      <ul className="flex flex-col gap-2 text-lg font-medium">
        {navItems.map(({ label, href }) => (
          <li key={href} className="rounded-md hover:bg-[var(--card)]">
            <Link
              href={href}
              onClick={onClose}
              className="group relative w-full block text-[var(--foreground)] transition-colors cursor-pointer hover:text-[var(--primary)] p-2"
            >
              {label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--primary)] transition-all duration-300 group-hover:w-full" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;

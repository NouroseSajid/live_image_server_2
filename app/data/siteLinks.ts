export interface NavLink {
  label: string;
  href: string;
  drawerOnly?: boolean;
  footerOnly?: boolean;
}

export interface SocialLink {
  label: string;
  href: string;
  icon: string;
}

export const mainNavLinks: NavLink[] = [
  { label: "Go back home", href: "https://nourose.com" },
 
];

export const footerLinks: NavLink[] = [
  { label: "Home", href: "https://nourose.com" },
  { label: "Services", href: "https://nourose.com/#services" },
  { label: "Gallery", href: "https://nourose.com/#gallery" },
  { label: "My Approach", href: "https://nourose.com/#approach" },
  { label: "Contact", href: "https://nourose.com/#contact" },
  { label: "Privacy Policy", href: "https://nourose.com/privacy", footerOnly: true },
  { label: "Terms of Service", href: "https://nourose.com/terms", footerOnly: true },
];

export const socialLinks = [
  {
    label: "Instagram",
    href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "https://instagram.com",
    icon: "FaInstagram",
  },
  {
    label: "TikTok",
    href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || "https://tiktok.com",
    icon: "FaTiktok",
  },
  {
    label: "YouTube",
    href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || "https://youtube.com",
    icon: "FaYoutube",
  },
  {
    label: "WhatsApp",
    href: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP || "https://whatsapp.com",
    icon: "FaWhatsapp",
  },
];

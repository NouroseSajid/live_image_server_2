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
  { label: 'Home', href: '#home' },
  { label: 'Services', href: '#services' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Contact', href: '#contact' },
  { label: 'My Approach', href: '#approach' },
  { label: 'Book Now', href: process.env.NEXT_PUBLIC_BOOKING_LINK || '' },
  
  { label: 'FAQ', href: '/faq', drawerOnly: true },
];

export const footerLinks: NavLink[] = [
  { label: 'Home', href: '#home' },
  { label: 'Services', href: '#services' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'My Approach', href: '#approach' },
  { label: 'Contact', href: '#contact' },
  { label: 'Privacy Policy', href: '/privacy', footerOnly: true },
  { label: 'Terms of Service', href: '/terms', footerOnly: true },
];

export const socialLinks = [
  {
    label: 'Instagram',
    href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://instagram.com',
    icon: 'FaInstagram',
  },
  {
    label: 'TikTok',
    href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || 'https://tiktok.com',
    icon: 'FaTiktok',
  },
  {
    label: 'YouTube',
    href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || 'https://youtube.com',
    icon: 'FaYoutube',
  },
  {
    label: 'WhatsApp',
    href: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP || 'https://whatsapp.com',
    icon: 'FaWhatsapp',
  },
];
import type { Metadata } from "next";
import Gallery from "./components/Gallery";

export const metadata: Metadata = {
  title: "Gallery - Nourose",
  description: "Browse and manage your photo and video gallery",
};

export default function Home() {
  return (
    <main id="main-content" className="flex-1 mt-16">
      <Gallery />
    </main>
  );
}

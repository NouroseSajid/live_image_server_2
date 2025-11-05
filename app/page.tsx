"use client";

import React, { useEffect, useState } from "react";
import { LiveGallery } from "@/app/components/LiveGallery";
import { RepoGallery } from "@/app/components/RepoGallery";

export default function Home() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setIsLive(process.env.NEXT_PUBLIC_WHAT_AM_I === "1");
  }, []);

  return (
    <main className="min-h-screen">
      {isLive ? <LiveGallery /> : <RepoGallery />}
    </main>
  );
}

"use client";

import { useContext } from "react";
import { SelectionContext } from "@/app/providers/SelectionProvider";

export const useSelection = () => {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
};

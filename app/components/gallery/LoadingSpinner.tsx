"use client";

import React from "react";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md" }) => {
  return (
    <div className="flex justify-center items-center p-4">
      <motion.div
        className={`${sizes[size]} rounded-full border-4 border-gray-300 border-t-gray-800`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

export default LoadingSpinner;

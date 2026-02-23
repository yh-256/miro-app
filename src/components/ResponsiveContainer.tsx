"use client";

import { ReactNode } from "react";
import { useBreakpoint, useDeviceDetection } from "@/utils/deviceDetection";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
}

export function ResponsiveContainer({
  children,
  className = "",
  maxWidth = "lg",
  padding = "md",
}: ResponsiveContainerProps) {
  const _breakpoint = useBreakpoint();
  const deviceInfo = useDeviceDetection();

  // 最大幅のクラス設定
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
    full: "max-w-full",
  };

  // パディングのクラス設定
  const paddingClasses = {
    none: "",
    sm: "px-4 py-2",
    md: "px-4 sm:px-6 lg:px-8 py-4 sm:py-6",
    lg: "px-6 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-12",
  };

  // デバイス固有のクラス
  const deviceClasses =
    deviceInfo?.type === "mobile"
      ? "mobile-container"
      : deviceInfo?.type === "tablet"
        ? "tablet-container"
        : "desktop-container";

  return (
    <div
      className={`
        w-full mx-auto
        ${maxWidthClasses[maxWidth]}
        ${paddingClasses[padding]}
        ${deviceClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

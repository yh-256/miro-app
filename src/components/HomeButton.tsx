"use client";

import { useRouter, usePathname } from "next/navigation";

interface HomeButtonProps {
  className?: string;
  variant?: "primary" | "outline" | "text";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function HomeButton({
  className = "",
  variant = "outline",
  size = "md",
  showText = true,
}: HomeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ホームページにいる場合は表示しない
  if (pathname === "/") {
    return null;
  }

  const handleHomeClick = () => {
    router.push("/");
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600",
    outline:
      "bg-transparent text-gray-700 hover:bg-gray-50 border border-gray-300",
    text: "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent",
  };

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={handleHomeClick}
      type="button"
      className={`
        inline-flex items-center gap-2 font-medium rounded-md
        transition-colors duration-200 focus:outline-none focus:ring-2 
        focus:ring-offset-2 focus:ring-blue-500
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      title="ホームに戻る"
    >
      <svg
        className={iconSize[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
      {showText && "ホーム"}
    </button>
  );
}

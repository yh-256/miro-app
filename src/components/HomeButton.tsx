'use client';

import { useRouter, usePathname } from 'next/navigation';

interface HomeButtonProps {
  className?: string;
  variant?: 'primary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function HomeButton({ 
  className = '', 
  variant = 'outline',
  size = 'md',
  showText = true
}: HomeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ホームページにいる場合は表示しない
  if (pathname === '/') {
    return null;
  }

  const handleHomeClick = () => {
    router.push('/');
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
    outline: 'bg-transparent text-gray-700 hover:bg-gray-50 border border-gray-300',
    text: 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
  };

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleHomeClick}
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
      {showText && 'ホーム'}
    </button>
  );
}

// ヘッダー用のコンパクトなホームボタン
export function CompactHomeButton({ className = '' }: { className?: string }) {
  return (
    <HomeButton
      variant="text"
      size="sm"
      showText={false}
      className={`${className}`}
    />
  );
}

// フローティングアクションボタン風のホームボタン
export function FloatingHomeButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/') {
    return null;
  }

  const handleHomeClick = () => {
    router.push('/');
  };

  return (
    <button
      onClick={handleHomeClick}
      className={`
        fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full
        shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:scale-105
        transition-all duration-200 focus:outline-none focus:ring-2 
        focus:ring-offset-2 focus:ring-blue-500 z-50
        ${className}
      `}
      title="ホームに戻る"
    >
      <svg 
        className="w-6 h-6 mx-auto" 
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
    </button>
  );
}
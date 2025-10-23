'use client';

import { ReactNode } from 'react';
import { useDeviceDetection } from '@/utils/deviceDetection';
import { ToastProvider } from './Toast';
import { HomeButton } from './HomeButton';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title = 'Miro Image Upload App' }: LayoutProps) {
  const deviceInfo = useDeviceDetection();

  return (
    <ToastProvider>
      <div className={`min-h-screen bg-gray-50 ${deviceInfo?.type === 'mobile' ? 'mobile-layout' : 'desktop-layout'}`}>
        {/* ヘッダー */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
                  {title}
                </h1>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                {/* ホームボタン */}
                <HomeButton variant="outline" size="sm" />
                
                {/* デバイス情報表示（開発用） */}
                {process.env.NODE_ENV === 'development' && deviceInfo && (
                  <div className="text-xs text-gray-500 hidden sm:block">
                    {deviceInfo.type} | {deviceInfo.screenWidth}×{deviceInfo.screenHeight}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">
          {children}
        </main>

        {/* フッター */}
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="text-center text-sm text-gray-500">
              <p>&copy; 2025 Miro Image Upload App</p>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeviceDetection } from '@/utils/deviceDetection';
import { ToastProvider } from './Toast';
import { HomeButton } from './HomeButton';
import { useNotifications } from '@/hooks/useNotifications';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

interface AuthStatus {
  isLoggedIn: boolean;
  userId?: string;
  userDbId?: string;
  displayName?: string;
  role?: 'ADMIN' | 'USER';
}

export function Layout({ children, title = 'Miro Image Upload App' }: LayoutProps) {
  const deviceInfo = useDeviceDetection();
  const router = useRouter();
  const { showSuccess, showError } = useNotifications();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [authLoading, setAuthLoading] = useState(true);

  // 認証状態を取得
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        setAuthStatus({
          isLoggedIn: data.isLoggedIn ?? false,
          userId: data.user?.userId,
          userDbId: data.user?.dbId,
          displayName: data.user?.displayName,
          role: data.user?.role,
        });
      } catch (error) {
        console.error('Failed to fetch auth status:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        showSuccess('ログアウト', 'ログアウトしました');
        setAuthStatus({ isLoggedIn: false });
        router.push('/');
        router.refresh();
      } else {
        showError('エラー', 'ログアウトに失敗しました');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showError('エラー', 'ログアウト処理中にエラーが発生しました');
    }
  };

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
                {/* 認証状態表示 */}
                {!authLoading && (
                  <>
                    {authStatus.isLoggedIn ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 hidden sm:inline">
                          {authStatus.displayName || authStatus.userId}
                        </span>
                        <button
                          onClick={handleLogout}
                          className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                        >
                          ログアウト
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push('/login')}
                        className="text-sm px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                      >
                        ログイン
                      </button>
                    )}
                  </>
                )}
                
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

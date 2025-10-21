'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ResponsiveContainer, FlexContainer } from './ResponsiveContainer';
import { useDeviceDetection } from '@/utils/deviceDetection';

interface AuthStatus {
  isLoggedIn: boolean;
  userId?: string;
  displayName?: string;
  role?: 'ADMIN' | 'USER';
}

export function HomePage() {
  const router = useRouter();
  const deviceInfo = useDeviceDetection();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [authLoading, setAuthLoading] = useState(true);

  // 認証状態を取得
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        setAuthStatus(data);
      } catch (error) {
        console.error('Failed to fetch auth status:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  const navigateToUpload = () => {
    router.push('/upload');
  };

  const navigateToBoard = () => {
    router.push('/board');
  };

  const navigateToSearch = () => {
    router.push('/search');
  };

  return (
    <ResponsiveContainer maxWidth="md" padding="lg">
      <FlexContainer 
        direction="col" 
        align="center" 
        gap="lg" 
        className="min-h-[60vh] justify-center"
      >
        {/* アプリタイトル */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Miro Image Upload
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            スマートフォンで撮影した画像を簡単にMiroボードにアップロードできます
          </p>
        </div>

        {/* 機能選択ボタン */}
        <div className="w-full max-w-md space-y-4">
          <button
            onClick={navigateToUpload}
            type="button"
            className="w-full btn-primary text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 4v16m8-8H4" 
                />
              </svg>
              画像アップロード
            </div>
            <p className="text-sm mt-1 opacity-90">
              写真を撮影してMiroボードに送信
            </p>
          </button>

          <button
            onClick={navigateToBoard}
            type="button"
            className="w-full btn-outline text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              ボード表示
            </div>
            <p className="text-sm mt-1 opacity-90">
              Miroボードを表示・確認
            </p>
          </button>

          <button
            onClick={navigateToSearch}
            type="button"
            className="w-full btn-outline text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
              ボード内検索
            </div>
            <p className="text-sm mt-1 opacity-90">
              画像・付箋・個人IDを検索
            </p>
          </button>

          {/* 認証関連ボタン */}
          {!authLoading && (
            <>
              {!authStatus.isLoggedIn && (
                <button
                  onClick={() => router.push('/login')}
                  type="button"
                  className="w-full bg-green-600 text-white text-lg py-4 px-6 rounded-lg shadow-md hover:bg-green-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-center justify-center gap-3">
                    <svg 
                      className="w-6 h-6" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" 
                      />
                    </svg>
                    ログイン
                  </div>
                  <p className="text-sm mt-1 opacity-90">
                    ユーザーIDとPINでログイン
                  </p>
                </button>
              )}

              {authStatus.isLoggedIn && authStatus.role === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin/users')}
                  type="button"
                  className="w-full bg-purple-600 text-white text-lg py-4 px-6 rounded-lg shadow-md hover:bg-purple-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-center justify-center gap-3">
                    <svg 
                      className="w-6 h-6" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
                      />
                    </svg>
                    ユーザー管理
                  </div>
                  <p className="text-sm mt-1 opacity-90">
                    ユーザーの作成・管理
                  </p>
                </button>
              )}
            </>
          )}
        </div>

        {/* デバイス情報の表示（開発時のみ） */}
        {process.env.NODE_ENV === 'development' && deviceInfo && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
            <h3 className="font-semibold mb-2">デバイス情報（開発用）</h3>
            <div className="space-y-1">
              <p>デバイス: {deviceInfo.type}</p>
              <p>画面サイズ: {deviceInfo.screenWidth} × {deviceInfo.screenHeight}</p>
              <p>タッチデバイス: {deviceInfo.isTouchDevice ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        {/* 使い方の説明 */}
        <div className="w-full max-w-2xl mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            使い方
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card card-hover">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">画像を撮影・選択</h3>
                  <p className="text-sm text-gray-600">
                    カメラで撮影するか、ギャラリーから画像を選択します
                  </p>
                </div>
              </div>
            </div>

            <div className="card card-hover">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">個人IDを選択</h3>
                  <p className="text-sm text-gray-600">
                    画像の個人IDを選択または新規作成します
                  </p>
                </div>
              </div>
            </div>

            <div className="card card-hover">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">送信先を選択</h3>
                  <p className="text-sm text-gray-600">
                    アップロード先のMiroボードを選択します
                  </p>
                </div>
              </div>
            </div>

            <div className="card card-hover">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">アップロード完了</h3>
                  <p className="text-sm text-gray-600">
                    画像とメタデータがMiroボードに配置されます
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FlexContainer>
    </ResponsiveContainer>
  );
}

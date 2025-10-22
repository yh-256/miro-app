'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useNotifications();
  
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'ログインに失敗しました');
        showError('ログイン失敗', data.message || 'ユーザーIDまたはPINが正しくありません');
        return;
      }

      showSuccess('ログイン成功', `${data.user.displayName || data.user.userId}さん、ようこそ!`);
      
      // リダイレクト先を確認（デフォルトはホーム）
      const redirectTo = searchParams.get('redirect') || '/problems';
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error('Login error:', err);
      setError('ログイン処理中にエラーが発生しました');
      showError('エラー', 'ログイン処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-md rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            ログイン
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ユーザーID入力 */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                ユーザーID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                minLength={3}
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ユーザーIDを入力"
                disabled={loading}
              />
            </div>

            {/* PIN入力 */}
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                PIN
              </label>
              <input
                type="password"
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                minLength={4}
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="PINを入力"
                disabled={loading}
              />
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

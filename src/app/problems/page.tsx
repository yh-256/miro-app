'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ProblemListResponse, ProblemSummary } from '@/types';
import { PROBLEM_STATUS_LABEL } from '@/constants/problemStatus';

type ProblemStatus = ProblemSummary['status'];

const STATUS_STYLES: Record<
  ProblemStatus,
  { badge: string; dot: string }
> = {
  LOCKED: {
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    dot: 'bg-gray-400',
  },
  AVAILABLE: {
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
  },
  INSIGHT_WRITTEN: {
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    dot: 'bg-indigo-500',
  },
  UPLOAD_COMPLETED: {
    badge: 'bg-purple-50 text-purple-700 border border-purple-200',
    dot: 'bg-purple-500',
  },
  BOARD_VIEWED: {
    badge: 'bg-teal-50 text-teal-700 border border-teal-200',
    dot: 'bg-teal-500',
  },
  COMPLETED: {
    badge: 'bg-green-50 text-green-700 border border-green-200',
    dot: 'bg-green-500',
  },
};

function formatDate(timestamp?: string) {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('ja-JP');
}

export default function ProblemsPage() {
  const [data, setData] = useState<ProblemListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/problems', { cache: 'no-store' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || '問題一覧の取得に失敗しました。');
        }
        const payload = (await response.json()) as ProblemListResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : '問題一覧の取得に失敗しました。'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const summaries = data?.problems ?? [];

  const stats = useMemo(() => {
    if (!data?.stats) {
      return { total: 0, completed: 0, available: 0 };
    }
    return data.stats;
  }, [data]);

  return (
    <Layout title="問題一覧 - Miro Image Upload App">
      <ResponsiveContainer maxWidth="2xl" padding="lg">
        <div className="space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                問題ステップ一覧
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                気づきの投稿状況と進行度を確認できます。順番に問題へ取り組み、条件を満たすとボード閲覧や画像アップロードが解禁されます。
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/search"
                className="btn-outline text-sm px-4 py-2"
              >
                ボード検索へ
              </Link>
              <Link
                href="/upload"
                className="btn-primary text-sm px-4 py-2"
              >
                通常アップロード
              </Link>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-gray-500 text-sm">総問題数</div>
              <div className="text-2xl font-semibold text-gray-900">
                {stats.total}
              </div>
            </div>
            <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
              <div className="text-green-600 text-sm">完了済み</div>
              <div className="text-2xl font-semibold text-green-700">
                {stats.completed}
              </div>
            </div>
            <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
              <div className="text-blue-600 text-sm">挑戦可能</div>
              <div className="text-2xl font-semibold text-blue-700">
                {stats.available}
              </div>
            </div>
          </section>

          {loading && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">問題一覧を読み込み中...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && summaries.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-600">
              登録された問題がありません。
            </div>
          )}

          {!loading && !error && summaries.length > 0 && (
            <div className="space-y-4">
              {summaries.map((problem) => {
                const styles = STATUS_STYLES[problem.status];
                const statusLabel =
                  PROBLEM_STATUS_LABEL[problem.status] ?? problem.status;
                const isActive = data?.activeProblemId === problem.id;

                return (
                  <div
                    key={problem.id}
                    className={`bg-white border rounded-lg shadow-sm transition hover:shadow-md ${
                      isActive ? 'border-blue-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${styles.badge}`}
                            >
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${styles.dot}`}
                              />
                              {statusLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              ステップ #{problem.orderIndex}
                            </span>
                            {isActive && (
                              <span className="text-xs font-semibold text-blue-600">
                                現在の進行中ステップ
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-semibold text-gray-900 mt-2">
                            {problem.title}
                          </h2>
                          {problem.description && (
                            <p className="mt-1 text-sm text-gray-600">
                              {problem.description}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/problems/${problem.id}`}
                          className="btn-primary self-start"
                        >
                          詳細を開く
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="font-medium text-gray-500 mb-1">
                            気づき記入
                          </p>
                          <p>
                            {formatDate(problem.insightSubmittedAt) ?? '未実施'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-500 mb-1">
                            ボード解禁
                          </p>
                          <p>
                            {formatDate(problem.boardUnlockedAt) ?? '未解禁'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-500 mb-1">
                            最終更新
                          </p>
                          <p>{formatDate(problem.completedAt) ?? '未完了'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ResponsiveContainer>
    </Layout>
  );
}

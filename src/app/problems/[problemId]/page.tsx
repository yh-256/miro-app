'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { BoardEmbed } from '@/components/BoardEmbed';
import { ProblemUploadSection } from '@/components/ProblemUploadSection';
import { ProblemDetailResponse } from '@/types';
import { PROBLEM_STATUS_LABEL } from '@/constants/problemStatus';

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('ja-JP');
}

export default function ProblemDetailPage() {
  const params = useParams();
  const problemId = (params?.problemId as string) ?? '';
  const [detail, setDetail] = useState<ProblemDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`/api/problems/${problemId}`, {
        cache: 'no-store',
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(
          payload.message || '問題詳細の取得に失敗しました。'
        );
      }
      const payload = (await resp.json()) as ProblemDetailResponse;
      setDetail(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '問題詳細の取得に失敗しました。'
      );
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (problemId) {
      fetchDetail();
    }
  }, [problemId, fetchDetail]);

  const statusLabel = detail
    ? PROBLEM_STATUS_LABEL[detail.problem.status] ?? detail.problem.status
    : '';

  const uploadUnlocked = detail?.problem.isUploadUnlocked ?? false;
  const boardUnlocked = detail?.problem.isBoardUnlocked ?? false;

  const refreshAfterUpload = () => {
    fetchDetail();
    setUploadKey((prev) => prev + 1);
  };

  return (
    <Layout title="問題詳細 - Miro Image Upload App">
      <ResponsiveContainer maxWidth="2xl" padding="lg">
        {loading && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">問題詳細を読み込み中...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && detail && (
          <div className="space-y-8">
            <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {statusLabel}
                  </span>
                  <h1 className="text-3xl font-bold text-gray-900 mt-2">
                    ステップ #{detail.problem.orderIndex}
                  </h1>
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <div className="flex justify-end">
                    <Link
                      href="/problems"
                      className="btn-outline text-xs px-3 py-2"
                    >
                      ← 問題一覧に戻る
                    </Link>
                  </div>
                  <p>ステップ番号: #{detail.problem.orderIndex}</p>
                  <p>問題ID: {detail.problem.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium text-gray-500 mb-1">作成日時</p>
                  <p>{formatTimestamp(detail.problem.createdAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 mb-1">更新日時</p>
                  <p>{formatTimestamp(detail.problem.updatedAt)}</p>
                </div>
              </div>
            </section>

            <ProblemUploadSection
              key={uploadKey}
              problemId={problemId}
              defaultBoardId={detail.problem.miroBoardId}
              defaultBoardName={`ステップ #${detail.problem.orderIndex}`}
              isUploadUnlocked={uploadUnlocked}
              isBoardUnlocked={boardUnlocked}
              onUploadCompleted={refreshAfterUpload}
              lockBoardSelection
            />

            <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                ボード閲覧
              </h2>
              {boardUnlocked && detail.problem.miroBoardId ? (
                <div className="space-y-4">
                  <BoardEmbed
                    boardId={detail.problem.miroBoardId}
                    boardName={`ステップ #${detail.problem.orderIndex}`}
                    height={600}
                  />
                  <p className="text-xs text-gray-500">
                    ボードを閲覧後、「ボード閲覧済みにする」ボタンを押すと、ステップ3が完了します。
                  </p>
                </div>
              ) : !uploadUnlocked ? (
                <div className="text-sm text-gray-600">
                  まず気づきを入力して投稿すると、画像アップロードとボード閲覧が順番に解禁されます。
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  画像をアップロードすると、Miroボードが閲覧できるようになります。
                </div>
              )}
            </section>

          </div>
        )}
      </ResponsiveContainer>
    </Layout>
  );
}

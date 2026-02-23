"use client";

import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { ProblemUploadSection } from "@/components/ProblemUploadSection";
import { ProblemDetailResponse } from "@/types";

interface UploadPageClientProps {
  problemIdFromQuery: string | null;
}

export function UploadPageClient({
  problemIdFromQuery,
}: UploadPageClientProps) {
  const [problemDetail, setProblemDetail] =
    useState<ProblemDetailResponse | null>(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState<string | null>(null);

  const refreshProblemDetail = useCallback(async () => {
    if (!problemIdFromQuery) {
      setProblemDetail(null);
      setProblemError(null);
      return;
    }

    try {
      setProblemLoading(true);
      setProblemError(null);

      const response = await fetch(`/api/problems/${problemIdFromQuery}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "問題情報の取得に失敗しました。");
      }
      const payload = (await response.json()) as ProblemDetailResponse;
      setProblemDetail(payload);
    } catch (error) {
      setProblemError(
        error instanceof Error
          ? error.message
          : "問題情報の取得に失敗しました。",
      );
    } finally {
      setProblemLoading(false);
    }
  }, [problemIdFromQuery]);

  useEffect(() => {
    if (problemIdFromQuery) {
      refreshProblemDetail();
    } else {
      setProblemDetail(null);
      setProblemError(null);
    }
  }, [problemIdFromQuery, refreshProblemDetail]);

  return (
    <Layout title="画像アップロード - Miro Image Upload App">
      <ResponsiveContainer maxWidth="2xl" padding="lg">
        {problemLoading && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">問題情報を読み込み中です...</p>
          </div>
        )}

        {problemError && !problemLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-sm text-red-700">
            {problemError}
          </div>
        )}

        {problemDetail && !problemLoading && !problemError && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {problemDetail.problem.title}
              </h1>
              <p className="text-sm text-gray-600">
                問題に紐付けて画像をアップロードします。ページ下部の問題詳細からも直接アップロードできます。
              </p>
            </div>

            <ProblemUploadSection
              problemId={problemIdFromQuery!}
              defaultBoardId={problemDetail.problem.miroBoardId}
              defaultBoardName={problemDetail.problem.title}
              defaultBoardDescription={problemDetail.problem.description}
              isUploadUnlocked={problemDetail.problem.isUploadUnlocked}
              isBoardUnlocked={problemDetail.problem.isBoardUnlocked}
              onUploadCompleted={refreshProblemDetail}
            />
          </div>
        )}

        {!problemIdFromQuery && !problemLoading && !problemError && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-700">
            <p className="mb-2">アップロードする問題を選択してください。</p>
            <p>
              問題ページから「画像アップロード」を開くと、選択した問題に紐付けて画像をアップロードできます。
            </p>
          </div>
        )}
      </ResponsiveContainer>
    </Layout>
  );
}

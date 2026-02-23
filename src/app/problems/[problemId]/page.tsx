"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "@/components/Layout";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { BoardEmbed } from "@/components/BoardEmbed";
import { ProblemUploadSection } from "@/components/ProblemUploadSection";
import {
  ProblemDetailResponse,
  InsightSummary,
  ProblemProgressUpdatePayload,
} from "@/types";
import {
  PROBLEM_STATUS_LABEL,
  isStatusAtLeast,
} from "@/constants/problemStatus";

interface InsightFormState {
  content: string;
  isPublic: boolean;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString("ja-JP");
}

export default function ProblemDetailPage() {
  const params = useParams();
  const problemId = (params?.problemId as string) ?? "";
  const router = useRouter();

  const [detail, setDetail] = useState<ProblemDetailResponse | null>(null);
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightForm, setInsightForm] = useState<InsightFormState>({
    content: "",
    isPublic: true,
  });
  const [submittingInsight, setSubmittingInsight] = useState(false);
  const [progressUpdating, setProgressUpdating] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`/api/problems/${problemId}`, {
        cache: "no-store",
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.message || "問題詳細の取得に失敗しました。");
      }
      const payload = (await resp.json()) as ProblemDetailResponse;
      setDetail(payload);
      setInsights(payload.relatedInsights ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "問題詳細の取得に失敗しました。",
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
    ? (PROBLEM_STATUS_LABEL[detail.problem.status] ?? detail.problem.status)
    : "";

  const canPostInsight = detail
    ? [
        "AVAILABLE",
        "INSIGHT_WRITTEN",
        "UPLOAD_COMPLETED",
        "BOARD_VIEWED",
        "COMPLETED",
      ].includes(detail.problem.status)
    : false;

  const uploadUnlocked = detail?.problem.isUploadUnlocked ?? false;
  const boardUnlocked = detail?.problem.isBoardUnlocked ?? false;

  const handleInsightSubmit = async () => {
    if (!insightForm.content.trim()) {
      return;
    }

    setSubmittingInsight(true);
    try {
      const resp = await fetch(`/api/problems/${problemId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: insightForm.content.trim(),
          isPublic: insightForm.isPublic,
        }),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.message || "気づきの投稿に失敗しました。");
      }

      const payload = await resp.json();
      if (payload.insight) {
        setInsights((prev) => [...prev, payload.insight as InsightSummary]);
      }
      setInsightForm({ content: "", isPublic: true });
      await fetchDetail();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "気づきの投稿に失敗しました。",
      );
    } finally {
      setSubmittingInsight(false);
    }
  };

  const updateProgress = async (update: ProblemProgressUpdatePayload) => {
    setProgressUpdating(true);
    try {
      const resp = await fetch(`/api/problems/${problemId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.message || "進捗の更新に失敗しました。");
      }

      if (update.completed) {
        router.push("/problems");
        return;
      }

      await fetchDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "進捗の更新に失敗しました。");
    } finally {
      setProgressUpdating(false);
    }
  };

  const refreshAfterUpload = () => {
    fetchDetail();
    setUploadKey((prev) => prev + 1);
  };

  const statusTimeline = useMemo(() => {
    if (!detail) return [];
    return [
      {
        label: "気づき記入",
        value: formatTimestamp(detail.problem.insightSubmittedAt),
      },
      {
        label: "アップロード完了",
        value: formatTimestamp(detail.problem.boardUnlockedAt),
      },
      {
        label: "ボード閲覧済み",
        value: formatTimestamp(detail.problem.boardViewedAt),
      },
      {
        label: "完了",
        value: formatTimestamp(detail.problem.completedAt),
      },
    ];
  }, [detail]);

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
                  <h1 className="text-2xl font-bold text-gray-900 mt-2">
                    {detail.problem.title}
                  </h1>
                  {detail.problem.description && (
                    <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                      {detail.problem.description}
                    </p>
                  )}
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

              {detail.problem.contentType === "text" &&
                detail.problem.contentBody && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                    {detail.problem.contentBody}
                  </div>
                )}
            </section>

            <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  気づきの記録
                </h2>
                <span className="text-sm text-gray-500">
                  投稿済み: {insights.length}件
                </span>
              </div>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <textarea
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="気づきを入力してください..."
                    value={insightForm.content}
                    onChange={(event) =>
                      setInsightForm((prev) => ({
                        ...prev,
                        content: event.target.value,
                      }))
                    }
                    disabled={!canPostInsight || submittingInsight}
                  />
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={insightForm.isPublic}
                        onChange={(event) =>
                          setInsightForm((prev) => ({
                            ...prev,
                            isPublic: event.target.checked,
                          }))
                        }
                        disabled={submittingInsight}
                      />
                      公開気づきとして共有
                    </label>
                    <button
                      onClick={handleInsightSubmit}
                      type="button"
                      disabled={
                        submittingInsight ||
                        !canPostInsight ||
                        !insightForm.content.trim()
                      }
                      className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingInsight ? "送信中..." : "気づきを投稿"}
                    </button>
                  </div>
                  {!canPostInsight && (
                    <p className="text-xs text-gray-500">
                      この問題の気づきはまだ投稿できません。前のステップを完了してください。
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  {insights.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      まだ投稿された気づきはありません。
                    </p>
                  ) : (
                    insights.map((insight) => (
                      <div
                        key={insight.id}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="text-sm text-gray-700">
                            投稿者: {insight.author?.displayName ?? "匿名"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTimestamp(insight.createdAt)}
                            {!insight.isPublic && (
                              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                非公開
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
                          {insight.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <ProblemUploadSection
              key={uploadKey}
              problemId={problemId}
              defaultBoardId={detail.problem.miroBoardId}
              defaultBoardName={detail.problem.title}
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
                    boardName={detail.problem.title}
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

            <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">進捗状況</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                {statusTimeline.map((item) => (
                  <div key={item.label}>
                    <p className="font-medium text-gray-500 mb-1">
                      {item.label}
                    </p>
                    <p>{item.value ?? "未実施"}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => updateProgress({ boardViewed: true })}
                  disabled={
                    progressUpdating ||
                    !isStatusAtLeast(detail.problem.status, "INSIGHT_WRITTEN")
                  }
                  className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ボード閲覧済みにする
                </button>
                <button
                  type="button"
                  onClick={() => updateProgress({ completed: true })}
                  disabled={
                    progressUpdating ||
                    !isStatusAtLeast(detail.problem.status, "BOARD_VIEWED")
                  }
                  className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ステップ完了を報告
                </button>
              </div>
            </section>
          </div>
        )}
      </ResponsiveContainer>
    </Layout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { ProgressStep } from "@/types";

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

interface UploadProgressProps {
  isVisible: boolean;
  steps: ProgressStep[];
  selectedBoard?: Board | null;
  skippedFiles?: Array<{ fileName: string; reason: string }>;
  onClose?: () => void;
  className?: string;
}

export function UploadProgress({
  isVisible,
  steps,
  selectedBoard,
  skippedFiles = [],
  onClose,
  className = "",
}: UploadProgressProps) {
  const [animatedSteps, setAnimatedSteps] = useState<ProgressStep[]>(steps);

  useEffect(() => {
    setAnimatedSteps(steps);
  }, [steps]);

  if (!isVisible) {
    return null;
  }

  const completedCount = animatedSteps.filter(
    (step) => step.status === "completed",
  ).length;
  const totalSteps = animatedSteps.length;
  const overallProgress =
    totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const hasError = animatedSteps.some((step) => step.status === "error");
  const isCompleted = completedCount === totalSteps && !hasError;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            アップロード進捗
          </h3>
          {(isCompleted || hasError) && onClose && (
            <button
              onClick={onClose}
              type="button"
              className="text-gray-400 hover:text-gray-600"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 全体の進捗バー */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>全体の進捗</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ease-out ${
                hasError
                  ? "bg-red-500"
                  : isCompleted
                    ? "bg-green-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* 各ステップの詳細 */}
        <div className="space-y-3">
          {animatedSteps.map((step, _index) => (
            <div key={step.id} className="flex items-start space-x-3">
              {/* ステップアイコン */}
              <div className="flex-shrink-0 mt-0.5">
                {step.status === "completed" && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}

                {step.status === "in_progress" && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                )}

                {step.status === "error" && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}

                {step.status === "pending" && (
                  <div className="w-5 h-5 bg-gray-300 rounded-full" />
                )}
              </div>

              {/* ステップ内容 */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.status === "error"
                      ? "text-red-600"
                      : step.status === "completed"
                        ? "text-green-600"
                        : step.status === "in_progress"
                          ? "text-blue-600"
                          : "text-gray-500"
                  }`}
                >
                  {step.label}
                </p>

                {step.message && (
                  <p className="text-xs text-gray-500 mt-1">{step.message}</p>
                )}

                {/* 個別の進捗バー */}
                {step.status === "in_progress" &&
                  typeof step.progress === "number" && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div
                          className="h-1 bg-blue-500 rounded-full transition-all duration-300 ease-out"
                          style={{
                            width: `${Math.min(100, Math.max(0, step.progress))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          {isCompleted && (
            <div className="text-center">
              <div className="text-green-600 mb-2">
                <svg
                  className="w-8 h-8 mx-auto"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm text-green-600 font-medium mb-4">
                アップロードが完了しました！
              </p>

              {/* スキップされたファイルの表示 */}
              {skippedFiles.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center mb-2">
                    <svg
                      className="w-4 h-4 text-yellow-600 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      {skippedFiles.length}個のファイルがスキップされました
                    </span>
                  </div>
                  <div className="space-y-1">
                    {skippedFiles.map((file, index) => (
                      <div key={index} className="text-xs text-yellow-700">
                        <span className="font-medium">{file.fileName}</span>:{" "}
                        {file.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBoard && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    「{selectedBoard.name}」ボードにアップロードされました
                  </p>
                  <a
                    href="/board"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    ボードを表示
                  </a>
                </div>
              )}
            </div>
          )}

          {hasError && (
            <div className="text-center">
              <div className="text-red-600 mb-2">
                <svg
                  className="w-8 h-8 mx-auto"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm text-red-600 font-medium">
                アップロードに失敗しました
              </p>
            </div>
          )}

          {!isCompleted && !hasError && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">処理中です...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// プリセットステップの定義
export const UPLOAD_STEPS = {
  VALIDATING: {
    id: "validating",
    label: "ファイルを検証しています",
    status: "pending" as const,
  },
  UPLOADING_IMAGES: {
    id: "uploading_images",
    label: "画像をアップロードしています",
    status: "pending" as const,
  },
  CREATING_NOTES: {
    id: "creating_notes",
    label: "メタデータ付箋を作成しています",
    status: "pending" as const,
  },
  GROUPING: {
    id: "grouping",
    label: "アイテムをグループ化しています",
    status: "pending" as const,
  },
  CLEANUP: {
    id: "cleanup",
    label: "処理を完了しています",
    status: "pending" as const,
  },
} as const;

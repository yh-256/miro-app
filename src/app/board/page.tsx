"use client";

import { useState } from "react";
import { Layout } from "@/components/Layout";
import { BoardSelector } from "@/components/BoardSelector";
import { BoardEmbed } from "@/components/BoardEmbed";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { useNotifications } from "@/hooks/useNotifications";

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

export default function BoardPage() {
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [showSelector, setShowSelector] = useState(true);
  const { showSuccess } = useNotifications();

  const handleBoardSelect = (board: Board) => {
    setSelectedBoard(board);
    setShowSelector(false);
    showSuccess("ボード選択完了", `「${board.name}」を表示します`, 3000);
  };

  const handleBackToSelector = () => {
    setShowSelector(true);
    setSelectedBoard(null);
  };

  return (
    <Layout title="ボード表示 - Miro Image Upload App">
      <ResponsiveContainer>
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    ボード表示
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedBoard
                      ? `現在表示中: ${selectedBoard.name}`
                      : "Miroボードを選択してください"}
                  </p>
                </div>

                {selectedBoard && (
                  <button
                    onClick={handleBackToSelector}
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 
                             shadow-sm text-sm font-medium rounded-md text-gray-700 
                             bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 
                             focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    ボード選択に戻る
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {showSelector ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    表示するボードを選択
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    アップロードした画像やメタデータを確認したいMiroボードを選択してください。
                  </p>

                  <BoardSelector onBoardSelect={handleBoardSelect} />
                </div>

                {/* 機能説明セクション */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                  <h3 className="text-lg font-medium text-blue-900 mb-3">
                    ボード表示機能について
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-start">
                      <svg
                        className="mt-1 mr-2 h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>画像とメタデータ付箋の一体表示</span>
                    </div>
                    <div className="flex items-start">
                      <svg
                        className="mt-1 mr-2 h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>個人ID別グループ化の確認</span>
                    </div>
                    <div className="flex items-start">
                      <svg
                        className="mt-1 mr-2 h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>タッチ操作対応（スマートフォン・タブレット）</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              selectedBoard && (
                <div className="space-y-4">
                  {/* ボード情報表示 */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {selectedBoard.name}
                        </h3>
                        {selectedBoard.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedBoard.description}
                          </p>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        {/* Miroで直接開くボタン */}
                        <a
                          href={`https://miro.com/app/board/${selectedBoard.id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-transparent 
                                   text-sm leading-4 font-medium rounded-md text-white 
                                   bg-blue-600 hover:bg-blue-700 focus:outline-none 
                                   focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg
                            className="mr-2 h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          Miroで開く
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* ボード埋め込み表示 */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <BoardEmbed
                      boardId={selectedBoard.id}
                      boardName={selectedBoard.name}
                    />
                  </div>

                  {/* 操作ガイド */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      操作方法
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">拡大・縮小:</span>{" "}
                        マウスホイール、ピンチ操作
                      </div>
                      <div>
                        <span className="font-medium">移動:</span> ドラッグ操作
                      </div>
                      <div>
                        <span className="font-medium">編集:</span>{" "}
                        アイテムをダブルクリック
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </ResponsiveContainer>
    </Layout>
  );
}

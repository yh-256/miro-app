"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { BoardListResponse } from "@/types";
import { useDeviceDetection } from "@/utils/deviceDetection";

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

interface BoardSelectorProps {
  selectedBoardId?: string;
  onBoardSelect: (board: Board) => void;
  className?: string;
}

export function BoardSelector({
  selectedBoardId,
  onBoardSelect,
  className = "",
}: BoardSelectorProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deviceInfo = useDeviceDetection();

  // ボード一覧を取得
  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/boards/list");
      const data: BoardListResponse = await response.json();

      if (response.ok) {
        setBoards(data.boards);
      } else {
        throw new Error(data.message || "ボード一覧の取得に失敗しました。");
      }
    } catch (err) {
      console.error("Failed to fetch boards:", err);
      setError(
        err instanceof Error ? err.message : "不明なエラーが発生しました。",
      );
    } finally {
      setLoading(false);
    }
  };

  // 検索フィルター
  const filteredBoards = boards.filter(
    (board) =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (board.description &&
        board.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleBoardClick = (board: Board) => {
    onBoardSelect(board);
  };

  const handleRetry = () => {
    fetchBoards();
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">ボード一覧を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-8">
          <div className="mb-4">
            <svg
              className="w-12 h-12 text-red-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-600 mb-4">{error}</p>
          </div>
          <button onClick={handleRetry} type="button" className="btn-primary">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          送信先ボードを選択
        </h3>

        {/* 検索フィールド */}
        <div className="relative">
          <input
            type="text"
            placeholder="ボード名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
        </div>
      </div>

      {/* ボード一覧 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredBoards.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery
              ? "検索条件に一致するボードが見つかりません。"
              : "ボードが見つかりません。"}
          </div>
        ) : (
          filteredBoards.map((board) => (
            <div
              key={board.id}
              onClick={() => handleBoardClick(board)}
              className={`
                card card-hover cursor-pointer transition-all duration-200 p-3
                ${
                  selectedBoardId === board.id
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "hover:border-gray-400"
                }
                ${deviceInfo?.type === "mobile" ? "min-h-[60px]" : ""}
              `}
            >
              <div className="flex items-start space-x-3">
                {/* サムネイル */}
                <div className="flex-shrink-0">
                  {board.thumbnailUrl ? (
                    <Image
                      src={board.thumbnailUrl}
                      alt={`${board.name} thumbnail`}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-md object-cover border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-gray-400"
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
                    </div>
                  )}
                </div>

                {/* ボード情報 */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {board.name}
                  </h4>
                  {board.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {board.description}
                    </p>
                  )}
                </div>

                {/* 選択インジケーター */}
                {selectedBoardId === board.id && (
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-600"
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
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 選択状態の表示 */}
      {selectedBoardId && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-blue-600 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-blue-800">
              {boards.find((b) => b.id === selectedBoardId)?.name || "ボード"}{" "}
              が選択されています
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

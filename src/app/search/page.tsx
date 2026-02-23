"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Layout } from "@/components/Layout";
import { SearchForm, SearchFormData } from "@/components/SearchForm";
import { SearchResults } from "@/components/SearchResults";
import { BoardSelector } from "@/components/BoardSelector";
import {
  SearchResult,
  SearchResultItem,
  getSearchStats,
} from "@/utils/searchService.types";

interface AuthStatus {
  isLoggedIn: boolean;
  userId?: string;
  userDbId?: string;
  displayName?: string;
  role?: "ADMIN" | "USER";
}

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

function SearchPageContent() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isLoggedIn: false,
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [restrictedCount, setRestrictedCount] = useState(0);

  const searchParams = useSearchParams();

  // 認証状態を取得
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        setAuthStatus({
          isLoggedIn: data.isLoggedIn ?? false,
          userId: data.user?.userId,
          userDbId: data.user?.dbId,
          displayName: data.user?.displayName,
          role: data.user?.role,
        });
      } catch (error) {
        console.error("Failed to fetch auth status:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  const performSearch = useCallback(
    async (searchData: SearchFormData, boardId?: string) => {
      const targetBoardId = boardId || selectedBoard?.id;

      if (!targetBoardId) {
        setError("検索を実行するにはボードを選択してください。");
        return;
      }

      setIsSearching(true);
      setError(null);
      setSearchQuery(
        searchData.query || searchData.userId || searchData.uploaderName || "",
      );

      try {
        // 検索パラメータの構築
        const params = new URLSearchParams({
          boardId: targetBoardId,
          searchType: searchData.searchType,
        });

        if (searchData.query) params.append("query", searchData.query);
        if (searchData.userId) params.append("userId", searchData.userId);
        if (searchData.uploaderName)
          params.append("uploaderName", searchData.uploaderName);
        if (searchData.dateFrom) params.append("dateFrom", searchData.dateFrom);
        if (searchData.dateTo) params.append("dateTo", searchData.dateTo);
        if (searchData.itemTypes.length > 0) {
          params.append("itemTypes", searchData.itemTypes.join(","));
        }

        const response = await fetch(`/api/search?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "検索に失敗しました。");
        }

        if (data.success) {
          const normalizedResults = normalizeSearchResults(data.results);
          setSearchResults(normalizedResults);
          setRestrictedCount(data.restrictedCount ?? 0);
        } else {
          throw new Error(data.message || "検索結果の取得に失敗しました。");
        }
      } catch (error) {
        console.error("Search error:", error);
        setError(
          error instanceof Error
            ? error.message
            : "検索中にエラーが発生しました。",
        );
        setSearchResults(null);
        setRestrictedCount(0);
      } finally {
        setIsSearching(false);
      }
    },
    [selectedBoard],
  );

  // URLパラメータから初期検索条件を取得
  useEffect(() => {
    const boardId = searchParams.get("boardId");
    const initialQuery = searchParams.get("q");

    if (boardId && initialQuery) {
      // URLパラメータから検索実行
      performSearch(
        {
          query: initialQuery,
          userId: "",
          uploaderName: "",
          searchType: "general",
          dateFrom: "",
          dateTo: "",
          itemTypes: [],
        },
        boardId,
      );
      setSearchQuery(initialQuery);
    }
  }, [searchParams, performSearch]);

  const handleSearch = (searchData: SearchFormData) => {
    performSearch(searchData);
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
    setError(null);
    setRestrictedCount(0);
  };

  const handleItemClick = (item: SearchResultItem) => {
    if (!selectedBoard) return;

    // Miroボードで該当アイテムを表示（新しいタブで開く）
    const boardUrl = `https://miro.com/app/board/${selectedBoard.id}/`;
    const itemUrl = `${boardUrl}?moveToWidget=${item.id}`;
    window.open(itemUrl, "_blank", "noopener,noreferrer");
  };

  const handleLoadMore = async () => {
    // 追加読み込み機能（実装例）
    setIsLoadingMore(true);
    // TODO: 追加の検索結果を取得するAPI実装
    setTimeout(() => {
      setIsLoadingMore(false);
    }, 1000);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* ページヘッダー */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ボード内検索
            </h1>
            <p className="text-gray-600">
              Miroボード内の画像、付箋、グループを検索できます。
            </p>
          </div>
        </div>

        {/* ボード選択 */}
        <div className="mb-6">
          <BoardSelector
            onBoardSelect={setSelectedBoard}
            selectedBoardId={selectedBoard?.id}
            className="bg-white"
          />
        </div>

        {/* ログイン推奨バナー */}
        {!authLoading && !authStatus.isLoggedIn && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <button
                    onClick={() => router.push("/login")}
                    className="font-medium underline hover:text-yellow-800"
                  >
                    ログイン
                  </button>
                  すると、検索履歴が記録され、よりパーソナライズされた結果が表示されます。
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedBoard && (
          <div className="space-y-6">
            {/* 検索フォーム */}
            <SearchForm
              onSearch={handleSearch}
              onClear={handleClearSearch}
              isLoading={isSearching}
            />

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-red-400 mr-2"
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
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              </div>
            )}

            {/* 検索結果統計 */}
            {searchResults && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-blue-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 002 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 002 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-blue-800">
                      検索統計
                    </span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-700">
                  {(() => {
                    const stats = getSearchStats(searchResults);
                    return (
                      <>
                        <div>画像: {stats.totalImages}件</div>
                        <div>付箋: {stats.totalStickyNotes}件</div>
                        <div>グループ: {stats.totalGroups}件</div>
                        <div>ユーザー: {stats.userCounts.size}名</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {restrictedCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                権限のない問題に紐付くアイテム {restrictedCount}{" "}
                件を結果から除外しました。
              </div>
            )}

            {/* 検索結果 */}
            {searchResults && (
              <SearchResults
                results={searchResults}
                searchQuery={searchQuery}
                onItemClick={handleItemClick}
                onLoadMore={searchResults.hasMore ? handleLoadMore : undefined}
                isLoading={isLoadingMore}
              />
            )}

            {/* 検索実行前のヒント */}
            {!searchResults && !isSearching && !error && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  検索を開始してください
                </h3>
                <p className="text-gray-600 mb-4">
                  上記の検索フォームで条件を入力して、ボード内のアイテムを検索できます。
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• キーワード検索で付箋の内容から検索</p>
                  <p>• 個人ID検索で特定の個人IDの画像を抽出</p>
                  <p>• 送信者検索でアップロード者別に絞り込み</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ボード未選択時のメッセージ */}
        {!selectedBoard && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <div className="text-yellow-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.82 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ボードを選択してください
            </h3>
            <p className="text-gray-600">
              検索を実行するには、まず対象となるMiroボードを選択する必要があります。
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function normalizeSearchResults(results: SearchResult): SearchResult {
  return {
    ...results,
    items: results.items.map((item) => ({
      ...item,
      metadata: item.metadata
        ? {
            ...item.metadata,
            uploadedAt: item.metadata.uploadedAt
              ? new Date(item.metadata.uploadedAt)
              : undefined,
          }
        : undefined,
    })),
  };
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useDeviceDetection } from "@/utils/deviceDetection";

interface BoardEmbedProps {
  boardId: string;
  boardName?: string;
  viewMode?: "embed" | "link" | "both";
  width?: string | number;
  height?: string | number;
  className?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

interface BoardEmbedRef {
  refresh: () => void;
}

export const BoardEmbed = forwardRef<BoardEmbedRef, BoardEmbedProps>(
  (
    {
      boardId,
      boardName,
      viewMode = "embed",
      width = "100%",
      height = 600,
      className = "",
      onLoad,
      onError,
    },
    ref,
  ) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [embedUrl, setEmbedUrl] = useState<string>("");
    const [refreshKey, setRefreshKey] = useState<number>(Date.now());
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isStorageAvailable, setIsStorageAvailable] = useState(true);
    const deviceInfo = useDeviceDetection();

    const generateEmbedUrl = useCallback(() => {
      try {
        // Miroの埋め込みURL生成（キャッシュバスティング付き）
        const baseUrl = "https://miro.com/app/live-embed";
        const params = new URLSearchParams({
          uiMode: "viewonly",
          autoplay: "true",
          embedMode: "view_only_without_ui",
          _t: refreshKey.toString(), // キャッシュバスティング用タイムスタンプ
        });

        const url = `${baseUrl}/${boardId}/?${params.toString()}`;
        setEmbedUrl(url);
      } catch (_error) {
        const errorMsg = "ボードの埋め込みURLの生成に失敗しました。";
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }, [boardId, refreshKey, onError]);

    useEffect(() => {
      if (boardId) {
        generateEmbedUrl();
      }
    }, [boardId, generateEmbedUrl]);

    useEffect(() => {
      if (typeof window === "undefined") return;

      try {
        const testKey = "__miro_embed_storage_probe__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        setIsStorageAvailable(true);
      } catch (_error) {
        setIsStorageAvailable(false);
      }
    }, []);

    const handleIframeLoad = () => {
      setIsLoading(false);
      onLoad?.();
    };

    const handleIframeError = () => {
      const errorMsg = "ボードの読み込みに失敗しました。";
      setError(errorMsg);
      setIsLoading(false);
      onError?.(errorMsg);
    };

    const openInNewTab = () => {
      const url = `https://miro.com/app/board/${boardId}/`;
      window.open(url, "_blank", "noopener,noreferrer");
    };

    const getBoardShareUrl = () => {
      return `https://miro.com/app/board/${boardId}/`;
    };

    const copyBoardUrl = async () => {
      try {
        await navigator.clipboard.writeText(getBoardShareUrl());
        // TODO: トースト通知を表示
        alert("ボードのURLをコピーしました！");
      } catch (_error) {
        alert("URLのコピーに失敗しました。");
      }
    };

    const refreshBoard = useCallback(() => {
      setIsLoading(true);
      setError(null);
      setRefreshKey(Date.now());
    }, []);

    // 外部からリフレッシュ機能を呼び出せるようにする
    useImperativeHandle(
      ref,
      () => ({
        refresh: refreshBoard,
      }),
      [refreshBoard],
    );

    if (error) {
      return (
        <div className={`${className}`}>
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-red-500 mb-4">
              <svg
                className="w-12 h-12"
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
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ボードの表示エラー
            </h3>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <div className="flex space-x-2">
              <button
                onClick={openInNewTab}
                type="button"
                className="btn-primary"
              >
                新しいタブで開く
              </button>
              <button
                onClick={copyBoardUrl}
                type="button"
                className="btn-outline"
              >
                URLをコピー
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${className}`}>
        {/* ボード情報ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {boardName || "Miroボード"}
            </h3>
            <p className="text-sm text-gray-500">ボードID: {boardId}</p>
          </div>

          <div className="flex space-x-2">
            {/* リフレッシュボタン */}
            <button
              onClick={refreshBoard}
              type="button"
              className="btn-outline text-sm"
              title="ボードを更新"
              disabled={isLoading}
            >
              <svg
                className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isLoading ? "更新中..." : "ボード更新"}
            </button>

            {/* フルスクリーンで開く */}
            <button
              onClick={openInNewTab}
              type="button"
              className="btn-outline text-sm"
              title="新しいタブで開く"
            >
              <svg
                className="w-4 h-4 mr-1"
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
              新しいタブで開く
            </button>

            {/* URLコピー */}
            <button
              onClick={copyBoardUrl}
              type="button"
              className="btn-outline text-sm"
              title="URLをコピー"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              URLコピー
            </button>
          </div>
        </div>

        {/* 埋め込み表示 */}
        {(viewMode === "embed" || viewMode === "both") &&
          embedUrl &&
          isStorageAvailable && (
            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">ボードを読み込み中...</p>
                  </div>
                </div>
              )}

              <iframe
                ref={iframeRef}
                src={embedUrl}
                width={width}
                height={height}
                style={{ border: 0 }}
                allowFullScreen
                allow="fullscreen clipboard-write"
                referrerPolicy="origin-when-cross-origin"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                className={`
              border border-gray-300 rounded-lg shadow-sm overflow-hidden
              ${deviceInfo?.type === "mobile" ? "min-h-[400px]" : ""}
            `}
                title={`Miro Board - ${boardName || boardId}`}
              />
            </div>
          )}
        {(viewMode === "embed" || viewMode === "both") &&
          !isStorageAvailable && (
            <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 space-y-2">
              <p className="font-medium">
                ブラウザの設定によりボードを埋め込み表示できません。
              </p>
              <p>
                サードパーティ Cookie / ローカルストレージの制限を解除するか、
                下の「新しいタブで開く」ボタンから直接Miroを開いてください。
              </p>
            </div>
          )}

        {/* リンク表示のみ */}
        {viewMode === "link" && (
          <div className="card p-6 text-center">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-blue-500"
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
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Miroボードを表示
            </h4>
            <p className="text-gray-600 mb-4">
              ボードを新しいタブで開いて確認できます
            </p>
            <button onClick={openInNewTab} className="btn-primary">
              ボードを開く
            </button>
          </div>
        )}

        {/* レスポンシブ対応の注意事項 */}
        {deviceInfo?.type === "mobile" && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-400 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm text-blue-800">
                  <strong>モバイル表示について:</strong>
                  <br />
                  最適な表示のため、「新しいタブで開く」をご利用ください。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

BoardEmbed.displayName = "BoardEmbed";

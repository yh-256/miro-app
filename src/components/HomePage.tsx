"use client";

import { useRouter } from "next/navigation";
import { ResponsiveContainer, FlexContainer } from "./ResponsiveContainer";
import { useDeviceDetection } from "@/utils/deviceDetection";

export function HomePage() {
  const router = useRouter();
  const deviceInfo = useDeviceDetection();

  const navigateToUpload = () => {
    router.push("/upload");
  };

  const navigateToBoard = () => {
    router.push("/board");
  };

  const navigateToSearch = () => {
    router.push("/search");
  };

  return (
    <ResponsiveContainer maxWidth="md" padding="lg">
      <FlexContainer
        direction="col"
        align="center"
        gap="lg"
        className="min-h-[60vh] justify-center"
      >
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Miro Image Upload
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            スマートフォンで撮影した画像を簡単にMiroボードにアップロードできます
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <button
            onClick={navigateToUpload}
            type="button"
            className="w-full btn-primary text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              画像アップロード
            </div>
            <p className="text-sm mt-1 opacity-90">
              写真を撮影してMiroボードに送信
            </p>
          </button>

          <button
            onClick={navigateToBoard}
            type="button"
            className="w-full btn-outline text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              ボード表示
            </div>
            <p className="text-sm mt-1 opacity-90">Miroボードを表示・確認</p>
          </button>

          <button
            onClick={navigateToSearch}
            type="button"
            className="w-full btn-outline text-lg py-4 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              ボード内検索
            </div>
            <p className="text-sm mt-1 opacity-90">画像・付箋・個人IDを検索</p>
          </button>

          {process.env.NODE_ENV === "development" && deviceInfo && (
            <div className="text-xs text-gray-500 text-center">
              {deviceInfo.type} | {deviceInfo.screenWidth}×
              {deviceInfo.screenHeight}
            </div>
          )}
        </div>
      </FlexContainer>
    </ResponsiveContainer>
  );
}

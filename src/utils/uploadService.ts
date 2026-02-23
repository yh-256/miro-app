"use client";

import { UploadResponse } from "@/types";

/**
 * フロントエンド用アップロードサービス
 */

interface ImageUploadData {
  file: File;
  userId?: string; // ログイン時に入力したユーザーID
  userDbId?: string; // サーバー上のUser.id（任意）
  userDisplayName?: string;
  uploaderName?: string;
}

interface UploadProgressCallback {
  (step: string, progress: number, message?: string): void;
}

/**
 * ファイルをBase64に変換
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 画像をMiroボードにアップロード
 */
type UploadOptions =
  | UploadProgressCallback
  | {
      onProgress?: UploadProgressCallback;
      problemId?: string;
    };

export async function uploadImagesToMiro(
  images: ImageUploadData[],
  boardId: string,
  sessionId: string,
  options?: UploadOptions,
): Promise<UploadResponse> {
  let onProgress: UploadProgressCallback | undefined;
  let problemId: string | undefined;

  if (typeof options === "function") {
    onProgress = options;
  } else if (options) {
    onProgress = options.onProgress;
    problemId = options.problemId;
  }

  try {
    onProgress?.("validating", 0, "ファイルを検証しています...");

    // 1. 画像をBase64に変換
    const imageData = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      onProgress?.(
        "validating",
        ((i + 1) / images.length) * 100,
        `${i + 1}/${images.length} ファイルを処理中...`,
      );

      const base64Data = await fileToBase64(image.file);
      imageData.push({
        name: image.file.name,
        data: base64Data,
        type: image.file.type,
      });
    }

    onProgress?.("uploading", 0, "アップロードを開始しています...");

    // 2. APIに送信
    const requestBody = {
      images: imageData,
      boardId,
      problemId,
      metadata: images.map((image) => ({
        userId: image.userDbId,
        userLoginId: image.userId,
        userDisplayName: image.userDisplayName ?? image.uploaderName,
        uploaderName: image.uploaderName,
        sessionId,
      })),
    };

    const response = await fetch("/api/upload/images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: UploadResponse = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "アップロードに失敗しました。");
    }

    onProgress?.("completed", 100, "アップロードが完了しました！");
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラーが発生しました。";
    onProgress?.("error", 0, errorMessage);
    throw error;
  }
}

/**
 * アップロードセッションIDを生成
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

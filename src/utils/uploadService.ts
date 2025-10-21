'use client';

import { UploadResponse } from '@/types';

/**
 * フロントエンド用アップロードサービス
 */

export interface ImageUploadData {
  file: File;
  userId: string;
  userDisplayName?: string;
  uploaderName?: string;
}

export interface UploadProgressCallback {
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
  options?: UploadOptions
): Promise<UploadResponse> {
  let onProgress: UploadProgressCallback | undefined;
  let problemId: string | undefined;

  if (typeof options === 'function') {
    onProgress = options;
  } else if (options) {
    onProgress = options.onProgress;
    problemId = options.problemId;
  }

  try {
    onProgress?.('validating', 0, 'ファイルを検証しています...');

    // 1. 画像をBase64に変換
    const imageData = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      onProgress?.('validating', ((i + 1) / images.length) * 100, `${i + 1}/${images.length} ファイルを処理中...`);
      
      const base64Data = await fileToBase64(image.file);
      imageData.push({
        name: image.file.name,
        data: base64Data,
        type: image.file.type,
      });
    }

    onProgress?.('uploading', 0, 'アップロードを開始しています...');

    // 2. APIに送信
    const requestBody = {
      images: imageData,
      boardId,
      problemId,
      metadata: images.map(image => ({
        userId: image.userId,
        userDisplayName: image.userDisplayName ?? image.uploaderName,
        uploaderName: image.uploaderName,
        sessionId,
      })),
    };

    const response = await fetch('/api/upload/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result: UploadResponse = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'アップロードに失敗しました。');
    }

    onProgress?.('completed', 100, 'アップロードが完了しました！');
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    onProgress?.('error', 0, errorMessage);
    throw error;
  }
}

/**
 * アップロードセッションIDを生成
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ファイルサイズの合計を計算
 */
export function calculateTotalSize(files: File[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

/**
 * ファイルサイズを人間が読める形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * アップロード可能かチェック
 */
export function canUpload(
  images: ImageUploadData[],
  boardId: string
): { canUpload: boolean; reason?: string } {
  if (images.length === 0) {
    return { canUpload: false, reason: '画像が選択されていません。' };
  }

  if (!boardId) {
    return { canUpload: false, reason: 'ボードが選択されていません。' };
  }

  const missingUsers = images.filter(img => !img.userId);
  if (missingUsers.length > 0) {
    return { canUpload: false, reason: 'ユーザーIDを特定できない画像があります。' };
  }

  return { canUpload: true };
}

/**
 * エラー時のリトライ処理
 */
export async function retryUpload<T>(
  uploadFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (i < maxRetries - 1) {
        // 最後の試行でなければ待機
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError!;
}

/**
 * アップロード状況の検証
 */
export function validateUploadResult(result: UploadResponse, expectedCount: number): boolean {
  if (!result.success) {
    return false;
  }

  if (result.uploadedItems.length !== expectedCount) {
    return false;
  }

  // 各アイテムが必要なIDを持っているかチェック
  return result.uploadedItems.every(item => 
    item.imageId && item.stickyNoteId && item.groupId
  );
}

/**
 * アップロード統計情報
 */
export interface UploadStats {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  largestFile: File | null;
  smallestFile: File | null;
}

export function calculateUploadStats(files: File[]): UploadStats {
  if (files.length === 0) {
    return {
      totalFiles: 0,
      totalSize: 0,
      averageFileSize: 0,
      largestFile: null,
      smallestFile: null,
    };
  }

  const totalSize = calculateTotalSize(files);
  const sorted = [...files].sort((a, b) => a.size - b.size);

  return {
    totalFiles: files.length,
    totalSize,
    averageFileSize: totalSize / files.length,
    largestFile: sorted[sorted.length - 1],
    smallestFile: sorted[0],
  };
}

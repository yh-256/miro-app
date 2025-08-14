/**
 * フロントエンド用設定定数
 */

export const CLIENT_CONFIG = {
  upload: {
    maxFileSize: 6000000, // 6MB in bytes
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as string[],
    maxFiles: 20, // 一度にアップロードできる最大ファイル数
  },
} as const;

/**
 * ファイルサイズを人間が読める形式に変換
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * ファイルがアップロード可能かチェック
 */
export function validateFile(file: File): { isValid: boolean; reason?: string } {
  // ファイルサイズチェック
  if (file.size > CLIENT_CONFIG.upload.maxFileSize) {
    return {
      isValid: false,
      reason: `ファイルサイズが上限 (${formatBytes(CLIENT_CONFIG.upload.maxFileSize)}) を超えています。 (実際のサイズ: ${formatBytes(file.size)})`
    };
  }

  // ファイルタイプチェック
  if (!CLIENT_CONFIG.upload.allowedFileTypes.includes(file.type)) {
    return {
      isValid: false,
      reason: `許可されていないファイル形式です: ${file.type}`
    };
  }

  return { isValid: true };
}
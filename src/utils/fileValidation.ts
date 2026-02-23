import { CLIENT_CONFIG } from "./clientConfig";

/**
 * ファイル検証の結果
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  file?: File;
}

/**
 * ファイル形式の検証
 */
export function validateFileType(file: File): boolean {
  return CLIENT_CONFIG.upload.allowedFileTypes.includes(file.type);
}

/**
 * ファイルサイズの検証
 */
export function validateFileSize(file: File): boolean {
  return file.size <= CLIENT_CONFIG.upload.maxFileSize;
}

/**
 * ファイル名の検証
 */
export function validateFileName(fileName: string): boolean {
  // 危険な文字をチェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(fileName)) {
    return false;
  }

  // ファイル名の長さチェック
  if (fileName.length > 255) {
    return false;
  }

  return true;
}

/**
 * 画像ファイルの検証（Magic Numberチェック）
 */
export function validateImageFile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        resolve(false);
        return;
      }

      const buffer = new Uint8Array(e.target.result as ArrayBuffer);

      // Magic Number による実際のファイル形式チェック
      const isJPEG =
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPNG =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isGIF =
        buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
      const isWebP =
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;

      resolve(isJPEG || isPNG || isGIF || isWebP);
    };

    reader.onerror = () => resolve(false);

    // 最初の12バイトのみ読み取り
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

/**
 * 単一ファイルの完全検証
 */
export async function validateSingleFile(
  file: File,
): Promise<FileValidationResult> {
  // ファイル存在チェック
  if (!file) {
    return { isValid: false, error: "ファイルが選択されていません。" };
  }

  // ファイル名検証
  if (!validateFileName(file.name)) {
    return {
      isValid: false,
      error: "ファイル名に無効な文字が含まれています。",
    };
  }

  // ファイルサイズ検証
  if (!validateFileSize(file)) {
    const maxSizeMB = Math.round(
      CLIENT_CONFIG.upload.maxFileSize / 1024 / 1024,
    );
    return {
      isValid: false,
      error: `ファイルサイズが${maxSizeMB}MBを超えています。`,
    };
  }

  // MIME type検証
  if (!validateFileType(file)) {
    const allowedTypes = CLIENT_CONFIG.upload.allowedFileTypes
      .map((type: string) => type.split("/")[1].toUpperCase())
      .join("、");
    return {
      isValid: false,
      error: `サポートされていないファイル形式です。対応形式: ${allowedTypes}`,
    };
  }

  // Magic Number検証
  const isValidImage = await validateImageFile(file);
  if (!isValidImage) {
    return {
      isValid: false,
      error: "ファイルが破損しているか、実際の形式が異なります。",
    };
  }

  return { isValid: true, file };
}

/**
 * 複数ファイルの検証
 */
export async function validateMultipleFiles(files: File[]): Promise<{
  validFiles: File[];
  invalidFiles: { file: File; error: string }[];
}> {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; error: string }[] = [];

  for (const file of files) {
    const result = await validateSingleFile(file);
    if (result.isValid && result.file) {
      validFiles.push(result.file);
    } else {
      invalidFiles.push({ file, error: result.error || "不明なエラー" });
    }
  }

  return { validFiles, invalidFiles };
}

/**
 * FileListからFileの配列に変換
 */
export function fileListToArray(fileList: FileList): File[] {
  return Array.from(fileList);
}

/**
 * 画像ファイルのプレビューURL生成
 */
export function createFilePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * プレビューURLのクリーンアップ
 */
export function revokeFilePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

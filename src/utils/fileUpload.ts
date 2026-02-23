import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { config } from "./config";
import { logError } from "./errorHandler";

/**
 * 一時ファイル管理ユーティリティ
 */

export interface TempFileInfo {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
  uploadedAt: Date;
}

/**
 * 一時ディレクトリのパス取得
 */
function getTempDir(): string {
  // Vercelでは /tmp を使用
  return process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "temp");
}

/**
 * 一時ファイル名生成
 */
function generateTempFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalName);
  return `upload_${timestamp}_${random}${ext}`;
}

/**
 * 一時ディレクトリの確保
 */
async function ensureTempDir(): Promise<void> {
  const tempDir = getTempDir();

  try {
    await fs.access(tempDir);
  } catch (_error) {
    // ディレクトリが存在しない場合は作成
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (mkdirError) {
      logError(mkdirError as Error, "ensureTempDir");
      throw new Error("一時ディレクトリの作成に失敗しました。");
    }
  }
}

/**
 * ファイルを一時ディレクトリに保存
 */
export async function saveTempFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
): Promise<TempFileInfo> {
  await ensureTempDir();

  const filename = generateTempFilename(originalName);
  const filePath = path.join(getTempDir(), filename);

  try {
    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);

    return {
      filename,
      originalName,
      path: filePath,
      size: stats.size,
      mimetype,
      uploadedAt: new Date(),
    };
  } catch (error) {
    logError(error as Error, "saveTempFile");
    throw new Error("ファイルの保存に失敗しました。");
  }
}

/**
 * 一時ファイルを削除
 */
async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // ファイルが存在しない場合はエラーにしない
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logError(error as Error, "deleteTempFile");
    }
  }
}

/**
 * 複数の一時ファイルを削除
 */
export async function deleteTempFiles(filePaths: string[]): Promise<void> {
  await Promise.all(filePaths.map((filePath) => deleteTempFile(filePath)));
}

/**
 * ファイルサイズを人間が読める形式に変換
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * ファイルアップロードに関するカスタムエラー
 */
export class FileUploadError extends Error {
  constructor(
    message: string,
    public readonly fileName: string,
    public readonly reason: "FILE_TOO_LARGE" | "INVALID_TYPE" | "OTHER",
  ) {
    super(message);
    this.name = "FileUploadError";
  }
}

/**
 * ファイル情報の検証
 */
export function validateFileInfo(fileInfo: TempFileInfo): void {
  // ファイルサイズチェック
  if (fileInfo.size > config.upload.maxFileSize) {
    throw new FileUploadError(
      `ファイルサイズが上限 (${formatBytes(config.upload.maxFileSize)}) を超えています。`,
      fileInfo.originalName,
      "FILE_TOO_LARGE",
    );
  }

  // MIMEタイプチェック
  if (!config.upload.allowedFileTypes.includes(fileInfo.mimetype)) {
    throw new FileUploadError(
      `許可されていないファイル形式です: ${fileInfo.mimetype}`,
      fileInfo.originalName,
      "INVALID_TYPE",
    );
  }

  // ファイル名の妥当性チェック
  if (fileInfo.filename.length === 0 || fileInfo.originalName.length === 0) {
    throw new FileUploadError(
      "ファイル名が無効です。",
      fileInfo.originalName,
      "OTHER",
    );
  }
}

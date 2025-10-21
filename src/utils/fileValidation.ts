import { CLIENT_CONFIG } from './clientConfig';
import { ValidationNotifications } from './notificationService';

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
      const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
      const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

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
export async function validateSingleFile(file: File): Promise<FileValidationResult> {
  // ファイル存在チェック
  if (!file) {
    return { isValid: false, error: 'ファイルが選択されていません。' };
  }

  // ファイル名検証
  if (!validateFileName(file.name)) {
    return { isValid: false, error: 'ファイル名に無効な文字が含まれています。' };
  }

  // ファイルサイズ検証
  if (!validateFileSize(file)) {
    const maxSizeMB = Math.round(CLIENT_CONFIG.upload.maxFileSize / 1024 / 1024);
    return { isValid: false, error: `ファイルサイズが${maxSizeMB}MBを超えています。` };
  }

  // MIME type検証
  if (!validateFileType(file)) {
    const allowedTypes = CLIENT_CONFIG.upload.allowedFileTypes
      .map((type: string) => type.split('/')[1].toUpperCase())
      .join('、');
    return { 
      isValid: false, 
      error: `サポートされていないファイル形式です。対応形式: ${allowedTypes}` 
    };
  }

  // Magic Number検証
  const isValidImage = await validateImageFile(file);
  if (!isValidImage) {
    return { isValid: false, error: 'ファイルが破損しているか、実際の形式が異なります。' };
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
      invalidFiles.push({ file, error: result.error || '不明なエラー' });
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
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * ファイルの詳細情報を取得
 */
export function getFileInfo(file: File) {
  return {
    name: file.name,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    type: file.type,
    lastModified: new Date(file.lastModified),
    extension: file.name.split('.').pop()?.toLowerCase() || '',
  };
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

/**
 * セキュリティ強化されたファイル検証
 */
export interface SecurityValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * ファイル拡張子の二重チェック
 */
export function validateFileExtensionConsistency(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  // MIME type と拡張子の整合性チェック
  const mimeExtensionMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
  };

  if (!extension || !mimeExtensionMap[file.type]) {
    return false;
  }

  return mimeExtensionMap[file.type].includes(extension);
}

/**
 * 悪意のあるファイル名パターンの検出
 */
export function detectMaliciousFileName(fileName: string): string[] {
  const warnings: string[] = [];
  
  // 実行可能ファイル拡張子のチェック
  const executableExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'msi', 'dll', 'sh', 'ps1', 'py', 'pl', 'php'
  ];
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && executableExtensions.includes(extension)) {
    warnings.push('実行可能ファイルの拡張子が含まれています');
  }

  // 隠しファイルパターンのチェック
  if (fileName.startsWith('.') || fileName.includes('/.')) {
    warnings.push('隠しファイルパターンが検出されました');
  }

  // パストラバーサル攻撃のチェック
  if (fileName.includes('../') || fileName.includes('..\\')) {
    warnings.push('パストラバーサルパターンが検出されました');
  }

  // NULL文字のチェック
  if (fileName.includes('\0')) {
    warnings.push('NULL文字が含まれています');
  }

  // 異常に長いファイル名
  if (fileName.length > 100) {
    warnings.push('ファイル名が異常に長いです');
  }

  return warnings;
}

/**
 * ファイル内容の基本的なセキュリティスキャン
 */
export async function scanFileContent(file: File): Promise<SecurityValidationResult> {
  const result: SecurityValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    riskLevel: 'low',
  };

  try {
    // ファイル名の検証
    const nameWarnings = detectMaliciousFileName(file.name);
    result.warnings.push(...nameWarnings);

    // 拡張子整合性チェック
    if (!validateFileExtensionConsistency(file)) {
      result.errors.push('ファイル拡張子とMIMEタイプが一致しません');
      result.riskLevel = 'high';
    }

    // ファイルサイズ異常チェック
    if (file.size === 0) {
      result.errors.push('ファイルサイズが0バイトです');
      result.riskLevel = 'medium';
    }

    // 異常に大きなファイルのチェック
    if (file.size > CLIENT_CONFIG.upload.maxFileSize * 2) {
      result.warnings.push('ファイルサイズが通常より大きいです');
      result.riskLevel = 'medium';
    }

    // Magic numberの詳細チェック
    const buffer = await readFileHeader(file, 32);
    const headerWarnings = analyzeFileHeader(buffer, file.type);
    result.warnings.push(...headerWarnings);

    // リスクレベルの最終判定
    if (result.errors.length > 0) {
      result.isValid = false;
      result.riskLevel = 'high';
    } else if (result.warnings.length > 2) {
      result.riskLevel = 'medium';
    }

  } catch (_error) {
    result.errors.push('ファイル解析中にエラーが発生しました');
    result.isValid = false;
    result.riskLevel = 'high';
  }

  return result;
}

/**
 * ファイルヘッダーの読み取り
 */
async function readFileHeader(file: File, bytes: number = 32): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(new Uint8Array(e.target.result as ArrayBuffer));
      } else {
        reject(new Error('Failed to read file header'));
      }
    };
    
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

/**
 * ファイルヘッダーの解析
 */
function analyzeFileHeader(buffer: Uint8Array, mimeType: string): string[] {
  const warnings: string[] = [];

  // EXIF データの存在チェック（JPEG）
  if (mimeType === 'image/jpeg') {
    // EXIF マーカー (0xFFE1) の確認
    for (let i = 0; i < Math.min(buffer.length - 1, 20); i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xE1) {
        warnings.push('EXIFデータが含まれている可能性があります（位置情報等）');
        break;
      }
    }
  }

  // PNG チャンクの基本検証
  if (mimeType === 'image/png') {
    if (buffer.length >= 8) {
      const isPngSignature = 
        buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A &&
        buffer[6] === 0x1A && buffer[7] === 0x0A;
      
      if (!isPngSignature) {
        warnings.push('PNG署名が正しくありません');
      }
    }
  }

  return warnings;
}

/**
 * 通知統合された包括的ファイル検証
 */
export async function validateFilesWithNotification(
  files: File[],
  showNotifications: boolean = true
): Promise<{
  validFiles: File[];
  invalidFiles: { file: File; error: string; riskLevel?: string }[];
  hasSecurityWarnings: boolean;
}> {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; error: string; riskLevel?: string }[] = [];
  let hasSecurityWarnings = false;

  for (const file of files) {
    try {
      // 基本検証
      const basicValidation = await validateSingleFile(file);
      
      // セキュリティ検証
      const securityValidation = await scanFileContent(file);
      
      if (!basicValidation.isValid) {
        invalidFiles.push({ 
          file, 
          error: basicValidation.error || '検証に失敗しました',
          riskLevel: 'medium'
        });
        
        if (showNotifications) {
          ValidationNotifications.invalidFileFormat(['JPEG', 'PNG', 'GIF']);
        }
        continue;
      }

      if (!securityValidation.isValid) {
        invalidFiles.push({ 
          file, 
          error: securityValidation.errors.join(', '),
          riskLevel: securityValidation.riskLevel
        });
        
        if (showNotifications) {
          ValidationNotifications.invalidFileFormat(['安全なファイル']);
        }
        continue;
      }

      // セキュリティ警告がある場合
      if (securityValidation.warnings.length > 0) {
        hasSecurityWarnings = true;
        
        if (showNotifications && securityValidation.riskLevel === 'medium') {
          // 中程度のリスクの場合は警告を表示するが、ファイルは有効とする
          console.warn(`Security warnings for ${file.name}:`, securityValidation.warnings);
        }
      }

      validFiles.push(file);

    } catch (_error) {
      invalidFiles.push({ 
        file, 
        error: 'ファイル検証中にエラーが発生しました',
        riskLevel: 'high'
      });
    }
  }

  // 総合的な通知
  if (showNotifications) {
    if (validFiles.length > 0) {
      console.log(`${validFiles.length}件のファイルが検証を通過しました`);
    }
    
    if (invalidFiles.length > 0) {
      console.warn(`${invalidFiles.length}件のファイルが検証に失敗しました`);
    }
  }

  return { validFiles, invalidFiles, hasSecurityWarnings };
}

/**
 * ファイルアップロード前の最終チェック
 */
export async function performPreUploadValidation(
  files: File[]
): Promise<{ canUpload: boolean; message?: string }> {
  if (files.length === 0) {
    return { canUpload: false, message: 'アップロードするファイルを選択してください。' };
  }

  const maxFiles = 10; // 設定可能にする
  if (files.length > maxFiles) {
    return { 
      canUpload: false, 
      message: `一度にアップロードできるファイル数は${maxFiles}件までです。` 
    };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSize = CLIENT_CONFIG.upload.maxFileSize * files.length;
  
  if (totalSize > maxTotalSize) {
    const maxTotalSizeMB = Math.round(maxTotalSize / 1024 / 1024);
    return { 
      canUpload: false, 
      message: `選択したファイルの合計サイズが${maxTotalSizeMB}MBを超えています。` 
    };
  }

  return { canUpload: true };
}
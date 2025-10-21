import { ErrorHandler, logError } from './errorHandler';
import { UserFriendlyError } from '@/types';

/**
 * 通知サービス - エラーハンドリングとトースト通知を統合
 */

export interface NotificationService {
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
  handleMiroError: (error: unknown, context?: string) => void;
  handleUploadError: (error: unknown, context?: string) => void;
  handleSearchError: (error: unknown, context?: string) => void;
  handleGenericError: (error: unknown, context?: string) => void;
}

// グローバルな通知サービスインスタンス
let globalNotificationService: NotificationService | null = null;

/**
 * 通知サービスを初期化
 */
export function initializeNotificationService(service: NotificationService) {
  globalNotificationService = service;
}

/**
 * デフォルトの通知サービス（フォールバック）
 */
const defaultNotificationService: NotificationService = {
  showSuccess: (title, message) => {
    console.log(`✅ ${title}${message ? `: ${message}` : ''}`);
  },
  showError: (title, message) => {
    console.error(`❌ ${title}${message ? `: ${message}` : ''}`);
  },
  showWarning: (title, message) => {
    console.warn(`⚠️ ${title}${message ? `: ${message}` : ''}`);
  },
  showInfo: (title, message) => {
    console.info(`ℹ️ ${title}${message ? `: ${message}` : ''}`);
  },
  handleMiroError: (error, context) => {
    const userError = ErrorHandler.handleMiroApiError(error);
    console.error(`❌ Miro Error${context ? ` [${context}]` : ''}: ${userError.message}`);
  },
  handleUploadError: (error, context) => {
    const userError = ErrorHandler.handleFileUploadError(error);
    console.error(`❌ Upload Error${context ? ` [${context}]` : ''}: ${userError.message}`);
  },
  handleSearchError: (error, context) => {
    const userError = ErrorHandler.handleGenericError(error);
    console.error(`❌ Search Error${context ? ` [${context}]` : ''}: ${userError.message}`);
  },
  handleGenericError: (error, context) => {
    const userError = ErrorHandler.handleGenericError(error);
    console.error(`❌ Error${context ? ` [${context}]` : ''}: ${userError.message}`);
  },
};

/**
 * 通知サービスを取得
 */
function getNotificationService(): NotificationService {
  return globalNotificationService || defaultNotificationService;
}

/**
 * 成功通知の表示
 */
export function showSuccessNotification(title: string, message?: string, duration?: number) {
  getNotificationService().showSuccess(title, message, duration);
}

/**
 * エラー通知の表示
 */
export function showErrorNotification(title: string, message?: string, duration?: number) {
  getNotificationService().showError(title, message, duration);
}

/**
 * 警告通知の表示
 */
export function showWarningNotification(title: string, message?: string, duration?: number) {
  getNotificationService().showWarning(title, message, duration);
}

/**
 * 情報通知の表示
 */
export function showInfoNotification(title: string, message?: string, duration?: number) {
  getNotificationService().showInfo(title, message, duration);
}

/**
 * Miro APIエラーのハンドリングと通知
 */
export function handleAndNotifyMiroError(error: unknown, context?: string): UserFriendlyError {
  const userError = ErrorHandler.handleMiroApiError(error);
  logError(error instanceof Error ? error : new Error(String(error)), context);
  
  // エラータイプに応じて適切な通知を表示
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response: { status: number } }).response?.status;
    if (status === 401) {
      getNotificationService().showError(
        '認証エラー',
        userError.message,
        8000
      );
    } else if (status === 403) {
    getNotificationService().showError(
      'アクセス権限エラー',
      userError.message,
      8000
    );
    } else if (status === 404) {
      getNotificationService().showWarning(
        'リソースが見つかりません',
        userError.message,
        6000
      );
    } else if (status === 429) {
      getNotificationService().showWarning(
        'API制限に達しました',
        userError.message,
        8000
      );
    } else if (status >= 500) {
    getNotificationService().showError(
      'サーバーエラー',
      userError.message,
      8000
    );
  } else {
    getNotificationService().showError(
      'Miro APIエラー',
      userError.message,
      6000
    );
  }
  }
  
  return userError;
}

/**
 * ファイルアップロードエラーのハンドリングと通知
 */
export function handleAndNotifyUploadError(error: unknown, context?: string): UserFriendlyError {
  const userError = ErrorHandler.handleFileUploadError(error);
  logError(error instanceof Error ? error : new Error(String(error)), context);
  
  getNotificationService().showError(
    'アップロードエラー',
    userError.message,
    8000
  );
  
  return userError;
}

/**
 * 検索エラーのハンドリングと通知
 */
export function handleAndNotifySearchError(error: unknown, context?: string): UserFriendlyError {
  const userError = ErrorHandler.handleGenericError(error);
  logError(error instanceof Error ? error : new Error(String(error)), context);
  
  getNotificationService().showError(
    '検索エラー',
    userError.message,
    6000
  );
  
  return userError;
}

/**
 * 一般的なエラーのハンドリングと通知
 */
export function handleAndNotifyGenericError(error: unknown, context?: string): UserFriendlyError {
  const userError = ErrorHandler.handleGenericError(error);
  logError(error instanceof Error ? error : new Error(String(error)), context);
  
  getNotificationService().showError(
    'エラーが発生しました',
    userError.message,
    6000
  );
  
  return userError;
}

/**
 * Miro関連の成功通知
 */
export const MiroNotifications = {
  /**
   * 画像アップロード成功
   */
  uploadSuccess: (count: number, boardName?: string) => {
    const message = boardName 
      ? `${count}件の画像を「${boardName}」にアップロードしました。`
      : `${count}件の画像をMiroボードにアップロードしました。`;
    
    showSuccessNotification('アップロード完了', message, 6000);
  },

  /**
   * ボード読み込み成功
   */
  boardLoadSuccess: (boardName: string) => {
    showSuccessNotification(
      'ボード読み込み完了',
      `「${boardName}」を読み込みました。`,
      4000
    );
  },

  /**
   * 検索完了
   */
  searchSuccess: (count: number, query?: string) => {
    const message = query 
      ? `「${query}」で${count}件の結果が見つかりました。`
      : `${count}件の結果が見つかりました。`;
    
    showSuccessNotification('検索完了', message, 4000);
  },

  /**
   * ボード選択成功
   */
  boardSelected: (boardName: string) => {
    showInfoNotification(
      'ボードを選択しました',
      `「${boardName}」を選択しました。`,
      3000
    );
  },

  /**
   * データ保存成功
   */
  dataSaved: (type: string) => {
    showSuccessNotification(
      'データを保存しました',
      `${type}を正常に保存しました。`,
      3000
    );
  },
};

/**
 * バリデーション関連の通知
 */
export const ValidationNotifications = {
  /**
   * 必須フィールドエラー
   */
  requiredField: (fieldName: string) => {
    showWarningNotification(
      '入力が必要です',
      `${fieldName}を入力してください。`,
      4000
    );
  },

  /**
   * ファイル形式エラー
   */
  invalidFileFormat: (supportedFormats: string[]) => {
    showWarningNotification(
      'ファイル形式エラー',
      `サポートされている形式: ${supportedFormats.join(', ')}`,
      6000
    );
  },

  /**
   * ファイルサイズエラー
   */
  fileSizeError: (maxSize: string) => {
    showWarningNotification(
      'ファイルサイズエラー',
      `ファイルサイズは${maxSize}以下にしてください。`,
      6000
    );
  },
};

/**
 * プロセス関連の通知
 */
export const ProcessNotifications = {
  /**
   * 処理開始
   */
  started: (processName: string) => {
    showInfoNotification(
      `${processName}を開始しました`,
      '処理が完了するまでお待ちください。',
      3000
    );
  },

  /**
   * 処理完了
   */
  completed: (processName: string) => {
    showSuccessNotification(
      `${processName}が完了しました`,
      undefined,
      3000
    );
  },

  /**
   * 処理キャンセル
   */
  cancelled: (processName: string) => {
    showInfoNotification(
      `${processName}をキャンセルしました`,
      undefined,
      3000
    );
  },
};

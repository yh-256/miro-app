'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (title: string, message?: string, duration?: number) => {
    addToast({ type: 'success', title, message, duration });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    addToast({ 
      type: 'error', 
      title, 
      message, 
      duration: duration || 8000 // エラーは少し長めに表示
    });
  };

  const showWarning = (title: string, message?: string, duration?: number) => {
    addToast({ type: 'warning', title, message, duration });
  };

  const showInfo = (title: string, message?: string, duration?: number) => {
    addToast({ type: 'info', title, message, duration });
  };

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // アニメーション用のフラグ設定
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200);
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.82 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getToastStyles = (type: ToastType) => {
    const baseStyles = "rounded-lg shadow-lg border p-4 transition-all duration-200 transform";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-200`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-200`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-200`;
    }
  };

  const getTextStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return { title: 'text-green-800', message: 'text-green-700' };
      case 'error':
        return { title: 'text-red-800', message: 'text-red-700' };
      case 'warning':
        return { title: 'text-yellow-800', message: 'text-yellow-700' };
      case 'info':
        return { title: 'text-blue-800', message: 'text-blue-700' };
    }
  };

  const textStyles = getTextStyles(toast.type);

  return (
    <div
      className={`
        ${getToastStyles(toast.type)}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getToastIcon(toast.type)}
        </div>
        
        <div className="ml-3 w-0 flex-1">
          <p className={`text-sm font-medium ${textStyles.title}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className={`mt-1 text-sm ${textStyles.message}`}>
              {toast.message}
            </p>
          )}
        </div>

        {toast.dismissible && (
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleClose}
              type="button"
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition ease-in-out duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 便利な関数をエクスポート
export const toast = {
  success: (title: string, message?: string, _duration?: number) => {
    // ToastContextが利用できない場合の代替実装
    console.log(`✅ ${title}${message ? `: ${message}` : ''}`);
  },
  error: (title: string, message?: string, _duration?: number) => {
    console.error(`❌ ${title}${message ? `: ${message}` : ''}`);
  },
  warning: (title: string, message?: string, _duration?: number) => {
    console.warn(`⚠️ ${title}${message ? `: ${message}` : ''}`);
  },
  info: (title: string, message?: string, _duration?: number) => {
    console.info(`ℹ️ ${title}${message ? `: ${message}` : ''}`);
  },
};

// Miro API操作用の専用関数
export const miroToast = {
  uploadSuccess: (count: number) => {
    toast.success(
      'アップロード完了',
      `${count}件の画像をMiroボードにアップロードしました。`,
      6000
    );
  },
  uploadError: (error: string) => {
    toast.error(
      'アップロード失敗',
      error,
      8000
    );
  },
  searchSuccess: (count: number) => {
    toast.success(
      '検索完了',
      `${count}件の結果が見つかりました。`,
      4000
    );
  },
  searchError: (error: string) => {
    toast.error(
      '検索失敗',
      error,
      6000
    );
  },
  boardLoadSuccess: (boardName: string) => {
    toast.success(
      'ボード読み込み完了',
      `「${boardName}」を読み込みました。`,
      4000
    );
  },
  boardLoadError: (error: string) => {
    toast.error(
      'ボード読み込み失敗',
      error,
      6000
    );
  },
  authError: () => {
    toast.error(
      '認証エラー',
      'Miroへの認証に失敗しました。管理者にお問い合わせください。',
      8000
    );
  },
  rateLimitError: (retryAfter?: number) => {
    const message = retryAfter 
      ? `${retryAfter}秒後に再試行してください。`
      : 'しばらく待ってから再試行してください。';
    
    toast.warning(
      'API制限に達しました',
      message,
      8000
    );
  },
  networkError: () => {
    toast.error(
      'ネットワークエラー',
      'インターネット接続を確認してください。',
      6000
    );
  },
};

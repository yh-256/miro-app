"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";
import {
  initializeNotificationService,
  MiroNotifications,
  ValidationNotifications,
  ProcessNotifications,
  handleAndNotifyMiroError,
  handleAndNotifyUploadError,
  handleAndNotifySearchError,
  handleAndNotifyGenericError,
  // showErrorNotification,
  // showWarningNotification,
} from "@/utils/notificationService";
import { UserFriendlyError } from "@/types";

/**
 * 通知システムを統合するカスタムフック
 */
export function useNotifications() {
  const toast = useToast();

  // 通知サービスを初期化
  useEffect(() => {
    initializeNotificationService({
      showSuccess: toast.showSuccess,
      showError: toast.showError,
      showWarning: toast.showWarning,
      showInfo: toast.showInfo,
      handleMiroError: (error, context) => {
        handleAndNotifyMiroError(error, context);
      },
      handleUploadError: (error, context) => {
        handleAndNotifyUploadError(error, context);
      },
      handleSearchError: (error, context) => {
        handleAndNotifySearchError(error, context);
      },
      handleGenericError: (error, context) => {
        handleAndNotifyGenericError(error, context);
      },
    });
  }, [toast]);

  return {
    // 基本的な通知メソッド
    showSuccess: toast.showSuccess,
    showError: toast.showError,
    showWarning: toast.showWarning,
    showInfo: toast.showInfo,

    // エラーハンドリング統合メソッド
    handleMiroError: (error: unknown, context?: string): UserFriendlyError => {
      return handleAndNotifyMiroError(error, context);
    },

    handleUploadError: (
      error: unknown,
      context?: string,
    ): UserFriendlyError => {
      return handleAndNotifyUploadError(error, context);
    },

    handleSearchError: (
      error: unknown,
      context?: string,
    ): UserFriendlyError => {
      return handleAndNotifySearchError(error, context);
    },

    handleGenericError: (
      error: unknown,
      context?: string,
    ): UserFriendlyError => {
      return handleAndNotifyGenericError(error, context);
    },

    // 専用通知メソッド
    miro: {
      uploadSuccess: MiroNotifications.uploadSuccess,
      boardLoadSuccess: MiroNotifications.boardLoadSuccess,
      searchSuccess: MiroNotifications.searchSuccess,
      boardSelected: MiroNotifications.boardSelected,
      dataSaved: MiroNotifications.dataSaved,
    },

    validation: {
      requiredField: ValidationNotifications.requiredField,
      invalidFileFormat: ValidationNotifications.invalidFileFormat,
      fileSizeError: ValidationNotifications.fileSizeError,
    },

    process: {
      started: ProcessNotifications.started,
      completed: ProcessNotifications.completed,
      cancelled: ProcessNotifications.cancelled,
    },

    // 便利なラッパーメソッド
    success: (title: string, message?: string) => {
      toast.showSuccess(title, message);
    },

    error: (title: string, message?: string) => {
      toast.showError(title, message);
    },

    warning: (title: string, message?: string) => {
      toast.showWarning(title, message);
    },

    info: (title: string, message?: string) => {
      toast.showInfo(title, message);
    },

    // 非同期処理用のヘルパー
    withErrorHandling: async <T>(
      promise: Promise<T>,
      context?: string,
      successMessage?: string,
    ): Promise<T | null> => {
      try {
        const result = await promise;
        if (successMessage) {
          toast.showSuccess("処理完了", successMessage);
        }
        return result;
      } catch (error) {
        handleAndNotifyGenericError(error, context);
        return null;
      }
    },

    withMiroErrorHandling: async <T>(
      promise: Promise<T>,
      context?: string,
      successMessage?: string,
    ): Promise<T | null> => {
      try {
        const result = await promise;
        if (successMessage) {
          toast.showSuccess("処理完了", successMessage);
        }
        return result;
      } catch (error) {
        handleAndNotifyMiroError(error, context);
        return null;
      }
    },

    withUploadErrorHandling: async <T>(
      promise: Promise<T>,
      context?: string,
      successMessage?: string,
    ): Promise<T | null> => {
      try {
        const result = await promise;
        if (successMessage) {
          toast.showSuccess("アップロード完了", successMessage);
        }
        return result;
      } catch (error) {
        handleAndNotifyUploadError(error, context);
        return null;
      }
    },
  };
}

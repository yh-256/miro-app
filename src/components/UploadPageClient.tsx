'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ResponsiveContainer, FlexContainer } from '@/components/ResponsiveContainer';
import { ImageCapture } from '@/components/ImageCapture';
import { BoardSelector } from '@/components/BoardSelector';
import { UploadProgress, UPLOAD_STEPS } from '@/components/UploadProgress';
import { ProblemUploadSection } from '@/components/ProblemUploadSection';
import { ProgressStep, ProblemDetailResponse } from '@/types';
import { uploadImagesToMiro, generateSessionId } from '@/utils/uploadService';

interface AuthStatus {
  isLoggedIn: boolean;
  userId?: string;
  displayName?: string;
  role?: 'ADMIN' | 'USER';
}

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

type UploadStep = 'capture' | 'board' | 'upload';

interface UploadPageClientProps {
  problemIdFromQuery: string | null;
}

export function UploadPageClient({ problemIdFromQuery }: UploadPageClientProps) {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [problemDetail, setProblemDetail] = useState<ProblemDetailResponse | null>(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState<string | null>(null);

  // 認証状態を取得
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        setAuthStatus(data);
      } catch (error) {
        console.error('Failed to fetch auth status:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  const refreshProblemDetail = useCallback(async () => {
    if (!problemIdFromQuery) {
      setProblemDetail(null);
      setProblemError(null);
      return;
    }

    try {
      setProblemLoading(true);
      setProblemError(null);

      const response = await fetch(`/api/problems/${problemIdFromQuery}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || '問題情報の取得に失敗しました。');
      }
      const payload = (await response.json()) as ProblemDetailResponse;
      setProblemDetail(payload);
    } catch (error) {
      setProblemError(
        error instanceof Error ? error.message : '問題情報の取得に失敗しました。'
      );
    } finally {
      setProblemLoading(false);
    }
  }, [problemIdFromQuery]);

  useEffect(() => {
    if (problemIdFromQuery) {
      refreshProblemDetail();
    } else {
      setProblemDetail(null);
      setProblemError(null);
    }
  }, [problemIdFromQuery, refreshProblemDetail]);

  const [currentStep, setCurrentStep] = useState<UploadStep>('capture');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<ProgressStep[]>([
    { ...UPLOAD_STEPS.VALIDATING },
    { ...UPLOAD_STEPS.UPLOADING_IMAGES },
    { ...UPLOAD_STEPS.CREATING_NOTES },
    { ...UPLOAD_STEPS.GROUPING },
    { ...UPLOAD_STEPS.CLEANUP },
  ]);
  const [skippedFiles, setSkippedFiles] = useState<Array<{ fileName: string; reason: string }>>([]);
  const [sessionId, setSessionId] = useState(() => generateSessionId());

  const currentUserId = authStatus.isLoggedIn ? authStatus.userId ?? null : null;
  const currentUserDisplayName = authStatus.isLoggedIn
    ? authStatus.displayName ?? authStatus.userId ?? undefined
    : undefined;

  const canProceedFromCapture = selectedFiles.length > 0 && !!currentUserId;
  const canUpload = Boolean(selectedBoard) && canProceedFromCapture;

  const handleNext = () => {
    if (currentStep === 'capture') {
      if (!canProceedFromCapture) {
        if (!currentUserId) {
          alert('アップロードを行うにはログインが必要です。');
        } else if (selectedFiles.length === 0) {
          alert('アップロードする画像を選択してください。');
        }
        return;
      }
      setCurrentStep('board');
      return;
    }

    if (currentStep === 'board') {
      if (!selectedBoard) {
        alert('送信先のボードを選択してください。');
        return;
      }
      setCurrentStep('upload');
      handleUpload();
    }
  };

  const handleBack = () => {
    if (currentStep === 'board') {
      setCurrentStep('capture');
    } else if (currentStep === 'upload') {
      setCurrentStep('board');
    }
  };

  const handleUpload = async () => {
    if (!selectedBoard || !currentUserId || selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);

    setUploadSteps([
      { ...UPLOAD_STEPS.VALIDATING, status: 'in_progress' as const },
      { ...UPLOAD_STEPS.UPLOADING_IMAGES },
      { ...UPLOAD_STEPS.CREATING_NOTES },
      { ...UPLOAD_STEPS.GROUPING },
      { ...UPLOAD_STEPS.CLEANUP },
    ]);

    try {
      const uploadData = selectedFiles.map((file) => ({
        file,
        userId: currentUserId,
        userDisplayName: currentUserDisplayName,
        uploaderName: currentUserDisplayName,
      }));

      const updateProgress = (step: string, progress: number, message?: string) => {
        setUploadSteps((prev) =>
          prev.map((stepItem) => {
            switch (step) {
              case 'validating':
                if (stepItem.id === 'validating') {
                  return {
                    ...stepItem,
                    status: progress === 100 ? ('completed' as const) : ('in_progress' as const),
                    progress,
                    message: message || stepItem.message,
                  } as ProgressStep;
                }
                if (stepItem.id === 'uploading_images' && progress === 100) {
                  return { ...stepItem, status: 'in_progress' as const, progress: 0 } as ProgressStep;
                }
                break;
              case 'uploading':
                if (stepItem.id === 'uploading_images') {
                  return {
                    ...stepItem,
                    status: 'in_progress' as const,
                    progress,
                    message: message || stepItem.message,
                  } as ProgressStep;
                }
                break;
              case 'completed':
                if (stepItem.id === 'uploading_images') {
                  return {
                    ...stepItem,
                    status: 'completed' as const,
                    message: message || 'アップロード完了',
                  } as ProgressStep;
                }
                if (stepItem.id === 'creating_notes' && stepItem.status === 'pending') {
                  return { ...stepItem, status: 'in_progress' as const } as ProgressStep;
                }
                break;
            }
            return stepItem;
          })
        );
      };

      const result = await uploadImagesToMiro(uploadData, selectedBoard.id, sessionId, {
        onProgress: updateProgress,
      });

      setUploadSteps((prev) =>
        prev.map((step) => {
          switch (step.id) {
            case 'creating_notes':
              return {
                ...step,
                status: 'completed' as const,
                message: 'メタデータ付箋を作成しました',
              } as ProgressStep;
            case 'grouping':
              return step.status === 'pending'
                ? ({
                    ...step,
                    status: 'completed' as const,
                    message: '画像と付箋をグループ化しました',
                  } as ProgressStep)
                : step;
            case 'cleanup':
              return step.status === 'pending'
                ? ({
                    ...step,
                    status: 'completed' as const,
                    message: '処理が完了しました',
                  } as ProgressStep)
                : step;
            default:
              return step;
          }
        })
      );

      if (result.skippedItems && result.skippedItems.length > 0) {
        setSkippedFiles(result.skippedItems);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'アップロードに失敗しました';

      setUploadSteps((prev) =>
        prev.map((step) =>
          step.status === 'in_progress'
            ? ({ ...step, status: 'error' as const, message: errorMessage } as ProgressStep)
            : step
        )
      );
    }
  };

  const handleUploadComplete = () => {
    setIsUploading(false);
    setSelectedFiles([]);
    setSelectedBoard(null);
    setSkippedFiles([]);
    setUploadSteps([
      { ...UPLOAD_STEPS.VALIDATING },
      { ...UPLOAD_STEPS.UPLOADING_IMAGES },
      { ...UPLOAD_STEPS.CREATING_NOTES },
      { ...UPLOAD_STEPS.GROUPING },
      { ...UPLOAD_STEPS.CLEANUP },
    ]);
    setSessionId(generateSessionId());
    setCurrentStep('capture');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'capture':
        return <ImageCapture onImagesChange={setSelectedFiles} maxFiles={10} />;
      case 'board':
        return <BoardSelector selectedBoardId={selectedBoard?.id} onBoardSelect={setSelectedBoard} />;
      case 'upload':
        return (
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">アップロード準備完了</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>選択された画像: {selectedFiles.length}枚</p>
              <p>送信先ボード: {selectedBoard?.name}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'capture', label: '画像選択', number: 1 },
      { key: 'board', label: 'ボード選択', number: 2 },
      { key: 'upload', label: 'アップロード', number: 3 },
    ];

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep === step.key
                  ? 'bg-blue-600 text-white'
                  : steps.findIndex(s => s.key === currentStep) > index
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
                }
              `}
            >
              {steps.findIndex(s => s.key === currentStep) > index ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span className="ml-2 text-sm font-medium text-gray-600">{step.label}</span>
            {index < steps.length - 1 && <div className="w-8 h-px bg-gray-300 mx-4" />}
          </div>
        ))}
      </div>
    );
  };

  if (problemIdFromQuery) {
    return (
      <Layout title="問題コンテキスト - 画像アップロード">
        <ResponsiveContainer maxWidth="2xl" padding="lg">
          {problemLoading && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">問題情報を読み込み中です...</p>
            </div>
          )}

          {problemError && !problemLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-sm text-red-700">
              {problemError}
            </div>
          )}

          {problemDetail && !problemLoading && !problemError && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-2">{problemDetail.problem.title}</h1>
                <p className="text-sm text-gray-600">
                  問題に紐付けて画像をアップロードします。ページ下部の問題詳細からも直接アップロードできます。
                </p>
              </div>

              <ProblemUploadSection
                problemId={problemIdFromQuery}
                defaultBoardId={problemDetail.problem.miroBoardId}
                defaultBoardName={problemDetail.problem.title}
                defaultBoardDescription={problemDetail.problem.description}
                isUploadUnlocked={problemDetail.problem.isUploadUnlocked}
                isBoardUnlocked={problemDetail.problem.isBoardUnlocked}
                onUploadCompleted={refreshProblemDetail}
              />
            </div>
          )}
        </ResponsiveContainer>
      </Layout>
    );
  }

  return (
    <Layout title="画像アップロード - Miro Image Upload App">
      <ResponsiveContainer maxWidth="2xl" padding="lg">
        <FlexContainer direction="col" gap="lg">
          {/* ログイン推奨バナー */}
          {!authLoading && !authStatus.isLoggedIn && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <button
                      onClick={() => router.push('/login')}
                      className="font-medium underline hover:text-yellow-800"
                    >
                      ログイン
                    </button>
                    すると、アップロード履歴が記録され、後から確認できます。
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {renderStepIndicator()}
          <div className="flex-1">{renderStepContent()}</div>
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div>
              <button
                onClick={handleBack}
                type="button"
                disabled={currentStep === 'capture'}
                className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← 戻る
              </button>
            </div>
            <button
              onClick={handleNext}
              type="button"
              disabled={
                (currentStep === 'capture' && !canProceedFromCapture) ||
                (currentStep === 'board' && !canUpload) ||
                currentStep === 'upload'
              }
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 'board' ? 'アップロード開始' : '次へ →'}
            </button>
          </div>
        </FlexContainer>
      </ResponsiveContainer>
      <UploadProgress
        isVisible={isUploading}
        steps={uploadSteps}
        selectedBoard={selectedBoard}
        skippedFiles={skippedFiles}
        onClose={handleUploadComplete}
      />
    </Layout>
  );
}

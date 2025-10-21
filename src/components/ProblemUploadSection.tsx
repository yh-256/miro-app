'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImageCapture } from '@/components/ImageCapture';
import { MetadataForm } from '@/components/MetadataForm';
import { BoardSelector } from '@/components/BoardSelector';
import { UploadProgress, UPLOAD_STEPS } from '@/components/UploadProgress';
import { ProgressStep } from '@/types';
import {
  uploadImagesToMiro,
  generateSessionId,
} from '@/utils/uploadService';
import {
  fetchSubjects as fetchSubjectsFromApi,
} from '@/utils/subjectStorage';

interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

interface ImageMetadata {
  file: File;
  subjectId: string;
  uploaderName?: string;
}

type UploadStep = 'capture' | 'metadata' | 'board' | 'upload';

interface AuthStatus {
  isLoggedIn: boolean;
  userId?: string;
  displayName?: string;
  role?: 'ADMIN' | 'USER';
}

interface ProblemUploadSectionProps {
  problemId: string;
  defaultBoardId?: string;
  defaultBoardName?: string;
  defaultBoardDescription?: string;
  isUploadUnlocked?: boolean;
  isBoardUnlocked?: boolean;
  onUploadCompleted?: () => void;
  lockBoardSelection?: boolean;
}

export function ProblemUploadSection({
  problemId,
  defaultBoardId,
  defaultBoardName,
  defaultBoardDescription,
  isUploadUnlocked = true,
  isBoardUnlocked = true,
  onUploadCompleted,
  lockBoardSelection = false,
}: ProblemUploadSectionProps) {
  const [currentStep, setCurrentStep] = useState<UploadStep>('capture');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<ImageMetadata[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(
    defaultBoardId
      ? {
          id: defaultBoardId,
          name: defaultBoardName || '選択されたボード',
          description: defaultBoardDescription,
        }
      : null
  );
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<ProgressStep[]>([
    { ...UPLOAD_STEPS.VALIDATING },
    { ...UPLOAD_STEPS.UPLOADING_IMAGES },
    { ...UPLOAD_STEPS.CREATING_NOTES },
    { ...UPLOAD_STEPS.GROUPING },
    { ...UPLOAD_STEPS.CLEANUP },
  ]);
  const [skippedFiles, setSkippedFiles] = useState<
    Array<{ fileName: string; reason: string }>
  >([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [authLoading, setAuthLoading] = useState(true);

  const boardStepEnabled = !lockBoardSelection;
  const autoMetadataSubjectId =
    !authLoading && authStatus.isLoggedIn && authStatus.userId
      ? authStatus.userId
      : null;
  const autoUploaderName =
    !authLoading && authStatus.isLoggedIn
      ? authStatus.displayName || authStatus.userId
      : undefined;
  const metadataStepEnabled = !autoMetadataSubjectId;

  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('failed');
        }
        const data = await response.json();
        setAuthStatus({
          isLoggedIn: data.isLoggedIn ?? false,
          userId: data.user?.userId,
          displayName: data.user?.displayName,
          role: data.user?.role,
        });
      } catch (error) {
        console.error('Failed to fetch auth status for upload flow:', error);
        setAuthStatus({ isLoggedIn: false });
      } finally {
        setAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setMetadata([]);
      return;
    }

    if (autoMetadataSubjectId) {
      setMetadata(
        selectedFiles.map((file) => ({
          file,
          subjectId: autoMetadataSubjectId,
          uploaderName: autoUploaderName,
        }))
      );
      return;
    }

    setMetadata(
      selectedFiles.map((file) => ({
        file,
        subjectId: '',
        uploaderName: undefined,
      }))
    );
  }, [selectedFiles, autoMetadataSubjectId, autoUploaderName]);

  useEffect(() => {
    if (lockBoardSelection) {
      if (defaultBoardId) {
        setSelectedBoard({
          id: defaultBoardId,
          name: defaultBoardName || '選択されたボード',
          description: defaultBoardDescription,
        });
      } else {
        setSelectedBoard(null);
      }
    }
  }, [
    lockBoardSelection,
    defaultBoardId,
    defaultBoardName,
    defaultBoardDescription,
  ]);

  useEffect(() => {
    if (!metadataStepEnabled && currentStep === 'metadata') {
      setCurrentStep('capture');
    }
  }, [metadataStepEnabled, currentStep]);

  const metadataReady =
    metadata.length === selectedFiles.length &&
    metadata.every((item) => item.subjectId);
  const canProceedFromCapture =
    selectedFiles.length > 0 && (metadataStepEnabled ? true : metadataReady);
  const canProceedFromMetadata = metadataReady;
  const canUpload = Boolean(selectedBoard) && metadataReady;

  const stepper = useMemo<
    Array<{ key: UploadStep; label: string; number: number }>
  >(() => {
    const steps: Array<{ key: UploadStep; label: string }> = [
      { key: 'capture', label: '画像選択' },
    ];

    if (metadataStepEnabled) {
      steps.push({ key: 'metadata', label: 'メタデータ' });
    }

    if (boardStepEnabled) {
      steps.push({ key: 'board', label: 'ボード選択' });
    }

    steps.push({ key: 'upload', label: 'アップロード' });

    return steps.map((step, index) => ({
      ...step,
      number: index + 1,
    }));
  }, [boardStepEnabled, metadataStepEnabled]);

  const goToNext = () => {
    if (currentStep === 'capture') {
      if (!canProceedFromCapture) {
        return;
      }

      if (metadataStepEnabled) {
        setCurrentStep('metadata');
      } else if (boardStepEnabled) {
        setCurrentStep('board');
      } else if (selectedBoard) {
        setCurrentStep('upload');
        handleUpload();
      }
      return;
    }

    if (currentStep === 'metadata') {
      if (!metadataStepEnabled || !canProceedFromMetadata) {
        return;
      }

      if (boardStepEnabled) {
        setCurrentStep('board');
      } else if (selectedBoard) {
        setCurrentStep('upload');
        handleUpload();
      }
      return;
    }

    if (currentStep === 'board') {
      if (canUpload) {
        setCurrentStep('upload');
        handleUpload();
      }
    }
  };

  const goBack = () => {
    if (currentStep === 'metadata') {
      setCurrentStep('capture');
    } else if (currentStep === 'board') {
      setCurrentStep(metadataStepEnabled ? 'metadata' : 'capture');
    } else if (currentStep === 'upload') {
      if (boardStepEnabled) {
        setCurrentStep('board');
      } else if (metadataStepEnabled) {
        setCurrentStep('metadata');
      } else {
        setCurrentStep('capture');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedBoard || !metadataReady) {
      return;
    }

    setIsUploading(true);

    try {
      const subjects = await fetchSubjectsFromApi();
      const subjectMap = new Map(subjects.map((item) => [item.id, item.name]));

      const uploadData = metadata.map((entry) => {
        const subjectName = subjectMap.get(entry.subjectId) || entry.subjectId;
        return {
          file: entry.file,
          subjectId: entry.subjectId,
          subjectName,
          uploaderName: entry.uploaderName,
        };
      });

      const resetSteps = () =>
        setUploadSteps([
          { ...UPLOAD_STEPS.VALIDATING, status: 'in_progress' },
          { ...UPLOAD_STEPS.UPLOADING_IMAGES },
          { ...UPLOAD_STEPS.CREATING_NOTES },
          { ...UPLOAD_STEPS.GROUPING },
          { ...UPLOAD_STEPS.CLEANUP },
        ]);

      resetSteps();

      const updateProgress = (
        step: string,
        progress: number,
        message?: string
      ) => {
        setUploadSteps((prev) =>
          prev.map((stepItem) => {
            switch (step) {
              case 'validating':
                if (stepItem.id === 'validating') {
                  return {
                    ...stepItem,
                    status: progress === 100 ? 'completed' : 'in_progress',
                    progress,
                    message: message || stepItem.message,
                  } as ProgressStep;
                }
                if (stepItem.id === 'uploading_images' && progress === 100) {
                  return {
                    ...stepItem,
                    status: 'in_progress',
                    progress: 0,
                  } as ProgressStep;
                }
                break;
              case 'uploading':
                if (stepItem.id === 'uploading_images') {
                  return {
                    ...stepItem,
                    status: 'in_progress',
                    progress,
                    message: message || stepItem.message,
                  } as ProgressStep;
                }
                break;
              case 'completed':
                if (stepItem.id === 'uploading_images') {
                  return {
                    ...stepItem,
                    status: 'completed',
                    message: message || 'アップロード完了',
                  } as ProgressStep;
                }
                if (
                  stepItem.id === 'creating_notes' &&
                  stepItem.status === 'pending'
                ) {
                  return { ...stepItem, status: 'in_progress' } as ProgressStep;
                }
                break;
            }
            return stepItem;
          })
        );
      };

      const result = await uploadImagesToMiro(
        uploadData,
        selectedBoard.id,
        sessionId,
        {
          onProgress: updateProgress,
          problemId,
        }
      );

      setUploadSteps((prev) =>
        prev.map((step) => {
          switch (step.id) {
            case 'creating_notes':
              return {
                ...step,
                status: 'completed',
                message: 'メタデータ付箋を作成しました',
              } as ProgressStep;
            case 'grouping':
              return step.status === 'pending'
                ? {
                    ...step,
                    status: 'completed',
                    message: '画像と付箋をグループ化しました',
                  }
                : step;
            case 'cleanup':
              return step.status === 'pending'
                ? {
                    ...step,
                    status: 'completed',
                    message: '処理が完了しました',
                  }
                : step;
            default:
              return step;
          }
        })
      );

      if (result.skippedItems && result.skippedItems.length > 0) {
        setSkippedFiles(result.skippedItems);
      }

      onUploadCompleted?.();
    } catch (error) {
      console.error('Problem upload failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'アップロードに失敗しました';

      setUploadSteps((prev) =>
        prev.map((step) =>
          step.status === 'in_progress'
            ? ({
                ...step,
                status: 'error',
                message: errorMessage,
              } as ProgressStep)
            : step
        )
      );
    }
  };

  const handleUploadComplete = () => {
    setIsUploading(false);
    setSelectedFiles([]);
    setMetadata([]);
    setSkippedFiles([]);
    setSessionId(generateSessionId());
    setCurrentStep('capture');
  };

  const uploadTriggerStep = boardStepEnabled
    ? 'board'
    : metadataStepEnabled
    ? 'metadata'
    : 'capture';
  const isUploadTriggerStep = currentStep === uploadTriggerStep;
  const nextButtonLabel = isUploadTriggerStep ? 'アップロード開始' : '次へ →';

  if (!isUploadUnlocked) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              画像アップロードはまだ利用できません
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              まず気づきを投稿すると、この問題で画像をアップロードできるようになります。
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded">
            問題ID: {problemId}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            画像アップロード
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            選択した問題に関連する画像をMiroボードへ送信します。
          </p>
        </div>
        <span className="text-xs font-medium text-blue-600 px-2 py-1 bg-blue-50 rounded">
          セッションID: {sessionId}
        </span>
      </div>

      {lockBoardSelection && selectedBoard && (
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          このアップロードは「{selectedBoard.name}」ボードに固定されています。
        </div>
      )}

      {lockBoardSelection && !selectedBoard && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          この問題には紐付いたボードが設定されていません。管理者に確認してください。
        </div>
      )}

      {!isBoardUnlocked && (
        <div className="mb-6 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          画像のアップロードが完了すると、対応するMiroボードを閲覧できるようになります。
        </div>
      )}

      {autoMetadataSubjectId && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          ログイン中のため、画像メタデータの入力は省略されます。アップロード時にはユーザーID「{autoMetadataSubjectId}」を自動付与します。
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        {stepper.map((step, index) => {
          const currentIndex = stepper.findIndex((s) => s.key === currentStep);
          return (
            <div key={step.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step.key
                    ? 'bg-blue-600 text-white'
                    : currentIndex > index
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {currentIndex > index ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
              <span className="ml-2 text-sm font-medium text-gray-600">
                {step.label}
              </span>
              {index < stepper.length - 1 && (
                <div className="w-8 h-px bg-gray-300 mx-4" />
              )}
            </div>
          );
        })}
      </div>

      <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-6">
        {currentStep === 'capture' && (
          <ImageCapture onImagesChange={setSelectedFiles} maxFiles={10} />
        )}

        {currentStep === 'metadata' && (
          <MetadataForm
            imageFiles={selectedFiles}
            onMetadataChange={setMetadata}
          />
        )}

        {currentStep === 'board' && boardStepEnabled && (
          <div className="space-y-4">
            <BoardSelector
              onBoardSelect={setSelectedBoard}
              selectedBoardId={selectedBoard?.id}
            />
            {defaultBoardId && (
              <div className="text-xs text-gray-500">
                問題に紐付いた既定のボード: {defaultBoardName ?? defaultBoardId}
              </div>
            )}
          </div>
        )}

        {currentStep === 'upload' && selectedBoard && (
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              アップロード準備完了
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>選択された画像: {selectedFiles.length}枚</p>
              <p>送信先ボード: {selectedBoard.name}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={goBack}
          type="button"
          disabled={currentStep === 'capture'}
          className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← 戻る
        </button>

        <button
          onClick={goToNext}
          type="button"
          disabled={
            (currentStep === 'capture' && !canProceedFromCapture) ||
            (currentStep === 'metadata' && !canProceedFromMetadata) ||
            (currentStep === 'board' && !canUpload) ||
            currentStep === 'upload'
          }
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextButtonLabel}
        </button>
      </div>

      <UploadProgress
        isVisible={isUploading}
        steps={uploadSteps}
        selectedBoard={selectedBoard}
        skippedFiles={skippedFiles}
        onClose={handleUploadComplete}
      />
    </div>
  );
}

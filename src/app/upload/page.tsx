'use client';

import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ResponsiveContainer, FlexContainer } from '@/components/ResponsiveContainer';
import { ImageCapture } from '@/components/ImageCapture';
import { MetadataForm } from '@/components/MetadataForm';
import { BoardSelector } from '@/components/BoardSelector';
import { UploadProgress, UPLOAD_STEPS } from '@/components/UploadProgress';
import { ProgressStep } from '@/types';
import { fetchSubjects as fetchSubjectsFromApi } from '@/utils/subjectStorage';

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

export default function UploadPage() {
  const [currentStep, setCurrentStep] = useState<UploadStep>('capture');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<ImageMetadata[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<ProgressStep[]>([
    { ...UPLOAD_STEPS.VALIDATING },
    { ...UPLOAD_STEPS.UPLOADING_IMAGES },
    { ...UPLOAD_STEPS.CREATING_NOTES },
    { ...UPLOAD_STEPS.GROUPING },
    { ...UPLOAD_STEPS.CLEANUP },
  ]);
  const [skippedFiles, setSkippedFiles] = useState<Array<{ fileName: string; reason: string; }>>([]);

  const canProceedToMetadata = selectedFiles.length > 0;
  const canProceedToBoard = metadata.length > 0 && metadata.every(m => m.subjectId);
  const canUpload = selectedBoard && canProceedToBoard;

  const handleNext = () => {
    if (currentStep === 'capture' && canProceedToMetadata) {
      setCurrentStep('metadata');
    } else if (currentStep === 'metadata' && canProceedToBoard) {
      setCurrentStep('board');
    } else if (currentStep === 'board' && canUpload) {
      setCurrentStep('upload');
      handleUpload();
    }
  };

  const handleBack = () => {
    if (currentStep === 'metadata') {
      setCurrentStep('capture');
    } else if (currentStep === 'board') {
      setCurrentStep('metadata');
    } else if (currentStep === 'upload') {
      setCurrentStep('board');
    }
  };

  const handleUpload = async () => {
    if (!selectedBoard || !canProceedToBoard) return;

    setIsUploading(true);
    
    try {
      // アップロード用のサービスをインポート
      const { uploadImagesToMiro, generateSessionId } = await import('@/utils/uploadService');
      
      // セッションIDを生成
      const sessionId = generateSessionId();

      // ステップをリセット
      setUploadSteps([
        { ...UPLOAD_STEPS.VALIDATING, status: 'in_progress' as const },
        { ...UPLOAD_STEPS.UPLOADING_IMAGES },
        { ...UPLOAD_STEPS.CREATING_NOTES },
        { ...UPLOAD_STEPS.GROUPING },
        { ...UPLOAD_STEPS.CLEANUP },
      ]);

      // アップロードデータを変換
      const subjects = await fetchSubjectsFromApi();
      const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
      
      console.log('[DEBUG] Available subjects:', subjects);
      console.log('[DEBUG] Subject map:', Object.fromEntries(subjectMap));
      console.log('[DEBUG] Metadata to process:', metadata.map(m => ({ subjectId: m.subjectId, fileName: m.file.name })));
      
      const uploadData = metadata.map(m => {
        const subjectName = subjectMap.get(m.subjectId) || m.subjectId;
        console.log(`[DEBUG] Resolving subject ID ${m.subjectId} to name: ${subjectName}`);
        return {
          file: m.file,
          subjectId: m.subjectId,
          subjectName: subjectName,
          uploaderName: m.uploaderName,
        };
      });

      // プログレス更新関数
      const updateProgress = (step: string, progress: number, message?: string) => {
        setUploadSteps(prev => prev.map(stepItem => {
          switch (step) {
            case 'validating':
              if (stepItem.id === 'validating') {
                return {
                  ...stepItem,
                  status: progress === 100 ? 'completed' as const : 'in_progress' as const,
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
                return { ...stepItem, status: 'completed' as const, message: message || 'アップロード完了' } as ProgressStep;
              }
              if (stepItem.id === 'creating_notes' && stepItem.status === 'pending') {
                return { ...stepItem, status: 'in_progress' as const } as ProgressStep;
              }
              break;
          }
          return stepItem;
        }));
      };

      // 実際のアップロード処理
      const result = await uploadImagesToMiro(
        uploadData,
        selectedBoard.id,
        sessionId,
        { onProgress: updateProgress }
      );

      // 成功時の最終ステップ更新
      setUploadSteps(prev => prev.map(step => {
        switch (step.id) {
          case 'creating_notes':
            return { ...step, status: 'completed' as const, message: 'メタデータ付箋を作成しました' } as ProgressStep;
          case 'grouping':
            return step.status === 'pending' 
              ? { ...step, status: 'completed' as const, message: '画像と付箋をグループ化しました' } as ProgressStep
              : step;
          case 'cleanup':
            return step.status === 'pending'
              ? { ...step, status: 'completed' as const, message: '処理が完了しました' } as ProgressStep
              : step;
          default:
            return step;
        }
      }));

      console.log('Upload completed:', result);
      
      // スキップされたファイルがあれば状態に保存
      if (result.skippedItems && result.skippedItems.length > 0) {
        setSkippedFiles(result.skippedItems);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'アップロードに失敗しました';
      
      setUploadSteps(prev => prev.map(step => 
        step.status === 'in_progress'
          ? { ...step, status: 'error' as const, message: errorMessage } as ProgressStep
          : step
      ));
    }
  };

  const handleUploadComplete = () => {
    setIsUploading(false);
    // リセット処理
    setSelectedFiles([]);
    setMetadata([]);
    setSelectedBoard(null);
    setSkippedFiles([]);
    setCurrentStep('capture');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'capture':
        return (
          <ImageCapture
            onImagesChange={setSelectedFiles}
            maxFiles={10}
          />
        );
      
      case 'metadata':
        return (
          <MetadataForm
            imageFiles={selectedFiles}
            onMetadataChange={setMetadata}
          />
        );
      
      case 'board':
        return (
          <BoardSelector
            selectedBoardId={selectedBoard?.id}
            onBoardSelect={setSelectedBoard}
          />
        );
      
      case 'upload':
        return (
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              アップロード準備完了
            </h3>
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
      { key: 'metadata', label: 'メタデータ', number: 2 },
      { key: 'board', label: 'ボード選択', number: 3 },
      { key: 'upload', label: 'アップロード', number: 4 },
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
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span className="ml-2 text-sm font-medium text-gray-600">
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className="w-8 h-px bg-gray-300 mx-4" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout title="画像アップロード - Miro Image Upload App">
      <ResponsiveContainer maxWidth="2xl" padding="lg">
        <FlexContainer direction="col" gap="lg">
          {/* ステップインジケーター */}
          {renderStepIndicator()}

          {/* メインコンテンツ */}
          <div className="flex-1">
            {renderStepContent()}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div>
              <button
                onClick={handleBack}
                disabled={currentStep === 'capture'}
                className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← 戻る
              </button>
            </div>

            <button
              onClick={handleNext}
              disabled={
                (currentStep === 'capture' && !canProceedToMetadata) ||
                (currentStep === 'metadata' && !canProceedToBoard) ||
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

      {/* アップロード進捗モーダル */}
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

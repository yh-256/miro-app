'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useDeviceDetection } from '@/utils/deviceDetection';
import { validateMultipleFiles, fileListToArray, createFilePreviewUrl, revokeFilePreviewUrl } from '@/utils/fileValidation';
import { validateFile } from '@/utils/clientConfig';

interface ImageCaptureProps {
  onImagesChange: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
}

interface CameraState {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
  facingMode: 'user' | 'environment';
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

export function ImageCapture({ 
  onImagesChange, 
  maxFiles = 10, 
  className = '' 
}: ImageCaptureProps) {
  const [camera, setCamera] = useState<CameraState>({
    isActive: false,
    stream: null,
    error: null,
    facingMode: 'environment',
  });
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deviceInfo = useDeviceDetection();

  // ファイルが変更されたときに親コンポーネントに通知
  useEffect(() => {
    onImagesChange(files.map(f => f.file));
  }, [files, onImagesChange]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      // プレビューURLをクリーンアップ
      files.forEach(f => revokeFilePreviewUrl(f.preview));
      // カメラストリームをクリーンアップ
      if (camera.stream) {
        camera.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [camera.stream, files]);

  // ビデオ表示用ヘルパー関数
  const waitForVideoReady = useCallback((video: HTMLVideoElement): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video ready timeout'));
      }, 10000);

      if (video.readyState >= 2) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      const onLoadedData = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        reject(new Error('Video loading error'));
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('error', onError);
    });
  }, []);

  const playVideoWithRetry = useCallback(async (video: HTMLVideoElement, maxRetries: number = 3): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Video play attempt ${i + 1}/${maxRetries}`);
        await video.play();
        console.log('Video play successful');
        return;
      } catch (playError) {
        console.warn(`Video play attempt ${i + 1} failed:`, playError);
        if (i === maxRetries - 1) {
          throw new Error(`Video play failed after ${maxRetries} attempts: ${playError}`);
        }
        // 少し待ってからリトライ
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, []);

  // カメラストリーム表示管理（再レンダリング対応）
  useEffect(() => {
    const setupVideoStream = async () => {
      if (camera.isActive && camera.stream && videoRef.current) {
        try {
          console.log('Setting up video stream after render:', {
            hasStream: !!camera.stream,
            hasVideoElement: !!videoRef.current,
            currentSrcObject: videoRef.current.srcObject
          });

          // ストリームが既に設定されている場合はスキップ
          if (videoRef.current.srcObject === camera.stream) {
            console.log('Stream already assigned, skipping setup');
            return;
          }

          // ストリームを設定
          videoRef.current.srcObject = camera.stream;
          console.log('Stream assigned to video element in useEffect');

          // メタデータ待機と再生
          await waitForVideoReady(videoRef.current);
          console.log('Video metadata ready in useEffect');
          
          await playVideoWithRetry(videoRef.current);
          console.log('Video playback started in useEffect');

        } catch (error) {
          console.error('Video stream setup failed in useEffect:', error);
        }
      }
    };

    setupVideoStream();
  }, [camera.isActive, camera.stream, waitForVideoReady, playVideoWithRetry]);

  // 基本的な制約で再試行
  const retryWithBasicConstraints = useCallback(async () => {
    try {
      console.log('Retrying with basic constraints...');
      const basicConstraints: MediaStreamConstraints = {
        video: true,
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      
      console.log('Basic constraints retry successful, setting state');
      setCamera({ isActive: true, stream, error: null, facingMode: 'environment' });
    } catch (retryError) {
      console.error('Retry with basic constraints failed:', retryError);
      setCamera({ 
        isActive: false, 
        stream: null, 
        error: 'カメラの初期化に失敗しました。',
        facingMode: 'environment'
      });
    }
  }, []);

  // カメラを開始
  const startCamera = useCallback(async (targetFacingMode?: 'user' | 'environment') => {
    try {
      setCamera(prev => ({ ...prev, error: null }));
      
      // getUserMedia API の互換性チェック
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const facingMode = targetFacingMode || camera.facingMode;

      // カメラアクセス環境ログ（制約なし）
      console.log('Camera access attempt:', {
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        deviceType: deviceInfo?.type || 'unknown',
        facingMode
      });
      
      // 段階的な制約で試行
      let stream: MediaStream | null = null;
      const constraintAttempts: MediaStreamConstraints[] = [
        // 1. デバイス別の詳細制約
        {
          video: {
            facingMode: deviceInfo?.type === 'mobile' ? facingMode : 'user',
            // width: { ideal: deviceInfo?.type === 'mobile' ? 1280 : 1920 },
            // height: { ideal: deviceInfo?.type === 'mobile' ? 720 : 1080 },
            width: { ideal: deviceInfo?.type === 'mobile' ? 720 : 720 },
            height: { ideal: deviceInfo?.type === 'mobile' ? 720 : 720 },
          },
          audio: false,
        },
        // 2. 基本的な制約
        {
          video: {
            facingMode: deviceInfo?.type === 'mobile' ? facingMode : 'user',
          },
          audio: false,
        },
        // 3. 最小限の制約
        {
          video: true,
          audio: false,
        }
      ];

      for (let i = 0; i < constraintAttempts.length; i++) {
        try {
          console.log(`Attempting camera access (${i + 1}/${constraintAttempts.length}):`, constraintAttempts[i]);
          stream = await navigator.mediaDevices.getUserMedia(constraintAttempts[i]);
          console.log('Camera stream obtained:', stream);
          break;
        } catch (attemptError) {
          console.warn(`Camera attempt ${i + 1} failed:`, attemptError);
          if (i === constraintAttempts.length - 1) {
            throw attemptError;
          }
        }
      }

      if (!stream) {
        throw new Error('Failed to obtain camera stream');
      }
      
      // ストリームを状態に保存（useEffectでvideo設定を行う）
      console.log('Camera stream successfully obtained, setting state');
      setCamera({ isActive: true, stream, error: null, facingMode });
    } catch (error) {
      console.error('Camera access failed:', error);
      let errorMessage = 'カメラにアクセスできませんでした。';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラの許可を確認してください。';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'このブラウザではカメラがサポートされていません。';
        } else if (error.message === 'getUserMedia not supported') {
          errorMessage = 'お使いのブラウザはカメラ機能をサポートしていません。Chrome、Firefox、Safari等の最新ブラウザをご利用ください。';
        } else if (error.message === 'Camera requires HTTPS') {
          errorMessage = 'カメラアクセスエラーが発生しました。ブラウザの権限設定を確認してください。';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'カメラの設定に問題があります。別の解像度で再試行します。';
          // より緩い制約で再試行
          setTimeout(() => retryWithBasicConstraints(), 1000);
          return;
        }
      }
      
      setCamera({ isActive: false, stream: null, error: errorMessage, facingMode: camera.facingMode });
    }
  }, [deviceInfo, retryWithBasicConstraints, camera.facingMode]);

  // カメラを停止
  const stopCamera = useCallback(() => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => track.stop());
    }
    setCamera({ isActive: false, stream: null, error: null, facingMode: camera.facingMode });
  }, [camera.stream, camera.facingMode]);

  // カメラを切り替え
  const toggleCamera = useCallback(async () => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => track.stop());
    }
    const newFacingMode = camera.facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacingMode);
  }, [camera.stream, camera.facingMode, startCamera]);


  // ファイルを追加
  const addFiles = useCallback(async (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      alert(`最大${maxFiles}枚まで選択できます。`);
      return;
    }

    setUploading(true);
    
    try {
      // フロントエンド側でファイルサイズ制限（6MB）
      const clientValidFiles: File[] = [];
      const clientSkippedFiles: Array<{ file: File; error: string }> = [];
      
      for (const file of newFiles) {
        const validation = validateFile(file);
        if (validation.isValid) {
          clientValidFiles.push(file);
        } else {
          clientSkippedFiles.push({ file, error: validation.reason || '不明なエラー' });
        }
      }
      
      // クライアント側でスキップされたファイルがある場合は通知
      if (clientSkippedFiles.length > 0) {
        const skippedMessages = clientSkippedFiles.map(f => `${f.file.name}: ${f.error}`);
        alert(`以下のファイルがサイズ制限によりスキップされました:\n${skippedMessages.join('\n')}`);
      }
      
      // クライアント側で有効なファイルがない場合は早期リターン
      if (clientValidFiles.length === 0) {
        setUploading(false);
        return;
      }

      // 既存のサーバーサイド検証（形式チェックなど）
      const { validFiles, invalidFiles } = await validateMultipleFiles(clientValidFiles);
      
      if (invalidFiles.length > 0) {
        const errorMessages = invalidFiles.map(f => `${f.file.name}: ${f.error}`);
        alert(`以下のファイルに問題があります:\n${errorMessages.join('\n')}`);
      }

      // 有効なファイルを追加
      const filesWithPreview: FileWithPreview[] = validFiles.map(file => ({
        file,
        preview: createFilePreviewUrl(file),
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      }));

      setFiles(prev => [...prev, ...filesWithPreview]);
    } catch (error) {
      console.error('File processing failed:', error);
      alert('ファイルの処理に失敗しました。');
    } finally {
      setUploading(false);
    }
  }, [files.length, maxFiles]);

  // 写真を撮影
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Canvas context not available');
      return;
    }

    // ビデオの寸法検証
    console.log('Video dimensions:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState
    });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are zero - waiting for metadata');
      alert('カメラの映像が準備中です。少しお待ちください。');
      return;
    }

    // キャンバスサイズを動画サイズに合わせる
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      // 現在のフレームをキャンバスに描画
      context.drawImage(video, 0, 0);
      console.log('Frame captured to canvas');

      // キャンバスからBlobを作成
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('Photo blob created:', { size: blob.size, type: blob.type });
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          addFiles([file]);
        } else {
          console.error('Failed to create blob from canvas');
          alert('写真の保存に失敗しました。');
        }
      }, 'image/jpeg', 0.9);
    } catch (captureError) {
      console.error('Photo capture failed:', captureError);
      alert('写真の撮影に失敗しました。');
    }
  }, [addFiles]);

  // ファイル選択
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      addFiles(fileListToArray(selectedFiles));
    }
    // inputをリセット（同じファイルを再選択可能にする）
    event.target.value = '';
  }, [addFiles]);

  // ドラッグ&ドロップ
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(fileListToArray(e.dataTransfer.files));
    }
  }, [addFiles]);

  // ファイルを削除
  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        revokeFilePreviewUrl(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  // すべてのファイルをクリア
  const clearFiles = useCallback(() => {
    files.forEach(f => revokeFilePreviewUrl(f.preview));
    setFiles([]);
  }, [files]);

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          画像を選択・撮影
        </h3>

        {/* カメラ機能 */}
        <div className="mb-6">
          {!camera.isActive ? (
            <div className="text-center">
              <button
                onClick={() => startCamera()}
                type="button"
                disabled={!!camera.error}
                className="btn-primary"
              >
                📷 カメラを起動
              </button>
              
              {/* 初回利用時のヒント */}
              {!camera.error && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  <p className="font-medium mb-1">📝 カメラ利用のヒント:</p>
                  <ul className="text-left space-y-1">
                    <li>• ブラウザからカメラの許可を求められたら「許可」してください</li>
                    <li>• {deviceInfo?.type === 'mobile' ? 'リアカメラ' : 'Webカメラ'}を自動検出して使用します</li>
                    <li>• 映像が表示されてから撮影ボタンを押してください</li>
                  </ul>
                </div>
              )}
              
              {camera.error && (
                <div className="mt-3">
                  <p className="text-red-600 text-sm mb-2">{camera.error}</p>
                  
                  {/* トラブルシューティング */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                    <p className="font-medium mb-2">🔧 対処方法:</p>
                    <ul className="text-left space-y-1">
                      <li>• ブラウザのアドレスバーでカメラアイコンをクリックして許可してください</li>
                      <li>• ページを再読み込みしてもう一度お試しください</li>
                      <li>• 他のアプリ（Zoom、Teams等）でカメラを使用していないか確認してください</li>
                      <li>• Chrome、Firefox、Safari等の最新ブラウザをご利用ください</li>
                      <li>• モバイルの場合：ブラウザの設定でカメラアクセスを許可してください</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-auto min-h-[200px]"
                  onLoadedMetadata={() => {
                    // メタデータ読み込み完了時のログ
                    if (videoRef.current) {
                      console.log('Video metadata loaded:', {
                        width: videoRef.current.videoWidth,
                        height: videoRef.current.videoHeight,
                        readyState: videoRef.current.readyState
                      });
                    }
                  }}
                  onCanPlay={() => {
                    console.log('Video can play');
                  }}
                  onError={(e) => {
                    console.error('Video error:', e);
                  }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={takePhoto}
                  type="button"
                  className="btn-primary px-6 py-3 text-lg"
                >
                  📸 撮影
                </button>
                {deviceInfo?.type === 'mobile' && (
                  <button
                    onClick={toggleCamera}
                    type="button"
                    className="btn-secondary px-6 py-3 text-lg"
                    title="カメラを切り替え"
                  >
                    🔄 {camera.facingMode === 'user' ? 'アウトカメラ' : 'インカメラ'}
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  type="button"
                  className="btn-secondary px-6 py-3 text-lg"
                >
                  ❌ 停止
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ファイル選択エリア */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                ファイルをドラッグ&ドロップまたはクリックして選択
              </p>
              <p className="text-sm text-gray-500 mb-4">
                JPEG、PNG、GIF形式・6MB以下・最大{maxFiles}枚
              </p>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                disabled={uploading}
                className="btn-outline"
              >
                {uploading ? '処理中...' : 'ファイルを選択'}
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 選択済みファイル一覧 */}
      {files.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-gray-900">
              選択済み画像 ({files.length}/{maxFiles})
            </h4>
            <button
              onClick={clearFiles}
              type="button"
              className="text-sm text-red-600 hover:text-red-800"
            >
              すべて削除
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {files.map((fileWithPreview) => (
              <div
                key={fileWithPreview.id}
                className="relative group card p-2"
              >
                <Image
                  src={fileWithPreview.preview}
                  alt={fileWithPreview.file.name}
                  width={200}
                  height={96}
                  className="w-full h-24 object-cover rounded"
                />
                
                <button
                  onClick={() => removeFile(fileWithPreview.id)}
                  type="button"
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                
                <p className="text-xs text-gray-600 mt-1 truncate">
                  {fileWithPreview.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {Math.round(fileWithPreview.file.size / 1024)}KB
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

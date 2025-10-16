'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useDeviceDetection } from '@/utils/deviceDetection';
import { createSubject as createSubjectViaApi, fetchSubjects as fetchSubjectsFromApi, sortSubjectsByUsage } from '@/utils/subjectStorage';

interface Subject {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date;
}

interface MetadataFormProps {
  imageFiles: File[];
  onMetadataChange: (metadata: ImageMetadata[]) => void;
  className?: string;
}

interface ImageMetadata {
  file: File;
  subjectId: string;
  uploaderName?: string;
}

export function MetadataForm({ 
  imageFiles, 
  onMetadataChange, 
  className = '' 
}: MetadataFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata[]>([]);
  const [uploaderName, setUploaderName] = useState('');
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);
  const _deviceInfo = useDeviceDetection();

  // 個人ID一覧を取得
  useEffect(() => {
    fetchSubjects();
  }, []);

  // 画像ファイルが変更されたときにメタデータを初期化
  useEffect(() => {
    const initialMetadata = imageFiles.map(file => ({
      file,
      subjectId: '',
      uploaderName: uploaderName,
    }));
    setMetadata(initialMetadata);
  }, [imageFiles, uploaderName]);

  // メタデータが変更されたときに親コンポーネントに通知
  useEffect(() => {
    onMetadataChange(metadata);
  }, [metadata, onMetadataChange]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const storedSubjects = await fetchSubjectsFromApi();
      setSubjects(sortSubjectsByUsage(storedSubjects));

    } catch (err) {
      console.error('Failed to fetch subjects:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (index: number, subjectId: string) => {
    setMetadata(prev => prev.map((item, i) => 
      i === index ? { ...item, subjectId } : item
    ));
  };

  const handleUploaderNameChange = (name: string) => {
    setUploaderName(name);
    setMetadata(prev => prev.map(item => ({ ...item, uploaderName: name })));
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) {
      return;
    }

    try {
      setCreatingSubject(true);
      
      const newSubject = await createSubjectViaApi(newSubjectName.trim());
      
      // 新しい個人IDを一覧に追加
      setSubjects(prev => sortSubjectsByUsage([newSubject, ...prev]));
      setNewSubjectName('');
      setShowNewSubjectForm(false);
      
      // 作成した個人IDを自動選択（最初の画像に）
      if (metadata.length > 0) {
        handleSubjectSelect(0, newSubject.id);
      }
    } catch (err) {
      console.error('Failed to create subject:', err);
      alert('個人IDの作成に失敗しました。');
    } finally {
      setCreatingSubject(false);
    }
  };

  const isFormValid = metadata.every(item => item.subjectId);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">個人ID一覧を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchSubjects} className="btn-primary">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          画像のメタデータを設定
        </h3>
        
        {/* アップロード者名 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            アップロード者名（任意）
          </label>
          <input
            type="text"
            value={uploaderName}
            onChange={(e) => handleUploaderNameChange(e.target.value)}
            placeholder="例：田中太郎"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 新規個人ID作成フォーム */}
        <div className="mb-6">
          {!showNewSubjectForm ? (
            <button
              onClick={() => setShowNewSubjectForm(true)}
              className="btn-outline text-sm"
            >
              + 新しい個人IDを追加
            </button>
          ) : (
            <div className="card p-4 bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-3">新しい個人IDを作成</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="個人ID名を入力"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSubject()}
                />
                <button
                  onClick={handleCreateSubject}
                  disabled={!newSubjectName.trim() || creatingSubject}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {creatingSubject ? '作成中...' : '作成'}
                </button>
                <button
                  onClick={() => {
                    setShowNewSubjectForm(false);
                    setNewSubjectName('');
                  }}
                  className="btn-outline px-4"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 各画像の個人ID選択 */}
      <div className="space-y-4">
        {metadata.map((item, index) => (
          <div key={index} className="card">
            <div className="flex items-start space-x-4">
              {/* 画像プレビュー */}
              <div className="flex-shrink-0">
                <Image
                  src={URL.createObjectURL(item.file)}
                  alt={`Preview ${index + 1}`}
                  width={64}
                  height={64}
                  className="w-16 h-16 object-cover rounded border border-gray-300"
                />
              </div>

              {/* 個人ID選択 */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate">
                    {item.file.name}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {Math.round(item.file.size / 1024)}KB
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    個人IDを選択 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={item.subjectId}
                    onChange={(e) => handleSubjectSelect(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">個人IDを選択してください</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* バリデーション状態表示 */}
      {metadata.length > 0 && (
        <div className={`p-3 rounded-md ${
          isFormValid 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center">
            {isFormValid ? (
              <>
                <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-green-800">
                  すべての画像にメタデータが設定されました
                </span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-yellow-800">
                  個人IDが未選択の画像があります
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

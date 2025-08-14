'use client';

import { useState } from 'react';
import { useDeviceDetection } from '@/utils/deviceDetection';

export interface SearchFormData {
  query: string;
  subjectId: string;
  uploaderName: string;
  searchType: 'general' | 'subject' | 'uploader';
  dateFrom: string;
  dateTo: string;
  itemTypes: string[];
}

interface SearchFormProps {
  onSearch: (searchData: SearchFormData) => void;
  onClear: () => void;
  isLoading?: boolean;
  availableSubjects?: Array<{ id: string; name: string }>;
  className?: string;
}

export function SearchForm({
  onSearch,
  onClear,
  isLoading = false,
  availableSubjects = [],
  className = '',
}: SearchFormProps) {
  const [formData, setFormData] = useState<SearchFormData>({
    query: '',
    subjectId: '',
    uploaderName: '',
    searchType: 'general',
    dateFrom: '',
    dateTo: '',
    itemTypes: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const deviceInfo = useDeviceDetection();

  const handleInputChange = (field: keyof SearchFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSearchTypeChange = (type: SearchFormData['searchType']) => {
    setFormData(prev => ({
      ...prev,
      searchType: type,
      // 検索タイプ変更時に関連フィールドをクリア
      query: type === 'general' ? prev.query : '',
      subjectId: type === 'subject' ? prev.subjectId : '',
      uploaderName: type === 'uploader' ? prev.uploaderName : '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 基本的な検証
    const hasSearchCriteria = 
      formData.query.trim() || 
      formData.subjectId || 
      formData.uploaderName.trim();

    if (!hasSearchCriteria) {
      alert('検索条件を入力してください。');
      return;
    }

    onSearch({
      ...formData,
      query: formData.query.trim(),
      uploaderName: formData.uploaderName.trim(),
    });
  };

  const handleClear = () => {
    setFormData({
      query: '',
      subjectId: '',
      uploaderName: '',
      searchType: 'general',
      dateFrom: '',
      dateTo: '',
      itemTypes: [],
    });
    setShowAdvanced(false);
    onClear();
  };

  const handleItemTypeToggle = (itemType: string) => {
    setFormData(prev => ({
      ...prev,
      itemTypes: prev.itemTypes.includes(itemType)
        ? prev.itemTypes.filter(type => type !== itemType)
        : [...prev.itemTypes, itemType],
    }));
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 検索タイプ選択 */}
        <div className="border-b border-gray-200 pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            検索タイプ
          </label>
          <div className={`grid gap-2 ${deviceInfo?.type === 'mobile' ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <button
              type="button"
              onClick={() => handleSearchTypeChange('general')}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                formData.searchType === 'general'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              総合検索
            </button>
            <button
              type="button"
              onClick={() => handleSearchTypeChange('subject')}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                formData.searchType === 'subject'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              個人ID検索
            </button>
            <button
              type="button"
              onClick={() => handleSearchTypeChange('uploader')}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                formData.searchType === 'uploader'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              送信者検索
            </button>
          </div>
        </div>

        {/* 検索条件入力 */}
        <div className="space-y-4">
          {/* 総合検索 */}
          {formData.searchType === 'general' && (
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
                キーワード検索
              </label>
              <input
                type="text"
                id="query"
                value={formData.query}
                onChange={(e) => handleInputChange('query', e.target.value)}
                placeholder="キーワードを入力してください"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* 個人ID検索 */}
          {formData.searchType === 'subject' && (
            <div>
              <label htmlFor="subjectId" className="block text-sm font-medium text-gray-700 mb-1">
                個人ID選択
              </label>
              <select
                id="subjectId"
                value={formData.subjectId}
                onChange={(e) => handleInputChange('subjectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">個人IDを選択してください</option>
                {availableSubjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 送信者検索 */}
          {formData.searchType === 'uploader' && (
            <div>
              <label htmlFor="uploaderName" className="block text-sm font-medium text-gray-700 mb-1">
                送信者名
              </label>
              <input
                type="text"
                id="uploaderName"
                value={formData.uploaderName}
                onChange={(e) => handleInputChange('uploaderName', e.target.value)}
                placeholder="送信者名を入力してください"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* 詳細検索オプション */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg 
              className={`w-4 h-4 mr-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            詳細検索オプション
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-5 border-l-2 border-blue-100">
              {/* 日付範囲 */}
              <div className={`grid gap-4 ${deviceInfo?.type === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={formData.dateFrom}
                    onChange={(e) => handleInputChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                    終了日
                  </label>
                  <input
                    type="date"
                    id="dateTo"
                    value={formData.dateTo}
                    onChange={(e) => handleInputChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* アイテムタイプ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  検索対象
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'image', label: '画像' },
                    { value: 'sticky_note', label: '付箋' },
                    { value: 'group', label: 'グループ' },
                  ].map(type => (
                    <label key={type.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.itemTypes.includes(type.value)}
                        onChange={() => handleItemTypeToggle(type.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className={`flex gap-2 pt-4 ${deviceInfo?.type === 'mobile' ? 'flex-col' : 'flex-row'}`}>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 btn-primary flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                検索中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                検索
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isLoading}
            className="btn-outline"
          >
            クリア
          </button>
        </div>
      </form>
    </div>
  );
}
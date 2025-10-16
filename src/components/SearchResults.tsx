'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useDeviceDetection } from '@/utils/deviceDetection';
import { SearchResult, SearchResultItem } from '@/utils/searchService';

interface SearchResultsProps {
  results: SearchResult;
  searchQuery?: string;
  onItemClick?: (item: SearchResultItem) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function SearchResults({
  results,
  searchQuery = '',
  onItemClick,
  onLoadMore,
  isLoading = false,
  className = '',
}: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'type'>('relevance');
  const deviceInfo = useDeviceDetection();

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const sortedResults = [...results.items].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        const dateA = a.metadata?.uploadedAt?.getTime() || 0;
        const dateB = b.metadata?.uploadedAt?.getTime() || 0;
        return dateB - dateA;
      case 'type':
        return a.type.localeCompare(b.type);
      case 'relevance':
      default:
        return 0; // API側でソート済み
    }
  });

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'sticky_note':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'group':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return '不明';
    const time = date.getTime();
    if (Number.isNaN(time)) return '不明';
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatFileSize = (size?: number) => {
    if (!size || size <= 0) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  if (results.totalCount === 0) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          検索結果が見つかりませんでした
        </h3>
        <p className="text-gray-600">
          検索条件を変更して再度お試しください。
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* 検索結果ヘッダー */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              検索結果
            </h3>
            <p className="text-sm text-gray-600">
              {results.totalCount}件の結果が見つかりました
              {results.hasMore && ' (さらに結果があります)'}
            </p>
          </div>
          
          {/* 表示モード切り替え（PC版のみ） */}
          {deviceInfo?.type !== 'mobile' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="グリッド表示"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="リスト表示"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ソート・フィルター */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">並び順:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date' | 'type')}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="relevance">関連度</option>
              <option value="date">日付順</option>
              <option value="type">種類別</option>
            </select>
          </div>
        </div>
      </div>

      {/* 検索結果一覧 */}
      <div className="p-4">
        {viewMode === 'grid' ? (
          <div className={`grid gap-4 ${
            deviceInfo?.type === 'mobile' 
              ? 'grid-cols-1' 
              : 'grid-cols-2 lg:grid-cols-3'
          }`}>
            {sortedResults.map((item) => (
              <SearchResultCard
                key={item.id}
                item={item}
                searchQuery={searchQuery}
                onItemClick={onItemClick}
                highlightText={highlightText}
                getItemTypeIcon={getItemTypeIcon}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedResults.map((item) => (
              <SearchResultListItem
                key={item.id}
                item={item}
                searchQuery={searchQuery}
                onItemClick={onItemClick}
                highlightText={highlightText}
                getItemTypeIcon={getItemTypeIcon}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
              />
            ))}
          </div>
        )}

        {/* 追加読み込みボタン */}
        {results.hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="btn-outline"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2 inline-block"></div>
                  読み込み中...
                </>
              ) : (
                'さらに読み込む'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 検索結果カード（グリッド表示用）
function SearchResultCard({
  item,
  searchQuery,
  onItemClick,
  highlightText,
  getItemTypeIcon,
  formatDate,
  formatFileSize,
}: {
  item: SearchResultItem;
  searchQuery: string;
  onItemClick?: (item: SearchResultItem) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  getItemTypeIcon: (type: string) => React.ReactNode;
  formatDate: (date?: Date) => string;
  formatFileSize: (size?: number) => string | null;
}) {
  const handleClick = () => {
    onItemClick?.(item);
  };

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={handleClick}
    >
      {/* アイテムヘッダー */}
      <div className="flex items-center space-x-2 mb-3">
        {getItemTypeIcon(item.type)}
        <span className="text-sm font-medium text-gray-700 capitalize">
          {item.type === 'image' && '画像'}
          {item.type === 'sticky_note' && '付箋'}
          {item.type === 'group' && 'グループ'}
        </span>
      </div>

      {/* 画像プレビュー */}
      {item.type === 'image' && item.imageUrl && (
        <div className="mb-3">
          <Image
            src={item.imageUrl}
            alt="検索結果画像"
            width={300}
            height={128}
            className="w-full h-32 object-cover rounded border"
          />
        </div>
      )}

      {/* コンテンツ */}
      {item.content && (
        <div className="mb-3">
          <p className="text-sm text-gray-800 line-clamp-3">
            {highlightText(item.content, searchQuery)}
          </p>
        </div>
      )}

      {/* メタデータ */}
      <div className="text-xs text-gray-600 space-y-1">
        {item.metadata?.subjectId && (
          <div>ID: {item.metadata.subjectId}</div>
        )}
        {item.metadata?.subjectName && (
          <div>個人ID: {highlightText(item.metadata.subjectName, searchQuery)}</div>
        )}
        {item.metadata?.uploaderName && (
          <div>送信者: {highlightText(item.metadata.uploaderName, searchQuery)}</div>
        )}
        {item.metadata?.fileName && (
          <div>ファイル: {item.metadata.fileName}</div>
        )}
        {(() => {
          const formattedSize = formatFileSize(item.metadata?.fileSize);
          return formattedSize ? <div>サイズ: {formattedSize}</div> : null;
        })()}
        {item.metadata?.mimeType && (
          <div>MIME: {item.metadata.mimeType}</div>
        )}
        <div>アップロード: {formatDate(item.metadata?.uploadedAt)}</div>
      </div>
    </div>
  );
}

// 検索結果リストアイテム（リスト表示用）
function SearchResultListItem({
  item,
  searchQuery,
  onItemClick,
  highlightText,
  getItemTypeIcon,
  formatDate,
  formatFileSize,
}: {
  item: SearchResultItem;
  searchQuery: string;
  onItemClick?: (item: SearchResultItem) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  getItemTypeIcon: (type: string) => React.ReactNode;
  formatDate: (date?: Date) => string;
  formatFileSize: (size?: number) => string | null;
}) {
  const handleClick = () => {
    onItemClick?.(item);
  };

  return (
    <div
      className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={handleClick}
    >
      {/* アイコンとプレビュー */}
      <div className="flex-shrink-0">
        {item.type === 'image' && item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt="検索結果画像"
            width={64}
            height={64}
            className="w-16 h-16 object-cover rounded border"
          />
        ) : (
          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded border">
            {getItemTypeIcon(item.type)}
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-700">
            {item.type === 'image' && '画像'}
            {item.type === 'sticky_note' && '付箋'}
            {item.type === 'group' && 'グループ'}
          </span>
          <span className="text-xs text-gray-500">
            {formatDate(item.metadata?.uploadedAt)}
          </span>
        </div>

        {item.content && (
          <p className="text-sm text-gray-800 mb-2 line-clamp-2">
            {highlightText(item.content, searchQuery)}
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          {item.metadata?.subjectId && (
            <span>ID: {item.metadata.subjectId}</span>
          )}
          {item.metadata?.subjectName && (
            <span>個人ID: {highlightText(item.metadata.subjectName, searchQuery)}</span>
          )}
          {item.metadata?.uploaderName && (
            <span>送信者: {highlightText(item.metadata.uploaderName, searchQuery)}</span>
          )}
          {item.metadata?.fileName && (
            <span>ファイル: {item.metadata.fileName}</span>
          )}
          {(() => {
            const formattedSize = formatFileSize(item.metadata?.fileSize);
            return formattedSize ? <span>サイズ: {formattedSize}</span> : null;
          })()}
          {item.metadata?.mimeType && (
            <span>MIME: {item.metadata.mimeType}</span>
          )}
        </div>
      </div>
    </div>
  );
}

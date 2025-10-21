/**
 * 検索サービスの型定義とクライアント用ユーティリティ
 * クライアントコンポーネントでも使用可能
 */

export interface SearchCriteria {
  query?: string;
  subjectId?: string;
  subjectName?: string;
  uploaderName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  itemTypes?: string[];
}

export interface SearchResult {
  items: SearchResultItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface SearchResultItem {
  id: string;
  type: 'image' | 'sticky_note' | 'group';
  position: { x: number; y: number };
  metadata?: {
    subjectId?: string;
    subjectName?: string;
    uploaderName?: string;
    uploadedAt?: Date;
    fileName?: string;
    sessionId?: string;
    fileSize?: number;
    mimeType?: string;
    problemId?: string;
    userSessionId?: string;
  };
  content?: string;
  imageUrl?: string;
  groupedItems?: string[];
}

/**
 * 検索結果の統計情報を取得
 * クライアントでも使用可能な純粋関数
 */
export function getSearchStats(results: SearchResult): {
  totalImages: number;
  totalStickyNotes: number;
  totalGroups: number;
  subjectCounts: Map<string, number>;
  uploaderCounts: Map<string, number>;
} {
  const stats = {
    totalImages: 0,
    totalStickyNotes: 0,
    totalGroups: 0,
    subjectCounts: new Map<string, number>(),
    uploaderCounts: new Map<string, number>(),
  };
  
  results.items.forEach(item => {
    switch (item.type) {
      case 'image':
        stats.totalImages++;
        break;
      case 'sticky_note':
        stats.totalStickyNotes++;
        break;
      case 'group':
        stats.totalGroups++;
        break;
    }
    
    // 個人ID統計
    if (item.metadata?.subjectName) {
      const current = stats.subjectCounts.get(item.metadata.subjectName) || 0;
      stats.subjectCounts.set(item.metadata.subjectName, current + 1);
    }
    
    // アップロード者統計
    if (item.metadata?.uploaderName) {
      const current = stats.uploaderCounts.get(item.metadata.uploaderName) || 0;
      stats.uploaderCounts.set(item.metadata.uploaderName, current + 1);
    }
  });
  
  return stats;
}

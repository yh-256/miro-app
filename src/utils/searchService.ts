import { miroClient, MiroItem, MiroImageItem, MiroStickyNote, IMiroClient } from './miroClient';
import { logError } from './errorHandler';
import { extractPersonalIdFromContent } from './subjectStorage';
import { findNearbyItems as findNearbyByType } from './proximity';
import { toPlainText } from './text';

/**
 * 検索機能の基盤サービス
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
  };
  content?: string;
  imageUrl?: string;
  groupedItems?: string[];
}

/**
 * ボード内アイテムの包括的検索
 */
export async function searchBoardItems(
  boardId: string,
  criteria: SearchCriteria,
  limit: number = 50,
  client: IMiroClient = miroClient
): Promise<SearchResult> {
  try {
    // Miro APIから基本アイテムを取得（プレフィルタしない）
    const allItems = await client.searchItems(boardId);
    
    // 検索条件でフィルタリング
    const filteredItems = await filterItemsByCriteria(allItems, criteria);
    
    // 検索結果を構造化
    const searchResults = await processSearchResults(filteredItems, boardId, client);
    
    // ページネーション対応
    const paginatedResults = searchResults.slice(0, limit);
    
    return {
      items: paginatedResults,
      totalCount: searchResults.length,
      hasMore: searchResults.length > limit,
    };
  } catch (error) {
    logError(error as Error, 'searchBoardItems');
    throw error;
  }
}

/**
 * 個人ID別の検索
 */
export async function searchBySubjectId(
  boardId: string,
  subjectId: string,
  client: IMiroClient = miroClient,
  subjectName?: string
): Promise<SearchResult> {
  try {
    // 付箋から個人IDを含むアイテムを検索
    const stickyNotes = await client.searchItems(boardId, subjectId, 'sticky_note');
    
    // 各付箋に関連する画像とグループを取得
    const relatedItems = [];
    
    for (const note of stickyNotes) {
      // 付箋の内容から個人IDを確認（後方互換性付き）
      if (note.type === 'sticky_note' && note.data?.content) {
        const extractedId = extractPersonalIdFromContent(note.data.content);
        if (extractedId === subjectId || (subjectName && extractedId === subjectName)) {
          // 付箋を結果に追加
          relatedItems.push(note);
          
          // 同じ位置にある画像を検索
          const nearbyImages = await findNearbyByType(client, boardId, note.position, 'image', 300);
          relatedItems.push(...nearbyImages);
          
          // グループ情報を取得
          if (note.parentGroup) {
            const groupInfo = await getGroupInfo(boardId, note.parentGroup.id, client);
            if (groupInfo && groupInfo.type && typeof groupInfo.id === 'string') {
              relatedItems.push(groupInfo as unknown as MiroItem);
            }
          }
        }
      }
    }
    
    const processedResults = await processSearchResults(relatedItems, boardId, client);
    
    return {
      items: processedResults,
      totalCount: processedResults.length,
      hasMore: false,
    };
  } catch (error) {
    logError(error as Error, 'searchBySubjectId');
    throw error;
  }
}

/**
 * アップロード者名での検索
 */
export async function searchByUploaderName(
  boardId: string,
  uploaderName: string,
  client: IMiroClient = miroClient
): Promise<SearchResult> {
  try {
    // 付箋からアップロード者名を含むアイテムを検索
    const stickyNotes = await client.searchItems(boardId, uploaderName, 'sticky_note');
    
    const relatedItems = [];
    
    for (const note of stickyNotes) {
      if (note.type === 'sticky_note' && note.data?.content) {
        const text = toPlainText(note.data.content);
        if (!text.includes(`アップロード者: ${uploaderName}`)) continue;
        relatedItems.push(note);
        
        // 関連画像を検索
        const nearbyImages = await findNearbyByType(client, boardId, note.position, 'image', 300);
        relatedItems.push(...nearbyImages);
      }
    }
    
    const processedResults = await processSearchResults(relatedItems, boardId, client);
    
    return {
      items: processedResults,
      totalCount: processedResults.length,
      hasMore: false,
    };
  } catch (error) {
    logError(error as Error, 'searchByUploaderName');
    throw error;
  }
}

/**
 * 検索条件によるアイテムフィルタリング
 */
async function filterItemsByCriteria(
  items: MiroItem[],
  criteria: SearchCriteria
): Promise<MiroItem[]> {
  let filteredItems = [...items];
  const q = criteria.query?.toLowerCase().trim();

  // キーワードフィルタ（ID or 付箋テキスト）
  if (q && q.length > 0) {
    filteredItems = filteredItems.filter(item => {
      if (item.id?.toLowerCase().includes(q)) return true;
      if (item.type === 'sticky_note') {
        const sticky = item as MiroStickyNote;
        const text = toPlainText(sticky.data?.content || '').toLowerCase();
        return text.includes(q);
      }
      return false;
    });
  }
  
  // 個人IDフィルター
  if (criteria.subjectId || criteria.subjectName) {
    filteredItems = filteredItems.filter(item => {
      if (item.type === 'sticky_note') {
        const stickyNote = item as MiroStickyNote;
        if (stickyNote.data?.content) {
          const extractedId = extractPersonalIdFromContent(stickyNote.data.content);
          if (criteria.subjectName && extractedId === criteria.subjectName) return true;
          if (criteria.subjectId && extractedId === criteria.subjectId) return true;
          return false;
        }
      }
      return false;
    });
  }
  
  // アップロード者名フィルター
  if (criteria.uploaderName) {
    filteredItems = filteredItems.filter(item => {
      if (item.type === 'sticky_note') {
        const stickyNote = item as MiroStickyNote;
        if (stickyNote.data?.content) {
          const text = toPlainText(stickyNote.data.content);
          return text.includes(`アップロード者: ${criteria.uploaderName}`);
        }
      }
      return false;
    });
  }
  
  // アイテムタイプフィルター
  if (criteria.itemTypes && criteria.itemTypes.length > 0) {
    filteredItems = filteredItems.filter(item => 
      criteria.itemTypes!.includes(item.type)
    );
  }
  
  // 日付範囲フィルター（createdAt / modifiedAt を使用）
  if (criteria.dateFrom || criteria.dateTo) {
    const from = criteria.dateFrom ? criteria.dateFrom.getTime() : -Infinity;
    const to = criteria.dateTo ? criteria.dateTo.getTime() : Infinity;
    filteredItems = filteredItems.filter(item => {
      const created = safeParseDate(item.createdAt);
      const modified = safeParseDate(item.modifiedAt);
      const ts = isFinite(modified) ? modified : created;
      return ts >= from && ts <= to;
    });
  }

  return filteredItems;
}

function safeParseDate(value?: string): number {
  if (!value) return NaN;
  const t = Date.parse(value);
  return isNaN(t) ? NaN : t;
}

/**
 * 検索結果の構造化処理
 */
async function processSearchResults(
  items: MiroItem[],
  boardId: string,
  client: IMiroClient
): Promise<SearchResultItem[]> {
  const processedResults: SearchResultItem[] = [];
  
  for (const item of items) {
    try {
      const processedItem: SearchResultItem = {
        id: item.id,
        type: item.type,
        position: item.position || { x: 0, y: 0 },
      };
      
      // メタデータ抽出
      if (item.type === 'sticky_note') {
        const stickyNote = item as MiroStickyNote;
        if (stickyNote.data?.content) {
          processedItem.metadata = extractMetadataFromStickyNote(stickyNote.data.content);
          processedItem.content = toPlainText(stickyNote.data.content);
        }
      }
      
      // 画像URLの取得
      if (item.type === 'image') {
        processedItem.imageUrl = (item as MiroImageItem).url;
      }
      
      // グループ情報の取得
      if (item.parentGroup) {
        const groupInfo = await getGroupInfo(boardId, item.parentGroup.id, client);
        if (groupInfo && groupInfo.items && Array.isArray(groupInfo.items)) {
          processedItem.groupedItems = (groupInfo.items as Array<{ id: string }>).map((i: { id: string }) => i.id) || [];
        }
      }
      
      processedResults.push(processedItem);
    } catch (error) {
      logError(error as Error, `processSearchResults - item ${item.id}`);
      // 個別アイテムの処理エラーは継続
    }
  }
  
  return processedResults;
}

/**
 * 付箋からメタデータを抽出
 */
function extractMetadataFromStickyNote(content: string): SearchResultItem['metadata'] {
  const metadata: SearchResultItem['metadata'] = {};
  const text = toPlainText(content);
  
  // 個人ID名の抽出（後方互換性付き）
  const personalId = extractPersonalIdFromContent(text);
  if (personalId) {
    metadata.subjectName = personalId;
  }
  
  // アップロード者名の抽出
  const uploaderMatch = text.match(/アップロード者:\s*(.+)/);
  if (uploaderMatch) {
    metadata.uploaderName = uploaderMatch[1].trim();
  }
  
  // ファイル名の抽出
  const fileNameMatch = text.match(/ファイル名:\s*(.+)/);
  if (fileNameMatch) {
    metadata.fileName = fileNameMatch[1].trim();
  }
  
  // セッションIDの抽出
  const sessionMatch = text.match(/セッションID:\s*(.+)/);
  if (sessionMatch) {
    metadata.sessionId = sessionMatch[1].trim();
  }
  
  // 日時の抽出
  const dateMatch = text.match(/アップロード日時:\s*(.+)/);
  if (dateMatch) {
    const parsed = new Date(dateMatch[1].trim());
    if (!Number.isNaN(parsed.getTime())) {
      metadata.uploadedAt = parsed;
    }
  }
  
  return metadata;
}

/**
 * 指定位置の近くにあるアイテムを検索
 */
// moved to utils/proximity.ts

/**
 * グループ情報を取得
 */
async function getGroupInfo(boardId: string, groupId: string, client: IMiroClient): Promise<Record<string, unknown> | null> {
  try {
    return await client.request(`/boards/${boardId}/groups/${groupId}`);
  } catch (error) {
    logError(error as Error, 'getGroupInfo');
    return null;
  }
}

/**
 * 検索ハイライト用のテキスト処理
 */
export function highlightSearchTerms(text: string, searchTerms: string[]): string {
  let highlightedText = text;
  
  searchTerms.forEach(term => {
    if (term.trim()) {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
  });
  
  return highlightedText;
}

/**
 * 検索結果の統計情報を取得
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

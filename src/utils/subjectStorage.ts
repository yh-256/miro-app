import { Subject } from '@/types';

/**
 * 個人IDデータの永続化管理
 * 簡易実装：ローカルストレージを使用（本番環境ではデータベース使用）
 */

// 新しい個人ID用のストレージキー
const PERSONAL_ID_STORAGE_KEY = 'miro-app-personal-ids';
// 旧被写体用のストレージキー（後方互換性のため）
const LEGACY_SUBJECT_STORAGE_KEY = 'miro-app-subjects';

// 現在使用するストレージキー（段階的移行用）
const STORAGE_KEY = PERSONAL_ID_STORAGE_KEY;

/**
 * 個人ID一覧をローカルストレージから取得（自動移行処理付き）
 */
export function getStoredSubjects(): Subject[] {
  if (typeof window === 'undefined') {
    return [];
  }

  // 起動時に旧データから新データへの移行を試行
  migrateLegacySubjectsToPersonalIds();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultPersonalIds();
    }

    const subjects = JSON.parse(stored);
    return subjects.map((subject: { id: string; name: string; createdAt: string; lastUsedAt: string }) => ({
      ...subject,
      createdAt: new Date(subject.createdAt),
      lastUsedAt: new Date(subject.lastUsedAt),
    }));
  } catch (error) {
    console.error('Failed to load personal IDs from storage:', error);
    return getDefaultPersonalIds();
  }
}

/**
 * 被写体一覧をローカルストレージに保存
 */
export function storeSubjects(subjects: Subject[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
  } catch (error) {
    console.error('Failed to save subjects to storage:', error);
  }
}

/**
 * 新しい被写体を追加
 */
export function addSubject(name: string): Subject {
  const subjects = getStoredSubjects();
  const now = new Date();
  
  const newSubject: Subject = {
    id: generateSubjectId(),
    name: name.trim(),
    createdAt: now,
    lastUsedAt: now,
  };

  subjects.push(newSubject);
  storeSubjects(subjects);
  
  return newSubject;
}

/**
 * 被写体の最終使用日時を更新
 */
export function updateSubjectLastUsed(subjectId: string): void {
  const subjects = getStoredSubjects();
  const subject = subjects.find(s => s.id === subjectId);
  
  if (subject) {
    subject.lastUsedAt = new Date();
    storeSubjects(subjects);
  }
}

/**
 * 被写体名の重複チェック
 */
export function isSubjectNameExists(name: string, excludeId?: string): boolean {
  const subjects = getStoredSubjects();
  const normalizedName = name.trim().toLowerCase();
  
  return subjects.some(subject => 
    subject.name.toLowerCase() === normalizedName && 
    subject.id !== excludeId
  );
}

/**
 * 被写体IDを生成
 */
function generateSubjectId(): string {
  return `subject_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 個人ID一覧を使用頻度順でソート
 */
export function sortSubjectsByUsage(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    // 最終使用日時の降順
    return b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
  });
}

/**
 * 被写体検索
 */
export function searchSubjects(query: string): Subject[] {
  const subjects = getStoredSubjects();
  const normalizedQuery = query.trim().toLowerCase();
  
  if (!normalizedQuery) {
    return sortSubjectsByUsage(subjects);
  }
  
  const filtered = subjects.filter(subject =>
    subject.name.toLowerCase().includes(normalizedQuery)
  );
  
  return sortSubjectsByUsage(filtered);
}

/**
 * ストレージをクリアしてデフォルト状態に戻す（開発用）
 */
export function resetSubjectsStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 被写体データのエクスポート（バックアップ用）
 */
export function exportSubjects(): string {
  const subjects = getStoredSubjects();
  return JSON.stringify(subjects, null, 2);
}

/**
 * 被写体データのインポート（復元用）
 */
export function importSubjects(jsonData: string): boolean {
  try {
    const subjects = JSON.parse(jsonData);
    
    // データの検証
    if (!Array.isArray(subjects)) {
      throw new Error('Invalid data format');
    }
    
    for (const subject of subjects) {
      if (!subject.id || !subject.name || !subject.createdAt || !subject.lastUsedAt) {
        throw new Error('Invalid subject data');
      }
    }
    
    storeSubjects(subjects);
    return true;
  } catch (error) {
    console.error('Failed to import subjects:', error);
    return false;
  }
}

/**
 * === 個人ID移行用ユーティリティ ===
 */

/**
 * 旧被写体データから個人IDデータへの移行
 */
export function migrateLegacySubjectsToPersonalIds(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // 新しいストレージに既にデータがある場合は移行しない
    const existingPersonalIds = localStorage.getItem(PERSONAL_ID_STORAGE_KEY);
    if (existingPersonalIds) {
      return false; // 既に移行済み
    }

    // 旧データを取得
    const legacyData = localStorage.getItem(LEGACY_SUBJECT_STORAGE_KEY);
    if (!legacyData) {
      return false; // 移行対象データなし
    }

    // 旧データを新しいストレージにコピー（データ構造は同じため、そのまま移行可能）
    localStorage.setItem(PERSONAL_ID_STORAGE_KEY, legacyData);
    
    console.log('被写体データを個人IDデータに移行しました');
    return true;
  } catch (error) {
    console.error('データ移行に失敗しました:', error);
    return false;
  }
}

/**
 * 個人ID用のデフォルトデータ
 */
function getDefaultPersonalIds(): Subject[] {
  const now = new Date();
  
  return [
    {
      id: 'personal_id_default_001',
      name: '参加者A',
      createdAt: now,
      lastUsedAt: now,
    },
    {
      id: 'personal_id_default_002', 
      name: '参加者B',
      createdAt: now,
      lastUsedAt: now,
    },
    {
      id: 'personal_id_default_003',
      name: '参加者C',
      createdAt: now,
      lastUsedAt: now,
    },
    {
      id: 'personal_id_default_004',
      name: '参加者D',
      createdAt: now,
      lastUsedAt: now,
    },
    {
      id: 'personal_id_default_005',
      name: 'その他',
      createdAt: now,
      lastUsedAt: now,
    },
  ];
}

/**
 * 後方互換性を保つ検索パターン（Miro付箋用）
 */
export const SEARCH_PATTERNS = {
  // 新しい個人IDパターン
  PERSONAL_ID: /個人ID:\s*([^\n\r]+)/,
  // 旧被写体パターン（後方互換性のため）
  LEGACY_SUBJECT: /被写体:\s*([^\n\r]+)/,
} as const;

/**
 * 付箋コンテンツから個人ID情報を抽出（後方互換性付き）
 */
export function extractPersonalIdFromContent(content: string): string | null {
  // まず新しい個人IDパターンを試す
  const personalIdMatch = content.match(SEARCH_PATTERNS.PERSONAL_ID);
  if (personalIdMatch) {
    return personalIdMatch[1].trim();
  }
  
  // 次に旧被写体パターンを試す（後方互換性）
  const legacyMatch = content.match(SEARCH_PATTERNS.LEGACY_SUBJECT);
  if (legacyMatch) {
    return legacyMatch[1].trim();
  }
  
  return null;
}
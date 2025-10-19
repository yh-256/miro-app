import type { ProblemProgressStatus } from '@/constants/problemStatus';

// 個人ID管理
export interface Subject {
  id: string;           // 一意識別子
  name: string;         // 表示名
  createdAt: Date;      // 作成日時
  lastUsedAt: Date;     // 最終使用日時
}

// アップロードセッション
export interface UploadSession {
  sessionId: string;    // セッション識別子
  uploaderName?: string; // アップロード者名（任意）
  timestamp: Date;      // アップロード日時
  boardId: string;      // 送信先ボードID
  images: Array<{
    tempId: string;     // 一時ID
    subjectId: string;  // 個人ID
    filename: string;   // ファイル名
    mimeType: string;   // MIMEタイプ
  }>;
}

// Miroアイテム関連付け
export interface MiroItemGroup {
  groupId: string;      // MiroグループID
  imageId: string;      // Miro画像アイテムID
  stickyNoteId: string; // Miro付箋アイテムID
  metadata: {
    subjectId: string;
    uploaderName?: string;
    uploadedAt: Date;
    sessionId: string;
  };
}

// API レスポンス型
export interface BoardListResponse {
  boards: Array<{
    id: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
  }>;
  success?: boolean;
  error?: string;
  message?: string;
}

export interface SubjectListResponse {
  subjects: Array<{
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt?: string;
  }>;
  success?: boolean;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  success: boolean;
  uploadedItems: Array<{
    imageId: string;
    stickyNoteId: string;
    groupId: string;
  }>;
  skippedItems?: Array<{ fileName: string; reason: string; }>; // スキップされたアイテム情報
  error?: string;
  message?: string;
}

// アップロード進捗管理
export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  message?: string;
}

// Board Selector Props
export interface BoardSelectorProps {
  onBoardSelect: (board: Board | null) => void;
  selectedBoardId?: string;
  className?: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

// 問題（Problem）ドメイン
export interface ProblemProgressSnapshot {
  status: ProblemProgressStatus;
  insightSubmittedAt?: string;
  boardUnlockedAt?: string;
  boardViewedAt?: string;
  completedAt?: string;
}

export interface ProblemSummary extends ProblemProgressSnapshot {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  isActive: boolean;
}

export interface ProblemDetail extends ProblemSummary {
  contentType: string;
  contentBody?: string;
  contentUrl?: string;
  miroBoardId?: string;
  isBoardUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemListResponse {
  problems: ProblemSummary[];
  activeProblemId?: string;
  nextProblemId?: string;
  stats?: {
    total: number;
    completed: number;
    available: number;
  };
}

export interface ProblemDetailResponse {
  problem: ProblemDetail;
  relatedInsights?: InsightSummary[];
}

export interface ProblemProgressUpdatePayload {
  status?: ProblemProgressStatus;
  boardViewed?: boolean;
  completed?: boolean;
}

export interface InsightPayload {
  content: string;
  isPublic?: boolean;
}

export interface InsightSummary {
  id: string;
  problemId: string;
  sessionId: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    sessionId: string;
    displayName?: string;
  };
}

export interface InsightListResponse {
  insights: InsightSummary[];
}

// エラー型
export class UserFriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFriendlyError';
  }
}

export interface MiroApiError {
  code: 'UNAUTHORIZED' | 'RATE_LIMITED' | 'BOARD_NOT_FOUND' | 'UNKNOWN';
  message: string;
}

export type { ProblemProgressStatus } from '@/constants/problemStatus';

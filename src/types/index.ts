import type { ProblemProgressStatus } from "@/constants/problemStatus";

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

export interface UploadResponse {
  success: boolean;
  uploadedItems: Array<{
    imageId: string;
    stickyNoteId: string;
    groupId: string;
  }>;
  skippedItems?: Array<{ fileName: string; reason: string }>; // スキップされたアイテム情報
  error?: string;
  message?: string;
}

// アップロード進捗管理
export interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "error";
  progress?: number;
  message?: string;
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
  isUploadUnlocked: boolean;
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
  userId: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    userId: string;
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
    this.name = "UserFriendlyError";
  }
}

export type { ProblemProgressStatus } from "@/constants/problemStatus";

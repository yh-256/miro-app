import { InsightSummary } from '@/types';

export function mapInsightToSummary(insight: {
  id: string;
  problemId: string;
  userId: string;
  content: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; displayName: string | null };
}): InsightSummary {
  return {
    id: insight.id,
    problemId: insight.problemId,
    userId: insight.userId,
    content: insight.content,
    isPublic: insight.isPublic,
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
    author: insight.user
      ? {
          userId: insight.user.id,
          displayName: insight.user.displayName ?? undefined,
        }
      : {
          userId: insight.userId,
        },
  };
}

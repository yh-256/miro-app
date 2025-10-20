import { InsightSummary } from '@/types';

export function mapInsightToSummary(insight: {
  id: string;
  problemId: string;
  userSessionId: string;
  content: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userSession: { sessionToken: string; displayName: string | null };
}): InsightSummary {
  return {
    id: insight.id,
    problemId: insight.problemId,
    sessionId: insight.userSession.sessionToken,
    content: insight.content,
    isPublic: insight.isPublic,
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
    author: {
      sessionId: insight.userSession.sessionToken,
      displayName: insight.userSession.displayName ?? undefined,
    },
  };
}

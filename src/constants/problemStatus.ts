export const PROBLEM_STATUSES = [
  'LOCKED',
  'AVAILABLE',
  'INSIGHT_WRITTEN',
  'BOARD_VIEWED',
  'COMPLETED',
] as const;

export type ProblemProgressStatus = (typeof PROBLEM_STATUSES)[number];

export const PROBLEM_STATUS_ORDER: Record<ProblemProgressStatus, number> = {
  LOCKED: 0,
  AVAILABLE: 1,
  INSIGHT_WRITTEN: 2,
  BOARD_VIEWED: 3,
  COMPLETED: 4,
};

export const PROBLEM_STATUS_LABEL: Record<ProblemProgressStatus, string> = {
  LOCKED: '未解禁',
  AVAILABLE: '回答可能',
  INSIGHT_WRITTEN: '気づき記入済み',
  BOARD_VIEWED: 'ボード閲覧済み',
  COMPLETED: '完了',
};

export const BOARD_UNLOCKED_STATUSES: ReadonlySet<ProblemProgressStatus> =
  new Set(['INSIGHT_WRITTEN', 'BOARD_VIEWED', 'COMPLETED']);
export const COMPLETED_STATUSES: ReadonlySet<ProblemProgressStatus> = new Set([
  'COMPLETED',
  'BOARD_VIEWED',
]);

export function isProblemProgressStatus(value: unknown): value is ProblemProgressStatus {
  return typeof value === 'string' && PROBLEM_STATUSES.includes(value as ProblemProgressStatus);
}

export function compareProblemStatus(a: ProblemProgressStatus, b: ProblemProgressStatus): number {
  return PROBLEM_STATUS_ORDER[a] - PROBLEM_STATUS_ORDER[b];
}

export function isStatusAtLeast(
  value: ProblemProgressStatus,
  threshold: ProblemProgressStatus
): boolean {
  return PROBLEM_STATUS_ORDER[value] >= PROBLEM_STATUS_ORDER[threshold];
}

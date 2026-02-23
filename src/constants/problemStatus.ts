import { ProblemStatus } from "@prisma/client";

export const PROBLEM_STATUSES = [
  ProblemStatus.LOCKED,
  ProblemStatus.AVAILABLE,
  ProblemStatus.INSIGHT_WRITTEN,
  ProblemStatus.UPLOAD_COMPLETED,
  ProblemStatus.BOARD_VIEWED,
  ProblemStatus.COMPLETED,
] as const;

export type ProblemProgressStatus = ProblemStatus;

export const PROBLEM_STATUS_ORDER: Record<ProblemProgressStatus, number> = {
  [ProblemStatus.LOCKED]: 0,
  [ProblemStatus.AVAILABLE]: 1,
  [ProblemStatus.INSIGHT_WRITTEN]: 2,
  [ProblemStatus.UPLOAD_COMPLETED]: 3,
  [ProblemStatus.BOARD_VIEWED]: 4,
  [ProblemStatus.COMPLETED]: 5,
};

export const PROBLEM_STATUS_LABEL: Record<ProblemProgressStatus, string> = {
  [ProblemStatus.LOCKED]: "未解禁",
  [ProblemStatus.AVAILABLE]: "回答可能",
  [ProblemStatus.INSIGHT_WRITTEN]: "気づき記入済み",
  [ProblemStatus.UPLOAD_COMPLETED]: "アップロード済み",
  [ProblemStatus.BOARD_VIEWED]: "ボード閲覧済み",
  [ProblemStatus.COMPLETED]: "完了",
};

export const BOARD_UNLOCKED_STATUSES: ReadonlySet<ProblemProgressStatus> =
  new Set([
    ProblemStatus.UPLOAD_COMPLETED,
    ProblemStatus.BOARD_VIEWED,
    ProblemStatus.COMPLETED,
  ]);
export const COMPLETED_STATUSES: ReadonlySet<ProblemProgressStatus> = new Set([
  ProblemStatus.COMPLETED,
  ProblemStatus.BOARD_VIEWED,
]);

export function isProblemProgressStatus(
  value: unknown,
): value is ProblemProgressStatus {
  return (
    typeof value === "string" &&
    PROBLEM_STATUSES.includes(value as ProblemProgressStatus)
  );
}

export function compareProblemStatus(
  a: ProblemProgressStatus,
  b: ProblemProgressStatus,
): number {
  return PROBLEM_STATUS_ORDER[a] - PROBLEM_STATUS_ORDER[b];
}

export function isStatusAtLeast(
  value: ProblemProgressStatus,
  threshold: ProblemProgressStatus,
): boolean {
  return PROBLEM_STATUS_ORDER[value] >= PROBLEM_STATUS_ORDER[threshold];
}

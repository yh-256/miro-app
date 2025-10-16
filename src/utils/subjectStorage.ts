import { Subject } from '@/types';
import { toPlainText } from './text';

const API_BASE_URL = typeof window === 'undefined'
  ? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  : '';

const SUBJECTS_ENDPOINT = `${API_BASE_URL}/api/subjects`;

export async function fetchSubjects(query?: string): Promise<Subject[]> {
  const endpoint = query ? `${SUBJECTS_ENDPOINT}/list?query=${encodeURIComponent(query)}` : `${SUBJECTS_ENDPOINT}/list`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error((await response.json().catch(() => ({}))).message ?? '個人IDの取得に失敗しました。');
  }

  const data = (await response.json()) as { subjects: Array<{ id: string; name: string; createdAt: string }>; message?: string };
  return data.subjects.map(subject => ({
    id: subject.id,
    name: subject.name,
    createdAt: new Date(subject.createdAt),
    lastUsedAt: subject.lastUsedAt ? new Date(subject.lastUsedAt) : new Date(subject.createdAt),
  }));
}

export async function createSubject(name: string): Promise<Subject> {
  const response = await fetch(`${SUBJECTS_ENDPOINT}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? '個人IDの作成に失敗しました。');
  }

  const subject = data.subject as { id: string; name: string; createdAt: string };
  return {
    id: subject.id,
    name: subject.name,
    createdAt: new Date(subject.createdAt),
    lastUsedAt: subject.lastUsedAt ? new Date(subject.lastUsedAt) : new Date(subject.createdAt),
  };
}

export function sortSubjectsByUsage(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
}

export const SEARCH_PATTERNS = {
  PERSONAL_ID: /個人ID:\s*([^\n\r]+)/,
  LEGACY_SUBJECT: /被写体:\s*([^\n\r]+)/,
} as const;

export function extractPersonalIdFromContent(content: string): string | null {
  const text = toPlainText(content);
  const personalIdMatch = text.match(SEARCH_PATTERNS.PERSONAL_ID);
  if (personalIdMatch) {
    return personalIdMatch[1].trim();
  }

  const legacyMatch = text.match(SEARCH_PATTERNS.LEGACY_SUBJECT);
  if (legacyMatch) {
    return legacyMatch[1].trim();
  }

  return null;
}

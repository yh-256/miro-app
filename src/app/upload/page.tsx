import { UploadPageClient } from '@/components/UploadPageClient';

type SearchParamsValue = string | string[] | undefined;

interface UploadPageProps {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}

const getSearchParamValue = (value: SearchParamsValue): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const sp = (await searchParams) ?? {};
  const problemIdFromQuery = getSearchParamValue(sp.problemId);
  return <UploadPageClient problemIdFromQuery={problemIdFromQuery} />;
}

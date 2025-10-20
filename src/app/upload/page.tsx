import { UploadPageClient } from '@/components/UploadPageClient';

type SearchParamsValue = string | string[] | undefined;

interface UploadPageProps {
  searchParams?: Record<string, SearchParamsValue>;
}

const getSearchParamValue = (value: SearchParamsValue): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default function UploadPage({ searchParams }: UploadPageProps) {
  const problemIdFromQuery = getSearchParamValue(searchParams?.problemId);

  return <UploadPageClient problemIdFromQuery={problemIdFromQuery} />;
}

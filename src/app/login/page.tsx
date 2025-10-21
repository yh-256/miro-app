import { Suspense } from 'react';
import { Layout, LoginForm } from '@/components';

export default function LoginPage() {
  return (
    <Layout title="ログイン">
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </Layout>
  );
}

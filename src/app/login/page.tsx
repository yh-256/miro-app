import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Layout, LoginForm } from "@/components";
import { getAuthSession } from "@/lib/auth/helpers";

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session.isLoggedIn && session.userId) {
    redirect("/problems");
  }

  return (
    <Layout title="ログイン">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            読み込み中...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </Layout>
  );
}

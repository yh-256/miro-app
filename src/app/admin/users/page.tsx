import { requireAdmin } from "@/lib/auth/helpers";
import { Layout, AdminUsersClient } from "@/components";

export default async function AdminUsersPage() {
  // Server Componentで管理者権限チェック
  await requireAdmin();

  return (
    <Layout title="ユーザー管理">
      <AdminUsersClient />
    </Layout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";

interface User {
  id: string;
  userId: string;
  displayName: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AdminUsersClient() {
  const { showSuccess, showError } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 新規ユーザーフォーム
  const [newUserId, setNewUserId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");

  // ユーザー一覧取得
  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();

      if (!response.ok) {
        showError("エラー", data.message || "ユーザー一覧の取得に失敗しました");
        return;
      }

      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      showError("エラー", "ユーザー一覧の取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新規ユーザー作成
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: newUserId,
          pin: newPin,
          displayName: newDisplayName || undefined,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError("作成失敗", data.message || "ユーザーの作成に失敗しました");
        return;
      }

      showSuccess("作成成功", `ユーザー「${data.user.userId}」を作成しました`);

      // フォームをリセット
      setNewUserId("");
      setNewPin("");
      setNewDisplayName("");
      setNewRole("USER");
      setShowCreateForm(false);

      // ユーザー一覧を再取得
      fetchUsers();
    } catch (error) {
      console.error("Failed to create user:", error);
      showError("エラー", "ユーザー作成中にエラーが発生しました");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">ユーザー管理</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? "キャンセル" : "新規ユーザー作成"}
        </button>
      </div>

      {/* 新規ユーザー作成フォーム */}
      {showCreateForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            新規ユーザー作成
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="userId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  ユーザーID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="userId"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  required
                  minLength={3}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: user001"
                  disabled={creating}
                />
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  PIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="pin"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  required
                  minLength={4}
                  maxLength={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4桁以上のPIN"
                  disabled={creating}
                />
              </div>

              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  表示名
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 田中太郎"
                  disabled={creating}
                />
              </div>

              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  権限 <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as "USER" | "ADMIN")
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                >
                  <option value="USER">一般ユーザー</option>
                  <option value="ADMIN">管理者</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "作成中..." : "ユーザーを作成"}
            </button>
          </form>
        </div>
      )}

      {/* ユーザー一覧テーブル */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザーID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  表示名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  権限
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最終ログイン
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作成日時
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.userId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.displayName || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === "ADMIN"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {user.role === "ADMIN" ? "管理者" : "一般"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString("ja-JP")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            ユーザーが登録されていません
          </div>
        )}
      </div>
    </div>
  );
}

import { miroClient, IMiroClient, MiroApiClient } from "./miroClient";
import { logError } from "./errorHandler";

/**
 * Miroボード上での高度なグループ化とレイアウト管理
 */

export interface UploadedItem {
  imageId: string;
  stickyNoteId: string;
  groupId: string;
  userId: string;
  userDisplayName?: string;
  position: { x: number; y: number };
  fileName: string;
  imageWidth: number;
  imageHeight: number;
  stickyWidth: number;
  stickyHeight: number;
}

export interface UserGroup {
  userId: string;
  userDisplayName?: string;
  items: UploadedItem[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 画像配置の基本設定（実際のMiroアイテムサイズに基づく）
 */
const IMAGE_SIZE = MiroApiClient.DEFAULT_IMAGE_SIZE;
const STICKY_SIZE = Math.round(IMAGE_SIZE * 1.5);

const LAYOUT_CONFIG = {
  IMAGE_WIDTH: IMAGE_SIZE,
  IMAGE_HEIGHT: IMAGE_SIZE,
  STICKY_NOTE_WIDTH: STICKY_SIZE,
  STICKY_NOTE_HEIGHT: STICKY_SIZE,

  IMAGE_SPACING_X: STICKY_SIZE + 120,
  IMAGE_SPACING_Y: STICKY_SIZE + 140,
  ITEMS_PER_ROW: 3,

  USER_GROUP_SPACING: STICKY_SIZE + 300,
};

/**
 * ユーザー別に画像をグループ化してレイアウト
 */
export async function createUserBasedLayout(
  boardId: string,
  uploadItems: Array<{
    imageId: string;
    stickyNoteId: string;
    groupId: string;
    userId: string;
    userDisplayName?: string;
    fileName: string;
    imageWidth: number;
    imageHeight: number;
    stickyWidth: number;
    stickyHeight: number;
  }>,
  basePosition: { x: number; y: number } = { x: 0, y: 0 },
  client: IMiroClient = miroClient,
): Promise<UserGroup[]> {
  try {
    // ユーザー別にアイテムをグループ化
    const userGroups = new Map<string, UserGroup>();

    uploadItems.forEach((item) => {
      if (!userGroups.has(item.userId)) {
        userGroups.set(item.userId, {
          userId: item.userId,
          userDisplayName: item.userDisplayName,
          items: [],
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        });
      }

      const group = userGroups.get(item.userId)!;
      group.items.push({
        imageId: item.imageId,
        stickyNoteId: item.stickyNoteId,
        groupId: item.groupId,
        userId: item.userId,
        userDisplayName: item.userDisplayName,
        position: { x: 0, y: 0 }, // 後で計算
        fileName: item.fileName,
        imageWidth: item.imageWidth,
        imageHeight: item.imageHeight,
        stickyWidth: item.stickyWidth,
        stickyHeight: item.stickyHeight,
      });
    });

    // 各ユーザーグループのレイアウトを計算
    const userGroupsArray = Array.from(userGroups.values());
    let currentUserX = basePosition.x;

    for (
      let groupIndex = 0;
      groupIndex < userGroupsArray.length;
      groupIndex++
    ) {
      const userGroup = userGroupsArray[groupIndex];
      const groupBaseY = basePosition.y;

      // グループ内でのアイテム配置
      await layoutItemsInGroup(
        boardId,
        userGroup,
        {
          x: currentUserX,
          y: groupBaseY,
        },
        client,
      );

      // 次のユーザーグループの中心位置を計算（右端 + 余白 + 付箋半分）
      const groupRightEdge = userGroup.bounds.x + userGroup.bounds.width;
      const halfSticky = LAYOUT_CONFIG.STICKY_NOTE_WIDTH / 2;
      currentUserX =
        groupRightEdge + LAYOUT_CONFIG.USER_GROUP_SPACING + halfSticky;
    }

    return userGroupsArray;
  } catch (error) {
    logError(error as Error, "createUserBasedLayout");
    throw error;
  }
}

/**
 * 1つのユーザーグループ内でアイテムをレイアウト
 */
async function layoutItemsInGroup(
  boardId: string,
  userGroup: UserGroup,
  basePosition: { x: number; y: number },
  client: IMiroClient,
): Promise<void> {
  const items = userGroup.items;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = Math.floor(i / LAYOUT_CONFIG.ITEMS_PER_ROW);
    const col = i % LAYOUT_CONFIG.ITEMS_PER_ROW;

    // アイテムの新しい位置を計算（画像の中心位置）
    const newPosition = {
      x: basePosition.x + col * LAYOUT_CONFIG.IMAGE_SPACING_X,
      y: basePosition.y + row * LAYOUT_CONFIG.IMAGE_SPACING_Y,
    };

    item.position = newPosition;

    try {
      const imageWidth = item.imageWidth || LAYOUT_CONFIG.IMAGE_WIDTH;
      const imageHeight = item.imageHeight || LAYOUT_CONFIG.IMAGE_HEIGHT;
      const stickyWidth = item.stickyWidth || LAYOUT_CONFIG.STICKY_NOTE_WIDTH;
      const stickyHeight =
        item.stickyHeight || LAYOUT_CONFIG.STICKY_NOTE_HEIGHT;

      await client.patchItem(boardId, item.stickyNoteId, {
        position: {
          x: newPosition.x,
          y: newPosition.y,
          origin: "center",
        },
        geometry: {
          width: stickyWidth,
        },
      });

      await client.patchItem(boardId, item.imageId, {
        position: {
          x: newPosition.x,
          y: newPosition.y,
          origin: "center",
        },
        geometry: {
          width: imageWidth,
          height: imageHeight,
        },
      });

      const halfWidth = Math.max(stickyWidth, imageWidth) / 2;
      const halfHeight = Math.max(stickyHeight, imageHeight) / 2;

      const left = newPosition.x - halfWidth;
      const right = newPosition.x + halfWidth;
      const top = newPosition.y - halfHeight;
      const bottom = newPosition.y + halfHeight;

      minLeft = Math.min(minLeft, left);
      maxRight = Math.max(maxRight, right);
      minTop = Math.min(minTop, top);
      maxBottom = Math.max(maxBottom, bottom);
    } catch (error) {
      logError(error as Error, `layoutItemsInGroup - item ${item.imageId}`);
      // 個別のアイテム移動に失敗しても継続
    }
  }

  // グループのバウンディング情報を更新
  const width = maxRight - minLeft;
  const height = maxBottom - minTop;

  userGroup.bounds = {
    x: Number.isFinite(minLeft) ? minLeft : basePosition.x,
    y: Number.isFinite(minTop) ? minTop : basePosition.y,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

/**
 * 指定位置の近くにある画像を検索
 */
// nearby images handled via utils/proximity.ts

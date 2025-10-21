import { miroClient, MiroImageItem, MiroStickyNote, IMiroClient } from './miroClient';
import { logError } from './errorHandler';
import { findNearbyItems } from './proximity';

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
  imageHeight: number; // 画像の実際の高さを追加
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
const LAYOUT_CONFIG = {
  // 実際のMiroアイテムサイズ（miroClient.uploadImageで設定される値）
  IMAGE_WIDTH: 400,           // 画像の実際の幅
  IMAGE_HEIGHT: 400,          // 画像の実際の高さ
  STICKY_NOTE_WIDTH: 200,     // 付箋の推定幅
  STICKY_NOTE_HEIGHT: 120,    // 付箋の高さ
  
  // レイアウト間隔（実際のアイテムサイズ + 余白）
  IMAGE_SPACING_X: 450,       // 画像幅400px + 余白50px
  IMAGE_SPACING_Y: 480,       // 画像高さ400px + 付箋間隔 + 余白
  STICKY_NOTE_OFFSET: 20,     // 画像と付箋の間隔
  ITEMS_PER_ROW: 3,           // 1行あたりのアイテム数
  
  // グループ間隔設定
  USER_GROUP_SPACING: 600, // ユーザーグループ間の間隔
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
    imageHeight: number; // 画像の高さを受け取る
  }>,
  basePosition: { x: number; y: number } = { x: 0, y: 0 },
  client: IMiroClient = miroClient
): Promise<UserGroup[]> {
  try {
    // ユーザー別にアイテムをグループ化
    const userGroups = new Map<string, UserGroup>();
    
    uploadItems.forEach(item => {
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
        imageHeight: item.imageHeight, // 画像の高さを格納
      });
    });

    // 各ユーザーグループのレイアウトを計算
    const userGroupsArray = Array.from(userGroups.values());
    let currentUserX = basePosition.x;
    
    for (let groupIndex = 0; groupIndex < userGroupsArray.length; groupIndex++) {
      const userGroup = userGroupsArray[groupIndex];
      const groupBaseY = basePosition.y;
      
      // グループ内でのアイテム配置
      await layoutItemsInGroup(boardId, userGroup, {
        x: currentUserX,
        y: groupBaseY,
      }, client);
      
      // 次のユーザーグループの位置を計算
      currentUserX += userGroup.bounds.width + LAYOUT_CONFIG.USER_GROUP_SPACING;
    }

    return userGroupsArray;
  } catch (error) {
    logError(error as Error, 'createUserBasedLayout');
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
  client: IMiroClient
): Promise<void> {
  const items = userGroup.items;
  let maxWidth = 0;
  let totalHeight = 0;
  
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
      // 画像の位置を更新
      await client.patchItem(boardId, item.imageId, {
        position: newPosition,
      });

      // 実際の画像の高さを取得（なければデフォルト値を使用）
      const imageHeight = item.imageHeight || LAYOUT_CONFIG.IMAGE_HEIGHT;

      // 付箋の位置を計算して更新（画像の下に配置）
      const stickyNoteY = newPosition.y + 
                        (imageHeight / 2) + 
                        LAYOUT_CONFIG.STICKY_NOTE_OFFSET + 
                        (LAYOUT_CONFIG.STICKY_NOTE_HEIGHT / 2);

      await client.patchItem(boardId, item.stickyNoteId, {
        position: {
          x: newPosition.x,
          y: stickyNoteY,
        },
      });

      // バウンディングボックスを正確に計算
      const itemRight = newPosition.x + (LAYOUT_CONFIG.IMAGE_WIDTH / 2);
      const itemBottom = newPosition.y + 
                         (imageHeight / 2) + 
                         LAYOUT_CONFIG.STICKY_NOTE_OFFSET + 
                         LAYOUT_CONFIG.STICKY_NOTE_HEIGHT;
      
      maxWidth = Math.max(maxWidth, itemRight - basePosition.x);
      totalHeight = Math.max(totalHeight, itemBottom - basePosition.y);
      
    } catch (error) {
      logError(error as Error, `layoutItemsInGroup - item ${item.imageId}`);
      // 個別のアイテム移動に失敗しても継続
    }
  }
  
  // グループのバウンディング情報を更新
  userGroup.bounds = {
    x: basePosition.x,
    y: basePosition.y,
    width: maxWidth,
    height: totalHeight,
  };
}



/**
 * 同一ユーザーの既存アイテムを検索
 */
export async function findExistingUserItems(
  boardId: string,
  userId: string,
  client: IMiroClient = miroClient
): Promise<{ images: MiroImageItem[]; stickyNotes: MiroStickyNote[] }> {
  try {
    // 付箋を検索（メタデータからユーザーIDを抽出）
    const allItems = await client.searchItems(boardId, userId, 'sticky_note');
    const stickyNotes = allItems.filter((item): item is MiroStickyNote => item.type === 'sticky_note');
    
    // 画像アイテムを取得（付箋の近くにある画像を探す）
    const images: MiroImageItem[] = [];
    for (const note of stickyNotes) {
      const nearbyItems = await findNearbyItems(client, boardId, note.position, 'image', 300);
      const nearbyImages = nearbyItems.filter((item): item is MiroImageItem => item.type === 'image');
      images.push(...nearbyImages);
    }
    
    return { images, stickyNotes };
  } catch (error) {
    logError(error as Error, 'findExistingUserItems');
    return { images: [], stickyNotes: [] };
  }
}

/**
 * 指定位置の近くにある画像を検索
 */
// nearby images handled via utils/proximity.ts

/**
 * レイアウト統計情報を取得
 */
export function getLayoutStats(userGroups: UserGroup[]): {
  totalUsers: number;
  totalItems: number;
  layoutBounds: { x: number; y: number; width: number; height: number };
} {
  const totalItems = userGroups.reduce((sum, group) => sum + group.items.length, 0);
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  userGroups.forEach(group => {
    minX = Math.min(minX, group.bounds.x);
    minY = Math.min(minY, group.bounds.y);
    maxX = Math.max(maxX, group.bounds.x + group.bounds.width);
    maxY = Math.max(maxY, group.bounds.y + group.bounds.height);
  });
  
  return {
    totalUsers: userGroups.length,
    totalItems,
    layoutBounds: {
      x: minX === Infinity ? 0 : minX,
      y: minY === Infinity ? 0 : minY,
      width: maxX === -Infinity ? 0 : maxX - minX,
      height: maxY === -Infinity ? 0 : maxY - minY,
    },
  };
}

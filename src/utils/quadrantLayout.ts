import { miroClient, IMiroClient, MiroItem, BoundingBox } from './miroClient';
import { logError } from './errorHandler';

/**
 * 象限の境界情報
 */
export interface QuadrantBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * 象限レイアウト設定
 */
const QUADRANT_CONFIG = {
  QUADRANT_WIDTH: 24000,     // 8000 × 3
  QUADRANT_HEIGHT: 18000,    // 6000 × 3
  GROUP_SPACING: 800,        // グループ間の最小スペース
  MARGIN: 400,               // 象限端からのマージン
  ESTIMATED_GROUP_WIDTH: 600,   // 付箋の幅
  ESTIMATED_GROUP_HEIGHT: 1000, // 画像+付箋の縦積み高さ
};

/**
 * 問題インデックスから象限境界を計算
 */
export function getQuadrantBounds(problemIndex: number): QuadrantBounds {
  const { QUADRANT_WIDTH, QUADRANT_HEIGHT } = QUADRANT_CONFIG;
  
  const quadrantConfigs = [
    { centerX: QUADRANT_WIDTH / 2, centerY: -QUADRANT_HEIGHT / 2 },   // 第1象限（右上）
    { centerX: -QUADRANT_WIDTH / 2, centerY: -QUADRANT_HEIGHT / 2 },  // 第2象限（左上）
    { centerX: -QUADRANT_WIDTH / 2, centerY: QUADRANT_HEIGHT / 2 },   // 第3象限（左下）
    { centerX: QUADRANT_WIDTH / 2, centerY: QUADRANT_HEIGHT / 2 },    // 第4象限（右下）
  ];
  
  const config = quadrantConfigs[problemIndex];
  
  return {
    minX: config.centerX - QUADRANT_WIDTH / 2,
    maxX: config.centerX + QUADRANT_WIDTH / 2,
    minY: config.centerY - QUADRANT_HEIGHT / 2,
    maxY: config.centerY + QUADRANT_HEIGHT / 2,
    centerX: config.centerX,
    centerY: config.centerY,
    width: QUADRANT_WIDTH,
    height: QUADRANT_HEIGHT,
  };
}

/**
 * 象限内の既存グループを取得
 */
export async function getExistingGroupsInQuadrant(
  boardId: string,
  bounds: QuadrantBounds,
  client: IMiroClient = miroClient
): Promise<Array<{ item: MiroItem; bbox: BoundingBox | null }>> {
  try {
    // ボード上の全グループを取得
    const allGroups = await client.getAllItems(boardId, 'group');
    
    // 象限内のグループをフィルタリング
    const groupsInQuadrant = allGroups.filter(group => {
      const pos = group.position;
      return (
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY
      );
    });

    // 各グループのバウンディングボックスを取得
    const groupsWithBBox: Array<{ item: MiroItem; bbox: BoundingBox | null }> = [];
    
    for (const group of groupsInQuadrant) {
      const bbox = await client.getGroupBoundingBox(boardId, group.id);
      groupsWithBBox.push({ item: group, bbox });
    }

    return groupsWithBBox;
  } catch (error) {
    logError(error as Error, 'getExistingGroupsInQuadrant');
    return [];
  }
}

/**
 * 象限内で空いている位置を見つける（右端配置方式）
 */
export function findAvailablePositionInQuadrant(
  bounds: QuadrantBounds,
  existingGroups: Array<{ item: MiroItem; bbox: BoundingBox | null }>
): { x: number; y: number } {
  const { GROUP_SPACING, MARGIN, ESTIMATED_GROUP_WIDTH } = QUADRANT_CONFIG;

  // 既存グループがない場合は象限の左端から開始
  if (existingGroups.length === 0) {
    return {
      x: bounds.minX + MARGIN + ESTIMATED_GROUP_WIDTH / 2,
      y: bounds.centerY,
    };
  }

  // 既存グループの最も右端を見つける
  let maxRightX = bounds.minX + MARGIN;
  
  for (const { item, bbox } of existingGroups) {
    if (bbox) {
      // バウンディングボックスがある場合はそれを使用
      maxRightX = Math.max(maxRightX, bbox.right);
    } else {
      // バウンディングボックスがない場合は推定サイズを使用
      maxRightX = Math.max(maxRightX, item.position.x + ESTIMATED_GROUP_WIDTH / 2);
    }
  }

  // 新しい配置位置（最も右端 + スペーシング + 新グループの半分幅）
  const newX = maxRightX + GROUP_SPACING + ESTIMATED_GROUP_WIDTH / 2;

  // 象限を超える場合は2行目に配置
  if (newX + ESTIMATED_GROUP_WIDTH / 2 > bounds.maxX - MARGIN) {
    // 最も下の行を見つける
    let maxBottomY = bounds.minY + MARGIN;
    
    for (const { item, bbox } of existingGroups) {
      if (bbox) {
        maxBottomY = Math.max(maxBottomY, bbox.bottom);
      } else {
        // 推定の高さ
        const estimatedHeight = QUADRANT_CONFIG.ESTIMATED_GROUP_HEIGHT;
        maxBottomY = Math.max(maxBottomY, item.position.y + estimatedHeight / 2);
      }
    }

    const ROW_SPACING = 1000;
    const newY = maxBottomY + ROW_SPACING;

    // 2行目も象限を超える場合は中央に配置（警告）
    if (newY > bounds.maxY - MARGIN) {
      console.warn('Quadrant is full, placing at center');
      return { x: bounds.centerX, y: bounds.centerY };
    }

    return {
      x: bounds.minX + MARGIN + ESTIMATED_GROUP_WIDTH / 2,
      y: newY,
    };
  }

  return { x: newX, y: bounds.centerY };
}

/**
 * メイン関数: 象限内の空き位置を自動計算
 */
export async function calculateQuadrantPosition(
  boardId: string,
  problemIndex: number,
  client: IMiroClient = miroClient
): Promise<{ x: number; y: number }> {
  try {
    // 象限境界を取得
    const bounds = getQuadrantBounds(problemIndex);
    
    // 既存グループを取得
    const existingGroups = await getExistingGroupsInQuadrant(boardId, bounds, client);
    
    console.log(`Quadrant ${problemIndex + 1}: Found ${existingGroups.length} existing groups`);
    
    // 空き位置を計算
    const position = findAvailablePositionInQuadrant(bounds, existingGroups);
    
    console.log(`Quadrant ${problemIndex + 1}: New position (${position.x}, ${position.y})`);
    
    return position;
  } catch (error) {
    logError(error as Error, 'calculateQuadrantPosition');
    
    // エラー時はフォールバック（象限中心）
    const bounds = getQuadrantBounds(problemIndex);
    return { x: bounds.centerX, y: bounds.centerY };
  }
}

/**
 * ランダム配置設定
 */
const RANDOM_PLACEMENT_CONFIG = {
  BOARD_WIDTH: 48000,        // 16000 × 3 (= QUADRANT_WIDTH × 2)
  BOARD_HEIGHT: 36000,       // 12000 × 3 (= QUADRANT_HEIGHT × 2)
  ESTIMATED_GROUP_WIDTH: 600,   // 付箋の幅
  ESTIMATED_GROUP_HEIGHT: 1000, // 画像+付箋の縦積み高さ
  MIN_SPACING: 800,
  MAX_RETRY_ATTEMPTS: 10,  // 最大試行回数
};

/**
 * 指定位置が既存グループと衝突するかチェック
 * 
 * @param candidatePosition - 候補となる配置位置
 * @param estimatedSize - 新グループの推定サイズ（幅・高さ）
 * @param existingGroups - 既存のグループリスト
 * @param minSpacing - グループ間の最小スペース
 * @returns true=衝突あり, false=衝突なし
 */
export function hasCollision(
  candidatePosition: { x: number; y: number },
  estimatedSize: { width: number; height: number },
  existingGroups: Array<{ item: MiroItem; bbox: BoundingBox | null }>,
  minSpacing: number = 800
): boolean {
  // 候補位置のバウンディングボックスを計算（中心座標ベース）
  const candidateBox = {
    left: candidatePosition.x - estimatedSize.width / 2,
    right: candidatePosition.x + estimatedSize.width / 2,
    top: candidatePosition.y - estimatedSize.height / 2,
    bottom: candidatePosition.y + estimatedSize.height / 2,
  };
  
  // 各既存グループとの衝突をチェック
  for (const { item, bbox } of existingGroups) {
    let existingBox;
    
    if (bbox) {
      // バウンディングボックスがある場合
      existingBox = {
        left: bbox.x,
        right: bbox.right,
        top: bbox.y,
        bottom: bbox.bottom,
      };
    } else {
      // バウンディングボックスがない場合は推定サイズを使用
      existingBox = {
        left: item.position.x - estimatedSize.width / 2,
        right: item.position.x + estimatedSize.width / 2,
        top: item.position.y - estimatedSize.height / 2,
        bottom: item.position.y + estimatedSize.height / 2,
      };
    }
    
    // AABB（Axis-Aligned Bounding Box）による衝突判定
    // スペーシングを考慮して判定範囲を拡大
    const horizontalOverlap = 
      candidateBox.left < existingBox.right + minSpacing &&
      candidateBox.right > existingBox.left - minSpacing;
      
    const verticalOverlap = 
      candidateBox.top < existingBox.bottom + minSpacing &&
      candidateBox.bottom > existingBox.top - minSpacing;
    
    if (horizontalOverlap && verticalOverlap) {
      return true;  // 衝突あり
    }
  }
  
  return false;  // 衝突なし
}

/**
 * ボードIDに基づいてランダムな座標を生成（汎用版）
 * 
 * @param seed - ランダムシードとして使用する文字列
 * @param boardWidth - ボードの幅
 * @param boardHeight - ボードの高さ
 * @returns ボード上のランダム座標
 */
function generateRandomBasePosition(
  seed: string, 
  boardWidth: number, 
  boardHeight: number
): { x: number; y: number } {
  // シード値からハッシュを生成
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;  // 32ビット整数に変換
  }
  
  // ハッシュから疑似乱数を生成
  const random1 = Math.abs(Math.sin(hash) * 10000) % 1;
  const random2 = Math.abs(Math.sin(hash + 1) * 10000) % 1;
  
  return {
    x: Math.round((random1 - 0.5) * boardWidth),
    y: Math.round((random2 - 0.5) * boardHeight),
  };
}

/**
 * ボード全体からランダムな位置を見つける（衝突回避付き）
 * 
 * @param boardId - Miroボード ID
 * @param seed - ランダムシード（boardId + problemIndex等）
 * @param client - Miro APIクライアント
 * @param alreadyUploadedPositions - 同じリクエスト内で既にアップロードした画像の座標リスト
 * @returns 配置座標
 */
export async function calculateRandomPositionWithCollisionAvoidance(
  boardId: string,
  seed: string,
  client: IMiroClient = miroClient,
  alreadyUploadedPositions: Array<{ x: number; y: number }> = []
): Promise<{ x: number; y: number }> {
  try {
    const config = RANDOM_PLACEMENT_CONFIG;
    
    // ボード上の既存グループを全て取得
    console.log(`Board ${boardId}: Fetching existing groups for collision check...`);
    const allGroups = await client.getAllItems(boardId, 'group');
    
    // バウンディングボックスを取得
    const groupsWithBBox: Array<{ item: MiroItem; bbox: BoundingBox | null }> = [];
    for (const group of allGroups) {
      const bbox = await client.getGroupBoundingBox(boardId, group.id);
      groupsWithBBox.push({ item: group, bbox });
    }
    
    // 同じリクエスト内で既にアップロードした座標も追加（衝突回避用）
    for (const pos of alreadyUploadedPositions) {
      groupsWithBBox.push({
        item: {
          id: 'temp-upload',
          type: 'group',
          position: pos,
        } as MiroItem,
        bbox: null, // 推定サイズで判定
      });
    }
    
    console.log(`Board ${boardId}: Found ${allGroups.length} existing groups + ${alreadyUploadedPositions.length} pending uploads`);
    
    // 衝突しない位置が見つかるまでリトライ
    for (let attempt = 0; attempt < config.MAX_RETRY_ATTEMPTS; attempt++) {
      // シード値にattemptを加えて異なる座標を生成
      const attemptSeed = `${seed}-attempt-${attempt}`;
      const candidatePosition = generateRandomBasePosition(attemptSeed, config.BOARD_WIDTH, config.BOARD_HEIGHT);
      
      // 衝突チェック
      const collision = hasCollision(
        candidatePosition,
        { width: config.ESTIMATED_GROUP_WIDTH, height: config.ESTIMATED_GROUP_HEIGHT },
        groupsWithBBox,
        config.MIN_SPACING
      );
      
      if (!collision) {
        console.log(`Board ${boardId}: Found collision-free position at (${candidatePosition.x}, ${candidatePosition.y}) after ${attempt + 1} attempt(s)`);
        return candidatePosition;
      }
      
      console.log(`Board ${boardId}: Attempt ${attempt + 1} - collision detected, retrying...`);
    }
    
    // 最大試行回数に達した場合は最後の候補を使用（警告）
    const fallbackSeed = `${seed}-fallback`;
    const fallbackPosition = generateRandomBasePosition(fallbackSeed, config.BOARD_WIDTH, config.BOARD_HEIGHT);
    console.warn(`Board ${boardId}: Max retry attempts reached, using fallback position (${fallbackPosition.x}, ${fallbackPosition.y})`);
    
    return fallbackPosition;
    
  } catch (error) {
    logError(error as Error, 'calculateRandomPositionWithCollisionAvoidance');
    
    // エラー時はシンプルなランダム配置にフォールバック
    return generateRandomBasePosition(seed, 
      RANDOM_PLACEMENT_CONFIG.BOARD_WIDTH, 
      RANDOM_PLACEMENT_CONFIG.BOARD_HEIGHT);
  }
}

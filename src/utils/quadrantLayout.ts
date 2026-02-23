import { miroClient, IMiroClient, MiroItem, BoundingBox } from "./miroClient";
import { logError } from "./errorHandler";

/**
 * 象限の境界情報
 */
interface QuadrantBounds {
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
  QUADRANT_WIDTH: 24000, // 8000 × 3
  QUADRANT_HEIGHT: 18000, // 6000 × 3
  GROUP_SPACING: 800, // グループ間の最小スペース
  MARGIN: 400, // 象限端からのマージン
  ESTIMATED_GROUP_WIDTH: 600, // 付箋の幅
  ESTIMATED_GROUP_HEIGHT: 1000, // 画像+付箋の縦積み高さ
};

/**
 * 問題インデックスから象限境界を計算
 */
function getQuadrantBounds(problemIndex: number): QuadrantBounds {
  const { QUADRANT_WIDTH, QUADRANT_HEIGHT } = QUADRANT_CONFIG;

  const quadrantConfigs = [
    { centerX: QUADRANT_WIDTH / 2, centerY: -QUADRANT_HEIGHT / 2 }, // 第1象限（右上）
    { centerX: -QUADRANT_WIDTH / 2, centerY: -QUADRANT_HEIGHT / 2 }, // 第2象限（左上）
    { centerX: -QUADRANT_WIDTH / 2, centerY: QUADRANT_HEIGHT / 2 }, // 第3象限（左下）
    { centerX: QUADRANT_WIDTH / 2, centerY: QUADRANT_HEIGHT / 2 }, // 第4象限（右下）
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
async function getExistingGroupsInQuadrant(
  boardId: string,
  bounds: QuadrantBounds,
  client: IMiroClient = miroClient,
): Promise<Array<{ item: MiroItem; bbox: BoundingBox | null }>> {
  try {
    // ボード上の全グループを取得
    const allGroups = await client.getAllItems(boardId, "group");

    // 象限内のグループをフィルタリング
    const groupsInQuadrant = allGroups.filter((group) => {
      const pos = group.position;
      return (
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY
      );
    });

    // 各グループのバウンディングボックスを取得
    const groupsWithBBox: Array<{ item: MiroItem; bbox: BoundingBox | null }> =
      [];

    for (const group of groupsInQuadrant) {
      const bbox = await client.getGroupBoundingBox(boardId, group.id);
      groupsWithBBox.push({ item: group, bbox });
    }

    return groupsWithBBox;
  } catch (error) {
    logError(error as Error, "getExistingGroupsInQuadrant");
    return [];
  }
}

/**
 * 2点間の距離を計算
 */
function getDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
): number {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

/**
 * グリッドベースで象限内の候補位置を生成
 * 左上から右下へ、行ごとに候補を生成
 */
function generateGridCandidates(
  bounds: QuadrantBounds,
  groupSize: { width: number; height: number },
  spacing: number,
  margin: number,
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [];

  // グリッドのステップサイズ
  const stepX = groupSize.width + spacing;
  const stepY = groupSize.height + spacing;

  // 配置可能な範囲
  const startX = bounds.minX + margin + groupSize.width / 2;
  const endX = bounds.maxX - margin - groupSize.width / 2;
  const startY = bounds.minY + margin + groupSize.height / 2;
  const endY = bounds.maxY - margin - groupSize.height / 2;

  // グリッド候補を生成（左上→右下）
  for (let y = startY; y <= endY; y += stepY) {
    for (let x = startX; x <= endX; x += stepX) {
      candidates.push({ x, y });
    }
  }

  return candidates;
}

/**
 * 象限内で空いている位置を見つける（衝突回避グリッド配置）
 * 既存グループのBBoxを考慮して、確実に重ならない位置を探索
 */
function findAvailablePositionInQuadrant(
  bounds: QuadrantBounds,
  existingGroups: Array<{ item: MiroItem; bbox: BoundingBox | null }>,
  randomOffset: number = 0,
): { x: number; y: number } {
  const {
    GROUP_SPACING,
    MARGIN,
    ESTIMATED_GROUP_WIDTH,
    ESTIMATED_GROUP_HEIGHT,
  } = QUADRANT_CONFIG;
  const newGroupSize = {
    width: ESTIMATED_GROUP_WIDTH,
    height: ESTIMATED_GROUP_HEIGHT,
  };

  // 初期候補位置（左上から開始、オフセット適用）
  const initialX = bounds.minX + MARGIN + ESTIMATED_GROUP_WIDTH / 2;
  const initialY = bounds.minY + MARGIN + ESTIMATED_GROUP_HEIGHT / 2;
  const preferredPosition = {
    x: initialX + randomOffset * (GROUP_SPACING + ESTIMATED_GROUP_WIDTH),
    y: initialY,
  };

  // グリッド候補を生成
  const candidates = generateGridCandidates(
    bounds,
    newGroupSize,
    GROUP_SPACING,
    MARGIN,
  );

  // 初期位置を最優先候補として追加
  const allCandidates = [preferredPosition, ...candidates];

  // 初期位置からの距離でソート（最短移動を優先）
  allCandidates.sort(
    (a, b) =>
      getDistance(preferredPosition, a) - getDistance(preferredPosition, b),
  );

  // 衝突しない最初の候補を返す
  for (const candidate of allCandidates) {
    if (!hasCollision(candidate, newGroupSize, existingGroups, GROUP_SPACING)) {
      return candidate;
    }
  }

  // すべての候補が衝突する場合は中央に配置（警告）
  console.warn(
    "Quadrant is full, all grid positions occupied. Placing at center.",
  );
  return { x: bounds.centerX, y: bounds.centerY };
}

/**
 * メイン関数: 象限内の空き位置を自動計算
 */
export async function calculateQuadrantPosition(
  boardId: string,
  problemIndex: number,
  client: IMiroClient = miroClient,
  alreadyUploadedPositions: Array<{ x: number; y: number }> = [],
  uploadSeed: string = Date.now().toString(),
): Promise<{ x: number; y: number }> {
  try {
    // 象限境界を取得
    const bounds = getQuadrantBounds(problemIndex);

    // 既存グループを取得
    const existingGroups = await getExistingGroupsInQuadrant(
      boardId,
      bounds,
      client,
    );

    // 同じリクエスト内で既にアップロードした座標も追加（衝突回避用）
    for (const pos of alreadyUploadedPositions) {
      // 同じ象限内の座標のみを考慮
      if (
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY
      ) {
        existingGroups.push({
          item: {
            id: "temp-upload",
            type: "group",
            position: pos,
          } as MiroItem,
          bbox: null, // 推定サイズで判定
        });
      }
    }

    console.log(
      `Quadrant ${problemIndex + 1}: Found ${existingGroups.length} existing groups (including ${
        alreadyUploadedPositions.filter(
          (pos) =>
            pos.x >= bounds.minX &&
            pos.x <= bounds.maxX &&
            pos.y >= bounds.minY &&
            pos.y <= bounds.maxY,
        ).length
      } pending uploads)`,
    );

    // シードからハッシュベースのランダムオフセットを生成
    // これにより、Miro APIがグループを返さない場合でも異なる位置に配置される
    let hash = 0;
    for (let i = 0; i < uploadSeed.length; i++) {
      hash = uploadSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const randomOffset = Math.abs(hash) % 10; // 0-9のオフセット

    // 空き位置を計算
    const position = findAvailablePositionInQuadrant(
      bounds,
      existingGroups,
      randomOffset,
    );

    console.log(
      `Quadrant ${problemIndex + 1}: New position (${position.x}, ${position.y}) with seed-based offset ${randomOffset}`,
    );

    return position;
  } catch (error) {
    logError(error as Error, "calculateQuadrantPosition");

    // エラー時はフォールバック（象限中心）
    const bounds = getQuadrantBounds(problemIndex);
    return { x: bounds.centerX, y: bounds.centerY };
  }
}

/**
 * ランダム配置設定
 */
const RANDOM_PLACEMENT_CONFIG = {
  BOARD_WIDTH: 48000, // 16000 × 3 (= QUADRANT_WIDTH × 2)
  BOARD_HEIGHT: 36000, // 12000 × 3 (= QUADRANT_HEIGHT × 2)
  ESTIMATED_GROUP_WIDTH: 600, // 付箋の幅
  ESTIMATED_GROUP_HEIGHT: 1000, // 画像+付箋の縦積み高さ
  MIN_SPACING: 800,
  MAX_RETRY_ATTEMPTS: 10, // 最大試行回数
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
function hasCollision(
  candidatePosition: { x: number; y: number },
  estimatedSize: { width: number; height: number },
  existingGroups: Array<{ item: MiroItem; bbox: BoundingBox | null }>,
  minSpacing: number = 800,
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
      return true; // 衝突あり
    }
  }

  return false; // 衝突なし
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
  boardHeight: number,
): { x: number; y: number } {
  // シード値からハッシュを生成
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // 32ビット整数に変換
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
 * ボード全体でグリッドベースの候補位置を生成
 */
function generateBoardGridCandidates(
  boardWidth: number,
  boardHeight: number,
  groupSize: { width: number; height: number },
  spacing: number,
  initialPosition: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [];

  const stepX = groupSize.width + spacing;
  const stepY = groupSize.height + spacing;

  const startX = -boardWidth / 2 + groupSize.width / 2;
  const endX = boardWidth / 2 - groupSize.width / 2;
  const startY = -boardHeight / 2 + groupSize.height / 2;
  const endY = boardHeight / 2 - groupSize.height / 2;

  // グリッド候補を生成
  for (let y = startY; y <= endY; y += stepY) {
    for (let x = startX; x <= endX; x += stepX) {
      candidates.push({ x, y });
    }
  }

  // 初期位置からの距離でソート
  candidates.sort(
    (a, b) => getDistance(initialPosition, a) - getDistance(initialPosition, b),
  );

  return candidates;
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
  alreadyUploadedPositions: Array<{ x: number; y: number }> = [],
): Promise<{ x: number; y: number }> {
  try {
    const config = RANDOM_PLACEMENT_CONFIG;

    // ボード上の既存グループを全て取得
    console.log(
      `Board ${boardId}: Fetching existing groups for collision check...`,
    );
    const allGroups = await client.getAllItems(boardId, "group");

    // バウンディングボックスを取得
    const groupsWithBBox: Array<{ item: MiroItem; bbox: BoundingBox | null }> =
      [];
    for (const group of allGroups) {
      const bbox = await client.getGroupBoundingBox(boardId, group.id);
      groupsWithBBox.push({ item: group, bbox });
    }

    // 同じリクエスト内で既にアップロードした座標も追加（衝突回避用）
    for (const pos of alreadyUploadedPositions) {
      groupsWithBBox.push({
        item: {
          id: "temp-upload",
          type: "group",
          position: pos,
        } as MiroItem,
        bbox: null, // 推定サイズで判定
      });
    }

    console.log(
      `Board ${boardId}: Found ${allGroups.length} existing groups + ${alreadyUploadedPositions.length} pending uploads`,
    );

    const groupSize = {
      width: config.ESTIMATED_GROUP_WIDTH,
      height: config.ESTIMATED_GROUP_HEIGHT,
    };

    // 初期位置（シードベース）を生成
    const initialPosition = generateRandomBasePosition(
      seed,
      config.BOARD_WIDTH,
      config.BOARD_HEIGHT,
    );

    // 初期位置が衝突しないかチェック
    if (
      !hasCollision(
        initialPosition,
        groupSize,
        groupsWithBBox,
        config.MIN_SPACING,
      )
    ) {
      console.log(
        `Board ${boardId}: Initial position (${initialPosition.x}, ${initialPosition.y}) is collision-free`,
      );
      return initialPosition;
    }

    // グリッドベースで候補を生成（初期位置から近い順）
    console.log(
      `Board ${boardId}: Initial position has collision, searching grid...`,
    );
    const candidates = generateBoardGridCandidates(
      config.BOARD_WIDTH,
      config.BOARD_HEIGHT,
      groupSize,
      config.MIN_SPACING,
      initialPosition,
    );

    // 最初の100候補まで探索（パフォーマンス考慮）
    const searchLimit = Math.min(100, candidates.length);
    for (let i = 0; i < searchLimit; i++) {
      const candidate = candidates[i];
      if (
        !hasCollision(candidate, groupSize, groupsWithBBox, config.MIN_SPACING)
      ) {
        console.log(
          `Board ${boardId}: Found collision-free position at (${candidate.x}, ${candidate.y}) after ${i + 1} grid checks`,
        );
        return candidate;
      }
    }

    // グリッド探索でも見つからない場合は、ランダムリトライ
    console.log(
      `Board ${boardId}: Grid search failed, falling back to random attempts...`,
    );
    for (let attempt = 0; attempt < config.MAX_RETRY_ATTEMPTS; attempt++) {
      const attemptSeed = `${seed}-attempt-${attempt}`;
      const candidatePosition = generateRandomBasePosition(
        attemptSeed,
        config.BOARD_WIDTH,
        config.BOARD_HEIGHT,
      );

      if (
        !hasCollision(
          candidatePosition,
          groupSize,
          groupsWithBBox,
          config.MIN_SPACING,
        )
      ) {
        console.log(
          `Board ${boardId}: Found collision-free position at (${candidatePosition.x}, ${candidatePosition.y}) after ${attempt + 1} random attempt(s)`,
        );
        return candidatePosition;
      }
    }

    // 最大試行回数に達した場合は最後の候補を使用（警告）
    const fallbackSeed = `${seed}-fallback`;
    const fallbackPosition = generateRandomBasePosition(
      fallbackSeed,
      config.BOARD_WIDTH,
      config.BOARD_HEIGHT,
    );
    console.warn(
      `Board ${boardId}: Max retry attempts reached, using fallback position (${fallbackPosition.x}, ${fallbackPosition.y})`,
    );

    return fallbackPosition;
  } catch (error) {
    logError(error as Error, "calculateRandomPositionWithCollisionAvoidance");

    // エラー時はシンプルなランダム配置にフォールバック
    return generateRandomBasePosition(
      seed,
      RANDOM_PLACEMENT_CONFIG.BOARD_WIDTH,
      RANDOM_PLACEMENT_CONFIG.BOARD_HEIGHT,
    );
  }
}

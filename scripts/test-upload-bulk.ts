/**
 * 一括アップロードテストスクリプト
 * 各問題に50枚の画像をアップロードして、象限分割をテストする
 */

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// 設定
const CONFIG = {
  IMAGES_PER_PROBLEM: 8,          // 各問題にアップロードする画像数
  BATCH_SIZE: 5,                    // 一度にアップロードする画像数
  DELAY_BETWEEN_BATCHES: 2000,      // バッチ間の待機時間（ミリ秒）
  DELAY_BETWEEN_PROBLEMS: 5000,     // 問題間の待機時間（ミリ秒）
  IMAGE_SIZE: 400,                  // 生成する画像のサイズ
  API_ENDPOINT: 'http://localhost:3000/api/upload/images', // APIエンドポイント
  TEST_PROBLEM_COUNT: 15,           // テストする問題数（最大15）
};

// カラーパレット（視認性の高い色）
const COLORS = [
  { r: 255, g: 100, b: 100 }, // 赤
  { r: 100, g: 255, b: 100 }, // 緑
  { r: 100, g: 100, b: 255 }, // 青
  { r: 255, g: 255, b: 100 }, // 黄
  { r: 255, g: 100, b: 255 }, // マゼンタ
  { r: 100, g: 255, b: 255 }, // シアン
  { r: 255, g: 150, b: 100 }, // オレンジ
  { r: 150, g: 100, b: 255 }, // 紫
];

/**
 * カラフルなダミー画像を生成
 */
async function generateDummyImage(
  index: number,
  problemIndex: number
): Promise<{ data: string; name: string }> {
  const color = COLORS[index % COLORS.length];
  
  // 単色の背景 + テキスト（問題番号とインデックス）
  const svg = `
    <svg width="${CONFIG.IMAGE_SIZE}" height="${CONFIG.IMAGE_SIZE}">
      <rect width="100%" height="100%" fill="rgb(${color.r},${color.g},${color.b})"/>
      <text x="50%" y="45%" font-size="60" font-weight="bold" text-anchor="middle" fill="white">
        問題${problemIndex}
      </text>
      <text x="50%" y="60%" font-size="40" text-anchor="middle" fill="white">
        画像${index + 1}
      </text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  const base64 = buffer.toString('base64');
  
  return {
    data: `data:image/png;base64,${base64}`,
    name: `test-problem${problemIndex}-image${index + 1}.png`,
  };
}

/**
 * 待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * APIにアップロード
 */
async function uploadBatch(
  images: Array<{ data: string; name: string }>,
  problemId: string,
  userId: string,
  userDisplayName: string,
  boardId: string
): Promise<void> {
  const sessionId = `test-session-${randomUUID()}`;
  
  const requestBody = {
    images: images.map(img => ({
      name: img.name,
      data: img.data,
      type: 'image/png',
    })),
    boardId,
    problemId,
    metadata: images.map(() => ({
      userId,
      userLoginId: userDisplayName,
      userDisplayName,
      uploaderName: 'テストスクリプト',
      sessionId,
    })),
  };

  const response = await fetch(CONFIG.API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`アップロード失敗: ${response.status} - ${error}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`アップロード失敗: ${result.message}`);
  }
}

/**
 * 1つの問題に対してアップロード
 */
async function uploadForProblem(
  problem: { id: string; orderIndex: number; title: string; miroBoardId: string | null },
  user: { id: string; userId: string; displayName: string | null }
): Promise<void> {
  const boardId = problem.miroBoardId;
  
  if (!boardId) {
    console.log(`\n[${problem.orderIndex}/${CONFIG.TEST_PROBLEM_COUNT}] ⚠️  問題 #${problem.orderIndex}: ボードIDが未設定のためスキップ`);
    return;
  }
  
  console.log(`\n[${problem.orderIndex}/${CONFIG.TEST_PROBLEM_COUNT}] 問題 #${problem.orderIndex}: ${problem.title}`);
  console.log(`  対象ボード: ${boardId}`);
  console.log(`  アップロードユーザー: ${user.displayName || user.userId}`);
  console.log(`  画像数: ${CONFIG.IMAGES_PER_PROBLEM}枚\n`);

  // 画像を生成
  console.log('  📸 画像を生成中...');
  const images: Array<{ data: string; name: string }> = [];
  for (let i = 0; i < CONFIG.IMAGES_PER_PROBLEM; i++) {
    const image = await generateDummyImage(i, problem.orderIndex);
    images.push(image);
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  📸 画像生成: ${i + 1}/${CONFIG.IMAGES_PER_PROBLEM}`);
    }
  }
  console.log(`\r  ✓ 画像生成完了: ${CONFIG.IMAGES_PER_PROBLEM}枚\n`);

  // バッチに分けてアップロード
  const batches = Math.ceil(images.length / CONFIG.BATCH_SIZE);
  let uploadedCount = 0;

  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const start = batchIndex * CONFIG.BATCH_SIZE;
    const end = Math.min(start + CONFIG.BATCH_SIZE, images.length);
    const batch = images.slice(start, end);

    try {
      await uploadBatch(batch, problem.id, user.id, user.displayName || user.userId, boardId);
      uploadedCount += batch.length;
      
      process.stdout.write(
        `\r  ⬆️  アップロード中: ${uploadedCount}/${CONFIG.IMAGES_PER_PROBLEM} ` +
        `(バッチ ${batchIndex + 1}/${batches})`
      );

      // バッチ間で待機（最後のバッチ以外）
      if (batchIndex < batches - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    } catch (error) {
      console.error(`\n  ❌ エラー: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  console.log(`\n  ✓ アップロード完了: ${uploadedCount}枚\n`);
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 一括アップロードテスト開始\n');
  console.log('設定:');
  console.log(`  - テスト問題数: ${CONFIG.TEST_PROBLEM_COUNT}問`);
  console.log(`  - 各問題の画像数: ${CONFIG.IMAGES_PER_PROBLEM}枚`);
  console.log(`  - バッチサイズ: ${CONFIG.BATCH_SIZE}枚`);
  console.log(`  - バッチ間待機: ${CONFIG.DELAY_BETWEEN_BATCHES}ms`);
  console.log(`  - 問題間待機: ${CONFIG.DELAY_BETWEEN_PROBLEMS}ms\n`);

  try {
    // 問題一覧を取得
    console.log('📋 問題一覧を取得中...');
    const problems = await prisma.problem.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      take: CONFIG.TEST_PROBLEM_COUNT,
      select: {
        id: true,
        orderIndex: true,
        title: true,
        miroBoardId: true,
      },
    });

    if (problems.length === 0) {
      throw new Error('アクティブな問題が見つかりません');
    }

    console.log(`✓ ${problems.length}件の問題を取得\n`);
    
    // ボード共有状況を分析
    const boardMap = new Map<string, number>();
    problems.forEach(p => {
      if (p.miroBoardId) {
        boardMap.set(p.miroBoardId, (boardMap.get(p.miroBoardId) || 0) + 1);
      }
    });
    
    console.log('📊 ボード共有状況:');
    boardMap.forEach((count, boardId) => {
      const arrangement = count === 4 ? '4象限配置' : 'ランダム配置';
      console.log(`  - ${boardId}: ${count}問題 → ${arrangement}`);
    });
    console.log();

    // ユーザーを取得（最初のアクティブユーザー）
    console.log('👤 ユーザーを取得中...');
    const user = await prisma.user.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        userId: true,
        displayName: true,
      },
    });

    if (!user) {
      throw new Error('アクティブなユーザーが見つかりません');
    }

    console.log(`✓ ユーザー: ${user.displayName || user.userId}\n`);

    // 各問題に対してアップロード
    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i];
      await uploadForProblem(problem, user);

      // 問題間で待機（最後の問題以外）
      if (i < problems.length - 1) {
        console.log(`  ⏳ 次の問題まで ${CONFIG.DELAY_BETWEEN_PROBLEMS / 1000}秒待機...\n`);
        await sleep(CONFIG.DELAY_BETWEEN_PROBLEMS);
      }
    }

    console.log('\n✅ すべての問題へのアップロードが完了しました！');
    console.log(`\n📊 統計:`);
    console.log(`  - 問題数: ${problems.length}`);
    console.log(`  - 総画像数: ${problems.length * CONFIG.IMAGES_PER_PROBLEM}枚`);
    
    console.log(`\n🎯 期待される配置:`);
    console.log(`\n【4象限配置】`);
    boardMap.forEach((count, boardId) => {
      if (count === 4) {
        const problemsInBoard = problems.filter(p => p.miroBoardId === boardId);
        console.log(`  ボード ${boardId}:`);
        problemsInBoard.forEach((p, idx) => {
          const quadrants = ['第1象限（右上）', '第2象限（左上）', '第3象限（左下）', '第4象限（右下）'];
          console.log(`    - 問題${p.orderIndex} → ${quadrants[idx]}`);
        });
      }
    });
    
    console.log(`\n【ランダム配置】`);
    boardMap.forEach((count, boardId) => {
      if (count !== 4) {
        const problemsInBoard = problems.filter(p => p.miroBoardId === boardId);
        problemsInBoard.forEach(p => {
          console.log(`  - 問題${p.orderIndex} → ボード ${boardId} 上のランダム位置`);
        });
      }
    });
    
    console.log(`\n🌐 Miroボードで確認:`);
    const uniqueBoards = Array.from(new Set(problems.map(p => p.miroBoardId).filter(Boolean)));
    uniqueBoards.forEach(boardId => {
      console.log(`  https://miro.com/app/board/${boardId}`);
    });

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
main();

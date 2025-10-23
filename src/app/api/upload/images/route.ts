import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { miroClient, MiroApiClient } from '@/utils/miroClient';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import { saveTempFile, deleteTempFiles, validateFileInfo, TempFileInfo, FileUploadError, formatBytes } from '@/utils/fileUpload';
import { createUserBasedLayout } from '@/utils/miroGrouping';
import { UploadResponse } from '@/types';
import { generateCorsHeaders } from '@/utils/securityConfig';
import { prisma } from '@/lib/prisma';
import { ProblemStatus, type Prisma } from '@prisma/client';
import { ensureSessionContext } from '@/lib/session';
import { loadProblemAccessContext, maxStatus } from '@/utils/problemProgress';


interface UploadRequestBody {
  images: {
    name: string;
    data: string; // base64
    type: string;
  }[];
  boardId: string;
  problemId: string;
  metadata: {
    userId?: string; // DB上のUser.id
    userLoginId?: string;
    userDisplayName?: string;
    uploaderName?: string;
    sessionId?: string;
  }[];
}

/**
 * ボードIDに基づいてランダムな座標を生成（シード値使用）
 * 
 * @param seed - ランダムシードとして使用する文字列（boardId等）
 * @returns ボード上のランダム座標
 */
function generateRandomBasePosition(seed: string): { x: number; y: number } {
  // シード値からハッシュを生成
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // 32ビット整数に変換
  }
  
  // ハッシュから疑似乱数を生成
  const random1 = Math.abs(Math.sin(hash) * 10000) % 1;
  const random2 = Math.abs(Math.sin(hash + 1) * 10000) % 1;
  
  // ボード上の広い範囲にランダム配置
  const BOARD_WIDTH = 8000;
  const BOARD_HEIGHT = 6000;
  
  return {
    x: Math.round((random1 - 0.5) * BOARD_WIDTH),
    y: Math.round((random2 - 0.5) * BOARD_HEIGHT),
  };
}

/**
 * 問題とボード共有状況に基づいてボード上の配置座標を決定
 * - 4問題が1ボード共有: 4象限に配置
 * - それ以外: ランダム配置
 * 
 * @param boardId - Miroボード ID
 * @param problemCount - このボードを共有している問題の総数
 * @param problemIndex - この問題が何番目か（0始まり）
 * @returns 配置の基準座標（ボード中心基準）
 */
function generatePositionByBoardSharing(
  boardId: string,
  problemCount: number,
  problemIndex: number
): { x: number; y: number } {
  // 4問題が1ボードを共有している場合は4象限配置
  if (problemCount === 4) {
    // 各象限のサイズ設定
    const QUADRANT_WIDTH = 4000;   // 各象限の幅
    const QUADRANT_HEIGHT = 3000;  // 各象限の高さ
    
    // 各象限の中心座標（ボード中心(0,0)からのオフセット）
    const quadrantCenters = [
      { x:  QUADRANT_WIDTH / 2, y: -QUADRANT_HEIGHT / 2 },  // 第1象限（右上）
      { x: -QUADRANT_WIDTH / 2, y: -QUADRANT_HEIGHT / 2 },  // 第2象限（左上）
      { x: -QUADRANT_WIDTH / 2, y:  QUADRANT_HEIGHT / 2 },  // 第3象限（左下）
      { x:  QUADRANT_WIDTH / 2, y:  QUADRANT_HEIGHT / 2 },  // 第4象限（右下）
    ];
    
    return quadrantCenters[problemIndex];
  }
  
  // それ以外の場合はランダム配置
  // problemIndexを使って各問題に異なる座標を生成
  const seed = `${boardId}-${problemIndex}`;
  return generateRandomBasePosition(seed);
}

async function resizeImageToSquare(
  buffer: Buffer,
  size: number,
  mimeType: string
): Promise<Buffer> {
  const animated = mimeType === 'image/gif';
  const background = mimeType === 'image/jpeg'
    ? { r: 255, g: 255, b: 255, alpha: 1 }
    : { r: 0, g: 0, b: 0, alpha: 0 };

  const pipeline = sharp(buffer, { animated })
    .resize(size, size, {
      fit: 'contain',
      background,
    });

  switch (mimeType) {
    case 'image/png':
      return pipeline.png().toBuffer();
    case 'image/gif':
      return pipeline.gif().toBuffer();
    case 'image/webp':
      return pipeline.webp({ lossless: mimeType === 'image/webp' }).toBuffer();
    case 'image/jpeg':
    default:
      return pipeline.jpeg({ mozjpeg: true }).toBuffer();
  }
}

/**
 * POST /api/upload/images - 画像をMiroボードにアップロード
 */
export async function POST(request: NextRequest) {
  const tempFilesToCleanup: string[] = [];
  const skippedItems: { fileName: string; reason: string; }[] = [];
  
  try {
    const body: UploadRequestBody = await request.json();
    const { images, boardId, metadata, problemId } = body;
    const { userSession } = await ensureSessionContext();

    if (
      !boardId ||
      !images ||
      !metadata ||
      images.length !== metadata.length ||
      typeof problemId !== 'string' ||
      problemId.trim().length === 0
    ) {
      return NextResponse.json({ error: 'INVALID_REQUEST', message: 'リクエストデータが不正です。' }, { status: 400 });
    }
    if (images.length === 0) {
      return NextResponse.json({ success: true, uploadedItems: [], skippedItems: [] });
    }

    const baseMetadata = metadata[0];
    const targetUserId = baseMetadata?.userId;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        {
          error: 'INVALID_USER_SELECTION',
          message: 'アップロードに使用するユーザーIDが指定されていません。',
        },
        { status: 400 }
      );
    }

    const uploadUserRecord = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!uploadUserRecord || uploadUserRecord.isActive === false) {
      return NextResponse.json(
        {
          error: 'USER_NOT_FOUND',
          message: '指定されたユーザーが見つからないか、利用できません。',
        },
        { status: 404 }
      );
    }

    const context = await loadProblemAccessContext(problemId, targetUserId);
    if (!context) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    if (
      context.problem.miroBoardId &&
      context.problem.miroBoardId !== boardId
    ) {
      return NextResponse.json(
        {
          error: 'INVALID_BOARD_SELECTION',
          message: 'この問題に紐付いたボード以外にはアップロードできません。',
        },
        { status: 403 }
      );
    }

    // 1. ファイルの前処理と検証
    const validFilesInfo: { tempFile: TempFileInfo; metadata: typeof metadata[0] }[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const meta = {
        ...metadata[i],
        userId: targetUserId,
        userLoginId:
          metadata[i].userLoginId ?? uploadUserRecord.userId,
        userDisplayName:
          metadata[i].userDisplayName ??
          uploadUserRecord.displayName ??
          uploadUserRecord.userId,
        uploaderName:
          metadata[i].uploaderName ??
          uploadUserRecord.displayName ??
          uploadUserRecord.userId,
        sessionId: metadata[i].sessionId ?? userSession.id,
      };
      try {
        const base64Data = image.data.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const tempFile = await saveTempFile(buffer, image.name, image.type);
        tempFilesToCleanup.push(tempFile.path);
        
        validateFileInfo(tempFile); // ここでエラーがスローされる可能性がある
        
        validFilesInfo.push({ tempFile, metadata: meta });

      } catch (error) {
        if (error instanceof FileUploadError) {
          const fileSize = Buffer.from(image.data.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64').length;
          const detailedReason = `${error.message} (ファイルサイズ: ${formatBytes(fileSize)})`;
          
          console.log(`Skipping file: ${error.fileName}, Reason: ${detailedReason}`);
          skippedItems.push({ fileName: error.fileName, reason: detailedReason });
          continue; // 次のファイルの処理へ
        } else {
          // 予期せぬエラーは全体を失敗させる
          throw error;
        }
      }
    }

    if (validFilesInfo.length === 0) {
      return NextResponse.json({ success: true, uploadedItems: [], skippedItems });
    }

    // 2. ボード共有状況の確認と座標計算
    const sharedProblems = await prisma.problem.findMany({
      where: { 
        miroBoardId: boardId,
        isActive: true 
      },
      orderBy: { orderIndex: 'asc' }
    });
    
    const problemCount = sharedProblems.length;
    const problemIndex = sharedProblems.findIndex(p => p.id === problemId);
    
    if (problemIndex === -1) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_IN_BOARD', message: '指定された問題がこのボードに含まれていません。' },
        { status: 400 }
      );
    }
    
    // 3. Miroボードへのアップロード処理
    const uploadedItems: Array<{
      imageId: string;
      stickyNoteId: string;
      groupId: string;
      userId: string;
      userDisplayName?: string;
      fileName: string;
      imageHeight: number;
      imageWidth: number;
      stickyWidth: number;
      stickyHeight: number;
      fileSize: number;
      mimeType: string;
    }> = [];
    
    // ボード共有状況に基づいて配置座標を決定
    const basePosition = generatePositionByBoardSharing(boardId, problemCount, problemIndex);
    const TARGET_IMAGE_SIZE = MiroApiClient.DEFAULT_IMAGE_SIZE;
    const STICKY_SCALE = 1.5;
    const TARGET_STICKY_SIZE = Math.round(TARGET_IMAGE_SIZE * STICKY_SCALE);

    for (const { tempFile, metadata: imageMetadata } of validFilesInfo) {
      const originalBuffer = await fs.readFile(tempFile.path);
      const resizedBuffer = await resizeImageToSquare(originalBuffer, TARGET_IMAGE_SIZE, tempFile.mimetype);

      await fs.writeFile(tempFile.path, resizedBuffer);
      tempFile.size = resizedBuffer.byteLength;

      const arrayBuffer = resizedBuffer.buffer.slice(
        resizedBuffer.byteOffset,
        resizedBuffer.byteOffset + resizedBuffer.byteLength
      ) as ArrayBuffer;

      const file = new File([arrayBuffer], tempFile.originalName, { type: tempFile.mimetype });

      const loginIdForSticky =
        imageMetadata.userLoginId ??
        uploadUserRecord.userId ??
        '不明なユーザー';

      const userDbId = imageMetadata.userId ?? targetUserId;

      const stickyNoteContent = `ユーザーID: ${loginIdForSticky}`;

      const stickyNote = await miroClient.createStickyNote(
        boardId,
        stickyNoteContent,
        basePosition,
        {
          fillColor: getUserColor(userDbId),
          textAlign: 'left',
        },
        {
          geometry: {
            width: TARGET_STICKY_SIZE,
          },
        }
      );

      await miroClient.patchItem(boardId, stickyNote.id, {
        geometry: {
          width: TARGET_STICKY_SIZE,
        },
        position: {
          x: basePosition.x,
          y: basePosition.y,
          origin: 'center',
        },
      });

      const uploadedImage = await miroClient.uploadImage(boardId, file, {
        position: basePosition,
        geometry: {
          width: TARGET_IMAGE_SIZE,
          height: TARGET_IMAGE_SIZE,
        },
      });

      await miroClient.patchItem(boardId, uploadedImage.id, {
        geometry: {
          width: TARGET_IMAGE_SIZE,
          height: TARGET_IMAGE_SIZE,
        },
        position: {
          x: basePosition.x,
          y: basePosition.y,
          origin: 'center',
        },
      });

      const payload = buildGroupPayload(uploadedImage.id, stickyNote.id);
      const group = await miroClient.createGroup(boardId, payload);

      uploadedItems.push({
        imageId: uploadedImage.id,
        stickyNoteId: stickyNote.id,
        groupId: group.id,
        userId: userDbId,
        userDisplayName: imageMetadata.userDisplayName,
        fileName: tempFile.originalName,
        imageHeight: TARGET_IMAGE_SIZE,
        imageWidth: TARGET_IMAGE_SIZE,
        stickyWidth: TARGET_STICKY_SIZE,
        stickyHeight: TARGET_STICKY_SIZE,
        fileSize: tempFile.size,
        mimeType: tempFile.mimetype,
      });
    }

    // 4. レイアウト適用
    if (uploadedItems.length > 0) {
      await createUserBasedLayout(boardId, uploadedItems, basePosition);
    }

    // 5. データベースに保存
    if (uploadedItems.length > 0) {
      const now = new Date();
      const sessionIdentifier =
        validFilesInfo[0]?.metadata.sessionId ?? userSession.id;
      const uploaderName = validFilesInfo[0]?.metadata.uploaderName ?? null;

      const sessionRecord = await prisma.uploadSession.upsert({
        where: { sessionId: sessionIdentifier },
        update: {
          boardId,
          uploaderName,
          problemId,
          userSessionId: userSession.id,
        },
        create: {
          sessionId: sessionIdentifier,
          boardId,
          uploaderName,
          problemId,
          userSessionId: userSession.id,
        },
      });

      const transactions: Prisma.PrismaPromise<unknown>[] = [];
      transactions.push(
        prisma.uploadedItem.createMany({
          data: uploadedItems.map(item => ({
            sessionId: sessionRecord.id,
            userId: item.userId || null,
            miroImageId: item.imageId,
            miroStickyId: item.stickyNoteId,
            miroGroupId: item.groupId,
            fileName: item.fileName,
            fileSize: item.fileSize,
            mimeType: item.mimeType,
            imageHeight: item.imageHeight,
            imageWidth: item.imageWidth,
            problemId,
            userSessionId: userSession.id,
          })),
          skipDuplicates: true,
        })
      );

      const currentProgress = context.progress;
      const targetStatus = maxStatus(
        currentProgress?.status ?? ProblemStatus.LOCKED,
        ProblemStatus.UPLOAD_COMPLETED
      );

      transactions.push(
        prisma.problemProgress.upsert({
          where: {
            problemId_userId: {
              problemId,
              userId: targetUserId,
            },
          },
          update: {
            userSessionId: userSession.id,
            status: targetStatus,
            insightSubmittedAt:
              currentProgress?.insightSubmittedAt ?? now,
            boardUnlockedAt: currentProgress?.boardUnlockedAt ?? now,
          },
          create: {
            problemId,
            userId: targetUserId,
            userSessionId: userSession.id,
            status: targetStatus,
            insightSubmittedAt: currentProgress?.insightSubmittedAt ?? now,
            boardUnlockedAt: now,
          },
        })
      );

      await prisma.$transaction(transactions);
    }

    // 6. クリーンアップとレスポンス返却
    await deleteTempFiles(tempFilesToCleanup);

    const response: UploadResponse = {
      success: true,
      uploadedItems: uploadedItems.map(item => ({ imageId: item.imageId, stickyNoteId: item.stickyNoteId, groupId: item.groupId })),
      skippedItems,
    };
    return NextResponse.json(response);

  } catch (error) {
    logError(error as Error, 'POST /api/upload/images');
    await deleteTempFiles(tempFilesToCleanup);
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: userError.message, success: false, uploadedItems: [], skippedItems }, { status: 500 });
  }
}

/**
 * Miro API v2準拠のグループペイロードを生成
 */
function buildGroupPayload(imageId?: string, stickyId?: string): { data: { items: string[] } } {
  const ids = [imageId, stickyId].filter((id): id is string => typeof id === 'string' && id.length > 0);
  
  if (ids.length !== 2) {
    throw new Error(`Group requires exactly 2 valid IDs, got: ${JSON.stringify([imageId, stickyId])}`);
  }
  
  if (ids[0] === ids[1]) {
    throw new Error('Group requires two distinct IDs');
  }
  
  // IDは文字列の配列として送信（推奨）
  return {
    data: {
      items: ids  // [imageId, stickyId] として文字列配列で送信
    }
  };
}

/**
 * Miro API v2で許可されている付箋の色名
 */
const ALLOWED_STICKY_COLORS: readonly string[] = [
  'gray', 'light_yellow', 'yellow', 'orange', 'light_green', 'green', 'dark_green',
  'cyan', 'light_pink', 'pink', 'violet', 'red', 'light_blue', 'blue', 'dark_blue', 'black'
];

/**
 * 色名のエイリアス（互換性のため）
 */
const COLOR_ALIASES: Record<string, string> = {
  'purple': 'violet',
  'light_purple': 'violet',
  'light_orange': 'orange',
};

/**
 * 付箋の色名を正規化（Miro API v2準拠）
 */
function normalizeStickyFillColor(input?: string): string {
  if (!input) return 'light_yellow';
  
  const normalized = input.trim().toLowerCase();
  
  // 正規の色名ならそのまま使用
  if (ALLOWED_STICKY_COLORS.includes(normalized)) {
    return normalized;
  }
  
  // エイリアスがあれば変換
  if (COLOR_ALIASES[normalized]) {
    return COLOR_ALIASES[normalized];
  }
  
  // 不明な色はデフォルトにフォールバック
  return 'light_yellow';
}

/**
 * 個人IDから付箋の色を取得（Miro API v2対応の定義済み色名）
 */
function getUserColor(userId: string): string {
  // 使用する色のサブセット（視認性の良い色のみ）
  const colors = [
    'light_yellow',    // 薄い黄色
    'light_green',     // 薄い緑色
    'light_blue',      // 薄い青色
    'light_pink',      // 薄いピンク色
    'violet',          // 紫色
    'orange',          // オレンジ色
    'yellow',          // 黄色
    'green',           // 緑色
    'blue',            // 青色
    'pink',            // ピンク色
    'cyan',            // シアン色
    'red',             // 赤色
  ];
  
  // 個人IDのハッシュから色を決定
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const selectedColor = colors[Math.abs(hash) % colors.length];
  return normalizeStickyFillColor(selectedColor);
}

/**
 * OPTIONS /api/upload/images - CORS プリフライトリクエスト対応
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || undefined;
  const cors = generateCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...cors,
      'Vary': 'Origin',
    },
  });
}

// Next.js App Router用の設定
export const runtime = 'nodejs';
export const maxDuration = 60; // 60秒のタイムアウト

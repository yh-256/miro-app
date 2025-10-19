import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { miroClient } from '@/utils/miroClient';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import { saveTempFile, deleteTempFiles, validateFileInfo, TempFileInfo, FileUploadError, formatBytes } from '@/utils/fileUpload';
import { createSubjectBasedLayout } from '@/utils/miroGrouping';
import { UploadResponse } from '@/types';
import { generateCorsHeaders } from '@/utils/securityConfig';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { ensureSession, ensureUserSessionRecord } from '@/lib/session';

interface UploadRequestBody {
  images: {
    name: string;
    data: string; // base64
    type: string;
  }[];
  boardId: string;
  problemId: string;
  metadata: {
    subjectId: string;
    subjectName: string;
    uploaderName?: string;
    sessionId?: string;
  }[];
}

/**
 * ランダムな基準座標を生成
 */
function generateRandomBasePosition(): { x: number; y: number } {
  return {
    x: (Math.random() - 0.5) * 3200, // -1600 ~ +1600
    y: (Math.random() - 0.5) * 2400, // -1200 ~ +1200
  };
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
    const { sessionId } = await ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

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

    // 1. ファイルの前処理と検証
    const validFilesInfo: { tempFile: TempFileInfo; metadata: typeof metadata[0] }[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const meta = {
        ...metadata[i],
        sessionId: metadata[i].sessionId ?? sessionId,
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

    // 2. Miroボードへのアップロード処理
    const uploadedItems: Array<{
      imageId: string;
      stickyNoteId: string;
      groupId: string;
      subjectId: string;
      subjectName: string;
      fileName: string;
      imageHeight: number;
      imageWidth: number;
      fileSize: number;
      mimeType: string;
    }> = [];
    const basePosition = generateRandomBasePosition();

    const uploadedImages = [];
    for (const { tempFile, metadata: imageMetadata } of validFilesInfo) {
      const fileBuffer = await fs.readFile(tempFile.path);
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], tempFile.originalName, { type: tempFile.mimetype });
      const uploadedImage = await miroClient.uploadImage(boardId, file, basePosition);
      uploadedImages.push({ 
        image: uploadedImage, 
        imageHeight: uploadedImage.geometry.height, 
        metadata: imageMetadata, 
        tempFile 
      });
    }

    const stickyNotes = [];
    for (const imageData of uploadedImages) {
      const subjectName = imageData.metadata.subjectName;
      const stickyNoteContent = [
        `個人ID: ${subjectName}`,
        imageData.metadata.uploaderName ? `アップロード者: ${imageData.metadata.uploaderName}` : '',
        `アップロード日時: ${new Date().toLocaleString('ja-JP')}`,
        `ファイル名: ${imageData.tempFile.originalName}`,
        `セッションID: ${imageData.metadata.sessionId}`,
      ].filter(Boolean).join('\n');

      const stickyNote = await miroClient.createStickyNote(boardId, stickyNoteContent, basePosition, {
        fillColor: getSubjectColor(imageData.metadata.subjectId),
        textAlign: 'left',
      });
      stickyNotes.push({ stickyNote, imageData });
    }

    for (const noteData of stickyNotes) {
      const imageId = noteData.imageData.image.id;
      const stickyId = noteData.stickyNote.id;
      const payload = buildGroupPayload(imageId, stickyId);
      const group = await miroClient.createGroup(boardId, payload);
      
      uploadedItems.push({
        imageId, stickyNoteId: stickyId, groupId: group.id,
        subjectId: noteData.imageData.metadata.subjectId,
        subjectName: noteData.imageData.metadata.subjectName,
        fileName: noteData.imageData.tempFile.originalName,
        imageHeight: noteData.imageData.imageHeight,
        imageWidth: noteData.imageData.image.geometry.width,
        fileSize: noteData.imageData.tempFile.size,
        mimeType: noteData.imageData.tempFile.mimetype,
      });
    }

    // 3. レイアウト適用
    if (uploadedItems.length > 0) {
      await createSubjectBasedLayout(boardId, uploadedItems, basePosition);
    }

    // 4. データベースに保存
    if (uploadedItems.length > 0) {
      const sessionIdentifier =
        validFilesInfo[0]?.metadata.sessionId ?? sessionId;
      const uploaderName = metadata.find(m => m.uploaderName)?.uploaderName ?? null;

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

      const subjectIds = Array.from(
        new Set(uploadedItems.map(item => item.subjectId).filter(Boolean))
      );

      const transactions: Prisma.PrismaPromise<unknown>[] = [];

      if (subjectIds.length > 0) {
        transactions.push(
          prisma.subject.updateMany({
            where: {
              id: {
                in: subjectIds,
              },
            },
            data: {
              lastUsedAt: new Date(),
            },
          })
        );
      }

      transactions.push(
        prisma.uploadedItem.createMany({
          data: uploadedItems.map(item => ({
            sessionId: sessionRecord.id,
            subjectId: item.subjectId || null,
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

      await prisma.$transaction(transactions);
    }

    // 5. クリーンアップとレスポンス返却
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
function getSubjectColor(subjectId: string): string {
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
  for (let i = 0; i < subjectId.length; i++) {
    hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
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

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import sharp from "sharp";
import { miroClient, MiroApiClient } from "@/utils/miroClient";
import { ErrorHandler, logError } from "@/utils/errorHandler";
import {
  saveTempFile,
  deleteTempFiles,
  validateFileInfo,
  TempFileInfo,
  FileUploadError,
  formatBytes,
} from "@/utils/fileUpload";
import {
  calculateQuadrantPosition,
  calculateRandomPositionWithCollisionAvoidance,
} from "@/utils/quadrantLayout";
import { UploadResponse } from "@/types";
import { generateCorsHeaders } from "@/utils/securityConfig";
import { prisma } from "@/lib/prisma";
import { ProblemStatus, type Prisma } from "@prisma/client";
import { ensureSessionContext } from "@/lib/session";
import { loadProblemAccessContext, maxStatus } from "@/utils/problemProgress";

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
/**
 * 個別の画像配置座標を決定
 * - 4問題が1ボード共有: 4象限に配置（既存グループを考慮して右端に順次配置）
 * - それ以外: ランダム配置（衝突回避付き、画像ごとに異なる座標）
 *
 * @param boardId - Miroボード ID
 * @param problemCount - このボードを共有している問題の総数
 * @param problemIndex - この問題が何番目か（0始まり）
 * @param imageIndex - この画像が何枚目か（0始まり、シード値の一意性確保）
 * @param alreadyUploadedPositions - 同じリクエスト内で既にアップロードした画像の座標リスト
 * @returns 配置座標（ボード中心基準）
 */
async function generatePositionForImage(
  boardId: string,
  problemCount: number,
  problemIndex: number,
  imageIndex: number,
  alreadyUploadedPositions: Array<{ x: number; y: number }> = [],
  uniqueSeed: string = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
): Promise<{ x: number; y: number }> {
  // 4問題が1ボードを共有している場合は4象限配置（既存グループの右端を自動検出）
  if (problemCount === 4) {
    return await calculateQuadrantPosition(
      boardId,
      problemIndex,
      miroClient,
      alreadyUploadedPositions,
      uniqueSeed,
    );
  }

  // それ以外の場合はランダム配置（画像ごとに異なるシード値で衝突回避）
  // 既にアップロード済みの画像座標も衝突チェックに含める
  // 一意なシード値を含めることで、別のアップロードリクエストでは確実に異なる座標を生成
  const seed = `${boardId}-${problemIndex}-${uniqueSeed}-image-${imageIndex}`;
  return await calculateRandomPositionWithCollisionAvoidance(
    boardId,
    seed,
    miroClient,
    alreadyUploadedPositions,
  );
}

async function resizeImageToSquare(
  buffer: Buffer,
  size: number,
  mimeType: string,
): Promise<Buffer> {
  const animated = mimeType === "image/gif";
  const background =
    mimeType === "image/jpeg"
      ? { r: 255, g: 255, b: 255, alpha: 1 }
      : { r: 0, g: 0, b: 0, alpha: 0 };

  const pipeline = sharp(buffer, { animated }).resize(size, size, {
    fit: "contain",
    background,
  });

  switch (mimeType) {
    case "image/png":
      return pipeline.png().toBuffer();
    case "image/gif":
      return pipeline.gif().toBuffer();
    case "image/webp":
      return pipeline.webp({ lossless: mimeType === "image/webp" }).toBuffer();
    case "image/jpeg":
    default:
      return pipeline.jpeg({ mozjpeg: true }).toBuffer();
  }
}

/**
 * POST /api/upload/images - 画像をMiroボードにアップロード
 */
export async function POST(request: NextRequest) {
  const tempFilesToCleanup: string[] = [];
  const skippedItems: { fileName: string; reason: string }[] = [];

  try {
    const body: UploadRequestBody = await request.json();
    const { images, boardId, metadata, problemId } = body;
    const { userSession } = await ensureSessionContext();

    if (
      !boardId ||
      !images ||
      !metadata ||
      images.length !== metadata.length ||
      typeof problemId !== "string" ||
      problemId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "リクエストデータが不正です。" },
        { status: 400 },
      );
    }
    if (images.length === 0) {
      return NextResponse.json({
        success: true,
        uploadedItems: [],
        skippedItems: [],
      });
    }

    const baseMetadata = metadata[0];
    const targetUserId = baseMetadata?.userId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        {
          error: "INVALID_USER_SELECTION",
          message: "アップロードに使用するユーザーIDが指定されていません。",
        },
        { status: 400 },
      );
    }

    const uploadUserRecord = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!uploadUserRecord || uploadUserRecord.isActive === false) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
          message: "指定されたユーザーが見つからないか、利用できません。",
        },
        { status: 404 },
      );
    }

    const context = await loadProblemAccessContext(problemId, targetUserId);
    if (!context) {
      return NextResponse.json(
        {
          error: "PROBLEM_NOT_FOUND",
          message: "指定された問題が見つかりません。",
        },
        { status: 404 },
      );
    }

    if (
      context.problem.miroBoardId &&
      context.problem.miroBoardId !== boardId
    ) {
      return NextResponse.json(
        {
          error: "INVALID_BOARD_SELECTION",
          message: "この問題に紐付いたボード以外にはアップロードできません。",
        },
        { status: 403 },
      );
    }

    // 1. ファイルの前処理と検証
    const validFilesInfo: {
      tempFile: TempFileInfo;
      metadata: (typeof metadata)[0];
    }[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const meta = {
        ...metadata[i],
        userId: targetUserId,
        userLoginId: metadata[i].userLoginId ?? uploadUserRecord.userId,
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
        const base64Data = image.data.replace(
          /^data:image\/[a-z]+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");
        const tempFile = await saveTempFile(buffer, image.name, image.type);
        tempFilesToCleanup.push(tempFile.path);

        validateFileInfo(tempFile); // ここでエラーがスローされる可能性がある

        validFilesInfo.push({ tempFile, metadata: meta });
      } catch (error) {
        if (error instanceof FileUploadError) {
          const fileSize = Buffer.from(
            image.data.replace(/^data:image\/[a-z]+;base64,/, ""),
            "base64",
          ).length;
          const detailedReason = `${error.message} (ファイルサイズ: ${formatBytes(fileSize)})`;

          console.log(
            `Skipping file: ${error.fileName}, Reason: ${detailedReason}`,
          );
          skippedItems.push({
            fileName: error.fileName,
            reason: detailedReason,
          });
          continue; // 次のファイルの処理へ
        } else {
          // 予期せぬエラーは全体を失敗させる
          throw error;
        }
      }
    }

    if (validFilesInfo.length === 0) {
      return NextResponse.json({
        success: true,
        uploadedItems: [],
        skippedItems,
      });
    }

    // 2. ボード共有状況の確認と座標計算
    const sharedProblems = await prisma.problem.findMany({
      where: {
        miroBoardId: boardId,
        isActive: true,
      },
      orderBy: { orderIndex: "asc" },
    });

    const problemCount = sharedProblems.length;
    const problemIndex = sharedProblems.findIndex((p) => p.id === problemId);

    if (problemIndex === -1) {
      return NextResponse.json(
        {
          error: "PROBLEM_NOT_IN_BOARD",
          message: "指定された問題がこのボードに含まれていません。",
        },
        { status: 400 },
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

    const TARGET_IMAGE_SIZE = MiroApiClient.DEFAULT_IMAGE_SIZE;
    const STICKY_SCALE = 1.5;
    const TARGET_STICKY_SIZE = Math.round(TARGET_IMAGE_SIZE * STICKY_SCALE);

    // このアップロードリクエストのタイムスタンプ（シード値の一意性確保）
    // ランダム要素も追加して、ミリ秒単位で同時リクエストが来ても確実に異なるシード値にする
    const uploadTimestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const uniqueSeed = `${uploadTimestamp}-${randomSuffix}`;
    console.log(
      `[Upload] Starting upload with seed: ${uniqueSeed}, problemCount: ${problemCount}, problemIndex: ${problemIndex}`,
    );

    // 既にアップロードした画像の座標を記録（同一リクエスト内の衝突回避用）
    const uploadedPositions: Array<{ x: number; y: number }> = [];

    // 各画像ごとに個別の座標を決定してアップロード
    for (let i = 0; i < validFilesInfo.length; i++) {
      const { tempFile, metadata: imageMetadata } = validFilesInfo[i];

      // 画像ごとに配置座標を決定（衝突回避・象限考慮）
      // 既にアップロード済みの画像座標も考慮
      const position = await generatePositionForImage(
        boardId,
        problemCount,
        problemIndex,
        i,
        uploadedPositions,
        uniqueSeed,
      );
      console.log(
        `[Upload] Image ${i + 1}/${validFilesInfo.length}: position (${position.x}, ${position.y})`,
      );
      const originalBuffer = await fs.readFile(tempFile.path);
      const resizedBuffer = await resizeImageToSquare(
        originalBuffer,
        TARGET_IMAGE_SIZE,
        tempFile.mimetype,
      );

      await fs.writeFile(tempFile.path, resizedBuffer);
      tempFile.size = resizedBuffer.byteLength;

      const arrayBuffer = resizedBuffer.buffer.slice(
        resizedBuffer.byteOffset,
        resizedBuffer.byteOffset + resizedBuffer.byteLength,
      ) as ArrayBuffer;

      const file = new File([arrayBuffer], tempFile.originalName, {
        type: tempFile.mimetype,
      });

      const loginIdForSticky =
        imageMetadata.userLoginId ??
        uploadUserRecord.userId ??
        "不明なユーザー";

      const userDbId = imageMetadata.userId ?? targetUserId;

      const stickyNoteContent = `ユーザーID: ${loginIdForSticky}\n\n\n\n\n\n\n\n`;

      const stickyNote = await miroClient.createStickyNote(
        boardId,
        stickyNoteContent,
        position,
        {
          fillColor: getUserColor(userDbId),
          textAlign: "left",
        },
        {
          geometry: {
            width: TARGET_STICKY_SIZE,
          },
        },
      );

      await miroClient.patchItem(boardId, stickyNote.id, {
        geometry: {
          width: TARGET_STICKY_SIZE,
        },
        position: {
          x: position.x,
          y: position.y,
          origin: "center",
        },
      });

      const uploadedImage = await miroClient.uploadImage(boardId, file, {
        position: position,
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
          x: position.x,
          y: position.y,
          origin: "center",
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

      // アップロード完了した画像の座標を記録（次の画像の衝突回避用）
      uploadedPositions.push(position);
    }

    // 4. データベースに保存
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
          data: uploadedItems.map((item) => ({
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
        }),
      );

      const currentProgress = context.progress;
      const targetStatus = maxStatus(
        currentProgress?.status ?? ProblemStatus.LOCKED,
        ProblemStatus.UPLOAD_COMPLETED,
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
            insightSubmittedAt: currentProgress?.insightSubmittedAt ?? now,
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
        }),
      );

      await prisma.$transaction(transactions);
    }

    // 6. クリーンアップとレスポンス返却
    await deleteTempFiles(tempFilesToCleanup);

    const response: UploadResponse = {
      success: true,
      uploadedItems: uploadedItems.map((item) => ({
        imageId: item.imageId,
        stickyNoteId: item.stickyNoteId,
        groupId: item.groupId,
      })),
      skippedItems,
    };
    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, "POST /api/upload/images");
    await deleteTempFiles(tempFilesToCleanup);
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json(
      {
        error: "UPLOAD_FAILED",
        message: userError.message,
        success: false,
        uploadedItems: [],
        skippedItems,
      },
      { status: 500 },
    );
  }
}

/**
 * Miro API v2準拠のグループペイロードを生成
 */
function buildGroupPayload(
  imageId?: string,
  stickyId?: string,
): { data: { items: string[] } } {
  const ids = [imageId, stickyId].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );

  if (ids.length !== 2) {
    throw new Error(
      `Group requires exactly 2 valid IDs, got: ${JSON.stringify([imageId, stickyId])}`,
    );
  }

  if (ids[0] === ids[1]) {
    throw new Error("Group requires two distinct IDs");
  }

  // IDは文字列の配列として送信（推奨）
  return {
    data: {
      items: ids, // [imageId, stickyId] として文字列配列で送信
    },
  };
}

/**
 * Miro API v2で許可されている付箋の色名
 */
const ALLOWED_STICKY_COLORS: readonly string[] = [
  "gray",
  "light_yellow",
  "yellow",
  "orange",
  "light_green",
  "green",
  "dark_green",
  "cyan",
  "light_pink",
  "pink",
  "violet",
  "red",
  "light_blue",
  "blue",
  "dark_blue",
  "black",
];

/**
 * 色名のエイリアス（互換性のため）
 */
const COLOR_ALIASES: Record<string, string> = {
  purple: "violet",
  light_purple: "violet",
  light_orange: "orange",
};

/**
 * 付箋の色名を正規化（Miro API v2準拠）
 */
function normalizeStickyFillColor(input?: string): string {
  if (!input) return "light_yellow";

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
  return "light_yellow";
}

/**
 * 個人IDから付箋の色を取得（Miro API v2対応の定義済み色名）
 */
function getUserColor(userId: string): string {
  // 使用する色のサブセット（視認性の良い色のみ）
  const colors = [
    "light_yellow", // 薄い黄色
    "light_green", // 薄い緑色
    "light_blue", // 薄い青色
    "light_pink", // 薄いピンク色
    "violet", // 紫色
    "orange", // オレンジ色
    "yellow", // 黄色
    "green", // 緑色
    "blue", // 青色
    "pink", // ピンク色
    "cyan", // シアン色
    "red", // 赤色
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
  const origin = request.headers.get("origin") || undefined;
  const cors = generateCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...cors,
      Vary: "Origin",
    },
  });
}

// Next.js App Router用の設定
export const runtime = "nodejs";
export const maxDuration = 60; // 60秒のタイムアウト

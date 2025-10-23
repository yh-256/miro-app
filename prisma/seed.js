// /* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'; 
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedProblems() {
  // const defaultBoardId =
  //   process.env.MOCK_MIRO_BOARD_ID ?? 'mock-miro-board-id-1';

  const problems = [
    // 最初の4問：同じボード（board-A）を共有 → 4象限配置
    {
      id: 'problem-001',
      title: '現場写真から気づきを抽出する',
      description:
        '撮影した写真を観察し、チームで共有できる気づきを整理してください。',
      orderIndex: 1,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody:
        '1. 写真を確認\n2. 重要なポイントを箇条書きにする\n3. 気づき投稿フォームに記載して送信',
    },
    {
      id: 'problem-002',
      title: '安全面を洗い出す',
      description:
        '現場で想定されるリスクや改善点を列挙し、具体的な対策を検討しましょう。',
      orderIndex: 2,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody:
        '想定されるリスク・改善点をできるだけ多く挙げ、写真やアップロードする画像と紐付けてください。',
    },
    {
      id: 'problem-003',
      title: '環境への影響を考察する',
      description:
        '作業が環境に与える影響を分析し、環境保護の観点から改善点を提案します。',
      orderIndex: 3,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody:
        '環境負荷、騒音、廃棄物などの観点から、現場の環境への影響を評価してください。',
    },
    {
      id: 'problem-004',
      title: '作業効率を分析する',
      description:
        '現状の作業フローを分析し、効率化できるポイントを特定します。',
      orderIndex: 4,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody:
        '時間のかかっている作業、無駄な動線、改善できそうな手順などを記録してください。',
    },
    
    // 次の4問：別のボード（board-B）を共有 → 4象限配置
    {
      id: 'problem-005',
      title: '品質管理のチェックポイント',
      description:
        '製品・作業の品質を確保するためのチェックポイントを洗い出します。',
      orderIndex: 5,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody:
        '品質基準、検査項目、不良品の発生要因などをリストアップしてください。',
    },
    {
      id: 'problem-006',
      title: 'コミュニケーション課題の抽出',
      description:
        'チーム内や部署間のコミュニケーション課題を特定し、改善策を考えます。',
      orderIndex: 6,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody:
        '情報共有の遅れ、伝達ミス、連携不足などの具体例を挙げてください。',
    },
    {
      id: 'problem-007',
      title: '設備・機材の状態確認',
      description:
        '使用している設備や機材の状態を確認し、メンテナンス計画を立案します。',
      orderIndex: 7,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody:
        '老朽化箇所、故障リスク、定期点検の必要性などを記録してください。',
    },
    {
      id: 'problem-008',
      title: 'コスト削減のアイデア出し',
      description:
        '無駄なコストを削減できる領域を特定し、具体的なアイデアを提案します。',
      orderIndex: 8,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody:
        '材料費、人件費、光熱費、外注費など、削減可能なコスト項目を検討してください。',
    },
    
    // 残り7問：個別のボードに対応 → ランダム配置
    {
      id: 'problem-009',
      title: '新人教育プログラムの見直し',
      description:
        '新人がスムーズに業務に適応できるよう、教育プログラムを改善します。',
      orderIndex: 9,
      miroBoardId: 'uXjVJ28TMvE=',
      contentType: 'text',
      contentBody:
        '現在の教育内容の問題点、追加すべき項目、効果的な教育方法を提案してください。',
    },
    {
      id: 'problem-010',
      title: '5S活動の実践状況確認',
      description:
        '整理・整頓・清掃・清潔・躾の実践状況を確認し、改善箇所を特定します。',
      orderIndex: 10,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        '各項目について現場の写真を撮影し、改善が必要な箇所を記録してください。',
    },
    {
      id: 'problem-011',
      title: '顧客満足度向上のための施策',
      description:
        '顧客の声を分析し、満足度を向上させるための具体的な施策を考えます。',
      orderIndex: 11,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        '顧客からのフィードバック、クレーム内容、改善できるサービスをまとめてください。',
    },
    {
      id: 'problem-012',
      title: 'デジタル化推進の可能性',
      description:
        '業務のデジタル化・DX推進ができる領域を探り、具体案を提案します。',
      orderIndex: 12,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        'アナログで行っている作業、紙で管理している情報、デジタル化のメリットなどを検討してください。',
    },
    {
      id: 'problem-013',
      title: '働き方改革のアイデア',
      description:
        '働きやすい職場環境を実現するためのアイデアを出し合います。',
      orderIndex: 13,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        '労働時間、休憩時間、福利厚生、職場の雰囲気など、改善できる点を挙げてください。',
    },
    {
      id: 'problem-014',
      title: 'サプライチェーンの最適化',
      description:
        '資材調達から納品までのサプライチェーンを分析し、最適化します。',
      orderIndex: 14,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        '納期遅延の原因、在庫管理の課題、物流コストの削減案などを検討してください。',
    },
    {
      id: 'problem-015',
      title: '改善案の総まとめと優先順位付け',
      description:
        'これまでの全問題から得られた気づきと改善案を統合し、優先順位を決定します。',
      orderIndex: 15,
      miroBoardId: '',
      contentType: 'text',
      contentBody:
        '全問題の改善案を振り返り、実現可能性・効果・緊急度の観点から優先順位をつけてください。',
    },
  ];

  for (const problem of problems) {
    await prisma.problem.upsert({
      where: { id: problem.id },
      update: {
        title: problem.title,
        description: problem.description,
        orderIndex: problem.orderIndex,
        miroBoardId: problem.miroBoardId,
        contentType: problem.contentType,
        contentBody: problem.contentBody,
        isActive: true,
      },
      create: problem,
    });
  }
}

async function seedAdminUser() {
  const adminUserId = 'admin';
  const adminPin = '1234'; // 初回デフォルトPIN（後で変更推奨）
  const pinHash = await bcrypt.hash(adminPin, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { userId: adminUserId },
  });

  if (existingAdmin) {
    console.info('Admin user already exists, skipping creation.');
    return;
  }

  await prisma.user.create({
    data: {
      userId: adminUserId,
      pinHash: pinHash,
      displayName: '管理者',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.info('✅ Admin user created successfully!');
  console.info('   UserID: admin');
  console.info('   PIN: 1234');
  console.info('   ⚠️  Please change the default PIN after first login!');
}

async function seedStandardUsers(count = 50) {
  const userPromises = Array.from({ length: count }).map(async (_, index) => {
    const userId = `user-${String(index + 1).padStart(2, '0')}`;

    const existing = await prisma.user.findUnique({
      where: { userId },
    });
    if (existing) {
      return null;
    }

    const pin = '1234';
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.user.create({
      data: {
        userId,
        pinHash,
        displayName: `一般ユーザー${index + 1}`,
        role: 'USER',
        isActive: true,
      },
    });
    return null;
  });

  await Promise.all(userPromises);
  console.info(`✅ ${count} standard users created successfully!`);
}

async function main() {
  console.info('Seeding problems...');
  await seedProblems();
  console.info('Seeding admin user...');
  await seedAdminUser();
  console.info('Seeding standard users...');
  await seedStandardUsers(50);
  console.info('Seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

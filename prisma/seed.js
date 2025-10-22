// /* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'; 
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedProblems() {
  // const defaultBoardId =
  //   process.env.MOCK_MIRO_BOARD_ID ?? 'mock-miro-board-id-1';

  const problems = [
    {
      id: 'problem-001',
      title: '現場写真から気づきを抽出する',
      description:
        '撮影した写真を観察し、チームで共有できる気づきを整理してください。',
      orderIndex: 1,
      // miroBoardId: 'uXjVJZIz_Aw=',
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody:
        '1. 写真を確認\n2. 重要なポイントを箇条書きにする\n3. 気づき投稿フォームに記載して送信',
    },
    {
      id: 'problem-002',
      title: '安全面の洗い出す',
      description:
        '現場で想定されるリスクや改善点を列挙し、具体的な対策を検討しましょう。',
      orderIndex: 2,
      // miroBoardId: 'uXjVJZOg96A=',
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody:
        '想定されるリスク・改善点をできるだけ多く挙げ、写真やアップロードする画像と紐付けてください。',
    },
    {
      id: 'problem-003',
      title: '改善案をまとめる',
      description:
        '得られた気づきとリスク情報をもとに、改善案を整理し共有します。',
      orderIndex: 3,
      // miroBoardId: 'uXjVJZeHD7I=',
      miroBoardId: 'uXjVJ28TMvE=',
      contentType: 'text',
      contentBody:
        'これまでの気づき・リスクを踏まえた改善案をまとめ、画像や資料があればアップロードしてください。',
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

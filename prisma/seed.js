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
      title: '',
      description: '',
      orderIndex: 1,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-002',
      title: '',
      description: '',
      orderIndex: 2,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-003',
      title: '',
      description: '',
      orderIndex: 3,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-004',
      title: '',
      description: '',
      orderIndex: 4,
      miroBoardId: 'uXjVJ28KUOE=',
      contentType: 'text',
      contentBody: '',
    },
    
    // 次の4問：別のボード（board-B）を共有 → 4象限配置
    {
      id: 'problem-005',
      title: '',
      description: '',
      orderIndex: 5,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-006',
      title: '',
      description: '',
      orderIndex: 6,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-007',
      title: '',
      description: '',
      orderIndex: 7,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-008',
      title: '',
      description: '',
      orderIndex: 8,
      miroBoardId: 'uXjVJ28QKOY=',
      contentType: 'text',
      contentBody: '',
    },
    
    // 残り7問：個別のボードに対応 → ランダム配置
    {
      id: 'problem-009',
      title: '',
      description: '',
      orderIndex: 9,
      miroBoardId: 'uXjVJ28TMvE=',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-010',
      title: '',
      description: '',
      orderIndex: 10,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-011',
      title: '',
      description: '',
      orderIndex: 11,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-012',
      title: '',
      description: '',
      orderIndex: 12,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-013',
      title: '',
      description: '',
      orderIndex: 13,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-014',
      title: '',
      description: '',
      orderIndex: 14,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
    },
    {
      id: 'problem-015',
      title: '',
      description: '',
      orderIndex: 15,
      miroBoardId: '',
      contentType: 'text',
      contentBody: '',
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

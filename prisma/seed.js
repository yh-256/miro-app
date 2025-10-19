/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedSubjects() {
  const subjects = [
    { id: 'subject-alpha', name: 'Aチーム' },
    { id: 'subject-bravo', name: 'Bチーム' },
    { id: 'subject-charlie', name: 'Cチーム' },
  ];

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: {
        name: subject.name,
        lastUsedAt: new Date(),
      },
      create: {
        ...subject,
        lastUsedAt: new Date(),
      },
    });
  }
}

async function seedProblems() {
  const defaultBoardId =
    process.env.MOCK_MIRO_BOARD_ID ?? 'mock-miro-board-id-1';

  const problems = [
    {
      id: 'problem-001',
      title: '現場写真から気づきを抽出する',
      description:
        '撮影した写真を観察し、チームで共有できる気づきを整理してください。',
      orderIndex: 1,
      miroBoardId: defaultBoardId,
      contentType: 'text',
      contentBody:
        '1. 写真を確認\n2. 重要なポイントを箇条書きにする\n3. 気づき投稿フォームに記載して送信',
    },
    {
      id: 'problem-002',
      title: '安全面のリスクを洗い出す',
      description:
        '現場で想定されるリスクや改善点を列挙し、具体的な対策を検討しましょう。',
      orderIndex: 2,
      miroBoardId: defaultBoardId,
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
      miroBoardId: defaultBoardId,
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

async function main() {
  console.info('Seeding subjects...');
  await seedSubjects();
  console.info('Seeding problems...');
  await seedProblems();
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

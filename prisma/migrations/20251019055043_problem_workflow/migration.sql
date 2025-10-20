-- AlterTable
ALTER TABLE "insights" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "problem_progress" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "problems" ALTER COLUMN "updated_at" DROP DEFAULT;

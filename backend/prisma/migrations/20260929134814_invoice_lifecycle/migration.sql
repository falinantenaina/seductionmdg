-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

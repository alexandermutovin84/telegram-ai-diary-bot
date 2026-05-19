-- CreateTable
CREATE TABLE "SchemaBootstrap" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaBootstrap_pkey" PRIMARY KEY ("id")
);

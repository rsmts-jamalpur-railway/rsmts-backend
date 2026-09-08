-- CreateEnum
CREATE TYPE "SyncEntity" AS ENUM ('ASSET', 'LOCATION', 'REPAIR_CYCLE', 'REPAIR_HOLD', 'MANUFACTURING_ORDER', 'QA_INSPECTION', 'FIT_CERTIFICATE', 'EXCEPTION', 'MOVEMENT_LOG', 'USER');

-- CreateEnum
CREATE TYPE "SyncAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- AlterTable
ALTER TABLE "Exception" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "ManufacturingOrder" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "MovementLog" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "QAInspection" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "RepairCycle" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "RepairHold" ADD COLUMN     "client_operation_id" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assigned_location_id" TEXT;

-- CreateTable
CREATE TABLE "SyncEvent" (
    "server_revision" BIGSERIAL NOT NULL,
    "entity_type" "SyncEntity" NOT NULL,
    "record_id" UUID NOT NULL,
    "action" "SyncAction" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("server_revision")
);

-- CreateIndex
CREATE INDEX "SyncEvent_server_revision_idx" ON "SyncEvent"("server_revision");

-- CreateIndex
CREATE INDEX "SyncEvent_entity_type_record_id_idx" ON "SyncEvent"("entity_type", "record_id");

-- CreateIndex
CREATE UNIQUE INDEX "Exception_client_operation_id_key" ON "Exception"("client_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingOrder_client_operation_id_key" ON "ManufacturingOrder"("client_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "MovementLog_client_operation_id_key" ON "MovementLog"("client_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "QAInspection_client_operation_id_key" ON "QAInspection"("client_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCycle_client_operation_id_key" ON "RepairCycle"("client_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "RepairHold_client_operation_id_key" ON "RepairHold"("client_operation_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assigned_location_id_fkey" FOREIGN KEY ("assigned_location_id") REFERENCES "Location"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

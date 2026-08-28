-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "employee_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT,
    "date_of_joining" TIMESTAMP(3),
    "employment_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentifier" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_location_id" TEXT,
    "scope_department" TEXT,
    "scope_section" TEXT,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "Location" (
    "location_id" TEXT NOT NULL,
    "location_type" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "zone" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "AssetCategoryMaster" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "id_length" INTEGER,
    "requires_check_digit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssetCategoryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairCategoryMaster" (
    "id" TEXT NOT NULL,
    "standard_tat_hours" INTEGER NOT NULL,

    CONSTRAINT "RepairCategoryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "asset_number" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "current_location" TEXT,
    "current_status" TEXT NOT NULL,
    "allocated_shop" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "target_location" TEXT NOT NULL,
    "allocated_by" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairCycle" (
    "cycle_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "repair_category_id" TEXT NOT NULL,
    "estimated_tat_hours" INTEGER,
    "actual_tat_hours" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairCycle_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "RepairAssessment" (
    "id" UUID NOT NULL,
    "repair_cycle_id" UUID NOT NULL,
    "assessed_by" UUID NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairHold" (
    "id" UUID NOT NULL,
    "repair_cycle_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "released_by" UUID,

    CONSTRAINT "RepairHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairWorkLog" (
    "id" UUID NOT NULL,
    "repair_cycle_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "performed_by" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingStageMaster" (
    "stage_id" TEXT NOT NULL,
    "asset_category_id" TEXT NOT NULL,
    "stage_sequence_number" INTEGER NOT NULL,
    "stage_name" TEXT NOT NULL,

    CONSTRAINT "ManufacturingStageMaster_pkey" PRIMARY KEY ("stage_id")
);

-- CreateTable
CREATE TABLE "ManufacturingOrder" (
    "order_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "production_type" TEXT NOT NULL,
    "built_by_shop" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "current_stage_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingOrder_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "ManufacturingWorkLog" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "stage_id" TEXT NOT NULL,
    "completed_by" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturingWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAInspection" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "repair_cycle_id" UUID,
    "manufacturing_order_id" UUID,
    "inspector_id" UUID NOT NULL,
    "inspection_type" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QAInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QATestResult" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "test_name" TEXT NOT NULL,
    "value" TEXT,
    "passed" BOOLEAN NOT NULL,

    CONSTRAINT "QATestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitCertificate" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID NOT NULL,

    CONSTRAINT "FitCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reported_by" UUID NOT NULL,
    "assigned_to" UUID,
    "reason" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementLog" (
    "log_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "from_location" TEXT,
    "to_location" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "repair_cycle_id" UUID,
    "manufacturing_order_id" UUID,
    "handled_by" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sync_status" TEXT NOT NULL DEFAULT 'Synced',
    "device_id" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "AssetPhoto" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "movement_log_id" UUID,
    "photo_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "fcm_token" TEXT,
    "last_sync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employee_number_key" ON "Employee"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "User_employee_id_key" ON "User"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentifier_type_normalized_value_key" ON "UserIdentifier"("type", "normalized_value");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_hash_key" ON "Session"("session_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_asset_number_key" ON "Asset"("asset_number");

-- CreateIndex
CREATE INDEX "Asset_current_status_current_location_idx" ON "Asset"("current_status", "current_location");

-- CreateIndex
CREATE UNIQUE INDEX "FitCertificate_certificate_number_key" ON "FitCertificate"("certificate_number");

-- CreateIndex
CREATE INDEX "MovementLog_handled_by_idx" ON "MovementLog"("handled_by");

-- CreateIndex
CREATE INDEX "MovementLog_timestamp_idx" ON "MovementLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Device_user_id_key" ON "Device"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Device_device_id_key" ON "Device"("device_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentifier" ADD CONSTRAINT "UserIdentifier_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_scope_location_id_fkey" FOREIGN KEY ("scope_location_id") REFERENCES "Location"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "AssetCategoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_current_location_fkey" FOREIGN KEY ("current_location") REFERENCES "Location"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_allocated_shop_fkey" FOREIGN KEY ("allocated_shop") REFERENCES "Location"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_target_location_fkey" FOREIGN KEY ("target_location") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCycle" ADD CONSTRAINT "RepairCycle_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCycle" ADD CONSTRAINT "RepairCycle_repair_category_id_fkey" FOREIGN KEY ("repair_category_id") REFERENCES "RepairCategoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairAssessment" ADD CONSTRAINT "RepairAssessment_repair_cycle_id_fkey" FOREIGN KEY ("repair_cycle_id") REFERENCES "RepairCycle"("cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairAssessment" ADD CONSTRAINT "RepairAssessment_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairHold" ADD CONSTRAINT "RepairHold_repair_cycle_id_fkey" FOREIGN KEY ("repair_cycle_id") REFERENCES "RepairCycle"("cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairHold" ADD CONSTRAINT "RepairHold_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairHold" ADD CONSTRAINT "RepairHold_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairWorkLog" ADD CONSTRAINT "RepairWorkLog_repair_cycle_id_fkey" FOREIGN KEY ("repair_cycle_id") REFERENCES "RepairCycle"("cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairWorkLog" ADD CONSTRAINT "RepairWorkLog_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingStageMaster" ADD CONSTRAINT "ManufacturingStageMaster_asset_category_id_fkey" FOREIGN KEY ("asset_category_id") REFERENCES "AssetCategoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_built_by_shop_fkey" FOREIGN KEY ("built_by_shop") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_current_stage_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "ManufacturingStageMaster"("stage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingWorkLog" ADD CONSTRAINT "ManufacturingWorkLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ManufacturingOrder"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingWorkLog" ADD CONSTRAINT "ManufacturingWorkLog_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "ManufacturingStageMaster"("stage_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingWorkLog" ADD CONSTRAINT "ManufacturingWorkLog_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAInspection" ADD CONSTRAINT "QAInspection_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAInspection" ADD CONSTRAINT "QAInspection_repair_cycle_id_fkey" FOREIGN KEY ("repair_cycle_id") REFERENCES "RepairCycle"("cycle_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAInspection" ADD CONSTRAINT "QAInspection_manufacturing_order_id_fkey" FOREIGN KEY ("manufacturing_order_id") REFERENCES "ManufacturingOrder"("order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAInspection" ADD CONSTRAINT "QAInspection_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QATestResult" ADD CONSTRAINT "QATestResult_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "QAInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitCertificate" ADD CONSTRAINT "FitCertificate_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "QAInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitCertificate" ADD CONSTRAINT "FitCertificate_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_from_location_fkey" FOREIGN KEY ("from_location") REFERENCES "Location"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_to_location_fkey" FOREIGN KEY ("to_location") REFERENCES "Location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_repair_cycle_id_fkey" FOREIGN KEY ("repair_cycle_id") REFERENCES "RepairCycle"("cycle_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_manufacturing_order_id_fkey" FOREIGN KEY ("manufacturing_order_id") REFERENCES "ManufacturingOrder"("order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_movement_log_id_fkey" FOREIGN KEY ("movement_log_id") REFERENCES "MovementLog"("log_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

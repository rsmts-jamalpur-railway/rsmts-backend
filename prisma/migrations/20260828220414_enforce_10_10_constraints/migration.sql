-- 1. XOR Constraint: QAInspection must belong to exactly ONE operation
ALTER TABLE "QAInspection" ADD CONSTRAINT "chk_qa_operation_xor" CHECK (
  ("repair_cycle_id" IS NOT NULL AND "manufacturing_order_id" IS NULL) OR 
  ("repair_cycle_id" IS NULL AND "manufacturing_order_id" IS NOT NULL)
);

-- 2. Single Active Operation Invariant: An asset cannot have multiple active operations across Repair and Mfg
CREATE OR REPLACE FUNCTION check_single_active_operation()
RETURNS TRIGGER AS $$
DECLARE
  active_repairs INT;
  active_mfgs INT;
BEGIN
  -- Count active repair cycles for this asset
  SELECT COUNT(*) INTO active_repairs FROM "RepairCycle" WHERE "asset_id" = NEW."asset_id" AND "status" = 'ACTIVE';
  
  -- Count active manufacturing orders for this asset
  SELECT COUNT(*) INTO active_mfgs FROM "ManufacturingOrder" WHERE "asset_id" = NEW."asset_id" AND "status" = 'ACTIVE';
  
  IF (active_repairs + active_mfgs) > 1 THEN
    RAISE EXCEPTION 'Asset % cannot have more than one active operation simultaneously (Repair or Manufacturing)', NEW."asset_id";
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_active_repair
AFTER INSERT OR UPDATE ON "RepairCycle"
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION check_single_active_operation();

CREATE TRIGGER trg_check_active_mfg
AFTER INSERT OR UPDATE ON "ManufacturingOrder"
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION check_single_active_operation();

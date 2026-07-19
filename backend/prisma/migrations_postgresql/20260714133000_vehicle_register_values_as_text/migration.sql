ALTER TABLE "vehicles"
  ALTER COLUMN "purchaseCost" TYPE TEXT USING "purchaseCost"::TEXT,
  ALTER COLUMN "bookedValue" TYPE TEXT USING "bookedValue"::TEXT,
  ALTER COLUMN "estimatedCost" TYPE TEXT USING "estimatedCost"::TEXT,
  ALTER COLUMN "reservedPresentValue" TYPE TEXT USING "reservedPresentValue"::TEXT,
  ALTER COLUMN "age" TYPE TEXT USING "age"::TEXT;

BEGIN;
ALTER TABLE telemetry ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_changes ADD COLUMN expected_version INTEGER NOT NULL DEFAULT 0, ADD COLUMN applied_version INTEGER;
-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error_code" TEXT,
    "traceparent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs"("created_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_next_attempt_at_locked_at_idx" ON "outbox_events"("published_at", "next_attempt_at", "locked_at");
COMMIT;

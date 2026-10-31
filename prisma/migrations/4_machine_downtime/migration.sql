BEGIN;

-- Old change records point to readings from the retired telemetry domain.
DELETE FROM telemetry_changes;
ALTER TABLE telemetry_changes ALTER COLUMN reading_id TYPE BIGINT;

DROP TABLE IF EXISTS telemetry;
CREATE TABLE telemetry (
    id BIGSERIAL NOT NULL,
    record_key VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    machine_id VARCHAR(120) NOT NULL,
    assembly_line VARCHAR(80) NOT NULL,
    date TIMESTAMP(6) NOT NULL,
    hydraulic_pressure_bar NUMERIC,
    coolant_pressure_bar NUMERIC,
    air_system_pressure_bar NUMERIC,
    coolant_temperature_c NUMERIC,
    hydraulic_oil_temperature_c NUMERIC,
    spindle_bearing_temperature_c NUMERIC,
    spindle_vibration_um NUMERIC,
    tool_vibration_um NUMERIC,
    spindle_speed_rpm NUMERIC,
    voltage_v NUMERIC,
    torque_nm NUMERIC,
    cutting_kn NUMERIC,
    downtime BOOLEAN,
    downtime_label VARCHAR(40),
    quality_issues TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT telemetry_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX telemetry_record_key_key ON telemetry(record_key);
CREATE INDEX telemetry_machine_id_date_idx ON telemetry(machine_id, date);
CREATE INDEX telemetry_date_idx ON telemetry(date);

COMMIT;

export type ReadingStatus = "Falha" | "Crítico" | "Atenção" | "Normal"

export type TelemetryRow = {
  id: number
  recordKey: string
  version: number
  machineId: string
  assemblyLine: string
  timestamp: string
  status: ReadingStatus
  hydraulicPressure: number | null
  coolantPressure: number | null
  airSystemPressure: number | null
  coolantTemperature: number | null
  hydraulicOilTemperature: number | null
  spindleBearingTemperature: number | null
  spindleVibration: number | null
  toolVibration: number | null
  spindleSpeed: number | null
  voltage: number | null
  torque: number | null
  cutting: number | null
  downtime: boolean | null
  downtimeLabel: string | null
  qualityIssues: string[]
}

export type DashboardData = { kpis: { label: string; value: string; delta: string; tone: "good" | "warn" | "danger" }[]; series: { day: string; temperature: number; vibration: number; rpm: number }[]; machines: { id: string; status: "Normal" | "Atenção" | "Crítico" | "Falha"; temp: number; vibration: number; lastSeen: string }[]; alerts: { title: string; machine: string; time: string; severity: "high" | "medium" | "low" }[] };

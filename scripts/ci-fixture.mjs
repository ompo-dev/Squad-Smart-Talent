/** Synthetic fixture for disposable CI databases; contains no customer data. */
const machines = [
  ["Makino-L1-Unit1-2013", "Shopfloor-L1"],
  ["Makino-L2-Unit1-2013", "Shopfloor-L2"],
  ["Makino-L3-Unit1-2013", "Shopfloor-L3"],
]
const count = 2500

export function ciReadings() {
  return Array.from({ length: count }, (_, index) => {
    const [machineId, assemblyLine] = machines[index % machines.length]
    const day = Math.floor((index * 164) / count)
    const date = new Date(Date.UTC(2021, 11, 31 + day, index % 24, (index * 7) % 60))
    const criticalTemperature = index % machines.length === 0 && index % 97 === 0
    const criticalVibration = index % 131 === 0
    return {
      record_key: index.toString(16).padStart(32, "0"),
      machine_id: machineId,
      assembly_line: assemblyLine,
      date,
      hydraulic_pressure_bar: 130 + (index % 20),
      coolant_pressure_bar: 5 + (index % 5) / 10,
      air_system_pressure_bar: 6 + (index % 4) / 10,
      coolant_temperature_c: criticalTemperature ? 46 : 24 + (index % 80) / 10,
      hydraulic_oil_temperature_c: 45 + (index % 60) / 10,
      spindle_bearing_temperature_c: 40 + (index % 40) / 10,
      spindle_vibration_um: criticalVibration ? 1.98 : 1.2 + (index % 50) / 100,
      tool_vibration_um: 30 + (index % 10),
      spindle_speed_rpm: 20000 + (index % 5000),
      voltage_v: 400 + (index % 20),
      torque_nm: 35 + (index % 10),
      cutting_kn: 10 + (index % 5),
      downtime: index % 2 === 0,
      downtime_label: index % 2 === 0 ? "Machine_Failure" : "No_Machine_Failure",
      quality_issues: [],
    }
  })
}

export const ciFixture = { readings: count, machines: machines.length, days: 164 }

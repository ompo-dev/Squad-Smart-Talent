import { DashboardData } from "./types";
export const dashboardMock: DashboardData = {
  kpis: [
    { label: "Máquinas monitoradas", value: "3", delta: "Makino · 3 linhas de montagem", tone: "good" },
    { label: "Temp. do refrigerante", value: "24,9 °C", delta: "Dentro da faixa operacional", tone: "good" },
    { label: "Leituras em alerta", value: "07", delta: "Paradas e sensores críticos", tone: "warn" },
    { label: "Disponibilidade", value: "50,6%", delta: "1.235 leituras sem parada", tone: "warn" }
  ],
  series: ["01/05", "02/05", "03/05", "04/05", "05/05", "06/05", "07/05", "08/05", "09/05", "10/05", "11/05", "12/05", "13/05", "14/05"].map((day, i) => ({ day, temperature: +(24 + Math.sin(i / 2) * 2.4 + i * .12).toFixed(1), vibration: +(1.2 + Math.cos(i / 2) * .18 + (i % 4) * .04).toFixed(2), rpm: 21000 + Math.round(Math.cos(i / 2) * 900) })),
  machines: [
    { id: "Makino-L1-Unit1-2013", status: "Falha", temp: 27.4, vibration: 1.62, lastSeen: "há 2 min" }, { id: "Makino-L2-Unit1-2013", status: "Crítico", temp: 33.8, vibration: 1.97, lastSeen: "há 4 min" }, { id: "Makino-L3-Unit1-2013", status: "Atenção", temp: 31.2, vibration: 1.84, lastSeen: "há 7 min" }
  ],
  alerts: [
    { title: "Parada registrada", machine: "Makino-L1-Unit1-2013", time: "há 2 min", severity: "high" }, { title: "Vibração do spindle acima do limite crítico", machine: "Makino-L2-Unit1-2013", time: "há 4 min", severity: "high" }, { title: "Temperatura do refrigerante em atenção", machine: "Makino-L3-Unit1-2013", time: "há 7 min", severity: "medium" }, { title: "Rótulo de parada ausente", machine: "Makino-L1-Unit1-2013", time: "há 18 min", severity: "low" }
  ]
};

import { DashboardData } from "./types";
export const dashboardMock: DashboardData = {
  kpis: [
    { label: "Máquinas monitoradas", value: "24", delta: "+2,4% vs. semana anterior", tone: "good" },
    { label: "Temperatura média", value: "78,4 °C", delta: "Dentro do limite operacional", tone: "good" },
    { label: "Alertas ativos", value: "07", delta: "3 exigem atenção hoje", tone: "warn" },
    { label: "Uptime da frota", value: "98,7%", delta: "+0,8% no período", tone: "good" }
  ],
  series: ["01/05", "02/05", "03/05", "04/05", "05/05", "06/05", "07/05", "08/05", "09/05", "10/05", "11/05", "12/05", "13/05", "14/05"].map((day, i) => ({ day, temperature: 72 + Math.round(Math.sin(i / 2) * 7 + i * .4), vibration: +(2.4 + Math.cos(i / 2) * .4 + (i % 4) * .08).toFixed(2), rpm: 910 + Math.round(Math.cos(i / 2) * 34) })),
  machines: [
    { id: 22, status: "Crítico", temp: 105, vibration: 5.92, lastSeen: "há 2 min" }, { id: 7, status: "Atenção", temp: 104.1, vibration: 4.62, lastSeen: "há 4 min" }, { id: 15, status: "Atenção", temp: 92.4, vibration: 3.87, lastSeen: "há 7 min" }, { id: 3, status: "Normal", temp: 75.2, vibration: 2.51, lastSeen: "há 8 min" }, { id: 18, status: "Normal", temp: 73.8, vibration: 2.32, lastSeen: "há 10 min" }
  ],
  alerts: [
    { title: "Temperatura acima de 100 °C", machine: "Máquina #22", time: "há 2 min", severity: "high" }, { title: "Vibração fora da faixa", machine: "Máquina #07", time: "há 4 min", severity: "high" }, { title: "Pressão de óleo irregular", machine: "Máquina #15", time: "há 7 min", severity: "medium" }, { title: "Pacote de dados perdido", machine: "Máquina #04", time: "há 18 min", severity: "low" }
  ]
};

/** Synthetic fixture for disposable CI databases; contains no customer data. */
export function ciReadings() {
  return Array.from({ length: 4000 }, (_, index) => {
    const machine = (index % 24) + 1
    const day = Math.floor(index / 288)
    const timestamp = new Date(Date.UTC(2026, 4, day + 1, 0, (index % 288) * 5))
    return [index + 1, machine, timestamp, Number((68 + machine * 1.3 + index % 17).toFixed(1)), 40 + index % 10, 1000 + index % 600, Number((1 + (index % 50) / 10).toFixed(1)), 10 + index % 5, 1500 + index]
  })
}

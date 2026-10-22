// localStorage store for calculator history.

const KEY = 'hma_calc_history_v1'
const MAX = 60

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export const localCalculator = {
  getHistory() {
    return read()
  },

  pushEntry(expression, result) {
    const history = read()
    const entry = {
      id: Date.now(),
      expression: String(expression),
      result: String(result),
      at: new Date().toISOString(),
    }
    const updated = [entry, ...history].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(updated))
    return updated
  },

  clearHistory() {
    localStorage.setItem(KEY, '[]')
  },
}

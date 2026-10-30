export function formatSignedInt(value: number) {
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  if (value === 0) return '+0'
  return `${value > 0 ? '+' : '-'}${nf.format(Math.abs(value))}`
}


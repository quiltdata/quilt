const MINUTE = 1000 * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MONTH = DAY * 30
const YEAR = DAY * 365

const intl = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function formatRelative(date: Date) {
  const delta = date.valueOf() - Date.now()

  const years = delta / YEAR
  if (Math.abs(years) >= 1) return intl.format(Math.round(years), 'year')

  const months = delta / MONTH
  if (Math.abs(months) >= 1) return intl.format(Math.round(months), 'month')

  const days = delta / DAY
  if (Math.abs(days) >= 1) return intl.format(Math.round(days), 'day')

  const hours = delta / HOUR
  if (Math.abs(hours) >= 1) return intl.format(Math.round(hours), 'hour')

  const minutes = delta / MINUTE
  if (Math.abs(minutes) > 0) return intl.format(Math.round(minutes), 'minute')

  return intl.format(Math.round(delta / 1000), 'second')
}

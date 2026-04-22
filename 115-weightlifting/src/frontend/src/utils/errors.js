const formatFieldErrors = (data) => {
  if (!data || typeof data !== 'object') return null
  if (data.detail) return String(data.detail)

  const parts = []
  for (const [field, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      parts.push(`${field}: ${value.join(', ')}`)
    } else if (typeof value === 'string') {
      parts.push(`${field}: ${value}`)
    }
  }
  return parts.length > 0 ? parts.join(' | ') : null
}

export const formatApiError = (err, fallback = 'Request failed.') => {
  if (!err) return fallback
  const data = err.response?.data
  if (typeof data === 'string' && data) return data
  const fromData = formatFieldErrors(data)
  if (fromData) return fromData
  return err.message || fallback
}

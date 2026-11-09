export async function readApiPayload(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.detail || `Máy chủ trả về HTTP ${response.status}.`)
  }
  if (payload?.status === 'error') {
    throw new Error(payload.message || 'Yêu cầu không thành công.')
  }
  return payload?.data ?? payload
}

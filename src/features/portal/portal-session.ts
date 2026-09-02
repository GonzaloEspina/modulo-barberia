const STORAGE_KEY = 'barberia_portal_session'

export interface PortalSession {
  token: string
  clientId: string
  clientName: string
  expiresAt: string
}

export function loadPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortalSession
    if (new Date(parsed.expiresAt) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function savePortalSession(session: PortalSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearPortalSession() {
  localStorage.removeItem(STORAGE_KEY)
}

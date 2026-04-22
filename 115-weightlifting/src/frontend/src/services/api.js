import axios from 'axios'
import {
  clearAuth,
  getRefreshToken,
  getToken,
  setCurrentUser,
  setRefreshToken,
  setToken,
} from '../utils/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const getApiBase = () => API_BASE

export const getAuthHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const apiClient = axios.create({ baseURL: API_BASE })

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshInFlight = null

const refreshAccessToken = async () => {
  if (refreshInFlight) return refreshInFlight
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('no refresh token')

  refreshInFlight = axios
    .post(`${API_BASE}/api/auth/token/refresh/`, { refresh })
    .then(({ data }) => {
      setToken(data.access)
      if (data.refresh) setRefreshToken(data.refresh)
      return data.access
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

const handleAuthFailure = () => {
  clearAuth()
  if (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    if (status !== 401 || !original || original._retry) {
      if (status === 401) handleAuthFailure()
      return Promise.reject(error)
    }

    const url = original.url || ''
    if (url.includes('/api/auth/token/') || url.includes('/api/auth/register/')) {
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const newAccess = await refreshAccessToken()
      original.headers = original.headers || {}
      original.headers.Authorization = `Bearer ${newAccess}`
      return apiClient(original)
    } catch (refreshError) {
      handleAuthFailure()
      return Promise.reject(refreshError)
    }
  }
)

export const getCurrentUserFromApi = async () => {
  const { data } = await apiClient.get('/api/auth/me/')
  return data
}

export const login = async (username, password) => {
  const { data } = await axios.post(`${API_BASE}/api/auth/token/`, { username, password })
  setToken(data.access)
  if (data.refresh) setRefreshToken(data.refresh)

  try {
    const currentUser = await getCurrentUserFromApi()
    setCurrentUser(currentUser)
    return { ...data, user: currentUser }
  } catch (error) {
    clearAuth()
    throw error
  }
}

export const register = async (username, password, user_type) => {
  await axios.post(`${API_BASE}/api/auth/register/`, { username, password, user_type })
}

export const refreshCurrentUser = async () => {
  const currentUser = await getCurrentUserFromApi()
  setCurrentUser(currentUser)
  return currentUser
}

export const logout = () => clearAuth()

export const getProgramsFromBackend = async () => {
  const { data } = await apiClient.get('/api/programs/')
  return data
}

export const createProgram = async (payload) => {
  const { data } = await apiClient.post('/api/programs/', payload)
  return data
}

export const updateProgram = async (programId, payload) => {
  const { data } = await apiClient.patch(`/api/programs/${programId}/`, payload)
  return data
}

export const assignProgram = async (programId, athleteId) => {
  const { data } = await apiClient.patch(
    `/api/programs/${programId}/assign/`,
    { athlete_id: athleteId }
  )
  return data
}

export const getAthletes = async () => {
  const { data } = await apiClient.get('/api/auth/athletes/')
  return data
}

export const getProgramCompletion = async (programId) => {
  const { data } = await apiClient.get(`/api/athletes/program-completion/${programId}/`)
  return data
}

export const updateProgramCompletion = async (programId, completion_data) => {
  const { data } = await apiClient.patch(
    `/api/athletes/program-completion/${programId}/`,
    { completion_data }
  )
  return data
}

export const createWorkoutLog = async (payload) => {
  const { data } = await apiClient.post('/api/athletes/workouts/', payload)
  return data
}

export const getWorkoutLogs = async (athleteId = null) => {
  const params = athleteId ? { athlete_id: athleteId } : undefined
  const { data } = await apiClient.get('/api/athletes/workouts/', { params })
  return data
}

export const createPersonalRecord = async (payload) => {
  const { data } = await apiClient.post('/api/athletes/prs/', payload)
  return data
}

export const getPersonalRecords = async (athleteId = null) => {
  const params = athleteId ? { athlete_id: athleteId } : undefined
  const { data } = await apiClient.get('/api/athletes/prs/', { params })
  return data
}

export const calculateSinclair = async (payload) => {
  const { data } = await apiClient.post('/api/analytics/sinclair/', payload)
  return data
}

import axios from 'axios'
import { clearAuth, getToken, setCurrentUser, setToken } from '../utils/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const getApiBase = () => API_BASE

export const getAuthHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const getCurrentUserFromApi = async () => {
  const { data } = await axios.get(`${API_BASE}/api/auth/me/`, {
    headers: getAuthHeaders()
  })
  return data
}

export const login = async (username, password) => {
  const { data } = await axios.post(`${API_BASE}/api/auth/token/`, { username, password })
  setToken(data.access)

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
  const { data } = await axios.get(`${API_BASE}/api/programs/`, { headers: getAuthHeaders() })
  return data
}

export const createProgram = async (payload) => {
  const { data } = await axios.post(`${API_BASE}/api/programs/`, payload, {
    headers: getAuthHeaders()
  })
  return data
}

export const updateProgram = async (programId, payload) => {
  const { data } = await axios.patch(`${API_BASE}/api/programs/${programId}/`, payload, {
    headers: getAuthHeaders()
  })
  return data
}

export const assignProgram = async (programId, athleteId) => {
  const { data } = await axios.patch(
    `${API_BASE}/api/programs/${programId}/assign/`,
    { athlete_id: athleteId },
    { headers: getAuthHeaders() }
  )
  return data
}

export const getAthletes = async () => {
  const { data } = await axios.get(`${API_BASE}/api/auth/athletes/`, {
    headers: getAuthHeaders()
  })
  return data
}

export const getProgramCompletion = async (programId) => {
  const { data } = await axios.get(`${API_BASE}/api/athletes/program-completion/${programId}/`, {
    headers: getAuthHeaders()
  })
  return data
}

export const updateProgramCompletion = async (programId, completion_data) => {
  const { data } = await axios.patch(
    `${API_BASE}/api/athletes/program-completion/${programId}/`,
    { completion_data },
    { headers: getAuthHeaders() }
  )
  return data
}

export const createWorkoutLog = async (payload) => {
  const { data } = await axios.post(`${API_BASE}/api/athletes/workouts/`, payload, {
    headers: getAuthHeaders()
  })
  return data
}

export const getWorkoutLogs = async (athleteId = null) => {
  const params = athleteId ? { athlete_id: athleteId } : undefined
  const { data } = await axios.get(`${API_BASE}/api/athletes/workouts/`, {
    headers: getAuthHeaders(),
    params
  })
  return data
}

export const createPersonalRecord = async (payload) => {
  const { data } = await axios.post(`${API_BASE}/api/athletes/prs/`, payload, {
    headers: getAuthHeaders()
  })
  return data
}

export const getPersonalRecords = async (athleteId = null) => {
  const params = athleteId ? { athlete_id: athleteId } : undefined
  const { data } = await axios.get(`${API_BASE}/api/athletes/prs/`, {
    headers: getAuthHeaders(),
    params
  })
  return data
}

export const calculateSinclair = async (payload) => {
  const { data } = await axios.post(`${API_BASE}/api/analytics/sinclair/`, payload, {
    headers: getAuthHeaders()
  })
  return data
}

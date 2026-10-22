import axios from 'axios'
import store from '../store'

// No VITE_API_BASE_URL falls back to '' (same-origin) rather than a hardcoded
// host, so the production build works behind a reverse proxy without needing
// a public URL baked in at build time. Local dev sets VITE_API_BASE_URL
// explicitly in .env, so this fallback is only ever hit in production.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = store.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear session and send to login (but never for dev tokens)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = store.getState().token
      // Dev and local tokens are not real JWTs — ignore 401s so the session stays alive
      if (!token || token.startsWith('dev-') || token.startsWith('local-')) {
        return Promise.reject(error)
      }
      localStorage.removeItem('hma_token')
      store.dispatch({ type: 'set', user: null, token: null })
      // HashRouter — navigate without useNavigate (which requires a component context)
      window.location.hash = '#/login'
    }
    return Promise.reject(error)
  },
)

export default api

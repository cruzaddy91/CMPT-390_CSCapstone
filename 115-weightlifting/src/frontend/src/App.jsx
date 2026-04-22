import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import AthleteDashboard from './pages/AthleteDashboard'
import CoachDashboard from './pages/CoachDashboard'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import { getAthletes, getCurrentUserFromApi, getProgramsFromBackend, logout } from './services/api'
import { clearAuth, getCurrentUser, getToken, isAuthenticated, setCurrentUser } from './utils/auth'
import { countExercises, normalizeProgramData } from './utils/dataStructure'
import { relativeTimeSince } from './utils/relativeTime'
import { applyTheme, resolveInitialTheme, toggleTheme } from './utils/theme'
import './App.css'

const getDefaultRouteForUser = () => {
  const currentUser = getCurrentUser()
  if (!currentUser) return '/login'
  return currentUser.user_type === 'coach' ? '/coach' : '/athlete'
}

const ProtectedRoute = ({ role, children }) => {
  const [status, setStatus] = useState(() => (getToken() ? 'checking' : 'denied'))
  const [verifiedUser, setVerifiedUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!getToken()) {
      setStatus('denied')
      return () => {}
    }
    getCurrentUserFromApi()
      .then((user) => {
        if (cancelled) return
        setCurrentUser(user)
        setVerifiedUser(user)
        setStatus('authed')
      })
      .catch(() => {
        if (cancelled) return
        clearAuth()
        setStatus('denied')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'checking') {
    return <div className="route-loading">Checking session…</div>
  }
  if (status === 'denied') {
    return <Navigate to="/login" replace />
  }
  if (role && verifiedUser?.user_type !== role) {
    return <Navigate to={getDefaultRouteForUser()} replace />
  }
  return children
}

const Navigation = () => {
  const location = useLocation()
  const currentUser = getCurrentUser()
  const [theme, setThemeState] = useState(resolveInitialTheme)

  // Apply on mount (covers first visit -- index.css defaults to dark until
  // this runs, so light-preference users see a one-frame flicker; acceptable
  // trade for keeping the toggle state in React instead of an inline script).
  useEffect(() => { applyTheme(theme) }, [theme])

  // Hard reload on logout. SPA-style navigate('/login', replace) used to
  // trigger a render loop between /athlete's ProtectedRoute (Navigate to
  // /login) and whichever in-flight effect/request re-entered /athlete --
  // the browser eventually threw "SecurityError: Attempt to use
  // history.replaceState() more than 100 times per 10 seconds" and the
  // ErrorBoundary caught it. Forcing a full page reload is the right call
  // for logout anyway: it drops in-flight requests, resets module state,
  // and lands Login on a clean React tree.
  const handleLogout = async () => {
    await logout()
    window.location.assign('/login')
  }

  const handleThemeToggle = () => {
    setThemeState(toggleTheme(theme))
  }

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">115 <span>Weightlifting</span></Link>
        <div className="nav-actions">
          <div className="nav-links">
            {!currentUser && <Link to="/login" className={location.pathname === '/login' ? 'active' : ''}>Log in</Link>}
            {currentUser?.user_type === 'coach' && (
              <Link to="/coach" className={location.pathname === '/coach' ? 'active' : ''}>Coach</Link>
            )}
            {currentUser?.user_type === 'athlete' && (
              <Link to="/athlete" className={location.pathname === '/athlete' ? 'active' : ''}>Athlete</Link>
            )}
          </div>
          <button
            type="button"
            className="nav-button nav-theme-toggle"
            onClick={handleThemeToggle}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          {currentUser && (
            <>
              <span className="nav-user">{currentUser.username} · {currentUser.user_type}</span>
              <button type="button" className="nav-button" onClick={handleLogout}>Log out</button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

const Home = () => {
  const currentUser = getCurrentUser()
  if (currentUser?.user_type === 'coach') return <CoachHome currentUser={currentUser} />
  return <AnonymousHome currentUser={currentUser} />
}

const AnonymousHome = ({ currentUser }) => {
  const destination = currentUser ? getDefaultRouteForUser() : '/login'
  return (
    <div className="home-container">
      <div className="home-grid">
        <div className="home-copy">
          <div className="home-eyebrow">Olympic Weightlifting Workflow</div>
          <h1>Coach programming, athlete execution, and performance tracking in one precise system.</h1>
          <p className="home-description">
            Build structured weekly training plans, assign them to athletes, log completion against the prescription,
            and review progress with charts and Sinclair scoring.
          </p>
          <div className="home-buttons">
            <Link to={destination} className="home-btn coach-btn">
              {currentUser ? 'Open Dashboard' : 'Log in'}
            </Link>
            {!currentUser && (
              <>
                <Link to="/coach" className="home-btn coach-btn">Coach Preview</Link>
                <Link to="/athlete" className="home-btn athlete-btn">Athlete Preview</Link>
              </>
            )}
          </div>
        </div>
        <div className="home-side">
          <div className="home-panel">
            <span className="home-panel-label">System focus</span>
            <strong>Plan, execute, verify</strong>
            <p>Prescription stays connected to athlete completion, logs, PR history, and analytics.</p>
          </div>
          <div className="home-metrics">
            <div className="home-metric">
              <span className="label">Roles</span>
              <span className="value">Coach + Athlete</span>
            </div>
            <div className="home-metric">
              <span className="label">Tracking</span>
              <span className="value">PRs + Adherence</span>
            </div>
            <div className="home-metric">
              <span className="label">Analytics</span>
              <span className="value">Charts + Sinclair</span>
            </div>
          </div>
          <div className="home-status">
            <span className="status-pill">{currentUser ? `Signed in as ${currentUser.user_type}` : 'Ready for login or preview'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Coach-logged-in home: roster-forward. Fetches the coach's athletes
// (scope=mine) alongside every program the coach owns, groups programs
// by athlete, and renders a scannable "your people" list with the key
// decision-making data (program count + most recent activity) on the
// right. Falls back to an empty-state prompt when the coach has no
// athletes yet so the landing page never feels blank.
const CoachHome = ({ currentUser }) => {
  const [athletes, setAthletes] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAthletes({ scope: 'mine' }).catch(() => ({ results: [] })),
      getProgramsFromBackend().catch(() => []),
    ])
      .then(([athletesResponse, programsResponse]) => {
        if (cancelled) return
        setAthletes(athletesResponse?.results || [])
        setPrograms(Array.isArray(programsResponse) ? programsResponse : [])
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load your roster.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Bucket each program under its athlete so we can show per-athlete stats.
  const programsByAthlete = programs.reduce((acc, program) => {
    const bucket = acc[program.athlete_id] || []
    bucket.push(program)
    acc[program.athlete_id] = bucket
    return acc
  }, {})

  const totalExercises = programs.reduce((sum, program) => {
    const normalized = normalizeProgramData(program.program_data, program.start_date)
    return sum + countExercises(normalized)
  }, 0)
  const totalDays = programs.reduce((sum, program) => {
    const normalized = normalizeProgramData(program.program_data, program.start_date)
    return sum + (normalized?.days?.length || 0)
  }, 0)

  return (
    <div className="home-container coach-home">
      <div className="home-grid">
        <div className="home-copy">
          <div className="home-eyebrow">Coach · {currentUser.username}</div>
          <h1>Welcome back.</h1>
          <p className="home-description">
            {loading
              ? 'Loading your roster…'
              : athletes.length === 0
                ? 'No athletes on your roster yet. Open the Coach Dashboard to build your first program.'
                : `You coach ${athletes.length} athlete${athletes.length === 1 ? '' : 's'} across ${programs.length} program${programs.length === 1 ? '' : 's'}.`}
          </p>
          <div className="home-buttons">
            <Link to="/coach" className="home-btn coach-btn">Open Coach Dashboard</Link>
          </div>
          {error && <div className="save-message error">{error}</div>}
        </div>

        <div className="home-side">
          <div className="home-panel coach-home-roster-panel">
            <div className="coach-home-roster-header">
              <span className="home-panel-label">Your roster</span>
              <span className="coach-home-roster-count data">{athletes.length}</span>
            </div>
            {loading ? (
              <div className="empty-inline">Loading…</div>
            ) : athletes.length === 0 ? (
              <div className="empty-inline">
                No athletes yet. Create a program from the Coach Dashboard and the assigned athlete will appear here.
              </div>
            ) : (
              <div className="coach-home-roster-list">
                {athletes.map((athlete) => {
                  const athletePrograms = programsByAthlete[athlete.id] || []
                  const mostRecent = athletePrograms
                    .map((p) => p.updated_at)
                    .sort()
                    .at(-1)
                  return (
                    <Link
                      key={athlete.id}
                      to="/coach"
                      className="coach-home-roster-row"
                    >
                      <span className="coach-home-roster-name">@{athlete.username}</span>
                      <span className="coach-home-roster-meta">
                        <span className="data">{athletePrograms.length}</span>
                        <span> program{athletePrograms.length === 1 ? '' : 's'}</span>
                        {mostRecent && (
                          <>
                            <span className="program-row-dot">·</span>
                            <span className="coach-home-roster-updated">updated {relativeTimeSince(mostRecent)}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div className="home-metrics">
            <div className="home-metric">
              <span className="label">Athletes</span>
              <span className="value">{athletes.length}</span>
            </div>
            <div className="home-metric">
              <span className="label">Programs</span>
              <span className="value">{programs.length}</span>
            </div>
            <div className="home-metric">
              <span className="label">Days · Exercises</span>
              <span className="value">{totalDays} · {totalExercises}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <ErrorBoundary>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/login"
            element={isAuthenticated() ? <Navigate to={getDefaultRouteForUser()} replace /> : <Login />}
          />
          <Route
            path="/coach"
            element={<ProtectedRoute role="coach"><CoachDashboard /></ProtectedRoute>}
          />
          <Route
            path="/athlete"
            element={<ProtectedRoute role="athlete"><AthleteDashboard /></ProtectedRoute>}
          />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  )
}

export default App

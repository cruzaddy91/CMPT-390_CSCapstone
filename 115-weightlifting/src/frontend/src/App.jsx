import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import AthleteDashboard from './pages/AthleteDashboard'
import CoachDashboard from './pages/CoachDashboard'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import { getCurrentUserFromApi, logout } from './services/api'
import { clearAuth, getCurrentUser, getToken, isAuthenticated, setCurrentUser } from './utils/auth'
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
  const navigate = useNavigate()
  const currentUser = getCurrentUser()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
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

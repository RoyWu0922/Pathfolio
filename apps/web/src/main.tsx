import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store'
import './styles.css'

// In production this app is served under a path prefix (afsgtool.top/pathfolio),
// so the router needs the same base. BASE_URL is '/' in dev, which makes this a
// no-op locally.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME || undefined}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

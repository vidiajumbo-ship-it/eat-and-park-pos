import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StaffApp from './StaffApp.jsx'

// 🎯 URL check — agar /staff hai to StaffApp khule, warna purani App
const isStaffUrl = window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isStaffUrl ? <StaffApp /> : <App />}
  </StrictMode>,
)

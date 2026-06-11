import { BrowserRouter } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './auth'
import { AppRoutes } from './routes'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

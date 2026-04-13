import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Unidades from './pages/Unidades'
import RegistroDiario from './pages/RegistroDiario'
import Mantenimiento from './pages/Mantenimiento'
import CatalogosIndex from './pages/Catalogos/CatalogosIndex'
import Operadores from './pages/Catalogos/Operadores'
import Mecanizacion from './pages/Mecanizacion'
import Fincas from './pages/Catalogos/Fincas'
import Labores from './pages/Catalogos/Labores'
import Reportes from './pages/Reportes'
import BodegaTaller from './pages/BodegaTaller'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas protegidas */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="unidades" element={<Unidades />} />
            <Route path="registro-diario" element={<RegistroDiario />} />
            <Route path="mantenimiento" element={<Mantenimiento />} />
            <Route path="catalogos" element={<CatalogosIndex />} />
            <Route path="catalogos/operadores" element={<Operadores />} />
            <Route path="catalogos/fincas" element={<Fincas />} />
            <Route path="catalogos/labores" element={<Labores />} />
            <Route path="bodega-taller" element={<BodegaTaller />} />
            <Route path="mecanizacion" element={<Mecanizacion />} />
            <Route path="reportes" element={<Reportes />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Tractores from './pages/Tractores'
import RegistroDiario from './pages/RegistroDiario'
import Mantenimiento from './pages/Mantenimiento'

import CatalogosIndex from './pages/Catalogos/CatalogosIndex'
import Operadores from './pages/Catalogos/Operadores'
import Fincas from './pages/Catalogos/Fincas'
import Labores from './pages/Catalogos/Labores'

import Reportes from './pages/Reportes'

function App() {
  return (
    <BrowserRouter>
    <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tractores" element={<Tractores />} />
          <Route path="registro-diario" element={<RegistroDiario />} />
          <Route path="mantenimiento" element={<Mantenimiento />} />

          {/* Catálogos - rutas independientes */}
          <Route path="catalogos" element={<CatalogosIndex />} />
          <Route path="catalogos/operadores" element={<Operadores />} />
          <Route path="catalogos/fincas" element={<Fincas />} />
          <Route path="catalogos/labores" element={<Labores />} />

          <Route path="reportes" element={<Reportes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
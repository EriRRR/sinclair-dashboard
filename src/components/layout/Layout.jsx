import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // En desktop, el sidebar siempre está visible en el estado "abierto" visualmente
  // pero controlamos el estado para el overlay
  const handleSidebarClose = () => setSidebarOpen(false)
  const handleSidebarToggle = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className="flex h-screen bg-gray-100 w-full">
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      
      <div className="flex-1 flex flex-col">
        {/* Header con botón menú */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center">
            <button 
              onClick={handleSidebarToggle}
              className="lg:hidden text-gray-700 mr-3 p-1 rounded hover:bg-gray-100"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-semibold text-gray-800 truncate">
              Sinclair Import Group
            </h1>
          </div>
        </header>

        {/* Contenido principal con padding responsivo */}
        <main className="flex-1 p-4 md:p-6 overflow-x-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
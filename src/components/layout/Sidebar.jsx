import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Truck,
  ClipboardList, 
  Wrench, 
  FolderTree, 
  BarChart3,
  X
} from 'lucide-react'
import { Package } from 'lucide-react'

const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/unidades', name: 'Unidades', icon: Truck },
    { path: '/registro-diario', name: 'Registro Diario', icon: ClipboardList },
    { path: '/mantenimiento', name: 'Mantenimiento', icon: Wrench },
    { path: '/catalogos', name: 'Catálogos', icon: FolderTree },
    { path: '/bodega-taller', name: 'Bodega Taller', icon: Package },
    { path: '/reportes', name: 'Reportes', icon: BarChart3 },
  ]

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-gray-900 text-white z-30
        transition-transform duration-300 ease-in-out
        w-64 lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <span className="text-xl font-bold">Sinclair Group</span>
          <button onClick={onClose} className="lg:hidden text-gray-300 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="mt-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-green-800 hover:text-white transition ${
                  isActive ? 'bg-green-800 text-white border-r-4 border-green-500' : ''
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
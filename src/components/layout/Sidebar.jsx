import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Truck,
  ClipboardList, 
  Wrench, 
  FolderTree, 
  BarChart3,
  X,
  LogOut,
  User,
  Package, 
  Ruler 
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
// 1. Importa tu logo aquí
import LogoImg from '../../assets/SinclairLogo.png'

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth()

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  
  const navItems = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/unidades', name: 'Unidades', icon: Truck },
    { path: '/registro-diario', name: 'Registro Diario', icon: ClipboardList },
    { path: '/mantenimiento', name: 'Mantenimiento', icon: Wrench },
    { path: '/catalogos', name: 'Catálogos', icon: FolderTree },
    { path: '/bodega-taller', name: 'Bodega Taller', icon: Package },
    { path: '/mecanizacion', name: 'Mecanización', icon: Ruler },
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
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* SECCIÓN DEL LOGO */}
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img 
              src={LogoImg} 
              alt="Sinclair Group Logo" 
              className="h-8 w-auto object-contain" 
            />
            <span className="text-xl font-bold tracking-tight">Sinclair Group</span>
          </div>
          
          <button onClick={onClose} className="lg:hidden text-gray-300 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 mt-6 overflow-y-auto">
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

        {/* Footer con usuario y logout */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300 truncate mb-3">
            <User size={18} className="text-gray-400" />
            <span className="truncate">{displayName}</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-red-600 hover:text-white rounded transition"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
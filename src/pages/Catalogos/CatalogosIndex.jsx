import { useState } from 'react'
import { Users, MapPin, ClipboardList, Package, Layers } from 'lucide-react'
import Operadores from './Operadores'
import Fincas from './Fincas'
import Labores from './Labores'
import Lotes from './Lotes'
import Implementos from './Implementos'

const CatalogosIndex = () => {
  const [tabActivo, setTabActivo] = useState('operadores')

  const tabs = [
    { 
      id: 'operadores', 
      nombre: 'Operadores', 
      icono: Users, 
      color: 'text-blue-600',
      bgActivo: 'border-blue-500',
      componente: <Operadores />
    },
    { 
      id: 'fincas', 
      nombre: 'Fincas', 
      icono: MapPin, 
      color: 'text-green-600',
      bgActivo: 'border-green-500',
      componente: <Fincas />
    },
    { 
      id: 'labores', 
      nombre: 'Labores', 
      icono: ClipboardList, 
      color: 'text-purple-600',
      bgActivo: 'border-purple-500',
      componente: <Labores />
    },
    { 
      id: 'lotes', 
      nombre: 'Lotes', 
      icono: Layers, 
      color: 'text-orange-600',
      bgActivo: 'border-orange-500',
      componente: <Lotes />
    },
    { 
      id: 'implementos', 
      nombre: 'Implementos', 
      icono: Package, 
      color: 'text-rose-600',
      bgActivo: 'border-rose-500',
      componente: <Implementos />
    }
  ]

  const tabActual = tabs.find(t => t.id === tabActivo)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Catálogos</h1>

      {/* Tabs - ahora con scroll horizontal en móvil si es necesario */}
      <div className="flex flex-nowrap overflow-x-auto gap-1 sm:gap-2 mb-6 border-b border-gray-200 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActivo(tab.id)}
            className={`
              flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-t-lg transition-all duration-200 whitespace-nowrap
              ${tabActivo === tab.id 
                ? `bg-white text-gray-900 border-b-2 ${tab.bgActivo} shadow-sm font-medium` 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <tab.icono size={18} className={`${tabActivo === tab.id ? tab.color : 'text-gray-400'}`} />
            <span className="text-sm sm:text-base">{tab.nombre}</span>
          </button>
        ))}
      </div>

      {/* Contenido dinámico */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {tabActual.componente}
      </div>
    </div>
  )
}

export default CatalogosIndex
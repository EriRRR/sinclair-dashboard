import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const Operadores = () => {
  const [items, setItems] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', apellido: '', cod_empleado: '' })

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    const { data, error } = await supabase
      .from('operadores')
      .select('*')
      .order('nombre')
    if (error) {
      toast.error('Error al cargar operadores: ' + error.message)
    } else {
      setItems(data || [])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validar campos obligatorios
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('operadores')
          .update({
            nombre: formData.nombre.trim(),
            apellido: formData.apellido?.trim() || null,
            cod_empleado: formData.cod_empleado?.trim() || null
          })
          .eq('id', editando)
        if (error) throw error
        toast.success('Operador actualizado')
      } else {
        const { error } = await supabase
          .from('operadores')
          .insert([{
            nombre: formData.nombre.trim(),
            apellido: formData.apellido?.trim() || null,
            cod_empleado: formData.cod_empleado?.trim() || null
          }])
        if (error) throw error
        toast.success('Operador creado')
      }
      setModalOpen(false)
      setEditando(null)
      setFormData({ nombre: '', apellido: '', cod_empleado: '' })
      cargar()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const eliminar = async (id) => {
    if (confirm('¿Eliminar operador?')) {
      const { error } = await supabase
        .from('operadores')
        .delete()
        .eq('id', id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Eliminado')
        cargar()
      }
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Operadores</h1>
        <button
          onClick={() => { setEditando(null); setModalOpen(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Plus size={20} /> Nuevo Operador
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apellido</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código Empleado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">{item.nombre}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.apellido || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.cod_empleado || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditando(item.id)
                        setFormData({
                          nombre: item.nombre,
                          apellido: item.apellido || '',
                          cod_empleado: item.cod_empleado || ''
                        })
                        setModalOpen(true)
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => eliminar(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-8 text-gray-500">
                  No hay operadores registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para crear/editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">
                {editando ? 'Editar Operador' : 'Nuevo Operador'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md p-2"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2"
                  value={formData.apellido}
                  onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de Empleado
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2"
                  value={formData.cod_empleado}
                  onChange={e => setFormData({ ...formData, cod_empleado: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Operadores
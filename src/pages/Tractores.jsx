import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const Tractores = () => {
  const [tractores, setTractores] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    numero: '',
    nombre: '',
    marca: '',
    modelo: '',
    placa: '',
    estado: 'Activo',
    horometro_actual: 0,
    observaciones: ''
  })

  useEffect(() => {
    cargarTractores()
  }, [])

  const cargarTractores = async () => {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .order('numero')
    if (error) toast.error(error.message)
    else setTractores(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editando) {
      // Eliminar la propiedad 'id' del objeto antes de actualizar
      const { id, ...datosActualizar } = formData
      const { error } = await supabase
        .from('vehiculos')
        .update(datosActualizar)
        .eq('id', editando)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Tractor actualizado')
      }
    } else {
      const { error } = await supabase
        .from('vehiculos')
        .insert([formData])
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Tractor creado')
      }
    }
    setModalOpen(false)
    setEditando(null)
    setFormData({ numero: '', nombre: '', marca: '', modelo: '', placa: '', estado: 'Activo', horometro_actual: 0, observaciones: '' })
    cargarTractores()
  }

  const eliminar = async (id) => {
    if (confirm('¿Eliminar tractor?')) {
      const { error } = await supabase.from('vehiculos').delete().eq('id', id)
      if (error) toast.error(error.message)
      else toast.success('Eliminado')
      cargarTractores()
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Gestión de Tractores</h1>
        <button
          onClick={() => { setEditando(null); setModalOpen(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus size={20} /> Nuevo Tractor
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N°</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horómetro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tractores.map(t => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap">{t.numero}</td>
                <td className="px-6 py-4 whitespace-nowrap">{t.nombre}</td>
                <td className="px-6 py-4 whitespace-nowrap">{t.marca}</td>
                <td className="px-6 py-4 whitespace-nowrap">{t.horometro_actual?.toFixed(1)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${t.estado === 'Activo' ? 'bg-green-100 text-green-800' : t.estado === 'En Taller' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {t.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditando(t.id); setFormData(t); setModalOpen(true) }} className="text-blue-600 hover:text-blue-800">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => eliminar(t.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editando ? 'Editar' : 'Nuevo'} Tractor</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Número *"
                  className="w-full border p-2 rounded"
                  value={formData.numero}
                  onChange={e => setFormData({ ...formData, numero: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Nombre"
                  className="w-full border p-2 rounded"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Marca"
                  className="w-full border p-2 rounded"
                  value={formData.marca}
                  onChange={e => setFormData({ ...formData, marca: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Modelo"
                  className="w-full border p-2 rounded"
                  value={formData.modelo}
                  onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Placa"
                  className="w-full border p-2 rounded"
                  value={formData.placa}
                  onChange={e => setFormData({ ...formData, placa: e.target.value })}
                />
                <select
                  className="w-full border p-2 rounded"
                  value={formData.estado}
                  onChange={e => setFormData({ ...formData, estado: e.target.value })}
                >
                  <option>Activo</option>
                  <option>En Taller</option>
                  <option>Inactivo</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Horómetro actual"
                  className="w-full border p-2 rounded"
                  value={formData.horometro_actual}
                  onChange={e => setFormData({ ...formData, horometro_actual: parseFloat(e.target.value) })}
                />
                <div className="md:col-span-2">
                  <textarea
                    placeholder="Observaciones"
                    className="w-full border p-2 rounded"
                    rows={3}
                    value={formData.observaciones}
                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded order-1 sm:order-2"
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

export default Tractores
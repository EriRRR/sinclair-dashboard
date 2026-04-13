import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const Unidades = () => {
  const [unidades, setUnidades] = useState([])
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
    cargarUnidades()
  }, [])

  const cargarUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('unidaddestino')
        .select('*')
        .order('numero')
      if (error) throw error
      setUnidades(data || [])
    } catch (error) {
      toast.error('Error al cargar unidades: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      numero: '',
      nombre: '',
      marca: '',
      modelo: '',
      placa: '',
      estado: 'Activo',
      horometro_actual: 0,
      observaciones: ''
    })
    setEditando(null)
    setModalOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        // eslint-disable-next-line no-unused-vars
        const { id, created_at, ...datosActualizar } = formData
        const { error } = await supabase
          .from('unidaddestino')        // ✅ CORREGIDO: era 'UnidadDestino'
          .update(datosActualizar)
          .eq('id', editando)
        if (error) throw error
        toast.success('Unidad actualizada')
      } else {
        // eslint-disable-next-line no-unused-vars
        const { id, created_at, ...datosInsertar } = formData
        const { error } = await supabase
          .from('unidaddestino')        // ✅ CORREGIDO: era 'UnidadDestino'
          .insert([datosInsertar])
        if (error) throw error
        toast.success('Unidad creada')
      }
      resetForm()
      cargarUnidades()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar unidad? Esta acción no se puede deshacer.')) return
    try {
      const { error } = await supabase
        .from('unidaddestino')          // ✅ CORREGIDO: era 'UnidadDestino'
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Unidad eliminada')
      cargarUnidades()
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message)
    }
  }

  const abrirEditar = (unidad) => {
    setEditando(unidad.id)
    setFormData(unidad)
    setModalOpen(true)
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Gestión de Unidades Destino</h1>
        <button
          onClick={() => { resetForm(); setModalOpen(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus size={20} /> Nueva Unidad
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-[700px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horómetro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {unidades.map((unidad) => (
              <tr key={unidad.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{unidad.numero}</td>
                <td className="px-6 py-4 whitespace-nowrap">{unidad.nombre || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{unidad.marca || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{unidad.modelo || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{unidad.placa || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{unidad.horometro_actual?.toFixed(1)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    unidad.estado === 'Activo'    ? 'bg-green-100 text-green-800' :
                    unidad.estado === 'En Taller' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                  }`}>
                    {unidad.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirEditar(unidad)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => eliminar(unidad.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {unidades.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500">
                  No hay unidades registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editando ? 'Editar' : 'Nueva'} Unidad</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input
                    type="text"
                    placeholder="Ej: 101"
                    className="w-full border p-2 rounded"
                    value={formData.numero}
                    onChange={e => setFormData({ ...formData, numero: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    placeholder="Ej: Tractor John Deere"
                    className="w-full border p-2 rounded"
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej: John Deere"
                    className="w-full border p-2 rounded"
                    value={formData.marca}
                    onChange={e => setFormData({ ...formData, marca: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    placeholder="Ej: 6120M"
                    className="w-full border p-2 rounded"
                    value={formData.modelo}
                    onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
                  <input
                    type="text"
                    placeholder="Ej: ABC-1234"
                    className="w-full border p-2 rounded"
                    value={formData.placa}
                    onChange={e => setFormData({ ...formData, placa: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={formData.estado}
                    onChange={e => setFormData({ ...formData, estado: e.target.value })}
                  >
                    <option value="Activo">Activo</option>
                    <option value="En Taller">En Taller</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horómetro actual</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    className="w-full border p-2 rounded"
                    value={formData.horometro_actual}
                    onChange={e => setFormData({ ...formData, horometro_actual: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    placeholder="Observaciones adicionales..."
                    className="w-full border p-2 rounded"
                    rows={3}
                    value={formData.observaciones}
                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border rounded hover:bg-gray-50 order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 order-1 sm:order-2"
                >
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Unidades
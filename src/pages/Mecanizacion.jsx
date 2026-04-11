import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, History } from 'lucide-react'
import toast from 'react-hot-toast'

const Mecanizacion = () => {
  const [lotes, setLotes] = useState([])
  const [mediciones, setMediciones] = useState([])
  const [loteSeleccionado, setLoteSeleccionado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formData, setFormData] = useState({
    lote_id: '',
    area_mz: '',
    fecha_medicion: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  // Cargar lotes
  useEffect(() => {
    cargarLotes()
  }, [])

  useEffect(() => {
    if (loteSeleccionado) {
      cargarMediciones(loteSeleccionado)
    } else {
      setMediciones([])
    }
  }, [loteSeleccionado])

  const cargarLotes = async () => {
    const { data, error } = await supabase
      .from('lotes')
      .select('id, numero, fincas(nombre), area_mz')
      .order('numero')
    if (error) toast.error(error.message)
    else setLotes(data || [])
  }

  const cargarMediciones = async (loteId) => {
    const { data, error } = await supabase
      .from('mecanizacion_lotes')
      .select('*')
      .eq('lote_id', loteId)
      .order('fecha_medicion', { ascending: false })
    if (error) toast.error(error.message)
    else setMediciones(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.lote_id || !formData.area_mz || !formData.fecha_medicion) {
      toast.error('Complete todos los campos obligatorios')
      return
    }

    if (editandoId) {
      // Actualizar medición existente (no debería cambiar el área actual del lote)
      const { error } = await supabase
        .from('mecanizacion_lotes')
        .update({
          area_mz: parseFloat(formData.area_mz),
          fecha_medicion: formData.fecha_medicion,
          observaciones: formData.observaciones
        })
        .eq('id', editandoId)
      if (error) toast.error(error.message)
      else toast.success('Medición actualizada')
    } else {
      // Insertar nueva medición y actualizar el área actual del lote
      const { error: err1 } = await supabase
        .from('mecanizacion_lotes')
        .insert([{
          lote_id: parseInt(formData.lote_id),
          area_mz: parseFloat(formData.area_mz),
          fecha_medicion: formData.fecha_medicion,
          observaciones: formData.observaciones
        }])
      if (err1) {
        toast.error(err1.message)
        return
      }
      // Actualizar el área actual en la tabla lotes
      const { error: err2 } = await supabase
        .from('lotes')
        .update({ area_mz: parseFloat(formData.area_mz) })
        .eq('id', parseInt(formData.lote_id))
      if (err2) toast.error('Error al actualizar el área del lote: ' + err2.message)
      else toast.success('Medición guardada y área actualizada')
    }
    setModalOpen(false)
    setEditandoId(null)
    setFormData({ lote_id: '', area_mz: '', fecha_medicion: new Date().toISOString().split('T')[0], observaciones: '' })
    cargarLotes()
    if (loteSeleccionado) cargarMediciones(loteSeleccionado)
  }

  const eliminarMedicion = async (id, loteId, areaActual) => {
    if (!confirm('¿Eliminar esta medición? Se restaurará el área a la medición anterior si existe.')) return

    // Obtener la medición más reciente anterior (excluyendo esta)
    const { data: anteriores } = await supabase
      .from('mecanizacion_lotes')
      .select('area_mz')
      .eq('lote_id', loteId)
      .neq('id', id)
      .order('fecha_medicion', { ascending: false })
      .limit(1)

    const nuevaArea = anteriores && anteriores.length > 0 ? anteriores[0].area_mz : 0

    // Eliminar la medición
    const { error: errDel } = await supabase
      .from('mecanizacion_lotes')
      .delete()
      .eq('id', id)
    if (errDel) {
      toast.error(errDel.message)
      return
    }

    // Actualizar el área del lote con la medición anterior o 0
    const { error: errUpd } = await supabase
      .from('lotes')
      .update({ area_mz: nuevaArea })
      .eq('id', loteId)
    if (errUpd) toast.error('Error al restaurar área: ' + errUpd.message)
    else toast.success('Medición eliminada y área restaurada')

    cargarLotes()
    if (loteSeleccionado) cargarMediciones(loteSeleccionado)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mecanización - Historial de Áreas de Lotes</h1>

      {/* Selector de lote */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block text-sm font-medium mb-2">Seleccionar Lote</label>
        <select
          value={loteSeleccionado}
          onChange={e => setLoteSeleccionado(e.target.value)}
          className="border p-2 rounded w-full md:w-64"
        >
          <option value="">-- Seleccione un lote --</option>
          {lotes.map(l => (
            <option key={l.id} value={l.id}>
              {l.numero} - {l.fincas?.nombre} (Actual: {l.area_mz || 0} Mz)
            </option>
          ))}
        </select>
      </div>

      {loteSeleccionado && (
        <>
          {/* Botón para nueva medición */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditandoId(null)
                setFormData({
                  lote_id: loteSeleccionado,
                  area_mz: '',
                  fecha_medicion: new Date().toISOString().split('T')[0],
                  observaciones: ''
                })
                setModalOpen(true)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Plus size={20} /> Nueva Medición
            </button>
          </div>

          {/* Tabla de historial */}
          <div className="bg-white rounded shadow overflow-hidden">
            <h2 className="text-lg font-semibold p-4 border-b">Historial de Mediciones</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Área (Mz)</th>
                    <th className="px-4 py-2">Observaciones</th>
                    <th className="px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mediciones.map(m => (
                    <tr key={m.id} className="border-t">
                      <td className="px-4 py-2">{m.fecha_medicion}</td>
                      <td className="px-4 py-2 font-semibold">{m.area_mz} Mz</td>
                      <td className="px-4 py-2">{m.observaciones || '-'}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditandoId(m.id)
                              setFormData({
                                lote_id: m.lote_id,
                                area_mz: m.area_mz,
                                fecha_medicion: m.fecha_medicion,
                                observaciones: m.observaciones || ''
                              })
                              setModalOpen(true)
                            }}
                            className="text-blue-600"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => eliminarMedicion(m.id, m.lote_id, 0)}
                            className="text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {mediciones.length === 0 && (
                    <tr><td colSpan="4" className="text-center py-4">No hay mediciones registradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal para agregar/editar medición */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{editandoId ? 'Editar Medición' : 'Nueva Medición'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-500">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Lote</label>
                <select
                  value={formData.lote_id}
                  onChange={e => setFormData({...formData, lote_id: e.target.value})}
                  className="w-full border p-2 rounded"
                  required
                  disabled={editandoId}
                >
                  <option value="">Seleccionar lote</option>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.numero} - {l.fincas?.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Área (Mz) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.area_mz}
                  onChange={e => setFormData({...formData, area_mz: e.target.value})}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Medición *</label>
                <input
                  type="date"
                  required
                  value={formData.fecha_medicion}
                  onChange={e => setFormData({...formData, fecha_medicion: e.target.value})}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Observaciones</label>
                <textarea
                  rows={3}
                  value={formData.observaciones}
                  onChange={e => setFormData({...formData, observaciones: e.target.value})}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Mecanizacion
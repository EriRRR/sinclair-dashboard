import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Filter } from 'lucide-react'
import { exportToExcel, exportToCSV, exportToPDF } from './BodegaTaller/utils/xportUtils'
import toast from 'react-hot-toast'

const Mecanizacion = () => {
  const [fincas, setFincas] = useState([])
  const [fincaSeleccionada, setFincaSeleccionada] = useState('todas')
  const [lotes, setLotes] = useState([])
  const [mediciones, setMediciones] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formData, setFormData] = useState({
    lote_id: '',
    area_mz: '',
    area_m2: '',
    fecha_medicion: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  // Cargar fincas
  useEffect(() => {
    cargarFincas()
  }, [])

  useEffect(() => {
    if (fincaSeleccionada === 'todas') {
      cargarLotes()
    } else if (fincaSeleccionada) {
      cargarLotesPorFinca(fincaSeleccionada)
    }
  }, [fincaSeleccionada])

  useEffect(() => {
    if (fincaSeleccionada === 'todas') {
      cargarMediciones()
    } else if (fincaSeleccionada) {
      cargarMedicionesPorFinca(fincaSeleccionada)
    }
  }, [fincaSeleccionada])

  const cargarFincas = async () => {
    const { data, error } = await supabase.from('fincas').select('id, nombre').order('nombre')
    if (!error) setFincas(data || [])
  }

  const cargarLotes = async () => {
    const { data, error } = await supabase
      .from('lotes')
      .select('id, numero, finca_id, fincas(nombre), area_mz')
      .order('numero')
    if (!error) setLotes(data || [])
  }

  const cargarLotesPorFinca = async (fincaId) => {
    const { data, error } = await supabase
      .from('lotes')
      .select('id, numero, finca_id, fincas(nombre), area_mz')
      .eq('finca_id', fincaId)
      .order('numero')
    if (!error) setLotes(data || [])
  }

  const cargarMediciones = async () => {
    const { data, error } = await supabase
      .from('mecanizacion_lotes')
      .select('*, lotes(id, numero, finca_id, fincas(nombre))')
      .order('fecha_medicion', { ascending: false })
    if (!error) setMediciones(data || [])
  }

  const cargarMedicionesPorFinca = async (fincaId) => {
    const { data, error } = await supabase
      .from('mecanizacion_lotes')
      .select('*, lotes(id, numero, finca_id, fincas(nombre))')
      .eq('lotes.finca_id', fincaId)
      .order('fecha_medicion', { ascending: false })
    if (!error) setMediciones(data || [])
  }

  const mzToM2 = (mz) => (mz ? (parseFloat(mz) * 10000).toFixed(2) : '')
  const m2ToMz = (m2) => (m2 ? (parseFloat(m2) / 10000).toFixed(4) : '')

  const handleAreaChange = (tipo, valor) => {
    if (tipo === 'mz') {
      const mz = valor === '' ? '' : parseFloat(valor)
      setFormData({
        ...formData,
        area_mz: mz === '' ? '' : mz,
        area_m2: mz === '' ? '' : (mz * 10000).toFixed(2)
      })
    } else if (tipo === 'm2') {
      const m2 = valor === '' ? '' : parseFloat(valor)
      setFormData({
        ...formData,
        area_m2: m2 === '' ? '' : m2,
        area_mz: m2 === '' ? '' : (m2 / 10000).toFixed(4)
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.lote_id || !formData.area_mz || !formData.fecha_medicion) {
      toast.error('Complete todos los campos obligatorios')
      return
    }

    const areaMz = parseFloat(formData.area_mz)

    if (editandoId) {
      const { error } = await supabase
        .from('mecanizacion_lotes')
        .update({
          area_mz: areaMz,
          fecha_medicion: formData.fecha_medicion,
          observaciones: formData.observaciones
        })
        .eq('id', editandoId)
      if (error) toast.error(error.message)
      else toast.success('Medición actualizada')
    } else {
      const { error: err1 } = await supabase
        .from('mecanizacion_lotes')
        .insert([{
          lote_id: parseInt(formData.lote_id),
          area_mz: areaMz,
          fecha_medicion: formData.fecha_medicion,
          observaciones: formData.observaciones
        }])
      if (err1) {
        toast.error(err1.message)
        return
      }
      const { error: err2 } = await supabase
        .from('lotes')
        .update({ area_mz: areaMz })
        .eq('id', parseInt(formData.lote_id))
      if (err2) toast.error('Error al actualizar el área del lote: ' + err2.message)
      else toast.success('Medición guardada y área actualizada')
    }
    setModalOpen(false)
    setEditandoId(null)
    setFormData({
      lote_id: '',
      area_mz: '',
      area_m2: '',
      fecha_medicion: new Date().toISOString().split('T')[0],
      observaciones: ''
    })
    // Recargar datos
    if (fincaSeleccionada === 'todas') {
      cargarLotes()
      cargarMediciones()
    } else {
      cargarLotesPorFinca(fincaSeleccionada)
      cargarMedicionesPorFinca(fincaSeleccionada)
    }
  }

  const eliminarMedicion = async (id, loteId) => {
    if (!confirm('¿Eliminar esta medición? Se restaurará el área a la medición anterior si existe.')) return

    const { data: anteriores } = await supabase
      .from('mecanizacion_lotes')
      .select('area_mz')
      .eq('lote_id', loteId)
      .neq('id', id)
      .order('fecha_medicion', { ascending: false })
      .limit(1)

    const nuevaArea = anteriores && anteriores.length > 0 ? anteriores[0].area_mz : 0

    const { error: errDel } = await supabase
      .from('mecanizacion_lotes')
      .delete()
      .eq('id', id)
    if (errDel) {
      toast.error(errDel.message)
      return
    }

    const { error: errUpd } = await supabase
      .from('lotes')
      .update({ area_mz: nuevaArea })
      .eq('id', loteId)
    if (errUpd) toast.error('Error al restaurar área: ' + errUpd.message)
    else toast.success('Medición eliminada y área restaurada')

    if (fincaSeleccionada === 'todas') {
      cargarLotes()
      cargarMediciones()
    } else {
      cargarLotesPorFinca(fincaSeleccionada)
      cargarMedicionesPorFinca(fincaSeleccionada)
    }
  }

  const exportarReporte = (formato) => {
    const datos = []
    if (fincaSeleccionada === 'todas') {
      // Agrupar por finca
      const fincasMap = new Map()
      lotes.forEach(lote => {
        if (!fincasMap.has(lote.finca_id)) {
          fincasMap.set(lote.finca_id, {
            finca: lote.fincas?.nombre || 'Sin finca',
            lotes: []
          })
        }
        const medicion = mediciones.find(m => m.lote_id === lote.id) || {}
        fincasMap.get(lote.finca_id).lotes.push({
          lote: lote.numero,
          area_mz: medicion.area_mz || lote.area_mz || 0,
          area_m2: (medicion.area_mz || lote.area_mz || 0) * 10000,
          fecha: medicion.fecha_medicion || 'No registrada',
          observaciones: medicion.observaciones || ''
        })
      })
      for (const [_, fincaData] of fincasMap) {
        datos.push({ 'Finca': fincaData.finca, 'Lote': '', 'Área Mz': '', 'Área m²': '', 'Fecha': '', 'Observaciones': '' })
        fincaData.lotes.forEach(l => {
          datos.push({
            'Finca': '',
            'Lote': l.lote,
            'Área Mz': l.area_mz.toFixed(4),
            'Área m²': l.area_m2.toFixed(2),
            'Fecha': l.fecha,
            'Observaciones': l.observaciones
          })
        })
        datos.push({ 'Finca': '', 'Lote': '', 'Área Mz': '', 'Área m²': '', 'Fecha': '', 'Observaciones': '' }) // línea separadora
      }
    } else {
      const finca = fincas.find(f => f.id === parseInt(fincaSeleccionada))
      datos.push({ 'Finca': finca?.nombre || 'Seleccionada', 'Lote': '', 'Área Mz': '', 'Área m²': '', 'Fecha': '', 'Observaciones': '' })
      lotes.forEach(lote => {
        const medicion = mediciones.find(m => m.lote_id === lote.id) || {}
        datos.push({
          'Finca': '',
          'Lote': lote.numero,
          'Área Mz': (medicion.area_mz || lote.area_mz || 0).toFixed(4),
          'Área m²': ((medicion.area_mz || lote.area_mz || 0) * 10000).toFixed(2),
          'Fecha': medicion.fecha_medicion || 'No registrada',
          'Observaciones': medicion.observaciones || ''
        })
      })
    }
    if (formato === 'excel') exportToExcel(datos, `mecanizacion_${fincaSeleccionada === 'todas' ? 'todas_fincas' : fincas.find(f => f.id === parseInt(fincaSeleccionada))?.nombre || 'reporte'}`)
    else if (formato === 'csv') exportToCSV(datos, `mecanizacion_${fincaSeleccionada === 'todas' ? 'todas_fincas' : fincas.find(f => f.id === parseInt(fincaSeleccionada))?.nombre || 'reporte'}`)
    else if (formato === 'pdf') exportToPDF(datos, `Mecanización - ${fincaSeleccionada === 'todas' ? 'Todas las fincas' : fincas.find(f => f.id === parseInt(fincaSeleccionada))?.nombre || 'Reporte'}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mecanización - Registro de Áreas de Lotes</h1>

      {/* Filtro por finca */}
      <div className="bg-white p-4 rounded shadow flex flex-wrap gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium">Finca</label>
          <select
            value={fincaSeleccionada}
            onChange={e => setFincaSeleccionada(e.target.value)}
            className="border p-2 rounded w-full md:w-64"
          >
            <option value="todas">Todas las fincas</option>
            {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarReporte('excel')} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Excel</button>
          <button onClick={() => exportarReporte('csv')} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">CSV</button>
          <button onClick={() => exportarReporte('pdf')} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">PDF</button>
        </div>
      </div>

      {/* Tabla de lotes y mediciones */}
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {fincaSeleccionada === 'todas' ? 'Lotes por Finca' : `Lotes de ${fincas.find(f => f.id === parseInt(fincaSeleccionada))?.nombre || 'la finca seleccionada'}`}
          </h2>
          <button
            onClick={() => {
              setEditandoId(null)
              setFormData({
                lote_id: '',
                area_mz: '',
                area_m2: '',
                fecha_medicion: new Date().toISOString().split('T')[0],
                observaciones: ''
              })
              setModalOpen(true)
            }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
          >
            <Plus size={16} /> Nueva Medición
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">Finca</th>
                <th className="px-4 py-2">Lote</th>
                <th className="px-4 py-2">Área Actual (Mz)</th>
                <th className="px-4 py-2">Área Actual (m²)</th>
                <th className="px-4 py-2">Última Medición</th>
                <th className="px-4 py-2">Observaciones</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map(lote => {
                const medicion = mediciones.find(m => m.lote_id === lote.id)
                return (
                  <tr key={lote.id} className="border-t">
                    <td className="px-4 py-2">{lote.fincas?.nombre}</td>
                    <td className="px-4 py-2 font-medium">{lote.numero}</td>
                    <td className="px-4 py-2">{(lote.area_mz || 0).toFixed(4)} Mz</td>
                    <td className="px-4 py-2">{((lote.area_mz || 0) * 10000).toFixed(2)} m²</td>
                    <td className="px-4 py-2">{medicion?.fecha_medicion || '-'}</td>
                    <td className="px-4 py-2">{medicion?.observaciones || '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditandoId(medicion?.id || null)
                            setFormData({
                              lote_id: lote.id,
                              area_mz: lote.area_mz || '',
                              area_m2: lote.area_mz ? (lote.area_mz * 10000).toFixed(2) : '',
                              fecha_medicion: medicion?.fecha_medicion || new Date().toISOString().split('T')[0],
                              observaciones: medicion?.observaciones || ''
                            })
                            setModalOpen(true)
                          }}
                          className="text-blue-600"
                        >
                          <Edit size={18} />
                        </button>
                        {medicion && (
                          <button onClick={() => eliminarMedicion(medicion.id, lote.id)} className="text-red-600">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                     </td>
                   </tr>
                )
              })}
              {lotes.length === 0 && <tr><td colSpan="7" className="text-center py-4">No hay lotes registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

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
                <label className="block text-sm font-medium">Lote *</label>
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
                      {l.fincas?.nombre} - Lote {l.numero}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Área (Manzanas)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.area_mz}
                    onChange={e => handleAreaChange('mz', e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="Ej: 2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Área (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.area_m2}
                    onChange={e => handleAreaChange('m2', e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="Ej: 25000"
                  />
                </div>
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
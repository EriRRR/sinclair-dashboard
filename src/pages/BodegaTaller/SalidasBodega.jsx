import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SalidaForm from './components/SalidaForm'
import { exportToExcel, exportToCSV, exportToPDF } from './utils/xportUtils'
import toast from 'react-hot-toast'  

const SalidasBodega = () => {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ fechaInicio: '', fechaFin: '', responsable: '', tipo: 'todos' })

  const cargarRegistros = async () => {
    setLoading(true)
    let query = supabase
      .from('salidas_bodega_cabecera')
      .select(`*, unidaddestino (numero, nombre), detalles: salidas_bodega_detalle (*)`) 
      .order('fecha', { ascending: false })

    if (filters.fechaInicio) query = query.gte('fecha', filters.fechaInicio)
    if (filters.fechaFin) query = query.lte('fecha', filters.fechaFin)
    if (filters.responsable) query = query.ilike('persona_responsable', `%${filters.responsable}%`)
    if (filters.tipo === 'general') query = query.is('unidaddestino_id', null)
    if (filters.tipo === 'vehiculo') query = query.not('unidaddestino_id', 'is', null)

    const { data, error } = await query
    if (error) toast.error(error.message)
    else {
      const filas = []
      data?.forEach(cab => {
        if (cab.detalles?.length) {
          cab.detalles.forEach(det => {
            filas.push({
              id: `${cab.id}-${det.id}`,
              fecha: cab.fecha,
              n_requisicion: cab.n_requisicion,
              vehiculo: cab.unidaddestino ? `T${cab.unidaddestino.numero} ${cab.unidaddestino.nombre}` : '-', // ← cambio
              responsable: cab.persona_responsable,
              proveedor: cab.proveedor,
              descripcion: det.descripcion,
              codigo: det.codigo || 'Sin código',
              cantidad: det.cantidad,
              unidad_medida: det.unidad_medida || '-',
              observacion_motivo: det.observacion_motivo || '-',
              costo_aplicado_a: det.costo_aplicado_a || '-'
            })
          })
        }
      })
      setRegistros(filas)
    }
    setLoading(false)
  }

  useEffect(() => { cargarRegistros() }, [filters])

  const handleExport = (formato) => {
    const dataToExport = registros.map(r => ({
      Fecha: r.fecha,
      'N° Requisición': r.n_requisicion,
      'Unidad Destino': r.vehiculo,
      Responsable: r.responsable,
      Proveedor: r.proveedor,
      Descripción: r.descripcion,
      Código: r.codigo,
      Cantidad: r.cantidad,
      Unidad: r.unidad_medida,
      'Observación/Motivo': r.observacion_motivo,
      'Costo aplicado a': r.costo_aplicado_a
    }))
    if (formato === 'excel') exportToExcel(dataToExport, 'salidas_bodega')
    else if (formato === 'csv') exportToCSV(dataToExport, 'salidas_bodega')
    else if (formato === 'pdf') exportToPDF(dataToExport, 'Salidas de Bodega')
  }

  return (
    <div className="space-y-6">
      <SalidaForm onSuccess={cargarRegistros} />
      <div className="bg-white p-4 rounded shadow">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">Registros de Salidas</h2>
          <div className="flex gap-2">
            <button onClick={() => handleExport('excel')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Excel</button>
            <button onClick={() => handleExport('csv')} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">CSV</button>
            <button onClick={() => handleExport('pdf')} className="bg-red-600 text-white px-3 py-1 rounded text-sm">PDF</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input type="date" placeholder="Fecha inicio" value={filters.fechaInicio} onChange={e => setFilters({...filters, fechaInicio: e.target.value})} className="border p-2 rounded" />
          <input type="date" placeholder="Fecha fin" value={filters.fechaFin} onChange={e => setFilters({...filters, fechaFin: e.target.value})} className="border p-2 rounded" />
          <input type="text" placeholder="Responsable" value={filters.responsable} onChange={e => setFilters({...filters, responsable: e.target.value})} className="border p-2 rounded" />
          <select value={filters.tipo} onChange={e => setFilters({...filters, tipo: e.target.value})} className="border p-2 rounded">
            <option value="todos">Todos</option>
            <option value="general">Solo generales</option>
            <option value="vehiculo">Solo por unidad destino</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th>Fecha</th><th>N° Requisición</th><th>Unidad Destino</th><th>Responsable</th><th>Proveedor</th>
                <th>Descripción</th><th>Código</th><th>Cantidad</th><th>Unidad</th><th>Observación/Motivo</th><th>Costo aplicado a</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1">{r.fecha}</td>
                  <td className="px-2 py-1">{r.n_requisicion || '-'}</td>
                  <td className="px-2 py-1">{r.vehiculo}</td>
                  <td className="px-2 py-1">{r.responsable || '-'}</td>
                  <td className="px-2 py-1">{r.proveedor || '-'}</td>
                  <td className="px-2 py-1">{r.descripcion}</td>
                  <td className="px-2 py-1">{r.codigo}</td>
                  <td className="px-2 py-1">{r.cantidad}</td>
                  <td className="px-2 py-1">{r.unidad_medida}</td>
                  <td className="px-2 py-1">{r.observacion_motivo}</td>
                  <td className="px-2 py-1">{r.costo_aplicado_a}</td>
                </tr>
              ))}
              {registros.length === 0 && <tr><td colSpan="11" className="text-center py-4">No hay registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SalidasBodega
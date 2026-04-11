import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SalidaForm from './components/SalidaForm'
import TablaSalidas from './components/TablaSalidas'
import { exportToExcel, exportToCSV, exportToPDF } from './utils/xportUtils.js'
import toast from 'react-hot-toast'

const SalidasBodega = () => {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ fechaInicio: '', fechaFin: '', entregadoPor: '', tipo: 'todos' })

  const cargarRegistros = async () => {
    setLoading(true)
    let query = supabase
      .from('salidas_bodega_cabecera')
      .select(`
        *,
        unidaddestino (numero, nombre),
        detalles: salidas_bodega_detalle (*)
      `)
      .order('fecha', { ascending: false })

    if (filters.fechaInicio) query = query.gte('fecha', filters.fechaInicio)
    if (filters.fechaFin) query = query.lte('fecha', filters.fechaFin)
    if (filters.entregadoPor) query = query.ilike('entregado_por', `%${filters.entregadoPor}%`)
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
              unidadDestino: cab.unidaddestino ? `T${cab.unidaddestino.numero} ${cab.unidaddestino.nombre}` : '-',
              entregado_por: cab.entregado_por || '-',
              persona_responsable: cab.persona_responsable || '-',
              proveedor: cab.proveedor || '-',
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
      'Unidad Destino': r.unidadDestino,
      'Entregado por': r.entregado_por,
      'Persona responsable': r.persona_responsable,
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
          <input type="text" placeholder="Entregado por" value={filters.entregadoPor} onChange={e => setFilters({...filters, entregadoPor: e.target.value})} className="border p-2 rounded" />
          <select value={filters.tipo} onChange={e => setFilters({...filters, tipo: e.target.value})} className="border p-2 rounded">
            <option value="todos">Todos</option>
            <option value="general">Solo generales</option>
            <option value="vehiculo">Solo por unidad destino</option>
          </select>
        </div>
        <TablaSalidas registros={registros} loading={loading} />
      </div>
    </div>
  )
}

export default SalidasBodega
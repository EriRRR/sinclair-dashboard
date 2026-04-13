import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
 
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B']
 
const Reportes = () => {
  const [tipoReporte, setTipoReporte] = useState('horas_unidad')
  const [periodo, setPeriodo] = useState('mes')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [unidadesDestino, setUnidadesDestino] = useState([])
  const [unidadId, setUnidadId] = useState('todos')
  const [cargando, setCargando] = useState(false)
 
  const [horasPorUnidad, setHorasPorUnidad] = useState([])
  const [dieselPorUnidad, setDieselPorUnidad] = useState([])
  const [distribucionLabores, setDistribucionLabores] = useState([])
  const [salidasBodega, setSalidasBodega] = useState([])
  const [registrosDiarios, setRegistrosDiarios] = useState([])
  const [totalHoras, setTotalHoras] = useState(0)
  const [totalDiesel, setTotalDiesel] = useState(0)
  const [totalRegistros, setTotalRegistros] = useState(0)
 
  const [filtroBodega, setFiltroBodega] = useState({ tipo: 'todos', entregadoPor: '', descripcion: '' })
 
  useEffect(() => {
    cargarUnidadesDestino()
  }, [])
 
  useEffect(() => {
    if (tipoReporte === 'bodega') {
      cargarReporteBodega()
    } else if (tipoReporte === 'registro_diario') {
      cargarReporteRegistroDiario()
    } else {
      cargarReporteLaboral()
    }
  }, [tipoReporte, periodo, customStart, customEnd, unidadId, filtroBodega])
 
  const cargarUnidadesDestino = async () => {
    const { data } = await supabase.from('unidaddestino').select('id, numero, nombre').order('numero')
    setUnidadesDestino(data || [])
  }
 
  const obtenerRangoFechas = () => {
    if (periodo === 'custom') {
      return { inicio: customStart, fin: customEnd }
    }
    const hoy = new Date()
    let inicio
    switch (periodo) {
      case 'mes':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        break
      case 'semana': {
        const diaSemana = hoy.getDay()
        const diff = diaSemana === 0 ? 6 : diaSemana - 1
        inicio = new Date(hoy)
        inicio.setDate(hoy.getDate() - diff)
        break
      }
      case 'dia':
        inicio = new Date(hoy)
        inicio.setHours(0, 0, 0, 0)
        break
      default:
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    }
    const fin = new Date()
    return { inicio: inicio.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
  }
 
  const cargarReporteLaboral = async () => {
    setCargando(true)
    const { inicio, fin } = obtenerRangoFechas()
    try {
      let query = supabase
        .from('registros_diarios')
        .select(`
          total_horas,
          litros_diesel,
          unidaddestino_id,
          unidaddestino (numero, nombre),
          detalle_actividades (labor_id, labores (nombre))
        `)
        .gte('fecha', inicio)
        .lte('fecha', fin)
 
      if (unidadId !== 'todos') {
        query = query.eq('unidaddestino_id', unidadId)
      }
 
      const { data, error } = await query
      if (error) throw error
 
      const horasMap = {}
      const dieselMap = {}
      let totalH = 0, totalD = 0
      data?.forEach(reg => {
        totalH += reg.total_horas || 0
        totalD += reg.litros_diesel || 0
        const nombre = `T${reg.unidaddestino?.numero} ${reg.unidaddestino?.nombre || ''}`
        horasMap[nombre] = (horasMap[nombre] || 0) + (reg.total_horas || 0)
        dieselMap[nombre] = (dieselMap[nombre] || 0) + (reg.litros_diesel || 0)
      })
      setTotalHoras(totalH)
      setTotalDiesel(totalD)
      setTotalRegistros(data?.length || 0)
      setHorasPorUnidad(Object.entries(horasMap).map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas))
      setDieselPorUnidad(Object.entries(dieselMap).map(([nombre, litros]) => ({ nombre, litros })).sort((a, b) => b.litros - a.litros))
 
      const laboresMap = {}
      data?.forEach(reg => {
        reg.detalle_actividades?.forEach(det => {
          const nombre = det.labores?.nombre || 'Sin labor'
          laboresMap[nombre] = (laboresMap[nombre] || 0) + 1
        })
      })
      setDistribucionLabores(Object.entries(laboresMap).map(([name, value]) => ({ name, value })))
    } catch (error) {
      toast.error('Error al cargar datos laborales')
      console.error(error)
    } finally {
      setCargando(false)
    }
  }
 
  const cargarReporteBodega = async () => {
    setCargando(true)
    const { inicio, fin } = obtenerRangoFechas()
    try {
      let query = supabase
        .from('salidas_bodega_cabecera')
        .select(`
          id,
          fecha,
          n_requisicion,
          unidaddestino_id,
          persona_responsable,
          proveedor,
          entregado_por,
          unidaddestino (numero, nombre),
          detalles: salidas_bodega_detalle (*)
        `)
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false })
 
      if (filtroBodega.tipo === 'general') {
        query = query.is('unidaddestino_id', null)
      } else if (filtroBodega.tipo === 'vehiculo') {
        query = query.not('unidaddestino_id', 'is', null)
      }
 
      if (filtroBodega.entregadoPor) {
        query = query.ilike('entregado_por', `%${filtroBodega.entregadoPor}%`)
      }
 
      const { data: cabeceras, error } = await query
      if (error) throw error
 
      const filas = []
      cabeceras?.forEach(cab => {
        if (cab.detalles && cab.detalles.length) {
          cab.detalles.forEach(det => {
            if (filtroBodega.descripcion && !det.descripcion.toLowerCase().includes(filtroBodega.descripcion.toLowerCase())) {
              return
            }
            filas.push({
              id: `${cab.id}-${det.id}`,
              numero: det.numero_linea || '',
              descripcion: det.descripcion,
              codigo: det.codigo || '',
              cantidad: det.cantidad,
              unidad_medida: det.unidad_medida || '',
              observacion_motivo: det.observacion_motivo || '',
              fecha: cab.fecha,
              n_requisicion: cab.n_requisicion || '',
              entregado_por: cab.entregado_por || '',
              persona_responsable: cab.persona_responsable || '',
              proveedor: cab.proveedor || '',
              vehiculo: cab.unidaddestino ? `T${cab.unidaddestino.numero} ${cab.unidaddestino.nombre}` : '-',
              costo_aplicado_a: det.costo_aplicado_a || ''
            })
          })
        }
      })
 
      setSalidasBodega(filas)
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar salidas de bodega')
    } finally {
      setCargando(false)
    }
  }
 
  // ✅ CORREGIDO:
  //   - responsable_id con join a responsables (nombre, apellido)
  //   - lotes via detalle_actividad_lotes → lotes (numero)
  //   - eliminado campo inexistente responsable_mecanizacion
  const cargarReporteRegistroDiario = async () => {
    setCargando(true)
    const { inicio, fin } = obtenerRangoFechas()
    try {
      let query = supabase
        .from('registros_diarios')
        .select(`
          id,
          fecha,
          unidaddestino_id,
          unidaddestino (numero, nombre),
          operadores (nombre, apellido),
          responsables (nombre, apellido),
          total_horas,
          litros_diesel,
          observaciones,
          detalle_actividades (
            areamz,
            labores (nombre),
            fincas (nombre),
            detalle_actividad_lotes (
              lotes (numero)
            )
          )
        `)
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false })
 
      if (unidadId !== 'todos') {
        query = query.eq('unidaddestino_id', unidadId)
      }
 
      const { data, error } = await query
      if (error) throw error
      setRegistrosDiarios(data || [])
    } catch (error) {
      toast.error('Error al cargar registros diarios')
      console.error(error)
    } finally {
      setCargando(false)
    }
  }
 
  // ─── Helpers para formatear datos de reporte ───────────────────────────────
 
  // Convierte un registro diario en texto legible para fincas/lotes
  const formatFincasLotes = (detalles) => {
    if (!detalles?.length) return '-'
    const partes = detalles.map(d => {
      const finca = d.fincas?.nombre || ''
      const lotes = d.detalle_actividad_lotes?.map(dl => dl.lotes?.numero).filter(Boolean).join(', ')
      return lotes ? `${finca} [${lotes}]` : finca
    }).filter(Boolean)
    return partes.join(' | ') || '-'
  }
 
  const formatResponsable = (r) => {
    if (!r?.responsables) return '-'
    return `${r.responsables.nombre || ''} ${r.responsables.apellido || ''}`.trim() || '-'
  }
 
  // ─── Exportación ──────────────────────────────────────────────────────────
 
  const buildDatosExport = () => {
    if (tipoReporte === 'horas_unidad') {
      return horasPorUnidad.map(h => ({ 'Unidad Destino': h.nombre, Horas: h.horas }))
    }
    if (tipoReporte === 'diesel_unidad') {
      return dieselPorUnidad.map(d => ({ 'Unidad Destino': d.nombre, Litros: d.litros }))
    }
    if (tipoReporte === 'labores') {
      return distribucionLabores.map(l => ({ Labor: l.name, Frecuencia: l.value }))
    }
    if (tipoReporte === 'bodega') {
      return salidasBodega.map(s => ({
        'Nº': s.numero,
        'Descripción': s.descripcion,
        'Código': s.codigo || 'Sin código',
        'Cantidad': s.cantidad,
        'Unidad': s.unidad_medida || '-',
        'Observación/Motivo': s.observacion_motivo || '-',
        'Fecha': s.fecha,
        'Nº Requisición': s.n_requisicion || '-',
        'Entregado por': s.entregado_por || '-',       // ✅ CORREGIDO: era persona_responsable
        'Responsable': s.persona_responsable || '-',
        'Proveedor': s.proveedor || '-',
        'Unidad Destino': s.vehiculo,
        'Costo aplicado a': s.costo_aplicado_a || '-'
      }))
    }
    if (tipoReporte === 'registro_diario') {
      return registrosDiarios.map(r => ({
        'Fecha': r.fecha,
        'Unidad Destino': `T${r.unidaddestino?.numero} ${r.unidaddestino?.nombre || ''}`,
        'Operador': `${r.operadores?.nombre || ''} ${r.operadores?.apellido || ''}`.trim(),
        'Horas': r.total_horas,
        'Litros Diesel': r.litros_diesel,
        'Responsable': formatResponsable(r),           // ✅ CORREGIDO: join a responsables
        'Labores': r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-',
        'Fincas/Lotes': formatFincasLotes(r.detalle_actividades), // ✅ CORREGIDO: via detalle_actividad_lotes
        'Área (Mz)': r.detalle_actividades?.reduce((acc, d) => acc + (d.areamz || 0), 0).toFixed(2),
        'Observaciones': r.observaciones || '-'
      }))
    }
    return []
  }
 
  const exportarExcel = () => {
    const datos = buildDatosExport()
    if (!datos.length) { toast.error('No hay datos para exportar'); return }
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Exportado a Excel')
  }
 
  const exportarCSV = () => {
    const datos = buildDatosExport()
    if (!datos.length) { toast.error('No hay datos para exportar'); return }
    const ws = XLSX.utils.json_to_sheet(datos)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exportado a CSV')
  }
 
  const exportarPDF = () => {
    const datos = buildDatosExport()
    if (!datos.length) { toast.error('No hay datos para exportar'); return }
    const titulos = {
      horas_unidad: 'Horas trabajadas por unidad destino',
      diesel_unidad: 'Diesel consumido por unidad destino',
      labores: 'Distribución de labores',
      bodega: 'Salidas de bodega',
      registro_diario: 'Registro diario de labores'
    }
    const doc = new jsPDF('landscape', 'mm', 'a4')
    doc.setFontSize(16)
    doc.text(titulos[tipoReporte] || 'Reporte', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22)
    const columnas = Object.keys(datos[0] || {})
    const filas = datos.map(item => columnas.map(col => item[col] ?? ''))
    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 30,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { left: 10, right: 10 }
    })
    doc.save(`reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('Exportado a PDF')
  }
 
  // ─── Render ───────────────────────────────────────────────────────────────
 
  const renderGraficos = () => {
    if (cargando) return <p className="text-center py-8 text-gray-500">Cargando datos...</p>
 
    if (tipoReporte === 'horas_unidad') {
      return (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Horas trabajadas por unidad destino</h2>
          {horasPorUnidad.length ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={horasPorUnidad}>
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="horas" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-gray-500">No hay datos para el período seleccionado</p>}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm text-gray-600">Total horas</p>
              <p className="text-2xl font-bold text-blue-700">{totalHoras.toFixed(1)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-sm text-gray-600">Registros</p>
              <p className="text-2xl font-bold text-green-700">{totalRegistros}</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <p className="text-sm text-gray-600">Total diesel</p>
              <p className="text-2xl font-bold text-yellow-700">{totalDiesel.toFixed(1)} L</p>
            </div>
          </div>
        </div>
      )
    }
 
    if (tipoReporte === 'diesel_unidad') {
      return (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Diesel consumido por unidad destino</h2>
          {dieselPorUnidad.length ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dieselPorUnidad}>
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="litros" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-gray-500">No hay datos para el período seleccionado</p>}
        </div>
      )
    }
 
    if (tipoReporte === 'labores') {
      return (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Distribución de labores</h2>
          {distribucionLabores.length ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={distribucionLabores}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {distribucionLabores.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8 text-gray-500">No hay datos para el período seleccionado</p>}
        </div>
      )
    }
 
    if (tipoReporte === 'bodega') {
      return (
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">Salidas de bodega</h2>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left">Nº</th>
                <th className="px-2 py-2 text-left">Descripción</th>
                <th className="px-2 py-2 text-left">Código</th>
                <th className="px-2 py-2 text-left">Cantidad</th>
                <th className="px-2 py-2 text-left">Unidad</th>
                <th className="px-2 py-2 text-left">Observación/Motivo</th>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-left">Nº Requisición</th>
                <th className="px-2 py-2 text-left">Entregado por</th>
                <th className="px-2 py-2 text-left">Responsable</th>
                <th className="px-2 py-2 text-left">Proveedor</th>
                <th className="px-2 py-2 text-left">Unidad Destino</th>
                <th className="px-2 py-2 text-left">Costo aplicado a</th>
              </tr>
            </thead>
            <tbody>
              {salidasBodega.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-1">{s.numero}</td>
                  <td className="px-2 py-1">{s.descripcion}</td>
                  <td className="px-2 py-1">{s.codigo || '-'}</td>
                  <td className="px-2 py-1">{s.cantidad}</td>
                  <td className="px-2 py-1">{s.unidad_medida || '-'}</td>
                  <td className="px-2 py-1">{s.observacion_motivo || '-'}</td>
                  <td className="px-2 py-1">{s.fecha}</td>
                  <td className="px-2 py-1">{s.n_requisicion || '-'}</td>
                  <td className="px-2 py-1">{s.entregado_por || '-'}</td>        {/* ✅ campo correcto */}
                  <td className="px-2 py-1">{s.persona_responsable || '-'}</td>
                  <td className="px-2 py-1">{s.proveedor || '-'}</td>
                  <td className="px-2 py-1">{s.vehiculo}</td>
                  <td className="px-2 py-1">{s.costo_aplicado_a || '-'}</td>
                </tr>
              ))}
              {salidasBodega.length === 0 && (
                <tr><td colSpan="13" className="text-center py-4 text-gray-500">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )
    }
 
    if (tipoReporte === 'registro_diario') {
      return (
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <h2 className="text-lg font-semibold mb-4">Registro diario de labores</h2>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-left">Unidad Destino</th>
                <th className="px-2 py-2 text-left">Operador</th>
                <th className="px-2 py-2 text-left">Horas</th>
                <th className="px-2 py-2 text-left">Litros Diesel</th>
                <th className="px-2 py-2 text-left">Responsable</th>
                <th className="px-2 py-2 text-left">Labores</th>
                <th className="px-2 py-2 text-left">Fincas / Lotes</th>
                <th className="px-2 py-2 text-left">Área (Mz)</th>
                <th className="px-2 py-2 text-left">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {registrosDiarios.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-1 whitespace-nowrap">{r.fecha}</td>
                  <td className="px-2 py-1 whitespace-nowrap">T{r.unidaddestino?.numero} {r.unidaddestino?.nombre || ''}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.operadores?.nombre} {r.operadores?.apellido || ''}</td>
                  <td className="px-2 py-1">{r.total_horas?.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.litros_diesel?.toFixed(1) || '-'}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{formatResponsable(r)}</td>  {/* ✅ join correcto */}
                  <td className="px-2 py-1">{r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-2 py-1">{formatFincasLotes(r.detalle_actividades)}</td> {/* ✅ lotes via join correcto */}
                  <td className="px-2 py-1">
                    {r.detalle_actividades?.reduce((acc, d) => acc + (d.areamz || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-1">{r.observaciones || '-'}</td>
                </tr>
              ))}
              {registrosDiarios.length === 0 && (
                <tr><td colSpan="10" className="text-center py-4 text-gray-500">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )
    }
 
    return null
  }
 
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
 
      {/* Selector de tipo de reporte */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block text-sm font-medium mb-2">Tipo de reporte</label>
        <select
          value={tipoReporte}
          onChange={e => setTipoReporte(e.target.value)}
          className="border p-2 rounded w-full md:w-72"
        >
          <option value="horas_unidad">Horas trabajadas por unidad destino</option>
          <option value="diesel_unidad">Diesel consumido por unidad destino</option>
          <option value="labores">Distribución de labores</option>
          <option value="registro_diario">Registro diario de labores</option>
          <option value="bodega">Salidas de bodega</option>
        </select>
      </div>
 
      {/* Filtros comunes (período y unidad destino) */}
      {tipoReporte !== 'bodega' && (
        <div className="bg-white p-4 rounded shadow">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <div className="flex gap-1">
                {['mes', 'semana', 'dia', 'custom'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`px-3 py-1 text-sm rounded ${periodo === p ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    {p === 'mes' ? 'Mes' : p === 'semana' ? 'Semana' : p === 'dia' ? 'Día' : 'Personalizado'}
                  </button>
                ))}
              </div>
            </div>
            {periodo === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border p-2 rounded" />
                <span className="text-gray-500">a</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border p-2 rounded" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Unidad Destino</label>
              <select value={unidadId} onChange={e => setUnidadId(e.target.value)} className="border p-2 rounded">
                <option value="todos">Todos</option>
                {unidadesDestino.map(u => <option key={u.id} value={u.id}>T{u.numero} {u.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
 
      {/* Filtros específicos para bodega */}
      {tipoReporte === 'bodega' && (
        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <div className="flex gap-1 flex-wrap">
                {['mes', 'semana', 'dia', 'custom'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`px-3 py-1 text-sm rounded ${periodo === p ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    {p === 'mes' ? 'Mes' : p === 'semana' ? 'Semana' : p === 'dia' ? 'Día' : 'Personalizado'}
                  </button>
                ))}
              </div>
              {periodo === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border p-2 rounded flex-1" />
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border p-2 rounded flex-1" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={filtroBodega.tipo}
                onChange={e => setFiltroBodega({ ...filtroBodega, tipo: e.target.value })}
                className="border p-2 rounded w-full"
              >
                <option value="todos">Todos</option>
                <option value="general">Solo generales</option>
                <option value="vehiculo">Solo por unidad destino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Entregado por</label>
              <input
                type="text"
                placeholder="Filtrar por quien entregó"
                value={filtroBodega.entregadoPor}
                onChange={e => setFiltroBodega({ ...filtroBodega, entregadoPor: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <input
                type="text"
                placeholder="Filtrar por descripción"
                value={filtroBodega.descripcion}
                onChange={e => setFiltroBodega({ ...filtroBodega, descripcion: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
          </div>
        </div>
      )}
 
      {/* Botones de exportación */}
      <div className="flex gap-2 justify-end">
        <button onClick={exportarExcel} className="bg-green-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1 hover:bg-green-700">
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button onClick={exportarCSV} className="bg-blue-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1 hover:bg-blue-700">
          <FileJson size={16} /> CSV
        </button>
        <button onClick={exportarPDF} className="bg-red-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1 hover:bg-red-700">
          <FileText size={16} /> PDF
        </button>
      </div>
 
      {/* Contenido del reporte */}
      {renderGraficos()}
    </div>
  )
}
 
export default Reportes
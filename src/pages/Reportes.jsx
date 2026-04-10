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
      case 'semana':
        const diaSemana = hoy.getDay()
        const diff = diaSemana === 0 ? 6 : diaSemana - 1
        inicio = new Date(hoy)
        inicio.setDate(hoy.getDate() - diff)
        break
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
      setHorasPorUnidad(Object.entries(horasMap).map(([nombre, horas]) => ({ nombre, horas })).sort((a,b)=>b.horas - a.horas))
      setDieselPorUnidad(Object.entries(dieselMap).map(([nombre, litros]) => ({ nombre, litros })).sort((a,b)=>b.litros - a.litros))

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
        query = query.ilike('persona_responsable', `%${filtroBodega.entregadoPor}%`)
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
          total_horas,
          litros_diesel,
          responsable_mecanizacion,
          observaciones,
          detalle_actividades (
            labores (nombre),
            fincas (nombre),
            lotes (numero),
            areamz
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
    } finally {
      setCargando(false)
    }
  }

  const exportarExcel = () => {
    let datos = []
    if (tipoReporte === 'horas_unidad') {
      datos = horasPorUnidad.map(h => ({ 'Unidad Destino': h.nombre, Horas: h.horas }))
    } else if (tipoReporte === 'diesel_unidad') {
      datos = dieselPorUnidad.map(d => ({ 'Unidad Destino': d.nombre, Litros: d.litros }))
    } else if (tipoReporte === 'labores') {
      datos = distribucionLabores.map(l => ({ Labor: l.name, Frecuencia: l.value }))
    } else if (tipoReporte === 'bodega') {
      datos = salidasBodega.map(s => ({
        'Nº': s.numero,
        'Descripción': s.descripcion,
        'Código': s.codigo || 'Sin código',
        'Cantidad': s.cantidad,
        'Unidad': s.unidad_medida || '-',
        'Observación/Motivo': s.observacion_motivo || '-',
        'Fecha': s.fecha,
        'Nº Requisición': s.n_requisicion || '-',
        'Entregado por': s.persona_responsable || '-',
        'Proveedor': s.proveedor || '-',
        'Unidad Destino': s.vehiculo,
        'Costo aplicado a': s.costo_aplicado_a || '-'
      }))
    } else if (tipoReporte === 'registro_diario') {
      datos = registrosDiarios.map(r => ({
        'Fecha': r.fecha,
        'Unidad Destino': `T${r.unidaddestino?.numero} ${r.unidaddestino?.nombre || ''}`,
        'Operador': `${r.operadores?.nombre || ''} ${r.operadores?.apellido || ''}`,
        'Horas': r.total_horas,
        'Litros Diesel': r.litros_diesel,
        'Responsable': r.responsable_mecanizacion,
        'Labores': r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-',
        'Fincas/Lotes': r.detalle_actividades?.map(d => `${d.fincas?.nombre || ''} ${d.lotes?.numero || ''}`).filter(Boolean).join(', ') || '-',
        'Observaciones': r.observaciones
      }))
    }
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `reporte_${tipoReporte}_${new Date().toISOString()}.xlsx`)
    toast.success('Exportado a Excel')
  }

  const exportarCSV = () => {
    let datos = []
    if (tipoReporte === 'horas_unidad') {
      datos = horasPorUnidad.map(h => ({ 'Unidad Destino': h.nombre, Horas: h.horas }))
    } else if (tipoReporte === 'diesel_unidad') {
      datos = dieselPorUnidad.map(d => ({ 'Unidad Destino': d.nombre, Litros: d.litros }))
    } else if (tipoReporte === 'labores') {
      datos = distribucionLabores.map(l => ({ Labor: l.name, Frecuencia: l.value }))
    } else if (tipoReporte === 'bodega') {
      datos = salidasBodega.map(s => ({
        'Nº': s.numero,
        'Descripción': s.descripcion,
        'Código': s.codigo || 'Sin código',
        'Cantidad': s.cantidad,
        'Unidad': s.unidad_medida || '-',
        'Observación/Motivo': s.observacion_motivo || '-',
        'Fecha': s.fecha,
        'Nº Requisición': s.n_requisicion || '-',
        'Entregado por': s.persona_responsable || '-',
        'Proveedor': s.proveedor || '-',
        'Unidad Destino': s.vehiculo,
        'Costo aplicado a': s.costo_aplicado_a || '-'
      }))
    } else if (tipoReporte === 'registro_diario') {
      datos = registrosDiarios.map(r => ({
        'Fecha': r.fecha,
        'Unidad Destino': `T${r.unidaddestino?.numero} ${r.unidaddestino?.nombre || ''}`,
        'Operador': `${r.operadores?.nombre || ''} ${r.operadores?.apellido || ''}`,
        'Horas': r.total_horas,
        'Litros Diesel': r.litros_diesel,
        'Responsable': r.responsable_mecanizacion,
        'Labores': r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-',
        'Fincas/Lotes': r.detalle_actividades?.map(d => `${d.fincas?.nombre || ''} ${d.lotes?.numero || ''}`).filter(Boolean).join(', ') || '-',
        'Observaciones': r.observaciones
      }))
    }
    const ws = XLSX.utils.json_to_sheet(datos)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `reporte_${tipoReporte}_${new Date().toISOString()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exportado a CSV')
  }

  const exportarPDF = () => {
    let datos = []
    let titulo = ''
    if (tipoReporte === 'horas_unidad') {
      datos = horasPorUnidad.map(h => ({ 'Unidad Destino': h.nombre, Horas: h.horas }))
      titulo = 'Horas por unidad destino'
    } else if (tipoReporte === 'diesel_unidad') {
      datos = dieselPorUnidad.map(d => ({ 'Unidad Destino': d.nombre, Litros: d.litros }))
      titulo = 'Diesel por unidad destino'
    } else if (tipoReporte === 'labores') {
      datos = distribucionLabores.map(l => ({ Labor: l.name, Frecuencia: l.value }))
      titulo = 'Distribución de labores'
    } else if (tipoReporte === 'bodega') {
      datos = salidasBodega.map(s => ({
        'Nº': s.numero,
        'Descripción': s.descripcion,
        'Código': s.codigo || 'Sin código',
        'Cantidad': s.cantidad,
        'Unidad': s.unidad_medida || '-',
        'Observación/Motivo': s.observacion_motivo || '-',
        'Fecha': s.fecha,
        'Nº Requisición': s.n_requisicion || '-',
        'Entregado por': s.persona_responsable || '-',
        'Proveedor': s.proveedor || '-',
        'Unidad Destino': s.vehiculo,
        'Costo aplicado a': s.costo_aplicado_a || '-'
      }))
      titulo = 'Salidas de bodega'
    } else if (tipoReporte === 'registro_diario') {
      datos = registrosDiarios.map(r => ({
        'Fecha': r.fecha,
        'Unidad Destino': `T${r.unidaddestino?.numero} ${r.unidaddestino?.nombre || ''}`,
        'Operador': `${r.operadores?.nombre || ''} ${r.operadores?.apellido || ''}`,
        'Horas': r.total_horas,
        'Litros Diesel': r.litros_diesel,
        'Responsable': r.responsable_mecanizacion,
        'Labores': r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-',
        'Fincas/Lotes': r.detalle_actividades?.map(d => `${d.fincas?.nombre || ''} ${d.lotes?.numero || ''}`).filter(Boolean).join(', ') || '-',
        'Observaciones': r.observaciones
      }))
      titulo = 'Registro diario de labores'
    }
    const doc = new jsPDF('landscape', 'mm', 'a4')
    doc.setFontSize(16)
    doc.text(titulo, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22)
    const columnas = Object.keys(datos[0] || {})
    const filas = datos.map(item => columnas.map(col => item[col] || ''))
    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 30,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { left: 10, right: 10 }
    })
    doc.save(`reporte_${tipoReporte}_${new Date().toISOString()}.pdf`)
    toast.success('Exportado a PDF')
  }

  const renderGraficos = () => {
    if (cargando) return <p className="text-center py-8">Cargando datos...</p>

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
          ) : <p className="text-center py-8">No hay datos</p>}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-2 rounded"><p className="text-sm">Total horas</p><p className="text-xl font-bold">{totalHoras.toFixed(1)}</p></div>
            <div className="bg-green-50 p-2 rounded"><p className="text-sm">Registros</p><p className="text-xl font-bold">{totalRegistros}</p></div>
            <div className="bg-yellow-50 p-2 rounded"><p className="text-sm">Total diesel</p><p className="text-xl font-bold">{totalDiesel.toFixed(1)} L</p></div>
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
          ) : <p className="text-center py-8">No hay datos</p>}
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
                <Pie data={distribucionLabores} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({name, percent}) => `${name}: ${(percent*100).toFixed(0)}%`}>
                  {distribucionLabores.map((e,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-8">No hay datos</p>}
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
                <th>Nº</th><th>Descripción</th><th>Código</th><th>Cantidad</th><th>Unidad</th>
                <th>Observación/Motivo</th><th>Fecha</th><th>Nº Requisición</th>
                <th>Entregado por</th><th>Proveedor</th><th>Unidad Destino</th><th>Costo aplicado a</th>
              </tr>
            </thead>
            <tbody>
              {salidasBodega.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-2 py-1">{s.numero}</td>
                  <td className="px-2 py-1">{s.descripcion}</td>
                  <td className="px-2 py-1">{s.codigo || '-'}</td>
                  <td className="px-2 py-1">{s.cantidad}</td>
                  <td className="px-2 py-1">{s.unidad_medida || '-'}</td>
                  <td className="px-2 py-1">{s.observacion_motivo || '-'}</td>
                  <td className="px-2 py-1">{s.fecha}</td>
                  <td className="px-2 py-1">{s.n_requisicion || '-'}</td>
                  <td className="px-2 py-1">{s.persona_responsable || '-'}</td>
                  <td className="px-2 py-1">{s.proveedor || '-'}</td>
                  <td className="px-2 py-1">{s.vehiculo}</td>
                  <td className="px-2 py-1">{s.costo_aplicado_a || '-'}</td>
                </tr>
              ))}
              {salidasBodega.length === 0 && (
                <tr>
                  <td colSpan="12" className="text-center py-4">No hay registros</td>
                </tr>
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
                <th>Fecha</th><th>Unidad Destino</th><th>Operador</th><th>Horas</th><th>Litros Diesel</th>
                <th>Responsable</th><th>Labores</th><th>Fincas/Lotes</th><th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {registrosDiarios.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1">{r.fecha}</td>
                  <td className="px-2 py-1">T{r.unidaddestino?.numero} {r.unidaddestino?.nombre || ''}</td>
                  <td className="px-2 py-1">{r.operadores?.nombre} {r.operadores?.apellido || ''}</td>
                  <td className="px-2 py-1">{r.total_horas?.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.litros_diesel?.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.responsable_mecanizacion || '-'}</td>
                  <td className="px-2 py-1">{r.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-2 py-1">{r.detalle_actividades?.map(d => `${d.fincas?.nombre || ''} ${d.lotes?.numero || ''}`).filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-2 py-1">{r.observaciones || '-'}</td>
                </tr>
              ))}
              {registrosDiarios.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-4">No hay registros</td>
                </tr>
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
        <select value={tipoReporte} onChange={e => setTipoReporte(e.target.value)} className="border p-2 rounded w-full md:w-64">
          <option value="horas_unidad">Horas trabajadas por unidad destino</option>
          <option value="diesel_unidad">Diesel consumido por unidad destino</option>
          <option value="labores">Distribución de labores</option>
          <option value="registro_diario">Registro diario de labores</option>
          <option value="bodega">Salidas de bodega</option>
        </select>
      </div>

      {/* Filtros comunes (período y unidad destino, excepto para bodega) */}
      {tipoReporte !== 'bodega' && (
        <div className="bg-white p-4 rounded shadow">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium">Período</label>
              <div className="flex gap-1 mt-1">
                <button onClick={() => setPeriodo('mes')} className={`px-3 py-1 text-sm rounded ${periodo === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Mes</button>
                <button onClick={() => setPeriodo('semana')} className={`px-3 py-1 text-sm rounded ${periodo === 'semana' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Semana</button>
                <button onClick={() => setPeriodo('dia')} className={`px-3 py-1 text-sm rounded ${periodo === 'dia' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Día</button>
                <button onClick={() => setPeriodo('custom')} className={`px-3 py-1 text-sm rounded ${periodo === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Personalizado</button>
              </div>
            </div>
            {periodo === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border p-2 rounded" />
                <span>a</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border p-2 rounded" />
              </>
            )}
            <div>
              <label className="block text-sm font-medium">Unidad Destino</label>
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
              <label className="block text-sm font-medium">Período</label>
              <div className="flex gap-1 mt-1">
                <button onClick={() => setPeriodo('mes')} className={`px-3 py-1 text-sm rounded ${periodo === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Mes</button>
                <button onClick={() => setPeriodo('semana')} className={`px-3 py-1 text-sm rounded ${periodo === 'semana' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Semana</button>
                <button onClick={() => setPeriodo('dia')} className={`px-3 py-1 text-sm rounded ${periodo === 'dia' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Día</button>
                <button onClick={() => setPeriodo('custom')} className={`px-3 py-1 text-sm rounded ${periodo === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Personalizado</button>
              </div>
            </div>
            {periodo === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border p-2 rounded" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border p-2 rounded" />
              </>
            )}
            <div>
              <label className="block text-sm font-medium">Tipo</label>
              <select value={filtroBodega.tipo} onChange={e => setFiltroBodega({...filtroBodega, tipo: e.target.value})} className="border p-2 rounded w-full">
                <option value="todos">Todos</option>
                <option value="general">Solo generales</option>
                <option value="vehiculo">Solo por unidad destino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Entregado por</label>
              <input type="text" placeholder="Filtrar por quien entregó" value={filtroBodega.entregadoPor} onChange={e => setFiltroBodega({...filtroBodega, entregadoPor: e.target.value})} className="border p-2 rounded w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">Descripción</label>
              <input type="text" placeholder="Filtrar por descripción" value={filtroBodega.descripcion} onChange={e => setFiltroBodega({...filtroBodega, descripcion: e.target.value})} className="border p-2 rounded w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Botones de exportación */}
      <div className="flex gap-2 justify-end">
        <button onClick={exportarExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><FileSpreadsheet size={16} /> Excel</button>
        <button onClick={exportarCSV} className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><FileJson size={16} /> CSV</button>
        <button onClick={exportarPDF} className="bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><FileText size={16} /> PDF</button>
      </div>

      {renderGraficos()}
    </div>
  )
}

export default Reportes
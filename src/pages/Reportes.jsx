import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#A28D5C']

const Reportes = () => {
  const [tractores, setTractores] = useState([])
  const [cargando, setCargando] = useState(false)
  const [registros, setRegistros] = useState([])
  const [horasPorTractor, setHorasPorTractor] = useState([])
  const [dieselPorTractor, setDieselPorTractor] = useState([])
  const [horasPorLabor, setHorasPorLabor] = useState([])
  const [totalTractoresActivos, setTotalTractoresActivos] = useState(0)

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(() => {
    const fecha = new Date()
    fecha.setDate(1)
    return fecha.toISOString().split('T')[0]
  })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])
  const [tractorId, setTractorId] = useState('todos')

  useEffect(() => {
    cargarTractores()
    cargarTotalTractoresActivos()
  }, [])

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarReporte()
    }
  }, [fechaInicio, fechaFin, tractorId])

  const cargarTractores = async () => {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('id, numero, nombre')
      .order('numero')
    if (!error) setTractores(data || [])
  }

  const cargarTotalTractoresActivos = async () => {
    const { count, error } = await supabase
      .from('vehiculos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Activo')
    if (!error) setTotalTractoresActivos(count || 0)
  }

  const cargarReporte = async () => {
    setCargando(true)
    try {
      let query = supabase
        .from('registros_diarios')
        .select(`
          id,
          fecha,
          tractor_id,
          total_horas,
          litros_diesel,
          vehiculos (numero, nombre),
          detalle_actividades (
            labor_id,
            labores (nombre)
          )
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      if (tractorId !== 'todos') {
        query = query.eq('tractor_id', tractorId)
      }

      const { data, error } = await query.order('fecha', { ascending: false })

      if (error) throw error

      setRegistros(data || [])

      // Horas por tractor
      const horasMap = {}
      const dieselMap = {}
      // Para distribución de horas por labor (sumando horas distribuidas)
      const laborHorasMap = {}

      data?.forEach(reg => {
        const tractorNum = reg.vehiculos?.numero || '?'
        const tractorNombre = reg.vehiculos?.nombre || `T${tractorNum}`
        const key = `${tractorNum} - ${tractorNombre}`
        const horas = reg.total_horas || 0
        const diesel = reg.litros_diesel || 0

        horasMap[key] = (horasMap[key] || 0) + horas
        dieselMap[key] = (dieselMap[key] || 0) + diesel

        // Distribuir horas entre las labores de este registro
        const labores = reg.detalle_actividades || []
        const cantLabores = labores.length
        if (cantLabores > 0 && horas > 0) {
          const horasPorLabor = horas / cantLabores
          labores.forEach(det => {
            const laborNombre = det.labores?.nombre || 'Sin labor'
            laborHorasMap[laborNombre] = (laborHorasMap[laborNombre] || 0) + horasPorLabor
          })
        } else if (horas > 0) {
          // Si no hay labores asignadas, se agrupa como "Sin labor"
          laborHorasMap['Sin labor'] = (laborHorasMap['Sin labor'] || 0) + horas
        }
      })

      const horasArray = Object.entries(horasMap).map(([nombre, horas]) => ({ nombre, horas }))
      const dieselArray = Object.entries(dieselMap).map(([nombre, litros]) => ({ nombre, litros }))
      const laborArray = Object.entries(laborHorasMap).map(([name, value]) => ({ name, value }))

      setHorasPorTractor(horasArray.sort((a, b) => b.horas - a.horas))
      setDieselPorTractor(dieselArray.sort((a, b) => b.litros - a.litros))
      setHorasPorLabor(laborArray.sort((a, b) => b.value - a.value))
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar el reporte')
    } finally {
      setCargando(false)
    }
  }

  const totalHoras = registros.reduce((sum, r) => sum + (r.total_horas || 0), 0)
  const totalDiesel = registros.reduce((sum, r) => sum + (r.litros_diesel || 0), 0)
  const totalRegistros = registros.length

  const prepararDatosExportacion = () => {
    return registros.map(reg => ({
      Fecha: reg.fecha,
      Tractor: `T${reg.vehiculos?.numero || ''} ${reg.vehiculos?.nombre || ''}`,
      'Total Horas': reg.total_horas,
      'Litros Diesel': reg.litros_diesel,
      Labores: reg.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || ''
    }))
  }

  const exportarExcel = () => {
    const datos = prepararDatosExportacion()
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `reporte_${fechaInicio}_a_${fechaFin}.xlsx`)
    toast.success('Exportado a Excel')
  }

  const exportarCSV = () => {
    const datos = prepararDatosExportacion()
    const ws = XLSX.utils.json_to_sheet(datos)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `reporte_${fechaInicio}_a_${fechaFin}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exportado a CSV')
  }

  const exportarPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')
    const datos = prepararDatosExportacion()
    doc.setFontSize(16)
    doc.text(`Reporte de Labores - ${fechaInicio} al ${fechaFin}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22)
    const columnas = Object.keys(datos[0] || {})
    const filas = datos.map(item => columnas.map(col => item[col] || ''))
    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 30,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { left: 10, right: 10 }
    })
    doc.save(`reporte_${fechaInicio}_a_${fechaFin}.pdf`)
    toast.success('Exportado a PDF')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reportes</h1>

      {/* Panel de filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tractor</label>
            <select value={tractorId} onChange={e => setTractorId(e.target.value)} className="w-full border rounded-lg p-2">
              <option value="todos">Todos los tractores</option>
              {tractores.map(t => <option key={t.id} value={t.id}>T{t.numero} - {t.nombre}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={exportarCSV} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><FileJson size={16} /> CSV</button>
            <button onClick={exportarPDF} className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"><FileText size={16} /> PDF</button>
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Número de Registros</h3>
          <p className="text-3xl font-bold text-green-600">{totalRegistros}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Total de Horas Trabajadas</h3>
          <p className="text-3xl font-bold text-blue-600">{totalHoras.toFixed(1)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Total de Diesel (litros)</h3>
          <p className="text-3xl font-bold text-purple-600">{totalDiesel.toFixed(1)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Tractores Activos</h3>
          <p className="text-3xl font-bold text-orange-600">{totalTractoresActivos}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Horas por tractor */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Horas por tractor</h2>
          {cargando ? <p className="text-center py-8">Cargando...</p> : horasPorTractor.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={horasPorTractor} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="horas" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-8">No hay datos</p>}
        </div>

        {/* Diesel por tractor */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Diesel por tractor (litros)</h2>
          {cargando ? <p className="text-center py-8">Cargando...</p> : dieselPorTractor.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dieselPorTractor} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="litros" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-8">No hay datos</p>}
        </div>
      </div>

      {/* Distribución de horas por labor */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Distribución de horas por labor</h2>
        {cargando ? <p className="text-center py-8">Cargando...</p> : horasPorLabor.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={horasPorLabor} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                {horasPorLabor.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => `${value.toFixed(1)} hrs`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 text-center py-8">No hay datos de labores en el período</p>}
      </div>

      {/* Tabla de registros (mantenemos igual) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Detalle de registros</h2>
        </div>
        <div className="overflow-x-auto">
          {cargando ? (
            <p className="text-center py-8">Cargando registros...</p>
          ) : registros.length > 0 ? (
            <table className="min-w-[800px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tractor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diesel (L)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Labores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registros.map(reg => (
                  <tr key={reg.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{reg.fecha}</td>
                    <td className="px-4 py-3 whitespace-nowrap">T{reg.vehiculos?.numero} {reg.vehiculos?.nombre}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{reg.total_horas?.toFixed(1)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{reg.litros_diesel?.toFixed(1)}</td>
                    <td className="px-4 py-3">{reg.detalle_actividades?.map(d => d.labores?.nombre).filter(Boolean).join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-8 text-gray-500">No se encontraron registros</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reportes
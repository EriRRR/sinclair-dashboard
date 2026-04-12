import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { AlertTriangle, CheckCircle, Clock, Tractor, Wrench, CalendarCheck, Timer, Activity, Package, ClipboardList, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const AlertCard = ({ unidad, tipo, horasFaltantes, estado }) => {
  const getStatusColor = () => {
    if (estado === 'Atrasado') return 'border-red-200 bg-red-50'
    if (horasFaltantes <= 20) return 'border-orange-200 bg-orange-50'
    return 'border-yellow-200 bg-yellow-50'
  }
  const getTextColor = () => {
    if (estado === 'Atrasado') return 'text-red-700'
    if (horasFaltantes <= 20) return 'text-orange-700'
    return 'text-yellow-700'
  }
  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-gray-800">Unidad {unidad}</h4>
          <p className="text-sm text-gray-600">{tipo}</p>
        </div>
        {estado === 'Atrasado' ? <AlertTriangle className="text-red-500" size={20} /> : <Clock className="text-yellow-500" size={20} />}
      </div>
      <div className="mt-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Horas restantes:</span>
          <span className={`font-bold ${getTextColor()}`}>
            {horasFaltantes < 0 ? 'Vencido' : `${horasFaltantes.toFixed(1)} hrs`}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div className={`h-2 rounded-full ${estado === 'Atrasado' ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(100, Math.max(0, (horasFaltantes / 50) * 100))}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-2">{estado === 'Atrasado' ? 'Mantenimiento vencido' : 'Requiere atención pronto'}</p>
      </div>
    </div>
  )
}

const Dashboard = () => {
  const [periodo, setPeriodo] = useState('mes')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('todos')
  const [unidadesList, setUnidadesList] = useState([])

  const [stats, setStats] = useState({
    unidadesActivas: 0,
    enTaller: 0,
    mantenimientosPendientes: 0,
    horasPeriodo: 0,
    proximosServicios: 0,
    totalRequisiciones: 0
  })
  const [horasPorUnidad, setHorasPorUnidad] = useState([])
  const [distribucionLabores, setDistribucionLabores] = useState([])
  const [alertasMantenimiento, setAlertasMantenimiento] = useState([])
  const [unidadesHorometro, setUnidadesHorometro] = useState([])
  const [topMateriales, setTopMateriales] = useState([])
  const [topMaterialesLimit, setTopMaterialesLimit] = useState(5)

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B']

  const obtenerRangoFechas = () => {
    if (periodo === 'custom') return { inicio: customStart, fin: customEnd }
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

  const getPeriodoTexto = () => {
    if (periodo === 'custom') return 'rango personalizado'
    switch (periodo) {
      case 'mes': return 'este mes'
      case 'semana': return 'esta semana'
      case 'dia': return 'hoy'
      default: return 'este mes'
    }
  }

  const aplicarCustomRange = () => {
    if (customStart && customEnd) setPeriodo('custom')
    else toast.error('Selecciona ambas fechas')
  }

  // ========== FETCHES ==========
  const fetchUnidadesList = async () => {
    const { data } = await supabase.from('unidaddestino').select('id, numero, nombre').order('numero')
    if (data) setUnidadesList(data)
  }

  const fetchStatsBasicos = async () => {
    try {
      const { count: activos } = await supabase.from('unidaddestino').select('*', { count: 'exact', head: true }).eq('estado', 'Activo')
      const { count: taller } = await supabase.from('unidaddestino').select('*', { count: 'exact', head: true }).eq('estado', 'En Taller')
      const { count: pendientes } = await supabase.from('mantenimiento_aceite').select('*', { count: 'exact', head: true }).in('estado', ['Pendiente', 'Atrasado'])
      setStats(prev => ({ ...prev, unidadesActivas: activos || 0, enTaller: taller || 0, mantenimientosPendientes: pendientes || 0 }))
    } catch (error) { console.error(error) }
  }

  const fetchProximosServicios = async () => {
    const { count } = await supabase.from('mantenimiento_aceite').select('*', { count: 'exact', head: true }).eq('estado', 'Pendiente')
    setStats(prev => ({ ...prev, proximosServicios: count || 0 }))
  }

  const fetchTotalHorasPeriodo = async () => {
    const { inicio, fin } = obtenerRangoFechas()
    let query = supabase.from('registros_diarios').select('total_horas').gte('fecha', inicio).lte('fecha', fin)
    if (unidadSeleccionada !== 'todos') query = query.eq('unidaddestino_id', parseInt(unidadSeleccionada))
    const { data } = await query
    const total = data?.reduce((sum, h) => sum + (h.total_horas || 0), 0) || 0
    setStats(prev => ({ ...prev, horasPeriodo: total }))
  }

  const fetchHorasPorUnidad = async () => {
    const { inicio, fin } = obtenerRangoFechas()
    let query = supabase.from('registros_diarios')
      .select('total_horas, unidaddestino_id, unidaddestino(numero, nombre)')
      .gte('fecha', inicio)
      .lte('fecha', fin)
    if (unidadSeleccionada !== 'todos') query = query.eq('unidaddestino_id', parseInt(unidadSeleccionada))
    const { data } = await query
    if (unidadSeleccionada !== 'todos') {
      const unidadInfo = unidadesList.find(u => u.id === parseInt(unidadSeleccionada))
      const nombre = `T${unidadInfo?.numero || ''} ${unidadInfo?.nombre || ''}`
      const totalHoras = data?.reduce((sum, r) => sum + (r.total_horas || 0), 0) || 0
      setHorasPorUnidad([{ nombre, horas: totalHoras }])
    } else {
      const agrupado = {}
      data?.forEach(reg => {
        const key = `${reg.unidaddestino?.numero} - ${reg.unidaddestino?.nombre}`
        if (!agrupado[key]) agrupado[key] = { nombre: key, horas: 0 }
        agrupado[key].horas += reg.total_horas || 0
      })
      setHorasPorUnidad(Object.values(agrupado).sort((a, b) => b.horas - a.horas).slice(0, 8))
    }
  }

  const fetchDistribucionLabores = async () => {
    const { inicio, fin } = obtenerRangoFechas()
    let query = supabase.from('detalle_actividades')
      .select('labor_id, labores(nombre), registros_diarios!inner(fecha, unidaddestino_id)')
      .gte('registros_diarios.fecha', inicio)
      .lte('registros_diarios.fecha', fin)
    if (unidadSeleccionada !== 'todos') query = query.eq('registros_diarios.unidaddestino_id', parseInt(unidadSeleccionada))
    const { data } = await query
    const conteo = {}
    data?.forEach(det => {
      const nombre = det.labores?.nombre || 'Sin labor'
      conteo[nombre] = (conteo[nombre] || 0) + 1
    })
    setDistribucionLabores(Object.entries(conteo).map(([name, value]) => ({ name, value })))
  }

  const fetchAlertasMantenimiento = async () => {
    const { data } = await supabase
      .from('mantenimiento_aceite')
      .select('id, hrs_faltantes, estado, unidaddestino(numero, nombre)')
      .in('estado', ['Pendiente', 'Atrasado'])
      .order('hrs_faltantes', { ascending: true })
    setAlertasMantenimiento(data || [])
  }

  const fetchUnidadesHorometro = async () => {
    const { data } = await supabase.from('unidaddestino').select('numero, nombre, horometro_actual, estado').order('numero')
    if (data) setUnidadesHorometro(data)
  }

  const fetchTotalRequisiciones = async () => {
    const { count } = await supabase.from('salidas_bodega_cabecera').select('*', { count: 'exact', head: true })
    setStats(prev => ({ ...prev, totalRequisiciones: count || 0 }))
  }

  const fetchMaterialesMasUsados = async () => {
    try {
      const { inicio, fin } = obtenerRangoFechas()
      const { data, error } = await supabase
        .from('salidas_bodega_detalle')
        .select(`
          descripcion,
          cantidad,
          cabecera:salidas_bodega_cabecera!inner(fecha)
        `)
        .gte('cabecera.fecha', inicio)
        .lte('cabecera.fecha', fin)

      if (error) throw error

      const agrupado = {}
      data?.forEach(item => {
        const desc = item.descripcion
        if (!agrupado[desc]) agrupado[desc] = 0
        agrupado[desc] += item.cantidad
      })

      const top = Object.entries(agrupado)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, topMaterialesLimit === 0 ? undefined : topMaterialesLimit)

      setTopMateriales(top)
    } catch (error) {
      console.error('Error fetching materiales:', error)
    }
  }

  // ========== EFECTOS ==========
  useEffect(() => {
    fetchUnidadesList()
    fetchStatsBasicos()
    fetchProximosServicios()
    fetchAlertasMantenimiento()
    fetchUnidadesHorometro()
    fetchTotalRequisiciones()
    fetchMaterialesMasUsados()
  }, [])

  useEffect(() => {
    fetchHorasPorUnidad()
    fetchTotalHorasPeriodo()
    fetchDistribucionLabores()
    fetchMaterialesMasUsados()
  }, [periodo, customStart, customEnd, unidadSeleccionada, topMaterialesLimit])

  const allAlerts = alertasMantenimiento.map(alert => ({
    unidad_numero: alert.unidaddestino?.numero || '?',
    tipo_aceite: 'Motor',
    horas_faltantes: alert.hrs_faltantes,
    estado: alert.estado
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Tarjetas de estadísticas (6 columnas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">Unidades Activas</h3><div className="flex items-center gap-2 mt-1"><Tractor className="text-green-600" size={28} /><p className="text-3xl font-bold text-green-600">{stats.unidadesActivas}</p></div></div>
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">En Taller</h3><div className="flex items-center gap-2 mt-1"><Wrench className="text-yellow-600" size={28} /><p className="text-3xl font-bold text-yellow-600">{stats.enTaller}</p></div></div>
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">Mantenimientos Pendientes</h3><div className="flex items-center gap-2 mt-1"><AlertTriangle className="text-red-600" size={28} /><p className="text-3xl font-bold text-red-600">{stats.mantenimientosPendientes}</p></div></div>
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">Próximos Servicios</h3><div className="flex items-center gap-2 mt-1"><CalendarCheck className="text-orange-600" size={28} /><p className="text-3xl font-bold text-orange-600">{stats.proximosServicios}</p></div><p className="text-xs text-gray-400 mt-1">menos de 50 hrs</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">Horas trabajadas</h3><div className="flex items-center gap-2 mt-1"><Timer className="text-blue-600" size={28} /><p className="text-3xl font-bold text-blue-600">{stats.horasPeriodo.toFixed(1)}</p></div><p className="text-xs text-gray-400 mt-1">{getPeriodoTexto()}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-gray-500 text-sm font-medium">Requisiciones Registradas</h3><div className="flex items-center gap-2 mt-1"><ClipboardList className="text-purple-600" size={28} /><p className="text-3xl font-bold text-purple-600">{stats.totalRequisiciones}</p></div></div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
            <select value={unidadSeleccionada} onChange={(e) => setUnidadSeleccionada(e.target.value)} className="w-full border rounded-lg p-2">
              <option value="todos">Todas las unidades</option>
              {unidadesList.map(u => <option key={u.id} value={u.id}>T{u.numero} - {u.nombre}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button onClick={() => setPeriodo('mes')} className={`px-3 py-1 text-sm rounded ${periodo === 'mes' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Mes</button>
              <button onClick={() => setPeriodo('semana')} className={`px-3 py-1 text-sm rounded ${periodo === 'semana' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Semana</button>
              <button onClick={() => setPeriodo('dia')} className={`px-3 py-1 text-sm rounded ${periodo === 'dia' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Día</button>
            </div>
            <div className="flex gap-1 items-center">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border rounded p-1 text-sm" />
              <span className="text-xs">a</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border rounded p-1 text-sm" />
              <button onClick={aplicarCustomRange} className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1"><Calendar size={14} /> Aplicar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Horas trabajadas por unidades ({getPeriodoTexto()}){unidadSeleccionada !== 'todos' && ` - Unidad filtrada`}</h2>
          {horasPorUnidad.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={horasPorUnidad} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><XAxis dataKey="nombre" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} /><YAxis /><Tooltip /><Bar dataKey="horas" fill="#3b82f6" /></BarChart></ResponsiveContainer> : <p className="text-gray-500 text-center py-8">No hay datos</p>}
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Distribución de Labores ({getPeriodoTexto()}){unidadSeleccionada !== 'todos' && ` - Unidad filtrada`}</h2>
          {distribucionLabores.length > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={distribucionLabores} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={true}>{distribucionLabores.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <p className="text-gray-500 text-center py-8">No hay datos</p>}
        </div>
      </div>

      {/* Materiales más usados */}
      <div className="bg-white rounded-lg shadow p-4 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Repuestos/Materiales de Taller más usados en {getPeriodoTexto()}</h2>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">Mostrar:</label>
            <select value={topMaterialesLimit} onChange={e => setTopMaterialesLimit(Number(e.target.value))} className="border rounded p-1 text-sm">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="0">Todos</option>
            </select>
          </div>
        </div>
        {topMateriales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr><th className="px-4 py-2 text-left">Material</th><th className="px-4 py-2 text-right">Cantidad total</th></tr>
              </thead>
              <tbody>
                {topMateriales.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2">{item.nombre}</td>
                    <td className="px-4 py-2 text-right font-semibold">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No hay datos de salidas de bodega en este período</p>
        )}
      </div>

      {/* Horómetro actual */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-4"><Tractor className="text-blue-500" size={24} /><h3 className="text-lg font-semibold">Horómetro Actual de Unidades</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {unidadesHorometro.map(unidad => (
            <div key={unidad.numero} className="border rounded-lg p-3 bg-gray-50 hover:shadow transition">
              <div className="font-semibold text-gray-800">Unidad {unidad.numero} {unidad.nombre && `- ${unidad.nombre}`}</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{unidad.horometro_actual?.toFixed(1) || 0} hrs</div>
              <div className="text-xs text-gray-500 mt-1">{unidad.estado}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas de Mantenimiento */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="text-yellow-500" size={20} /> Alertas de Mantenimiento</h3><span className="text-sm text-gray-500">{allAlerts.length} registros</span></div>
        {allAlerts.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{allAlerts.map((alert, i) => <AlertCard key={i} unidad={alert.unidad_numero} tipo={`Aceite de ${alert.tipo_aceite}`} horasFaltantes={alert.horas_faltantes} estado={alert.estado} />)}</div> : <div className="text-center py-8 text-sm text-gray-500"><Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />Todos los mantenimientos están al día</div>}
      </div>
    </div>
  )
}

export default Dashboard
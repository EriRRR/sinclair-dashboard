import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { AlertTriangle, CheckCircle, Clock, Tractor, Wrench, CalendarCheck, Timer, Activity, Calendar, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { LabelList } from 'recharts'

// Componente para cada tarjeta de alerta
const AlertCard = ({ tractor, tipo, horasFaltantes, estado }) => {
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
          <h4 className="font-semibold text-gray-800">Tractor {tractor}</h4>
          <p className="text-sm text-gray-600">{tipo}</p>
        </div>
        {estado === 'Atrasado' ? (
          <AlertTriangle className="text-red-500" size={20} />
        ) : (
          <Clock className="text-yellow-500" size={20} />
        )}
      </div>
      <div className="mt-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Horas restantes:</span>
          <span className={`font-bold ${getTextColor()}`}>
            {horasFaltantes < 0 ? 'Vencido' : `${horasFaltantes.toFixed(1)} hrs`}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${estado === 'Atrasado' ? 'bg-red-500' : 'bg-yellow-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, (horasFaltantes / 50) * 100))}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {estado === 'Atrasado' ? 'Mantenimiento vencido' : 'Requiere atención pronto'}
        </p>
      </div>
    </div>
  )
}

const Dashboard = () => {
  // Estado del período (mes, semana, dia, custom)
  const [periodo, setPeriodo] = useState('mes')
  // Fechas personalizadas
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])

  // Filtro de tractor
  const [tractorSeleccionado, setTractorSeleccionado] = useState('todos')
  const [tractoresList, setTractoresList] = useState([])

  const [stats, setStats] = useState({
    tractoresActivos: 0,
    enTaller: 0,
    mantenimientosPendientes: 0,
    horasPeriodo: 0,
    proximosServicios: 0
  })
  const [horasPorTractor, setHorasPorTractor] = useState([])
  const [distribucionLabores, setDistribucionLabores] = useState([])
  const [alertasMantenimiento, setAlertasMantenimiento] = useState([])
  const [tractoresHorometro, setTractoresHorometro] = useState([])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B']

  // ======================
  // Funciones auxiliares
  // ======================
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
    const inicioStr = inicio.toISOString().split('T')[0]
    const finStr = fin.toISOString().split('T')[0]
    return { inicio: inicioStr, fin: finStr }
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
    if (customStart && customEnd) {
      setPeriodo('custom')
    } else {
      toast.error('Selecciona ambas fechas')
    }
  }

  // ======================
  // Consultas a Supabase
  // ======================
  const fetchTractoresList = async () => {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('id, numero, nombre')
      .order('numero')
    if (!error) setTractoresList(data || [])
  }

  const fetchStatsBasicos = async () => {
    try {
      const { count: activos } = await supabase
        .from('vehiculos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Activo')
      const { count: taller } = await supabase
        .from('vehiculos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'En Taller')
      const { count: pendientes } = await supabase
        .from('mantenimiento_aceite')
        .select('*', { count: 'exact', head: true })
        .in('estado', ['Pendiente', 'Atrasado'])
      setStats(prev => ({
        ...prev,
        tractoresActivos: activos || 0,
        enTaller: taller || 0,
        mantenimientosPendientes: pendientes || 0
      }))
    } catch (error) {
      console.error('Error fetching basic stats:', error)
    }
  }

  const fetchProximosServicios = async () => {
    try {
      const { count, error } = await supabase
        .from('mantenimiento_aceite')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Pendiente')
      if (!error) setStats(prev => ({ ...prev, proximosServicios: count || 0 }))
    } catch (error) {
      console.error('Error fetching próximos servicios:', error)
    }
  }

  const fetchTotalHorasPeriodo = async () => {
    const { inicio, fin } = obtenerRangoFechas()
    let query = supabase
      .from('registros_diarios')
      .select('total_horas')
      .gte('fecha', inicio)
      .lte('fecha', fin)

    if (tractorSeleccionado !== 'todos') {
      query = query.eq('tractor_id', parseInt(tractorSeleccionado))
    }

    const { data: horasData } = await query
    const total = horasData?.reduce((sum, h) => sum + (h.total_horas || 0), 0) || 0
    setStats(prev => ({ ...prev, horasPeriodo: total }))
  }

  const fetchHorasPorTractor = async () => {
    try {
      const { inicio, fin } = obtenerRangoFechas()
      let query = supabase
        .from('registros_diarios')
        .select(`
          total_horas,
          tractor_id,
          vehiculos (numero, nombre)
        `)
        .gte('fecha', inicio)
        .lte('fecha', fin)

      if (tractorSeleccionado !== 'todos') {
        query = query.eq('tractor_id', parseInt(tractorSeleccionado))
      }

      const { data: registros, error } = await query
      if (error) throw error

      if (tractorSeleccionado !== 'todos') {
        // Si es un tractor específico, mostramos una sola barra con sus horas totales
        const tractorInfo = tractoresList.find(t => t.id === parseInt(tractorSeleccionado))
        const nombre = `T${tractorInfo?.numero || ''} ${tractorInfo?.nombre || ''}`
        const totalHoras = registros?.reduce((sum, r) => sum + (r.total_horas || 0), 0) || 0
        setHorasPorTractor([{ nombre, horas: totalHoras }])
      } else {
        // Agrupar por tractor
        const agrupado = {}
        registros?.forEach(reg => {
          const tractorId = reg.vehiculos?.numero || 'Desconocido'
          const tractorNombre = reg.vehiculos?.nombre || `Tractor ${tractorId}`
          const key = `${tractorId} - ${tractorNombre}`
          if (!agrupado[key]) agrupado[key] = { nombre: key, horas: 0 }
          agrupado[key].horas += reg.total_horas || 0
        })
        const data = Object.values(agrupado).sort((a, b) => b.horas - a.horas).slice(0, 8)
        setHorasPorTractor(data)
      }
    } catch (error) {
      console.error('Error fetching horas por tractor:', error)
    }
  }

  const fetchDistribucionLabores = async () => {
    try {
      const { inicio, fin } = obtenerRangoFechas()
      let query = supabase
        .from('detalle_actividades')
        .select(`
          labor_id,
          labores (nombre),
          registros_diarios!inner (fecha, tractor_id)
        `)
        .gte('registros_diarios.fecha', inicio)
        .lte('registros_diarios.fecha', fin)

      if (tractorSeleccionado !== 'todos') {
        query = query.eq('registros_diarios.tractor_id', parseInt(tractorSeleccionado))
      }

      const { data, error } = await query
      if (error) throw error

      const conteo = {}
      data?.forEach(det => {
        const laborNombre = det.labores?.nombre || 'Sin labor'
        conteo[laborNombre] = (conteo[laborNombre] || 0) + 1
      })
      const resultado = Object.entries(conteo).map(([name, value]) => ({ name, value }))
      setDistribucionLabores(resultado)
    } catch (error) {
      console.error('Error fetching distribución de labores:', error)
    }
  }

  const fetchAlertasMantenimiento = async () => {
    try {
      const { data: mantenimientos, error } = await supabase
        .from('mantenimiento_aceite')
        .select(`
          id,
          horometro_actual,
          ultimo_cambio,
          proximo_cambio,
          hrs_faltantes,
          estado,
          vehiculos (numero, nombre)
        `)
        .in('estado', ['Pendiente', 'Atrasado'])
        .order('hrs_faltantes', { ascending: true })
      if (error) throw error
      setAlertasMantenimiento(mantenimientos || [])
    } catch (error) {
      console.error('Error fetching alertas mantenimiento:', error)
    }
  }

  const fetchTractoresHorometro = async () => {
    try {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('numero, nombre, horometro_actual, estado')
        .order('numero')
      if (!error) setTractoresHorometro(data || [])
    } catch (error) {
      console.error('Error fetching tractores horometro:', error)
    }
  }

  // ======================
  // Efectos
  // ======================
  useEffect(() => {
    fetchTractoresList()
    fetchStatsBasicos()
    fetchProximosServicios()
    fetchAlertasMantenimiento()
    fetchTractoresHorometro()
  }, [])

  // Cuando cambia el período o el tractor seleccionado, actualizamos datos
  useEffect(() => {
    fetchHorasPorTractor()
    fetchTotalHorasPeriodo()
    fetchDistribucionLabores()
  }, [periodo, customStart, customEnd, tractorSeleccionado])

  // Mapeamos las alertas para el componente AlertCard
  const allAlerts = alertasMantenimiento.map(alert => ({
    tractor_numero: alert.vehiculos?.numero || '?',
    tipo_aceite: 'Motor',
    horas_faltantes: alert.hrs_faltantes,
    estado: alert.estado
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Tarjetas de estadísticas con iconos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Tractores Activos</h3>
          <div className="flex items-center gap-2 mt-1">
            <Tractor className="text-green-600" size={28} />
            <p className="text-3xl font-bold text-green-600">{stats.tractoresActivos}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">En Taller</h3>
          <div className="flex items-center gap-2 mt-1">
            <Wrench className="text-yellow-600" size={28} />
            <p className="text-3xl font-bold text-yellow-600">{stats.enTaller}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Mantenimientos Pendientes</h3>
          <div className="flex items-center gap-2 mt-1">
            <AlertTriangle className="text-red-600" size={28} />
            <p className="text-3xl font-bold text-red-600">{stats.mantenimientosPendientes}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Próximos Servicios</h3>
          <div className="flex items-center gap-2 mt-1">
            <CalendarCheck className="text-orange-600" size={28} />
            <p className="text-3xl font-bold text-orange-600">{stats.proximosServicios}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1">menos de 50 hrs</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Horas trabajadas</h3>
          <div className="flex items-center gap-2 mt-1">
            <Timer className="text-blue-600" size={28} />
            <p className="text-3xl font-bold text-blue-600">{stats.horasPeriodo.toFixed(1)}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1">{getPeriodoTexto()}</p>
        </div>
      </div>

      {/* Filtros: Tractor + Rango de fechas */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tractor</label>
            <select
              value={tractorSeleccionado}
              onChange={(e) => setTractorSeleccionado(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="todos">Todos los tractores</option>
              {tractoresList.map(t => (
                <option key={t.id} value={t.id}>T{t.numero} - {t.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button onClick={() => setPeriodo('mes')} className={`px-3 py-1 text-sm rounded transition ${periodo === 'mes' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Mes</button>
              <button onClick={() => setPeriodo('semana')} className={`px-3 py-1 text-sm rounded transition ${periodo === 'semana' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Semana</button>
              <button onClick={() => setPeriodo('dia')} className={`px-3 py-1 text-sm rounded transition ${periodo === 'dia' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Día</button>
            </div>
            <div className="flex gap-1 items-center">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border rounded p-1 text-sm" />
              <span className="text-xs">a</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border rounded p-1 text-sm" />
              <button onClick={aplicarCustomRange} className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                <Calendar size={14} /> Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de barras: Horas por tractor */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            Horas trabajadas por tractor ({getPeriodoTexto()})
            {tractorSeleccionado !== 'todos' && ` - Tractor filtrado`}
          </h2>
          {horasPorTractor.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={horasPorTractor} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis dataKey="nombre" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="horas" fill="#3b82f6">
                  <LabelList
                    dataKey="horas"
                    fill='#fff'
                    position="center"
                    formatter={(value) => value.toFixed(1)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos en el período seleccionado</p>
          )}
        </div>

        {/* Gráfico de dona: Distribución de labores */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            Distribución de Labores ({getPeriodoTexto()})
            {tractorSeleccionado !== 'todos' && ` - Tractor filtrado`}
          </h2>
          {distribucionLabores.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribucionLabores}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={true}
                >
                  {distribucionLabores.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos de labores en el período seleccionado</p>
          )}
        </div>
      </div>

      {/* Horómetro actual de tractores */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Tractor className="text-blue-500" size={24} />
          <h3 className="text-lg font-semibold">Horómetro Actual de Tractores</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tractoresHorometro.map(tractor => (
            <div key={tractor.numero} className="border rounded-lg p-3 bg-gray-50 hover:shadow transition">
              <div className="font-semibold text-gray-800">
                Tractor {tractor.numero} {tractor.nombre && `- ${tractor.nombre}`}
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {tractor.horometro_actual?.toFixed(1) || 0} hrs
              </div>
              <div className="text-xs text-gray-500 mt-1">{tractor.estado}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas de Mantenimiento estilo tarjetas */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            Alertas de Mantenimiento
          </h3>
          <span className="text-sm text-gray-500">{allAlerts.length} registros</span>
        </div>
        {allAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAlerts.map((alert, i) => (
              <AlertCard
                key={i}
                tractor={alert.tractor_numero}
                tipo={`Aceite de ${alert.tipo_aceite}`}
                horasFaltantes={alert.horas_faltantes}
                estado={alert.estado}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            Todos los mantenimientos están al día
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
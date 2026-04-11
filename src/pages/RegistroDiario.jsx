import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useForm, useFieldArray } from 'react-hook-form'
import { FileSpreadsheet, FileJson, FileText, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const RegistroDiario = () => {
  const [unidadesDestino, setUnidadesDestino] = useState([])
  const [operadores, setOperadores] = useState([])
  const [labores, setLabores] = useState([])
  const [fincas, setFincas] = useState([])
  const [implementos, setImplementos] = useState([])
  const [todosLosLotes, setTodosLosLotes] = useState({})
  const [cargandoLotes, setCargandoLotes] = useState({})
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)

  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])
  const [unidadDestinoFiltro, setUnidadDestinoFiltro] = useState('todos')

  const { register, control, handleSubmit, reset, watch, getValues, setValue } = useForm({
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      unidaddestino_id: '',
      operador_id: '',
      horometro_inicial: '',
      horometro_final: '',
      litros_diesel: '',
      responsable_mecanizacion: '',
      observaciones: '',
      detalles: [{ implemento_id: '', labor_id: '', finca_id: '', lotes_ids: [], areamz: '' }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'detalles' })

  useEffect(() => {
    const fetchCatalogos = async () => {
      const [trac, ops, labs, fins, impl] = await Promise.all([
        supabase.from('unidaddestino').select('id,numero,nombre'),
        supabase.from('operadores').select('id,nombre,apellido'),
        supabase.from('labores').select('id,nombre'),
        supabase.from('fincas').select('id,nombre'),
        supabase.from('implementos').select('id,nombre')
      ])
      setUnidadesDestino(trac.data || [])
      setOperadores(ops.data || [])
      setLabores(labs.data || [])
      setFincas(fins.data || [])
      setImplementos(impl.data || [])
    }
    fetchCatalogos()
    cargarRegistros()
  }, [])

  useEffect(() => {
    cargarRegistros()
  }, [fechaInicio, fechaFin, unidadDestinoFiltro])

  const cargarLotesDeFinca = async (fincaId) => {
    if (!fincaId) return
    if (todosLosLotes[fincaId]) return
    setCargandoLotes(prev => ({ ...prev, [fincaId]: true }))
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, numero, area_mz')
        .eq('finca_id', fincaId)
        .order('numero')
      if (error) throw error
      setTodosLosLotes(prev => ({ ...prev, [fincaId]: data || [] }))
    } catch (error) {
      console.error('Error cargando lotes:', error)
      toast.error('Error al cargar los lotes')
    } finally {
      setCargandoLotes(prev => ({ ...prev, [fincaId]: false }))
    }
  }

  const actualizarAreaTotal = (index) => {
    const lotesIds = getValues(`detalles.${index}.lotes_ids`) || []
    const fincaId = getValues(`detalles.${index}.finca_id`)
    if (!fincaId) {
      setValue(`detalles.${index}.areamz`, '')
      return
    }
    const lotesDisponibles = todosLosLotes[fincaId] || []
    let totalArea = 0
    lotesIds.forEach(loteId => {
      const lote = lotesDisponibles.find(l => l.id === loteId)
      if (lote && lote.area_mz) totalArea += lote.area_mz
    })
    setValue(`detalles.${index}.areamz`, totalArea.toFixed(2))
  }

  const handleFincaChange = async (index, fincaId) => {
    setValue(`detalles.${index}.finca_id`, fincaId)
    setValue(`detalles.${index}.lotes_ids`, [])
    setValue(`detalles.${index}.areamz`, '')
    if (fincaId) {
      await cargarLotesDeFinca(fincaId)
    }
  }

  const handleLoteToggle = (index, loteId, isChecked) => {
    const currentLotes = getValues(`detalles.${index}.lotes_ids`) || []
    let newLotes
    if (isChecked) {
      newLotes = [...currentLotes, loteId]
    } else {
      newLotes = currentLotes.filter(id => id !== loteId)
    }
    setValue(`detalles.${index}.lotes_ids`, newLotes)
    actualizarAreaTotal(index)
  }

  const seleccionarTodosLotes = (index) => {
    const fincaId = getValues(`detalles.${index}.finca_id`)
    if (!fincaId) return
    const lotes = todosLosLotes[fincaId] || []
    const todosIds = lotes.map(l => l.id)
    setValue(`detalles.${index}.lotes_ids`, todosIds)
    actualizarAreaTotal(index)
  }

  const deseleccionarTodosLotes = (index) => {
    setValue(`detalles.${index}.lotes_ids`, [])
    actualizarAreaTotal(index)
  }

  const isAllSelected = (index) => {
    const fincaId = getValues(`detalles.${index}.finca_id`)
    if (!fincaId) return false
    const lotesDisponibles = todosLosLotes[fincaId] || []
    if (lotesDisponibles.length === 0) return false
    const lotesSeleccionados = getValues(`detalles.${index}.lotes_ids`) || []
    return lotesSeleccionados.length === lotesDisponibles.length
  }

  const isLoteSelected = (index, loteId) => {
    const lotes = watch(`detalles.${index}.lotes_ids`) || []
    return lotes.includes(loteId)
  }

  const getLotesDisponibles = (fincaId) => todosLosLotes[fincaId] || []

  const cargarRegistros = async () => {
    setCargando(true)
    try {
      let query = supabase
        .from('registros_diarios')
        .select(`
          id, fecha, unidaddestino_id, horometro_inicial, horometro_final, total_horas,
          litros_diesel, responsable_mecanizacion, observaciones,
          unidaddestino (numero, nombre),
          operadores (nombre, apellido),
          detalle_actividades (
            id, implemento_id, implementos (nombre),
            labor_id, labores (nombre),
            finca_id, fincas (nombre),
            areamz,
            detalle_actividad_lotes (lote_id, lotes (numero, area_mz))
          )
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false })

      if (unidadDestinoFiltro !== 'todos') {
        query = query.eq('unidaddestino_id', unidadDestinoFiltro)
      }

      const { data, error } = await query
      if (error) throw error
      setRegistros(data || [])
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar registros')
    } finally {
      setCargando(false)
    }
  }

  const aplanarRegistros = () => {
    const filas = []
    registros.forEach(reg => {
      reg.detalle_actividades?.forEach(det => {
        const lotes = det.detalle_actividad_lotes || []
        const baseRow = {
          Fecha: reg.fecha,
          UnidadDestino: `T${reg.unidaddestino?.numero || ''} ${reg.unidaddestino?.nombre || ''}`,
          'INV. EQUIPO': det.implementos?.nombre || '',
          'Horometro Inicial': reg.horometro_inicial,
          'Horometro Final': reg.horometro_final,
          Horas: reg.total_horas,
          Labor: det.labores?.nombre || '',
          Zona: det.fincas?.nombre || '',
          'Área Mz': det.areamz,
          Operador: `${reg.operadores?.nombre || ''} ${reg.operadores?.apellido || ''}`,
          'Responsable Mecanización': reg.responsable_mecanizacion || ''
        }
        if (lotes.length === 0) {
          filas.push({ ...baseRow, Lotes: '' })
        } else {
          lotes.forEach(lote => {
            filas.push({ ...baseRow, Lotes: lote.lotes?.numero || '' })
          })
        }
      })
    })
    return filas
  }

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(aplanarRegistros())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Labores')
    XLSX.writeFile(wb, `labores_${fechaInicio}.xlsx`)
    toast.success('Exportado a Excel')
  }

  const exportarCSV = () => {
    const datos = aplanarRegistros()
    const ws = XLSX.utils.json_to_sheet(datos)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `labores_${fechaInicio}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exportado a CSV')
  }

  const exportarPDF = () => {
    const datos = aplanarRegistros()
    const doc = new jsPDF('landscape', 'mm', 'a4')
    doc.setFontSize(16)
    doc.text('Registro de Labores', 14, 15)
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
    doc.save(`labores_${fechaInicio}.pdf`)
    toast.success('Exportado a PDF')
  }

  const handleRemove = (index) => {
    if (fields.length > 1) {
      remove(index)
    } else {
      toast.error('Debe haber al menos una actividad')
    }
  }

  const onSubmit = async (data) => {
    const hIni = parseFloat(data.horometro_inicial)
    const hFin = parseFloat(data.horometro_final)
    if (hFin <= hIni) {
      return toast.error(`El horómetro final (${hFin}) debe ser mayor al inicial (${hIni})`)
    }
    const detallesValidos = data.detalles.filter(d => d.labor_id)
    if (detallesValidos.length === 0) return toast.error('Agregue al menos una labor')

    const loadingToast = toast.loading('Guardando...')
    try {
      const { data: registro, error: err1 } = await supabase
        .from('registros_diarios')
        .insert([{
          fecha: data.fecha,
          unidaddestino_id: parseInt(data.unidaddestino_id),
          operador_id: parseInt(data.operador_id),
          horometro_inicial: hIni,
          horometro_final: hFin,
          litros_diesel: data.litros_diesel ? parseFloat(data.litros_diesel) : null,
          responsable_mecanizacion: data.responsable_mecanizacion || null,
          observaciones: data.observaciones || null
        }])
        .select()
      if (err1) throw err1
      const registroId = registro[0].id

      for (const det of detallesValidos) {
        const { data: detalle, error: errDet } = await supabase
          .from('detalle_actividades')
          .insert([{
            registro_id: registroId,
            implemento_id: det.implemento_id ? parseInt(det.implemento_id) : null,
            labor_id: parseInt(det.labor_id),
            finca_id: det.finca_id ? parseInt(det.finca_id) : null,
            areamz: det.areamz ? parseFloat(det.areamz) : null
          }])
          .select()
        if (errDet) throw errDet
        const detalleId = detalle[0].id

        if (det.lotes_ids?.length > 0) {
          const lotesToInsert = det.lotes_ids.map(loteId => ({
            detalle_actividad_id: detalleId,
            lote_id: parseInt(loteId)
          }))
          const { error: errLotes } = await supabase.from('detalle_actividad_lotes').insert(lotesToInsert)
          if (errLotes) throw errLotes
        }
      }
      toast.dismiss(loadingToast)
      toast.success('Guardado con éxito')
      reset()
      cargarRegistros()
    } catch (error) {
      toast.dismiss(loadingToast)
      console.error(error)
      toast.error('Error: ' + (error.message || 'No se pudo guardar'))
    }
  }

  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-bold">Registro Diario de Labores</h1>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">SINCLAIR IMPORT GROUP</h2>
          <p className="text-gray-600">RC-025 LABORES MECANIZADAS</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha</label>
              <input type="date" {...register('fecha')} className="mt-1 w-full border rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Unidad Destino</label>
              <select {...register('unidaddestino_id')} className="mt-1 w-full border rounded-md p-2" required>
                <option value="">Seleccionar</option>
                {unidadesDestino.map(t => <option key={t.id} value={t.id}>T{t.numero} - {t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Operador</label>
              <select {...register('operador_id')} className="mt-1 w-full border rounded-md p-2" required>
                <option value="">Seleccionar</option>
                {operadores.map(o => <option key={o.id} value={o.id}>{o.nombre} {o.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Horómetro Inicial</label>
              <input type="number" step="0.1" {...register('horometro_inicial')} className="mt-1 w-full border rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Horómetro Final</label>
              <input type="number" step="0.1" {...register('horometro_final')} className="mt-1 w-full border rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Litros Diesel</label>
              <input type="number" step="0.1" {...register('litros_diesel')} className="mt-1 w-full border rounded-md p-2" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Responsable Mecanización</label>
              <input {...register('responsable_mecanizacion')} className="mt-1 w-full border rounded-md p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Observaciones</label>
              <textarea {...register('observaciones')} rows={2} className="mt-1 w-full border rounded-md p-2" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">Detalle de Actividades</h3>
            <div className="space-y-3">
              {fields.map((field, index) => {
                const fincaId = watch(`detalles.${index}.finca_id`)
                return (
                  <div key={field.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500">INV. EQUIPO</label>
                        <select {...register(`detalles.${index}.implemento_id`)} className="w-full border rounded p-1 text-sm">
                          <option value="">--</option>
                          {implementos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Labor *</label>
                        <select {...register(`detalles.${index}.labor_id`)} className="w-full border rounded p-1 text-sm">
                          <option value="">Seleccionar</option>
                          {labores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Zona (Finca)</label>
                        <select
                          value={fincaId || ''}
                          onChange={(e) => handleFincaChange(index, e.target.value)}
                          className="w-full border rounded p-1 text-sm"
                        >
                          <option value="">Seleccionar</option>
                          {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Área (Mz)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`detalles.${index}.areamz`)}
                          readOnly
                          className="w-full border rounded p-1 text-sm bg-gray-100"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemove(index)}
                            className="text-red-500 text-sm font-medium hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                    {fincaId && (
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs text-gray-500">Lotes disponibles:</label>
                          <button
                            type="button"
                            onClick={() => {
                              if (isAllSelected(index)) {
                                deseleccionarTodosLotes(index)
                              } else {
                                seleccionarTodosLotes(index)
                              }
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {isAllSelected(index) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                          </button>
                        </div>
                        <div className="bg-white border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {getLotesDisponibles(fincaId).map(lote => (
                              <label key={lote.id} className="flex items-center gap-2 text-sm p-1.5 border rounded hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isLoteSelected(index, lote.id)}
                                  onChange={(e) => handleLoteToggle(index, lote.id, e.target.checked)}
                                  className="rounded text-blue-600"
                                />
                                <span>{lote.numero}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => append({ implemento_id: '', labor_id: '', finca_id: '', lotes_ids: [], areamz: '' })}
                className="text-blue-600 font-medium hover:underline"
              >
                + Agregar otra labor
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-md font-bold hover:bg-green-700 shadow-sm transition-colors">
              Guardar Registro
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-800">Registros Anteriores</h2>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={exportarCSV} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              <FileJson size={16} /> CSV
            </button>
            <button onClick={exportarPDF} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">
              <FileText size={16} /> PDF
            </button>
            <button onClick={cargarRegistros} className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
              <RefreshCw size={16} /> Actualizar
            </button>
          </div>
        </div>
        <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500">Fecha Inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border rounded p-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Fecha Fin</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border rounded p-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Unidad Destino</label>
            <select value={unidadDestinoFiltro} onChange={e => setUnidadDestinoFiltro(e.target.value)} className="w-full border rounded p-1.5 text-sm">
              <option value="todos">Todos</option>
              {unidadesDestino.map(t => <option key={t.id} value={t.id}>T{t.numero} - {t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {cargando ? (
            <p className="text-center py-8">Cargando...</p>
          ) : (
            <table className="min-w-[1200px] w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Unidad</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-4 py-3 text-left">Inicial</th>
                  <th className="px-4 py-3 text-left">Final</th>
                  <th className="px-4 py-3 text-left">Horas</th>
                  <th className="px-4 py-3 text-left">Labor</th>
                  <th className="px-4 py-3 text-left">Zona</th>
                  <th className="px-4 py-3 text-left">Lotes</th>
                  <th className="px-4 py-3 text-left">Mz</th>
                  <th className="px-4 py-3 text-left">Operador</th>
                  <th className="px-4 py-3 text-left">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {aplanarRegistros().map((fila, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{fila.Fecha}</td>
                    <td className="px-4 py-2">{fila.UnidadDestino}</td>
                    <td className="px-4 py-2">{fila['INV. EQUIPO']}</td>
                    <td className="px-4 py-2">{fila['Horometro Inicial']}</td>
                    <td className="px-4 py-2">{fila['Horometro Final']}</td>
                    <td className="px-4 py-2 font-bold">{fila.Horas}</td>
                    <td className="px-4 py-2">{fila.Labor}</td>
                    <td className="px-4 py-2">{fila.Zona}</td>
                    <td className="px-4 py-2">{fila.Lotes}</td>
                    <td className="px-4 py-2">{fila['Área Mz']}</td>
                    <td className="px-4 py-2">{fila.Operador}</td>
                    <td className="px-4 py-2">{fila['Responsable Mecanización']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default RegistroDiario
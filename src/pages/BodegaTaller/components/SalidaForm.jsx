import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const unidadesSugeridas = [
  'Unidades',
  'Litros',
  'Galones',
  'Kilogramos',
  'Metros',
  'Piezas',
  'Cajas',
  'Paquetes',
  'Rollos',
  'Pares'
]

const responsables = ['Omaydi', 'Dilver', 'Abby']

const SalidaForm = ({ onSuccess }) => {
  const [unidadesDestino, setUnidadesDestino] = useState([])
  const [cabecera, setCabecera] = useState({
    fecha: new Date().toISOString().split('T')[0],
    n_requisicion: '',
    unidaddestino_id: '',
    persona_responsable: '',
    proveedor: '',
    otroResponsable: ''
  })
  const [lineas, setLineas] = useState([
    { descripcion: '', codigo: '', cantidad: '', unidad_medida: '', observacion_motivo: '', costo_aplicado_a: '' }
  ])
  const [responsablePersonalizado, setResponsablePersonalizado] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchUnidades = async () => {
      // 🔁 Cambio: tabla 'unidaddestino'
      const { data } = await supabase.from('unidaddestino').select('id, numero, nombre').order('numero')
      if (data) setUnidadesDestino(data)
    }
    fetchUnidades()
  }, [])

  const addLinea = () => {
    setLineas([...lineas, { descripcion: '', codigo: '', cantidad: '', unidad_medida: '', observacion_motivo: '', costo_aplicado_a: '' }])
  }

  const removeLinea = (index) => {
    if (lineas.length === 1) {
      toast.error('Debe haber al menos una línea')
      return
    }
    setLineas(lineas.filter((_, i) => i !== index))
  }

  const updateLinea = (index, field, value) => {
    const nuevas = [...lineas]
    nuevas[index][field] = value
    setLineas(nuevas)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const lineasValidas = lineas.filter(l => l.descripcion.trim() && parseFloat(l.cantidad) > 0)
    if (lineasValidas.length === 0) {
      toast.error('Agregue al menos un repuesto con descripción y cantidad > 0')
      return
    }
    setLoading(true)

    const responsableFinal = cabecera.persona_responsable === 'Otro' ? cabecera.otroResponsable : cabecera.persona_responsable

    // Insertar cabecera con unidaddestino_id
    const { data: cab, error: errCab } = await supabase
      .from('salidas_bodega_cabecera')
      .insert([{
        fecha: cabecera.fecha,
        n_requisicion: cabecera.n_requisicion || null,
        unidaddestino_id: cabecera.unidaddestino_id ? parseInt(cabecera.unidaddestino_id) : null,
        persona_responsable: responsableFinal || null,
        proveedor: cabecera.proveedor || null
      }])
      .select()

    if (errCab) {
      toast.error(errCab.message)
      setLoading(false)
      return
    }

    const cabeceraId = cab[0].id

    const lineasInsert = lineasValidas.map((l, idx) => ({
      cabecera_id: cabeceraId,
      descripcion: l.descripcion,
      codigo: l.codigo || null,
      cantidad: parseFloat(l.cantidad),
      unidad_medida: l.unidad_medida || null,
      observacion_motivo: l.observacion_motivo || null,
      costo_aplicado_a: l.costo_aplicado_a || null,
      numero_linea: idx + 1
    }))

    const { error: errDet } = await supabase.from('salidas_bodega_detalle').insert(lineasInsert)
    if (errDet) {
      toast.error('Error al guardar líneas: ' + errDet.message)
      await supabase.from('salidas_bodega_cabecera').delete().eq('id', cabeceraId)
    } else {
      toast.success(`Registro guardado con ${lineasInsert.length} repuesto(s)`)
      setCabecera({
        fecha: new Date().toISOString().split('T')[0],
        n_requisicion: '',
        unidaddestino_id: '',
        persona_responsable: '',
        proveedor: '',
        otroResponsable: ''
      })
      setLineas([{ descripcion: '', codigo: '', cantidad: '', unidad_medida: '', observacion_motivo: '', costo_aplicado_a: '' }])
      setResponsablePersonalizado(false)
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-3">Nueva Salida de Bodega</h3>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm font-medium">Unidad Destino (equipo/vehículo)</label>
            <select value={cabecera.unidaddestino_id} onChange={e => setCabecera({...cabecera, unidaddestino_id: e.target.value})} className="mt-1 border p-2 rounded w-full">
              <option value="">Seleccionar unidad (opcional)</option>
              {unidadesDestino.map(u => <option key={u.id} value={u.id}>T{u.numero} {u.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Fecha *</label>
            <input type="date" required value={cabecera.fecha} onChange={e => setCabecera({...cabecera, fecha: e.target.value})} className="mt-1 border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">N° Requisición</label>
            <input type="text" placeholder="Ej: 7566" value={cabecera.n_requisicion} onChange={e => setCabecera({...cabecera, n_requisicion: e.target.value})} className="mt-1 border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Persona Responsable *</label>
            <select value={cabecera.persona_responsable} onChange={e => { setCabecera({...cabecera, persona_responsable: e.target.value}); setResponsablePersonalizado(e.target.value === 'Otro') }} className="mt-1 border p-2 rounded w-full" required>
              <option value="">Seleccionar responsable</option>
              {responsables.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Otro">Otro</option>
            </select>
            {responsablePersonalizado && (
              <input type="text" placeholder="Nombre del responsable" value={cabecera.otroResponsable} onChange={e => setCabecera({...cabecera, otroResponsable: e.target.value})} className="mt-2 border p-2 rounded w-full" required />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Proveedor (opcional)</label>
            <input type="text" placeholder="Nombre del proveedor" value={cabecera.proveedor} onChange={e => setCabecera({...cabecera, proveedor: e.target.value})} className="mt-1 border p-2 rounded w-full" />
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-semibold mb-2">Repuestos / Materiales</h4>
          {lineas.map((linea, idx) => (
            <div key={idx} className="border p-3 rounded mb-3 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs">Descripción *</label>
                  <input type="text" placeholder="Ej: Filtro de Aceite" value={linea.descripcion} onChange={e => updateLinea(idx, 'descripcion', e.target.value)} className="border p-2 rounded w-full" required />
                </div>
                <div>
                  <label className="block text-xs">Código</label>
                  <input type="text" placeholder="Ej: P550428" value={linea.codigo} onChange={e => updateLinea(idx, 'codigo', e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs">Cantidad *</label>
                  <input type="number" step="0.01" placeholder="0" value={linea.cantidad} onChange={e => updateLinea(idx, 'cantidad', e.target.value)} className="border p-2 rounded w-full" required />
                </div>
                <div>
                  <label className="block text-xs">Unidad</label>
                  <input list="unidadesList" placeholder="Seleccione o escriba" value={linea.unidad_medida} onChange={e => updateLinea(idx, 'unidad_medida', e.target.value)} className="border p-2 rounded w-full" />
                  <datalist id="unidadesList">
                    {unidadesSugeridas.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs">Observación / Motivo</label>
                  <input type="text" placeholder="para qué se usa" value={linea.observacion_motivo} onChange={e => updateLinea(idx, 'observacion_motivo', e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs">Costo aplicado a</label>
                  <input type="text" placeholder="Ej: Taller, Estación" value={linea.costo_aplicado_a} onChange={e => updateLinea(idx, 'costo_aplicado_a', e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => removeLinea(idx)} className="text-red-500 p-1"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addLinea} className="text-blue-600 text-sm flex items-center gap-1 mt-2"><Plus size={16} /> Agregar Línea</button>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar Salida'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SalidaForm
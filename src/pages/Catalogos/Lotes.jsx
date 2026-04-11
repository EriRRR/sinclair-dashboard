import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const Lotes = () => {
  const [items, setItems] = useState([])
  const [fincas, setFincas] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({ numero: '', finca_id: '', area_mz: '' })

  useEffect(() => {
    cargarFincas()
    cargarLotes()
  }, [])

  const cargarFincas = async () => {
    const { data, error } = await supabase.from('fincas').select('id, nombre').order('nombre')
    if (!error) setFincas(data || [])
  }

  const cargarLotes = async () => {
    const { data, error } = await supabase
      .from('lotes')
      .select('*, fincas(nombre)')
      .order('numero')
    if (error) toast.error(error.message)
    else setItems(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validar campos obligatorios
    if (!formData.numero || !formData.finca_id) {
      toast.error('Número de lote y finca son obligatorios')
      return
    }
    const dataToSend = {
      numero: formData.numero,
      finca_id: parseInt(formData.finca_id),
      area_mz: formData.area_mz ? parseFloat(formData.area_mz) : 0
    }
    if (editando) {
      const { error } = await supabase.from('lotes').update(dataToSend).eq('id', editando)
      if (error) toast.error(error.message)
      else toast.success('Lote actualizado')
    } else {
      const { error } = await supabase.from('lotes').insert([dataToSend])
      if (error) toast.error(error.message)
      else toast.success('Lote creado')
    }
    setModalOpen(false)
    setEditando(null)
    setFormData({ numero: '', finca_id: '', area_mz: '' })
    cargarLotes()
  }

  const eliminar = async (id) => {
    if (confirm('¿Eliminar lote?')) {
      const { error } = await supabase.from('lotes').delete().eq('id', id)
      if (error) toast.error(error.message)
      else toast.success('Eliminado')
      cargarLotes()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lotes</h1>
        <button onClick={() => { setEditando(null); setModalOpen(true) }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
          <Plus size={20} /> Nuevo Lote
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Número</th>
              <th className="px-6 py-3 text-left">Finca</th>
              <th className="px-6 py-3 text-left">Área (Mz)</th>
              <th className="px-6 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-6 py-4">{item.numero}</td>
                <td className="px-6 py-4">{item.fincas?.nombre}</td>
                <td className="px-6 py-4">{item.area_mz?.toFixed(2) || '0.00'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => { 
                    setEditando(item.id)
                    setFormData({ 
                      numero: item.numero, 
                      finca_id: item.finca_id.toString(), 
                      area_mz: item.area_mz || '' 
                    })
                    setModalOpen(true) 
                  }}><Edit size={18} className="text-blue-600" /></button>
                  <button onClick={() => eliminar(item.id)}><Trash2 size={18} className="text-red-600" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editando ? 'Editar' : 'Nuevo'} Lote</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Número de lote *"
                className="w-full border p-2 rounded"
                value={formData.numero}
                onChange={e => setFormData({ ...formData, numero: e.target.value })}
                required
              />
              <select
                className="w-full border p-2 rounded"
                value={formData.finca_id}
                onChange={e => setFormData({ ...formData, finca_id: e.target.value })}
                required
              >
                <option value="">Seleccionar finca</option>
                {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Área (Mz) - opcional"
                className="w-full border p-2 rounded"
                value={formData.area_mz}
                onChange={e => setFormData({ ...formData, area_mz: e.target.value })}
              />
              <div className="flex justify-end gap-2 pt-2">
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

export default Lotes
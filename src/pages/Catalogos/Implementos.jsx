import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const Implementos = () => {
  const [items, setItems] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({ nombre: '' })

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    const { data, error } = await supabase.from('implementos').select('*').order('nombre')
    if (error) toast.error(error.message)
    else setItems(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editando) {
      const { error } = await supabase.from('implementos').update(formData).eq('id', editando)
      if (error) toast.error(error.message)
      else toast.success('Implemento actualizado')
    } else {
      const { error } = await supabase.from('implementos').insert([formData])
      if (error) toast.error(error.message)
      else toast.success('Implemento creado')
    }
    setModalOpen(false)
    setEditando(null)
    setFormData({ nombre: '' })
    cargar()
  }

  const eliminar = async (id) => {
    if (confirm('¿Eliminar implemento?')) {
      const { error } = await supabase.from('implementos').delete().eq('id', id)
      if (error) toast.error(error.message)
      else toast.success('Eliminado')
      cargar()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Implementos</h1>
        <button onClick={() => { setEditando(null); setModalOpen(true) }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
          <Plus size={20} /> Nuevo Implemento
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr><th className="px-6 py-3 text-left">Nombre</th><th className="px-6 py-3 text-left">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-6 py-4">{item.nombre}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => { setEditando(item.id); setFormData(item); setModalOpen(true) }}><Edit size={18} className="text-blue-600" /></button>
                  <button onClick={() => eliminar(item.id)}><Trash2 size={18} className="text-red-600" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">{editando ? 'Editar' : 'Nuevo'} Implemento</h2>
            <form onSubmit={handleSubmit}>
              <input type="text" placeholder="Nombre" className="w-full border p-2 mb-4" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
              <div className="flex justify-end gap-2">
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

export default Implementos
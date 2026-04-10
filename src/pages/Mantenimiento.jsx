import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import AceiteForm from '../components/forms/MantenimientoAceiteForm'
import FiltrosForm from '../components/forms/MantenimientoFiltrosForm'
import OtrosForm from '../components/forms/MantenimientoOtrosForm'

const Mantenimiento = () => {
  const [tab, setTab] = useState('aceite')
  const [tractores, setTractores] = useState([])

  useEffect(() => {
    const fetchTractores = async () => {
      const { data } = await supabase.from('vehiculos').select('id,numero,nombre')
      setTractores(data || [])
    }
    fetchTractores()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Control de Mantenimiento</h1>
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('aceite')} className={`px-4 py-2 ${tab === 'aceite' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Cambios de Aceite</button>
        <button onClick={() => setTab('filtros')} className={`px-4 py-2 ${tab === 'filtros' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Filtros</button>
        <button onClick={() => setTab('otros')} className={`px-4 py-2 ${tab === 'otros' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Otros Mantenimientos</button>
      </div>

      {tab === 'aceite' && <AceiteForm tractores={tractores} />}
      {tab === 'filtros' && <FiltrosForm tractores={tractores} />}
      {tab === 'otros' && <OtrosForm tractores={tractores} />}
    </div>
  )
}

export default Mantenimiento
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import AceiteForm from '../components/forms/MantenimientoAceiteForm'
import FiltrosForm from '../components/forms/MantenimientoFiltrosForm'
import OtrosForm from '../components/forms/MantenimientoOtrosForm'

const Mantenimiento = () => {
  const [tab, setTab] = useState('aceite')
  const [unidades, setUnidades] = useState([])   // cambio de nombre

  useEffect(() => {
    const fetchUnidades = async () => {           // cambio de nombre
      const { data } = await supabase.from('unidaddestino').select('id,numero,nombre')
      setUnidades(data || [])
    }
    fetchUnidades()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Control de Mantenimiento</h1>
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('aceite')} className={`px-4 py-2 ${tab === 'aceite' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Cambios de Aceite</button>
        <button onClick={() => setTab('filtros')} className={`px-4 py-2 ${tab === 'filtros' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Filtros</button>
        <button onClick={() => setTab('otros')} className={`px-4 py-2 ${tab === 'otros' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>Otros Mantenimientos</button>
      </div>

      {tab === 'aceite' && <AceiteForm unidades={unidades} />}
      {tab === 'filtros' && <FiltrosForm unidades={unidades} />}
      {tab === 'otros' && <OtrosForm unidades={unidades} />}
    </div>
  )
}

export default Mantenimiento
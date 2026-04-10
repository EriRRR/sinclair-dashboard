import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const AceiteForm = ({ tractores }) => {
  const [registros, setRegistros] = useState([])
  const [form, setForm] = useState({
    tractor_id: '',
    horometro_actual: '',
    ultimo_cambio: '',
    proximo_cambio: ''
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    const { data, error } = await supabase
      .from('mantenimiento_aceite')
      .select('*, vehiculos(numero, nombre)')
      .order('id', { ascending: false })
    if (error) {
      console.error(error)
    } else {
      setRegistros(data || [])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.tractor_id || !form.horometro_actual || !form.ultimo_cambio || !form.proximo_cambio) {
      toast.error('Completa todos los campos')
      return
    }
    const hrsFaltantes = form.proximo_cambio - form.horometro_actual
    const estado = hrsFaltantes <= 0 ? 'Atrasado' : hrsFaltantes <= 50 ? 'Pendiente' : 'Al día'

    const { error } = await supabase.from('mantenimiento_aceite').insert([{
      tractor_id: form.tractor_id,
      horometro_actual: parseFloat(form.horometro_actual),
      ultimo_cambio: parseFloat(form.ultimo_cambio),
      proximo_cambio: parseFloat(form.proximo_cambio),
      hrs_faltantes: hrsFaltantes,
      estado,
      created_at: new Date()
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Registro de aceite guardado')
      setForm({ tractor_id: '', horometro_actual: '', ultimo_cambio: '', proximo_cambio: '' })
      cargar()
    }
  }

  const prepararDatos = () => {
    return registros.map(r => ({
      Tractor: `T${r.vehiculos?.numero} ${r.vehiculos?.nombre || ''}`,
      'Horómetro Actual': r.horometro_actual?.toFixed(1),
      'Último Cambio (hrs)': r.ultimo_cambio?.toFixed(1),
      'Próximo Cambio (hrs)': r.proximo_cambio?.toFixed(1),
      'Horas Faltantes': r.hrs_faltantes?.toFixed(1),
      Estado: r.estado,
      'Fecha Registro': new Date(r.created_at).toLocaleDateString()
    }))
  }

  const exportarExcel = () => {
    const datos = prepararDatos()
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cambios_Aceite')
    XLSX.writeFile(wb, `mantenimiento_aceite_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`)
    toast.success('Exportado a Excel')
  }

  const exportarCSV = () => {
    const datos = prepararDatos()
    const ws = XLSX.utils.json_to_sheet(datos)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `mantenimiento_aceite_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exportado a CSV')
  }

  const exportarPDF = () => {
    const datos = prepararDatos()
    const doc = new jsPDF('landscape', 'mm', 'a4')
    doc.setFontSize(16)
    doc.text('Registro de Cambios de Aceite', 14, 15)
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
    doc.save(`mantenimiento_aceite_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`)
    toast.success('Exportado a PDF')
  }

  return (
    <div>
      <div className="bg-white p-4 rounded shadow mb-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            required
            value={form.tractor_id}
            onChange={e => setForm({ ...form, tractor_id: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="">Seleccionar Tractor</option>
            {tractores.map(t => (
              <option key={t.id} value={t.id}>
                T{t.numero} - {t.nombre}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            placeholder="Horómetro actual (hrs)"
            required
            value={form.horometro_actual}
            onChange={e => setForm({ ...form, horometro_actual: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Último cambio (hrs)"
            required
            value={form.ultimo_cambio}
            onChange={e => setForm({ ...form, ultimo_cambio: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Próximo cambio (hrs)"
            required
            value={form.proximo_cambio}
            onChange={e => setForm({ ...form, proximo_cambio: e.target.value })}
            className="border p-2 rounded"
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded md:col-span-2">
            Registrar Cambio de Aceite
          </button>
        </form>
      </div>

      <div className="bg-white rounded shadow">
        <div className="flex flex-wrap justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Registros de Cambios de Aceite</h3>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={exportarCSV} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
              <FileJson size={16} /> CSV
            </button>
            <button onClick={exportarPDF} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm">
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Tractor</th>
                <th className="px-4 py-2 text-left">Horómetro</th>
                <th className="px-4 py-2 text-left">Último Cambio</th>
                <th className="px-4 py-2 text-left">Próximo</th>
                <th className="px-4 py-2 text-left">Faltan (hrs)</th>
                <th className="px-4 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">T{r.vehiculos?.numero} {r.vehiculos?.nombre}</td>
                  <td className="px-4 py-2">{r.horometro_actual?.toFixed(1)}</td>
                  <td className="px-4 py-2">{r.ultimo_cambio?.toFixed(1)}</td>
                  <td className="px-4 py-2">{r.proximo_cambio?.toFixed(1)}</td>
                  <td className="px-4 py-2">{r.hrs_faltantes?.toFixed(1)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${r.estado === 'Al día' ? 'bg-green-100 text-green-800' : ''}
                      ${r.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${r.estado === 'Atrasado' ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr><td colSpan="6" className="text-center py-4 text-gray-500">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AceiteForm
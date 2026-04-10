import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const OtrosForm = ({ tractores }) => {
  const [registros, setRegistros] = useState([])
  const [form, setForm] = useState({
    tractor_id: '',
    tipo_mantenimiento: '',
    descripcion: '',
    fecha_cambio: new Date().toISOString().split('T')[0],
    horometro: '',
    estado: 'Completado'
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    const { data, error } = await supabase
      .from('mantenimiento_otros')
      .select('*, vehiculos(numero, nombre)')
      .order('fecha_cambio', { ascending: false })
    if (error) console.error(error)
    else setRegistros(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.tractor_id || !form.tipo_mantenimiento || !form.fecha_cambio) {
      toast.error('Completa los campos obligatorios')
      return
    }

    const { error } = await supabase.from('mantenimiento_otros').insert([{
      tractor_id: form.tractor_id,
      tipo_mantenimiento: form.tipo_mantenimiento,
      descripcion: form.descripcion || null,
      fecha_cambio: form.fecha_cambio,
      horometro: form.horometro ? parseFloat(form.horometro) : null,
      estado: form.estado
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Registro de mantenimiento guardado')
      setForm({
        tractor_id: '',
        tipo_mantenimiento: '',
        descripcion: '',
        fecha_cambio: new Date().toISOString().split('T')[0],
        horometro: '',
        estado: 'Completado'
      })
      cargar()
    }
  }

  const prepararDatos = () => {
    return registros.map(r => ({
      Tractor: `T${r.vehiculos?.numero} ${r.vehiculos?.nombre || ''}`,
      'Tipo Mantenimiento': r.tipo_mantenimiento,
      Descripción: r.descripcion || '-',
      'Fecha Cambio': r.fecha_cambio,
      Horómetro: r.horometro?.toFixed(1) || '-',
      Estado: r.estado
    }))
  }

  const exportarExcel = () => {
    const datos = prepararDatos()
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Otros_Mantenimientos')
    XLSX.writeFile(wb, `mantenimiento_otros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`)
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
    link.setAttribute('download', `mantenimiento_otros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`)
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
    doc.text('Registro de Otros Mantenimientos', 14, 15)
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
    doc.save(`mantenimiento_otros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`)
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
            <option value="">Tractor</option>
            {tractores.map(t => (
              <option key={t.id} value={t.id}>T{t.numero} - {t.nombre}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tipo de mantenimiento (ej: Revisión general, Cambio de llantas)"
            required
            value={form.tipo_mantenimiento}
            onChange={e => setForm({ ...form, tipo_mantenimiento: e.target.value })}
            className="border p-2 rounded"
          />
          <textarea
            placeholder="Descripción detallada"
            value={form.descripcion}
            onChange={e => setForm({ ...form, descripcion: e.target.value })}
            className="border p-2 rounded md:col-span-2"
          />
          <input
            type="date"
            required
            value={form.fecha_cambio}
            onChange={e => setForm({ ...form, fecha_cambio: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horómetro"
            value={form.horometro}
            onChange={e => setForm({ ...form, horometro: e.target.value })}
            className="border p-2 rounded"
          />
          <select
            value={form.estado}
            onChange={e => setForm({ ...form, estado: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
          </select>
          <button type="submit" className="bg-blue-600 text-white p-2 rounded md:col-span-2">
            Registrar Mantenimiento
          </button>
        </form>
      </div>

      <div className="bg-white rounded shadow">
        <div className="flex flex-wrap justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Registros de Otros Mantenimientos</h3>
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
                <th className="px-4 py-2">Tractor</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Horómetro</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">T{r.vehiculos?.numero} {r.vehiculos?.nombre}</td>
                  <td className="px-4 py-2">{r.tipo_mantenimiento}</td>
                  <td className="px-4 py-2">{r.descripcion || '-'}</td>
                  <td className="px-4 py-2">{r.fecha_cambio}</td>
                  <td className="px-4 py-2">{r.horometro?.toFixed(1) || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${r.estado === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                    `}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && <tr><td colSpan="6" className="text-center py-4">Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default OtrosForm
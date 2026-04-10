import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const FiltrosForm = ({ tractores }) => {
  const [registros, setRegistros] = useState([])
  const [form, setForm] = useState({
    tractor_id: '',
    tipo_filtro: '',
    codigo_filtro: '',
    fecha_cambio: new Date().toISOString().split('T')[0],
    proximo_cambio: '',
    horometro: '',
    observaciones: ''
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    const { data, error } = await supabase
      .from('mantenimiento_filtros')
      .select('*, vehiculos(numero, nombre)')
      .order('fecha_cambio', { ascending: false })
    if (error) console.error(error)
    else setRegistros(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.tractor_id || !form.tipo_filtro || !form.fecha_cambio) {
      toast.error('Completa los campos obligatorios')
      return
    }

    const { error } = await supabase.from('mantenimiento_filtros').insert([{
      tractor_id: form.tractor_id,
      tipo_filtro: form.tipo_filtro,
      codigo_filtro: form.codigo_filtro || null,
      fecha_cambio: form.fecha_cambio,
      proximo_cambio: form.proximo_cambio ? parseFloat(form.proximo_cambio) : null,
      horometro: form.horometro ? parseFloat(form.horometro) : null,
      observaciones: form.observaciones || null
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Registro de filtro guardado')
      setForm({
        tractor_id: '',
        tipo_filtro: '',
        codigo_filtro: '',
        fecha_cambio: new Date().toISOString().split('T')[0],
        proximo_cambio: '',
        horometro: '',
        observaciones: ''
      })
      cargar()
    }
  }

  const prepararDatos = () => {
    return registros.map(r => ({
      Tractor: `T${r.vehiculos?.numero} ${r.vehiculos?.nombre || ''}`,
      'Tipo Filtro': r.tipo_filtro,
      'Código Filtro': r.codigo_filtro || '-',
      'Fecha Cambio': r.fecha_cambio,
      'Próximo Cambio (hrs)': r.proximo_cambio?.toFixed(1) || '-',
      'Horómetro': r.horometro?.toFixed(1) || '-',
      Observaciones: r.observaciones || '-'
    }))
  }

  const exportarExcel = () => {
    const datos = prepararDatos()
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cambio_Filtros')
    XLSX.writeFile(wb, `mantenimiento_filtros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`)
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
    link.setAttribute('download', `mantenimiento_filtros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`)
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
    doc.text('Registro de Cambio de Filtros', 14, 15)
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
    doc.save(`mantenimiento_filtros_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`)
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
            placeholder="Tipo de filtro (ej: Aceite, Combustible)"
            required
            value={form.tipo_filtro}
            onChange={e => setForm({ ...form, tipo_filtro: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Código del filtro"
            value={form.codigo_filtro}
            onChange={e => setForm({ ...form, codigo_filtro: e.target.value })}
            className="border p-2 rounded"
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
            placeholder="Próximo cambio (horas)"
            value={form.proximo_cambio}
            onChange={e => setForm({ ...form, proximo_cambio: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horómetro al cambio"
            value={form.horometro}
            onChange={e => setForm({ ...form, horometro: e.target.value })}
            className="border p-2 rounded"
          />
          <textarea
            placeholder="Observaciones"
            value={form.observaciones}
            onChange={e => setForm({ ...form, observaciones: e.target.value })}
            className="border p-2 rounded md:col-span-2"
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded md:col-span-2">
            Registrar Cambio de Filtro
          </button>
        </form>
      </div>

      <div className="bg-white rounded shadow">
        <div className="flex flex-wrap justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Registros de Cambio de Filtros</h3>
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
                <th className="px-4 py-2">Tipo Filtro</th>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Fecha Cambio</th>
                <th className="px-4 py-2">Próx. Cambio (hrs)</th>
                <th className="px-4 py-2">Horómetro</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">T{r.vehiculos?.numero} {r.vehiculos?.nombre}</td>
                  <td className="px-4 py-2">{r.tipo_filtro}</td>
                  <td className="px-4 py-2">{r.codigo_filtro || '-'}</td>
                  <td className="px-4 py-2">{r.fecha_cambio}</td>
                  <td className="px-4 py-2">{r.proximo_cambio?.toFixed(1) || '-'}</td>
                  <td className="px-4 py-2">{r.horometro?.toFixed(1) || '-'}</td>
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

export default FiltrosForm
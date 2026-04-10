import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const exportToExcel = (data, fileName) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Salidas')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

export const exportToCSV = (data, fileName) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.setAttribute('download', `${fileName}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportToPDF = (data, title) => {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  doc.setFontSize(16)
  doc.text(title, 14, 15)
  doc.setFontSize(10)
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22)

  const columns = Object.keys(data[0] || {})
  const rows = data.map(item => columns.map(col => item[col] || ''))

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 30,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    margin: { left: 10, right: 10 }
  })
  doc.save(`${title.replace(/\s/g, '_')}.pdf`)
}
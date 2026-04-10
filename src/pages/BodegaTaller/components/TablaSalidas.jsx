const TablaSalidas = ({ registros, loading }) => {
  if (loading) return <p className="text-center py-4">Cargando...</p>
  if (registros.length === 0) return <p className="text-center py-4 text-gray-500">No hay registros</p>

  const columnas = [
    'Nº', 'Descripción', 'Código', 'Cantidad', 'Unidad', 'Observación/Motivo',
    'Fecha', 'Nº Requisición', 'Responsable', 'Proveedor', 'Vehículo', 'Costo aplicado a'
  ]

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columnas.map(col => <th key={col} className="px-4 py-2 text-left">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {registros.map(reg => (
            <tr key={reg.id} className="border-t">
              <td className="px-4 py-2">{reg.numero}</td>
              <td className="px-4 py-2">{reg.descripcion}</td>
              <td className="px-4 py-2">{reg.codigo || 'Sin código'}</td>
              <td className="px-4 py-2">{reg.cantidad}</td>
              <td className="px-4 py-2">{reg.unidad_medida || '-'}</td>
              <td className="px-4 py-2">{reg.observacion_motivo || '-'}</td>
              <td className="px-4 py-2">{reg.fecha}</td>
              <td className="px-4 py-2">{reg.n_requisicion || '-'}</td>
              <td className="px-4 py-2">{reg.persona_responsable || '-'}</td>
              <td className="px-4 py-2">{reg.proveedor || '-'}</td>
              <td className="px-4 py-2">{reg.vehiculos ? `T${reg.vehiculos.numero} ${reg.vehiculos.nombre}` : '-'}</td>
              <td className="px-4 py-2">{reg.costo_aplicado_a || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TablaSalidas
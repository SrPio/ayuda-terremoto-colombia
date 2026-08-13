// ============================================================================
// Tipos del dominio.
//
// Espejo de supabase/migrations/0001_schema.sql. Se pueden regenerar con
//   npx supabase gen types typescript --linked > src/lib/database.types.ts
// pero se mantienen a mano porque son pocos y así el dominio queda legible
// para quien llega nuevo al proyecto.
// ============================================================================

export type Urgencia = 'baja' | 'media' | 'alta' | 'critica'
export type EstadoPunto = 'pending' | 'approved' | 'rejected' | 'inactive'
export type MotivoReporte =
  | 'cerrado'
  | 'info_incorrecta'
  | 'duplicado'
  | 'ya_no_necesita'
  | 'saturado'
  | 'otro'

export interface Departamento {
  code: string
  nombre: string
  region: string
  dane: string | null
  lat: number
  lng: number
  afectado: boolean
}

export interface Categoria {
  slug: string
  nombre: string
  emoji: string
  unidad_sugerida: string
  descripcion: string | null
  orden: number
}

export interface Necesidad {
  id: string
  point_id?: string
  category_slug: string
  cantidad_solicitada: number | null
  cantidad_cubierta: number
  unidad: string
  urgencia: Urgencia
  notas: string | null
  activa: boolean
}

export interface Punto {
  id: string
  slug: string
  nombre: string
  department_code: string
  ciudad: string
  direccion: string | null
  descripcion: string | null
  organizacion: string | null
  horario: string | null
  telefono: string | null
  whatsapp: string | null
  email: string | null
  lat: number | null
  lng: number | null
  /** 'exacta' = la coordenada es la puerta. 'ciudad' = es el centro del municipio. */
  precision_ubicacion: 'exacta' | 'ciudad'
  acepta_transporte_grande: boolean
  fuente_url: string | null
  status: EstadoPunto
  verificado: boolean
  created_at: string
  updated_at: string
  departments: { nombre: string; region?: string; afectado?: boolean } | null
  point_needs: Necesidad[]
}

/** Fila que devuelve la función match_needs. Es el resultado del asistente. */
export interface Coincidencia {
  need_id: string
  point_id: string
  point_slug: string
  punto: string
  organizacion: string | null
  ciudad: string
  departamento: string
  department_code: string
  direccion: string | null
  horario: string | null
  telefono: string | null
  whatsapp: string | null
  email: string | null
  lat: number | null
  lng: number | null
  categoria: string
  categoria_nombre: string
  emoji: string
  cantidad_solicitada: number | null
  cantidad_cubierta: number | null
  faltante: number | null
  unidad: string
  urgencia: Urgencia
  zona_afectada: boolean
  acepta_transporte_grande: boolean
  distancia_km: number | null
  cubre_completo: boolean | null
  actualizado: string
}

/** Fila que devuelve critical_needs, el manifiesto de la portada. */
export interface NecesidadCritica {
  need_id: string
  point_slug: string
  punto: string
  ciudad: string
  departamento: string
  categoria: string
  categoria_nombre: string
  emoji: string
  cantidad_solicitada: number | null
  cantidad_cubierta: number | null
  faltante: number | null
  unidad: string
  urgencia: Urgencia
  zona_afectada: boolean
  actualizado: string
}

export interface Estadisticas {
  puntos_activos: number
  departamentos_cubiertos: number
  necesidades_abiertas: number
  necesidades_criticas: number
  ultima_actualizacion: string | null
}

// --- Moderación ------------------------------------------------------------

export interface SolicitudCambio {
  id: string
  point_id: string
  tipo: 'edicion' | 'eliminacion'
  payload: Record<string, string | boolean>
  motivo: string
  submitter_nombre: string | null
  submitter_contacto: string | null
  created_at: string
  collection_points: { slug: string; nombre: string; ciudad: string } | null
}

export interface Reporte {
  id: string
  point_id: string
  motivo: MotivoReporte
  comentario: string | null
  submitter_contacto: string | null
  created_at: string
  collection_points: { slug: string; nombre: string; ciudad: string } | null
}

export interface Oferta {
  id: string
  category_slug: string
  cantidad: number
  unidad: string
  ciudad: string | null
  department_code: string | null
  transporte_disponible: boolean
  nombre_contacto: string | null
  telefono: string | null
  mensaje: string | null
  status: string
  created_at: string
  collection_points: { slug: string; nombre: string } | null
}

export interface PuntoModeracion extends Omit<Punto, 'departments'> {
  submitter_nombre: string | null
  submitter_contacto: string | null
  departments: { nombre: string } | null
}

export interface Colas {
  ok: true
  pendientes: PuntoModeracion[]
  solicitudes: SolicitudCambio[]
  reportes: Reporte[]
  ofertas: Oferta[]
  publicados: PuntoModeracion[]
  categorias: Categoria[]
  departamentos: Departamento[]
}

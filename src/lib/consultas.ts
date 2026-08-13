import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type {
  Categoria,
  Coincidencia,
  Departamento,
  Estadisticas,
  NecesidadCritica,
  Punto,
} from './tipos'

// ============================================================================
// Consultas de lectura.
//
// Los catálogos (departamentos, categorías) casi nunca cambian, así que viven
// mucho en caché. Los puntos y las necesidades sí cambian durante una
// emergencia: caché corta y suscripción en vivo.
// ============================================================================

const SELECCION_PUNTO = `
  id, slug, nombre, department_code, ciudad, direccion, descripcion, organizacion,
  horario, telefono, whatsapp, email, lat, lng, acepta_transporte_grande,
  fuente_url, status, verificado, created_at, updated_at,
  departments ( nombre, region, afectado ),
  point_needs ( id, category_slug, cantidad_solicitada, cantidad_cubierta, unidad, urgencia, notas, activa )
`

const UNA_HORA = 60 * 60 * 1000

export function useDepartamentos() {
  return useQuery({
    queryKey: ['departamentos'],
    staleTime: UNA_HORA,
    queryFn: async (): Promise<Departamento[]> => {
      const { data, error } = await supabase.from('departments').select('*').order('nombre')
      if (error) throw new Error(error.message)
      return data as Departamento[]
    },
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    staleTime: UNA_HORA,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase.from('need_categories').select('*').order('orden')
      if (error) throw new Error(error.message)
      return data as Categoria[]
    },
  })
}

export function usePuntos() {
  return useQuery({
    queryKey: ['puntos'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Punto[]> => {
      const { data, error } = await supabase
        .from('collection_points')
        .select(SELECCION_PUNTO)
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Punto[]
    },
  })
}

export function usePunto(slug: string | undefined) {
  return useQuery({
    queryKey: ['punto', slug],
    enabled: Boolean(slug),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Punto | null> => {
      const { data, error } = await supabase
        .from('collection_points')
        .select(SELECCION_PUNTO)
        .eq('slug', slug!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? null) as unknown as Punto | null
    },
  })
}

export function useEstadisticas() {
  return useQuery({
    queryKey: ['estadisticas'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Estadisticas> => {
      const { data, error } = await supabase.rpc('public_stats')
      if (error) throw new Error(error.message)
      return data as Estadisticas
    },
  })
}

export function useNecesidadesCriticas(limite = 6) {
  return useQuery({
    queryKey: ['necesidades-criticas', limite],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<NecesidadCritica[]> => {
      const { data, error } = await supabase.rpc('critical_needs', { p_limite: limite })
      if (error) throw new Error(error.message)
      return (data ?? []) as NecesidadCritica[]
    },
  })
}

export interface ParametrosMatch {
  categoria: string
  cantidad: number | null
  departamento: string | null
  lat: number | null
  lng: number | null
  transporte: boolean
}

/**
 * Emparejamiento. Se ejecuta solo cuando el asistente ya tiene lo necesario
 * (`habilitado`), no en cada tecla.
 */
export function useCoincidencias(parametros: ParametrosMatch | null, habilitado: boolean) {
  return useQuery({
    queryKey: ['coincidencias', parametros],
    enabled: habilitado && Boolean(parametros?.categoria),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Coincidencia[]> => {
      const { data, error } = await supabase.rpc('match_needs', {
        p_category: parametros!.categoria,
        p_cantidad: parametros!.cantidad,
        p_department_code: parametros!.departamento,
        p_lat: parametros!.lat,
        p_lng: parametros!.lng,
        p_transporte: parametros!.transporte,
        p_limite: 8,
      })
      if (error) throw new Error(error.message)
      return (data ?? []) as Coincidencia[]
    },
  })
}

/**
 * Suscripción en vivo a las necesidades.
 *
 * Cuando un moderador corrige una cantidad ("ya no faltan 80, faltan 20"), a
 * quien esté mirando la página se le actualiza sin recargar. En una emergencia
 * la diferencia entre un dato de hace un minuto y uno de hace una hora es que
 * alguien maneje 200 km al vacío.
 */
export function useActualizacionesEnVivo() {
  const cliente = useQueryClient()

  useEffect(() => {
    const canal = supabase
      .channel('cambios-acopio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_needs' }, () => {
        cliente.invalidateQueries({ queryKey: ['puntos'] })
        cliente.invalidateQueries({ queryKey: ['punto'] })
        cliente.invalidateQueries({ queryKey: ['necesidades-criticas'] })
        cliente.invalidateQueries({ queryKey: ['estadisticas'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_points' }, () => {
        cliente.invalidateQueries({ queryKey: ['puntos'] })
        cliente.invalidateQueries({ queryKey: ['estadisticas'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [cliente])
}

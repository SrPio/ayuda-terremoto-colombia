import { useEffect } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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
  horario, telefono, whatsapp, email, lat, lng, precision_ubicacion,
  acepta_transporte_grande, fuente_url, status, verificado, created_at, updated_at,
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

/** Una categoría concreta que la persona quiere donar, con su cantidad y unidad. */
export interface ItemBusquedaMatch {
  categoria: string
  cantidad: number | null
  unidad: string
}

/** Lo que no cambia entre categorías dentro de una misma búsqueda. */
export interface ContextoMatch {
  departamento: string | null
  lat: number | null
  lng: number | null
  transporte: boolean
}

/**
 * Emparejamiento para una o varias categorías a la vez.
 *
 * Se apoya en `useQueries` (no un `useQuery` por categoría llamado a mano
 * dentro de un `.map()`) porque la cantidad de categorías elegidas cambia
 * mientras la persona usa el asistente, y el número de hooks invocados no
 * puede variar entre renders. `useQueries` está pensado exactamente para
 * listas de tamaño variable como esta.
 *
 * `match_needs` sigue recibiendo una sola categoría por llamada: en vez de
 * tocar la función de la base de datos, se dispara una consulta por
 * categoría elegida y se combinan los resultados aquí. Cada necesidad ya
 * viene ordenada por urgencia y cercanía desde la función; al combinar varias
 * categorías se vuelve a ordenar con el mismo criterio para que la lista final
 * sea coherente de principio a fin.
 */
export function useCoincidenciasMultiples(
  items: ItemBusquedaMatch[],
  contexto: ContextoMatch,
  habilitado: boolean,
) {
  const resultados = useQueries({
    queries: items.map((item) => ({
      queryKey: ['coincidencias', item, contexto],
      enabled: habilitado && Boolean(item.categoria),
      staleTime: 30 * 1000,
      queryFn: async (): Promise<Coincidencia[]> => {
        const { data, error } = await supabase.rpc('match_needs', {
          p_category: item.categoria,
          p_cantidad: item.cantidad,
          p_department_code: contexto.departamento,
          p_lat: contexto.lat,
          p_lng: contexto.lng,
          p_transporte: contexto.transporte,
          p_limite: 8,
        })
        if (error) throw new Error(error.message)
        return (data ?? []) as Coincidencia[]
      },
    })),
  })

  return {
    coincidencias: resultados.flatMap((r) => r.data ?? []),
    isPending: habilitado && items.length > 0 && resultados.some((r) => r.isPending),
    isError: resultados.some((r) => r.isError),
  }
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

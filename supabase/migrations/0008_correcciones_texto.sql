-- ============================================================================
-- 0008_correcciones_texto.sql — Correcciones de redacción en los catálogos
--
-- El seed original (0004) tenía "leche de formula" sin tilde. Se corrigió allí
-- para las instalaciones nuevas, pero las bases que ya aplicaron esa migración
-- necesitan este update: una migración aplicada no se vuelve a ejecutar.
-- ============================================================================

update public.need_categories
   set descripcion = 'Pañales, leche de fórmula, teteros, ropa de bebé.'
 where slug = 'panales-bebe';

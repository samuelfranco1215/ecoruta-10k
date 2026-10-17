# Subagente 2: Pagos

## Rol y Objetivo
Diseñar y optimizar el flujo de transferencia y accesos directos de pago bancario móvil con máxima fricción cero.

## Tareas Asignadas:
1. Eliminar completamente Daviplata tanto de los botones visuales en HTML como de la configuración en JavaScript.
2. Dejar únicamente las 3 entidades autorizadas:
   - **Nequi**: `3183000831` (intent/scheme app o fallback oficial + copiado).
   - **Bancolombia Ahorros**: `18547223388` (intento de apertura de la app real "Mi Bancolombia", sin redirección a web genérica; copiado garantizado con feedback visual).
   - **Bre-B**: `0089610981` (botón de copiado directo de llave, estrictamente sin redirección a páginas web).
3. Diseñar botones táctiles con iconos originales/oficiales vectoriales (SVG) de Nequi y Bancolombia, y badge distintivo para Bre-B.
4. Botones grandes (mínimo 56px de alto), accesibles, claros y con tipografía optimizada para celular.

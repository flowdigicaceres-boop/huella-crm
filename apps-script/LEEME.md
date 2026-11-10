# Apps Script v2 – cómo instalarlo

1. Abre tu hoja de Google → **Extensiones → Apps Script**.
2. Haz una copia del código actual por si acaso (pégalo en un archivo de texto).
3. Sustituye todo el contenido de `Código.gs` por el de `Codigo.gs` de esta carpeta y guarda.
4. **Implementar → Administrar implementaciones →** lápiz de la implementación actual →
   **Versión: Nueva versión → Implementar**. Así la URL no cambia y no hay que tocar la app ni `bot.py`.
   (No crees una implementación nueva: daría una URL distinta.)
5. Abre la URL en el navegador: debe devolver `"success":true` y, ahora sí, una lista `visitas` con datos.

Haz este paso **antes** de instalar la versión nueva de la app: la app ya no da por guardada una visita
si el servidor no lo confirma, y el v2 evita duplicados si una visita se reenvía.

Nota: el `google-apps-script.js` de la raíz del proyecto es una versión antigua y no se ha tocado.
El código que debes pegar en tu hoja es `apps-script/Codigo.gs`.

## Pestaña WEB (capa de PON) — rutina diaria

La app agrupa por PON cruzando la descarga de la web con tu CRM. Para que funcione:

1. **Una sola vez:** en tu hoja de Google crea una pestaña llamada exactamente `WEB`.
2. **Cada día:** abre la descarga de la web (la hoja con las columnas `PROVINCIA … OBJETIVO_HORA`), selecciona todo
   (`Ctrl+A`), copia (`Ctrl+C`), ve a la pestaña `WEB`, borra su contenido y pega en la celda `A1`.
   Debe incluir la fila de cabeceras. Las columnas que necesita la app son `GESCAL26`, `ZONA-GPON`
   y `ESTADO-DE-PERMISO` (obligatorias) y `POBLACION`, `TIPO-VIA`, `NOMBRE-VIA`, `NUM`, `TOTALES`,
   `TIPO-DE-PERMISO`, `CLIENTES`, `FASE`, `DENSIDAD`, `AVANCE_FASE` y `OBJETIVO_HORA`.
3. En el móvil, pulsa sincronizar. Los PONs, el objetivo hora y lo que queda por gestionar se recalculan solos.

Si falta la pestaña o le faltan columnas, la app lo dice en pantalla y sigue usando la última descarga guardada.

Cuando registras la primera visita de un edificio que está en la web pero todavía no en tu CRM, el servidor lo da de
alta como una fila nueva en `EDIFICIOS` (con población, vía, número, PON, UUIs, tipo de permiso y clientes).

## Compatibilidad con `bot.py`

- Mismas claves: `success`, `edificios`, `visitas`.
- Campos que lee el bot: `Fecha`, `GESCAL`, `Comentario` (visitas) y `GESCAL26`, `COMENTARIO`, `ULTIMA-VISITA` (edificios).
- Las fechas ahora llegan como `dd/mm/yyyy`; `normalizar_fecha` del bot ya las entiende.
- Efecto visible: `visitas` deja de llegar vacía, así que el bot tomará el comentario de cada visita del día
  (en vez del comentario del edificio). Con la app actual ambos coinciden.

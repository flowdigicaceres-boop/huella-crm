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

## Compatibilidad con `bot.py`

- Mismas claves: `success`, `edificios`, `visitas`.
- Campos que lee el bot: `Fecha`, `GESCAL`, `Comentario` (visitas) y `GESCAL26`, `COMENTARIO`, `ULTIMA-VISITA` (edificios).
- Las fechas ahora llegan como `dd/mm/yyyy`; `normalizar_fecha` del bot ya las entiende.
- Efecto visible: `visitas` deja de llegar vacía, así que el bot tomará el comentario de cada visita del día
  (en vez del comentario del edificio). Con la app actual ambos coinciden.

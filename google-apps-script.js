// google-apps-script.js
// Pega este código en Extensiones -> Apps Script de tu Google Sheet.
// Luego despliégalo como "Aplicación web" con acceso para "Cualquiera" (Anyone).

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Obtener hoja de EDIFICIOS (la primera o por nombre)
    let sheetEdificios = ss.getSheetByName("EDIFICIOS") || ss.getSheets()[0];
    // Obtener hoja de VISITAS
    let sheetVisitas = ss.getSheetByName("VISITAS");
    if (!sheetVisitas) {
      sheetVisitas = ss.insertSheet("VISITAS");
      sheetVisitas.appendRow(["Fecha", "Hora", "GESCAL", "Resultado", "Comentario", "Próxima visita"]);
    }
    
    // Leer EDIFICIOS
    const dataEdificios = readSheetData(sheetEdificios);
    // Leer VISITAS
    const dataVisitas = readSheetData(sheetVisitas);
    
    const result = {
      success: true,
      edificios: dataEdificios,
      visitas: dataVisitas
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetEdificios = ss.getSheetByName("EDIFICIOS") || ss.getSheets()[0];
    let sheetVisitas = ss.getSheetByName("VISITAS");
    if (!sheetVisitas) {
      sheetVisitas = ss.insertSheet("VISITAS");
      sheetVisitas.appendRow(["Fecha", "Hora", "GESCAL", "Resultado", "Comentario", "Próxima visita"]);
    }
    
    // Obtener parámetros del POST
    let params;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter;
    }
    
    const { gescal, resultado, comentario, proximaVisita, fecha, hora } = params;
    
    if (!gescal || !resultado) {
      throw new Error("Faltan parámetros obligatorios: gescal y resultado");
    }
    
    // 1. Insertar fila en VISITAS
    sheetVisitas.appendRow([
      fecha || new Date().toLocaleDateString('es-ES'),
      hora || new Date().toLocaleTimeString('es-ES'),
      gescal,
      resultado,
      comentario || "",
      proximaVisita || ""
    ]);
    
    // 2. Actualizar EDIFICIOS
    const rows = sheetEdificios.getDataRange().getValues();
    const headers = rows[0];
    
    // Buscar o crear columnas adicionales en EDIFICIOS si no existen
    let estadoColIdx = headers.indexOf("ESTADO IC");
    let gescalColIdx = headers.indexOf("GESCAL26");
    let ultimaVisitaColIdx = headers.indexOf("ULTIMA-VISITA");
    let proximaVisitaColIdx = headers.indexOf("PROXIMA-VISITA");
    
    if (gescalColIdx === -1) {
      throw new Error("No se encontró la columna obligatoria 'GESCAL26' en la hoja de edificios.");
    }
    
    // Si no existen las columnas de última o próxima visita, las agregamos al final
    if (ultimaVisitaColIdx === -1) {
      sheetEdificios.insertColumnAfter(sheetEdificios.getLastColumn());
      sheetEdificios.getRange(1, sheetEdificios.getLastColumn()).setValue("ULTIMA-VISITA");
      ultimaVisitaColIdx = sheetEdificios.getLastColumn() - 1; // 0-indexed idx
      headers.push("ULTIMA-VISITA");
    }
    
    if (proximaVisitaColIdx === -1) {
      sheetEdificios.insertColumnAfter(sheetEdificios.getLastColumn());
      sheetEdificios.getRange(1, sheetEdificios.getLastColumn()).setValue("PROXIMA-VISITA");
      proximaVisitaColIdx = sheetEdificios.getLastColumn() - 1; // 0-indexed idx
      headers.push("PROXIMA-VISITA");
    }
    
    // Buscar la fila correspondiente
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      const rowGescal = String(rows[i][gescalColIdx]).trim();
      if (rowGescal === String(gescal).trim()) {
        const rowNum = i + 1; // 1-indexed para SpreadsheetApp
        
        // Actualizar Estado IC (si existe la columna)
        if (estadoColIdx !== -1) {
          sheetEdificios.getRange(rowNum, estadoColIdx + 1).setValue(resultado);
        }
        
        // Actualizar última visita
        sheetEdificios.getRange(rowNum, ultimaVisitaColIdx + 1).setValue(fecha || new Date().toLocaleDateString('es-ES'));
        
        // Actualizar próxima visita
        sheetEdificios.getRange(rowNum, proximaVisitaColIdx + 1).setValue(proximaVisita || "");
        
        found = true;
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      foundBuilding: found,
      message: "Visita registrada correctamente y edificio actualizado." 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Función auxiliar para leer datos de una hoja y convertirlos a un array de objetos
function readSheetData(sheet) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0].map(h => String(h).trim());
  const data = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        let val = row[j];
        // Formatear fechas si es necesario
        if (val instanceof Date) {
          val = val.toLocaleDateString('es-ES');
        }
        obj[headers[j]] = val;
        if (val !== "") hasData = true;
      }
    }
    if (hasData) {
      data.push(obj);
    }
  }
  return data;
}

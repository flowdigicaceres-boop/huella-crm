// Google Apps Script (Código.gs) - Huella CRM v2
//
// Compatible con bot.py: mismas claves JSON (success, edificios, visitas) y mismos
// nombres de campo (Fecha, GESCAL, Comentario / GESCAL26, COMENTARIO, ULTIMA-VISITA).
//
// Cambios respecto a la v1:
//  - VISITAS se lee por posición de columna (A:F), tenga o no fila de cabecera.
//  - Las fechas salen como texto dd/mm/yyyy y las horas como HH:mm (no como ISO en UTC).
//  - Un NOMBRE-VIA que Google Sheets convirtió en fecha ("8 DE SEPTIEMBRE") se devuelve como texto.
//  - doPost no duplica una visita reenviada (mismo GESCAL, fecha y hora) y confirma el guardado.
//  - Solo CONCEDIDO / DENEGADO / EN GESTION cambian el ESTADO IC del edificio.

var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO',
             'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
var VISITAS_KEYS = ['Fecha', 'Hora', 'GESCAL', 'Resultado', 'Comentario', 'Próxima visita'];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmtFecha_(d, tz) {
  return Utilities.formatDate(d, tz, 'dd/MM/yyyy');
}

// "2026-09-08" (medianoche local) -> "8 DE SEPTIEMBRE"
function fechaComoNombreVia_(d, tz) {
  var dia = parseInt(Utilities.formatDate(d, tz, 'd'), 10);
  var mes = parseInt(Utilities.formatDate(d, tz, 'M'), 10);
  return dia + ' DE ' + MESES[mes - 1];
}

function hm_(s) {
  var m = String(s).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) + ':' + m[2] : String(s).trim();
}

function normalizarEstado_(r) {
  var s = String(r || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  if (s === 'CONCEDIDO') return 'CONCEDIDO';
  if (s === 'DENEGADO') return 'DENEGADO';
  if (s === 'EN GESTION') return 'EN GESTION';
  return '';
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    var sheetEdificios = ss.getSheetByName('EDIFICIOS') || ss.getSheets()[0];
    var sheetVisitas = ss.getSheetByName('VISITAS') || ss.getSheets()[1];

    // 1. EDIFICIOS: la fila 1 son las cabeceras
    var edificiosData = [];
    var lastRowE = sheetEdificios.getLastRow();
    var lastColE = sheetEdificios.getLastColumn();
    if (lastRowE > 1) {
      var rangeE = sheetEdificios.getRange(1, 1, lastRowE, lastColE).getValues();
      var headersE = rangeE[0];
      for (var i = 1; i < rangeE.length; i++) {
        var row = rangeE[i];
        var obj = {};
        var hasData = false;
        for (var j = 0; j < headersE.length; j++) {
          var key = String(headersE[j]).trim();
          if (!key) continue;
          var val = row[j];
          if (val instanceof Date) {
            val = (key === 'NOMBRE-VIA') ? fechaComoNombreVia_(val, tz) : fmtFecha_(val, tz);
          }
          obj[key] = val;
          if (val !== '') hasData = true;
        }
        if (hasData && (obj['GESCAL26'] || obj['GESCAL'])) {
          edificiosData.push(obj);
        }
      }
    }

    // 2. VISITAS: columnas A:F por posición (Fecha, Hora, GESCAL, Resultado, Comentario, Próxima visita)
    var visitasData = [];
    if (sheetVisitas) {
      var lastRowV = sheetVisitas.getLastRow();
      if (lastRowV >= 1) {
        var rangeV = sheetVisitas.getRange(1, 1, lastRowV, 6);
        var valuesV = rangeV.getValues();
        var displayV = rangeV.getDisplayValues();
        for (var k = 0; k < valuesV.length; k++) {
          var gescal = String(valuesV[k][2]).trim();
          if (!gescal || gescal.toUpperCase() === 'GESCAL') continue;   // salta cabecera o filas vacías
          var vObj = {};
          for (var m = 0; m < VISITAS_KEYS.length; m++) {
            var v = valuesV[k][m];
            if (m === 0 && v instanceof Date) v = fmtFecha_(v, tz);
            else if (m === 1 && v instanceof Date) v = displayV[k][1];
            else if (m === 5 && v instanceof Date) v = fmtFecha_(v, tz);
            vObj[VISITAS_KEYS[m]] = v;
          }
          visitasData.push(vObj);
        }
      }
    }

    return json_({ success: true, edificios: edificiosData, visitas: visitasData });
  } catch (err) {
    return json_({ success: false, error: err.message });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    var sheetVisitas = ss.getSheetByName('VISITAS') || ss.getSheets()[1];
    var sheetEdificios = ss.getSheetByName('EDIFICIOS') || ss.getSheets()[0];

    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var gescal = String(data.gescal || data.GESCAL || data.GESCAL26 || '').trim();
    if (!gescal) return json_({ success: false, error: 'Falta el GESCAL' });

    var resultado = data.resultado || data.Resultado || '';
    var comentario = data.comentario || data.Comentario || data.COMENTARIO || '';
    var proximaVisita = data.proximaVisita || data['Próxima visita'] || '';
    var fecha = data.fecha || data.Fecha || fmtFecha_(new Date(), tz);
    var hora = data.hora || data.Hora || Utilities.formatDate(new Date(), tz, 'HH:mm');
    var estado = normalizarEstado_(resultado);

    // 1. VISITAS: añadir la fila salvo que ya exista (mismo GESCAL, fecha y hora)
    var duplicada = false;
    if (sheetVisitas) {
      var lastRowV = sheetVisitas.getLastRow();
      if (lastRowV >= 1) {
        var desde = Math.max(1, lastRowV - 49);
        var rng = sheetVisitas.getRange(desde, 1, lastRowV - desde + 1, 3);
        var vals = rng.getValues();
        var disp = rng.getDisplayValues();
        for (var r = 0; r < vals.length; r++) {
          var f = vals[r][0] instanceof Date ? fmtFecha_(vals[r][0], tz) : String(vals[r][0]).trim();
          if (String(vals[r][2]).trim() === gescal && f === String(fecha).trim() && hm_(disp[r][1]) === hm_(hora)) {
            duplicada = true;
            break;
          }
        }
      }
      if (!duplicada) {
        sheetVisitas.appendRow([fecha, hora, gescal, estado || resultado, comentario, proximaVisita]);
      }
    }

    // 2. EDIFICIOS: ESTADO IC (solo si es uno de los tres estados), ULTIMA-VISITA y COMENTARIO
    if (sheetEdificios) {
      var lastRowE = sheetEdificios.getLastRow();
      var lastColE = sheetEdificios.getLastColumn();
      var headers = sheetEdificios.getRange(1, 1, 1, lastColE).getValues()[0];
      var gescalCol = -1, estadoCol = -1, ultimaCol = -1, proximaCol = -1, comentarioCol = -1;
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toUpperCase().trim();
        if (h === 'GESCAL26' || h === 'GESCAL') gescalCol = c + 1;
        if (h === 'ESTADO IC') estadoCol = c + 1;
        if (h === 'ULTIMA-VISITA') ultimaCol = c + 1;
        if (h === 'PROXIMA-VISITA') proximaCol = c + 1;
        if (h === 'COMENTARIO') comentarioCol = c + 1;
      }
      if (gescalCol > 0 && lastRowE > 1) {
        var gescales = sheetEdificios.getRange(2, gescalCol, lastRowE - 1, 1).getValues();
        for (var i = 0; i < gescales.length; i++) {
          if (String(gescales[i][0]).trim() === gescal) {
            var rowNum = i + 2;
            if (estadoCol > 0 && estado) sheetEdificios.getRange(rowNum, estadoCol).setValue(estado);
            if (ultimaCol > 0) sheetEdificios.getRange(rowNum, ultimaCol).setValue(fecha);
            if (proximaCol > 0) sheetEdificios.getRange(rowNum, proximaCol).setValue(proximaVisita);
            if (comentarioCol > 0 && comentario) sheetEdificios.getRange(rowNum, comentarioCol).setValue(comentario);
            break;
          }
        }
      }
    }

    return json_({ success: true, duplicada: duplicada });
  } catch (err) {
    return json_({ success: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

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

// ---------------------------------------------------------------------------
// Pestaña WEB: la descarga diaria de la web (DESCARGA_PROYECTOS) pegada tal cual,
// con su fila de cabeceras. Se devuelve solo lo que la app necesita:
//  - filas: edificios cuyo ESTADO-DE-PERMISO no es CONCEDIDO
//  - pons: un resumen por ZONA-GPON con TODOS los edificios (total y concedidos)
// ---------------------------------------------------------------------------
var WEB_CAMPOS = ['GESCAL26', 'POBLACION', 'TIPO-VIA', 'NOMBRE-VIA', 'NUM', 'ZONA-GPON', 'TOTALES',
                  'TIPO-DE-PERMISO', 'ESTADO-DE-PERMISO', 'CLIENTES', 'FASE', 'DENSIDAD',
                  'AVANCE_FASE', 'OBJETIVO_HORA',
                  // Columnas añadidas a la descarga en noviembre de 2026
                  'FECHA-CONTACTADO', 'ESTADO_FECHA', 'TIPO-BLOQUEO', 'FECHA-ENTREGA-LLAVES', 'ESTADO_LLAVES'];

// Un GESCAL real: muchos dígitos seguidos de guiones o letras ("10000390004900002---------").
// Sirve para detectar datos pegados con las columnas desplazadas (p. ej. una población en lugar del GESCAL).
var GESCAL_RE = /^\d{12,}[-A-Za-z0-9]*$/;

function valorWeb_(v, campo, tz) {
  if (v instanceof Date) return campo === 'NOMBRE-VIA' ? fechaComoNombreVia_(v, tz) : fmtFecha_(v, tz);
  return v;
}

function leerWeb_(ss, tz) {
  var sh = ss.getSheetByName('WEB');
  if (!sh) return { web: null, error: 'No existe la pestaña WEB' };
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { web: null, error: 'La pestaña WEB está vacía' };

  var vals = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
  var idx = {};
  for (var c = 0; c < vals[0].length; c++) {
    var h = String(vals[0][c]).trim().toUpperCase();
    if (h === 'GESCAL') h = 'GESCAL26';
    if (h) idx[h] = c;
  }
  var faltan = ['GESCAL26', 'ZONA-GPON', 'ESTADO-DE-PERMISO'].filter(function (k) { return idx[k] === undefined; });
  if (faltan.length) return { web: null, error: 'Faltan columnas en WEB: ' + faltan.join(', ') };

  var filas = [];
  var pons = {};
  var vistos = {};
  var total = 0;
  var sinGescal = 0;
  var repetidas = 0;
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    var gescal = String(row[idx['GESCAL26']]).trim();
    if (!gescal && !String(row.join('')).trim()) continue;       // fila completamente vacía
    total++;
    if (!GESCAL_RE.test(gescal)) { sinGescal++; continue; }       // columnas desplazadas o fila rara
    if (vistos[gescal]) { repetidas++; continue; }                 // el mismo GESCAL dos veces: se usa el primero
    vistos[gescal] = true;
    var pon = String(row[idx['ZONA-GPON']] || '').trim();
    var estado = String(row[idx['ESTADO-DE-PERMISO']] || '').trim();
    var p = pons[pon];
    if (!p) {
      p = pons[pon] = {
        pon: pon,
        poblacion: idx['POBLACION'] !== undefined ? row[idx['POBLACION']] : '',
        densidad: idx['DENSIDAD'] !== undefined ? row[idx['DENSIDAD']] : '',
        fase: idx['FASE'] !== undefined ? row[idx['FASE']] : '',
        avance: idx['AVANCE_FASE'] !== undefined ? row[idx['AVANCE_FASE']] : '',
        objetivo: idx['OBJETIVO_HORA'] !== undefined ? row[idx['OBJETIVO_HORA']] : '',
        total: 0,
        concedidos: 0
      };
    }
    p.total++;
    if (estado.toUpperCase() === 'CONCEDIDO') { p.concedidos++; continue; }

    var obj = {};
    for (var k = 0; k < WEB_CAMPOS.length; k++) {
      var campo = WEB_CAMPOS[k];
      if (idx[campo] !== undefined) obj[campo] = valorWeb_(row[idx[campo]], campo, tz);
    }
    filas.push(obj);
  }

  // Si casi ninguna fila trae un GESCAL, los datos están mal pegados: no se manda nada (la app conserva la última descarga buena)
  if (total > 0 && sinGescal > total * 0.2) {
    return {
      web: null,
      error: 'La pestaña WEB tiene mal las columnas: ' + sinGescal + ' de ' + total + ' filas no traen un GESCAL en la columna GESCAL26. ' +
             'Borra el contenido de WEB y pega de nuevo la descarga entera, con su fila de cabeceras, desde la celda A1.'
    };
  }

  var avisos = [];
  if (sinGescal > 0) avisos.push('Se han ignorado ' + sinGescal + ' filas de WEB sin un GESCAL válido.');
  if (repetidas > 0) avisos.push('Se han ignorado ' + repetidas + ' filas de WEB con un GESCAL repetido.');

  var lista = [];
  for (var nombre in pons) lista.push(pons[nombre]);
  return { web: { filas: filas, pons: lista }, error: avisos.join(' ') };
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

    // 3. WEB: un fallo aquí no debe impedir descargar edificios y visitas
    var resultadoWeb = { web: null, error: '' };
    try {
      resultadoWeb = leerWeb_(ss, tz);
    } catch (errWeb) {
      resultadoWeb = { web: null, error: String(errWeb.message) };
    }

    return json_({
      success: true,
      edificios: edificiosData,
      visitas: visitasData,
      web: resultadoWeb.web,
      webError: resultadoWeb.error
    });
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
    // No se guarda nada con un GESCAL que no lo parece (evita filas basura en VISITAS y EDIFICIOS)
    if (!GESCAL_RE.test(gescal)) return json_({ success: false, error: 'GESCAL no válido: ' + gescal });

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
      if (gescalCol > 0) {
        var rowNum = 0;
        if (lastRowE > 1) {
          var gescales = sheetEdificios.getRange(2, gescalCol, lastRowE - 1, 1).getValues();
          for (var i = 0; i < gescales.length; i++) {
            if (String(gescales[i][0]).trim() === gescal) { rowNum = i + 2; break; }
          }
        }

        // Edificio que viene de la descarga web y aún no está en el CRM: se da de alta
        if (rowNum === 0 && data.edificio) {
          var nuevo = new Array(lastColE);
          for (var n = 0; n < nuevo.length; n++) nuevo[n] = '';
          var origen = data.edificio;
          for (var col = 0; col < headers.length; col++) {
            var nombreCol = String(headers[col]).trim();
            if (nombreCol === 'GESCAL26' || nombreCol === 'GESCAL') nuevo[col] = gescal;
            else if (origen[nombreCol] !== undefined && origen[nombreCol] !== null) nuevo[col] = origen[nombreCol];
          }
          sheetEdificios.appendRow(nuevo);
          rowNum = sheetEdificios.getLastRow();
        }

        if (rowNum > 0) {
          if (estadoCol > 0 && estado) sheetEdificios.getRange(rowNum, estadoCol).setValue(estado);
          if (ultimaCol > 0) sheetEdificios.getRange(rowNum, ultimaCol).setValue(fecha);
          if (proximaCol > 0) sheetEdificios.getRange(rowNum, proximaCol).setValue(proximaVisita);
          if (comentarioCol > 0 && comentario) sheetEdificios.getRange(rowNum, comentarioCol).setValue(comentario);
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

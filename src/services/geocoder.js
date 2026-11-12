// src/services/geocoder.js
// Localiza un edificio por su dirección (ArcGIS y, si no, Photon), limitando la búsqueda a su población y
// descartando cualquier resultado que caiga lejos de ella. Antes aceptaba el primer resultado sin mirar
// dónde estaba y por eso algún edificio acababa en un pueblo de otra provincia.
import {
  poblacionDe, centroDePoblacion, cajaDePoblacion, coordenadaPlausible, partesDireccion, direccionTexto, calleTexto
} from '../utils/ubicacion.js';

const ARCGIS = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const PHOTON = 'https://photon.komoot.io/api/';
const PUNTUACION_MINIMA = 60;

async function buscarArcGIS(texto, poblacion) {
  const caja = cajaDePoblacion(poblacion);
  const centro = centroDePoblacion(poblacion);
  let url = `${ARCGIS}?f=json&singleLine=${encodeURIComponent(texto)}&maxLocations=5&countryCode=ESP`;
  if (caja) url += `&searchExtent=${caja.minLon},${caja.minLat},${caja.maxLon},${caja.maxLat}`;
  if (centro) url += `&location=${centro.lon},${centro.lat}`;
  const data = await (await fetch(url)).json();
  const buena = ((data && data.candidates) || []).find((c) =>
    c.location && (c.score === undefined || c.score >= PUNTUACION_MINIMA)
    && coordenadaPlausible({ lat: c.location.y, lon: c.location.x }, poblacion));
  return buena ? { lat: buena.location.y, lon: buena.location.x } : null;
}

async function buscarPhoton(texto, poblacion) {
  const caja = cajaDePoblacion(poblacion);
  const centro = centroDePoblacion(poblacion);
  let url = `${PHOTON}?q=${encodeURIComponent(texto)}&limit=5`;
  if (centro) url += `&lat=${centro.lat}&lon=${centro.lon}`;
  if (caja) url += `&bbox=${caja.minLon},${caja.minLat},${caja.maxLon},${caja.maxLat}`;
  const data = await (await fetch(url)).json();
  const buena = ((data && data.features) || []).find((f) => {
    const c = f.geometry && f.geometry.coordinates;
    return c && coordenadaPlausible({ lat: c[1], lon: c[0] }, poblacion);
  });
  return buena ? { lat: buena.geometry.coordinates[1], lon: buena.geometry.coordinates[0] } : null;
}

export async function geocodeFastRealStreet(edificio) {
  const poblacion = poblacionDe(edificio);
  const { nombre, num } = partesDireccion(edificio);
  if (!nombre) return null;

  const completa = direccionTexto(edificio);

  try {
    const r = await buscarArcGIS(completa, poblacion);
    if (r) return r;
  } catch (e) { /* se prueba con el siguiente servicio */ }

  try {
    const r = await buscarPhoton(completa, poblacion);
    if (r) return r;
  } catch (e) { /* se prueba solo la calle */ }

  // Solo la calle (sin número): se desplaza un poco según el número para no apilar los edificios
  try {
    const r = await buscarArcGIS(calleTexto(edificio), poblacion);
    if (r) {
      const desplazamiento = ((num || 1) % 30) * 0.00006;
      return { lat: r.lat + desplazamiento, lon: r.lon + desplazamiento };
    }
  } catch (e) { /* sin resultado */ }

  return null;
}

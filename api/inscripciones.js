const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// Almacenamiento en memoria para ejecución serverless
let memoryStore = [];
const TMP_FILE = path.join(os.tmpdir(), 'inscripciones.json');

function getInscripciones() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = fs.readFileSync(TMP_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Error reading /tmp:', e);
  }
  return memoryStore;
}

function saveInscripciones(list) {
  memoryStore = list;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing /tmp:', e);
  }
}

function fetchFromGoogleSheet(url) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchFromGoogleSheet(res.headers.location).then(resolve);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    } catch (e) {
      resolve(null);
    }
  });
}

function postToGoogleSheet(url, payload) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const postData = JSON.stringify({
        ...payload,
        comprobante: payload.comprobante ? 'Adjunto en sistema' : 'Sin comprobante'
      });
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      const req = (parsed.protocol === 'https:' ? https : http).request(options, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return postToGoogleSheet(res.headers.location, payload).then(resolve);
        }
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dgvbpsdifnvhxmaronhf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmJwc2RpZm52aHhtYXJvbmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDg0NCwiZXhwIjoyMTA4MTk2ODQ0fQ.gk3NyhyrK6K3LsDqgWSYY9Emg6llsstvwylmaXfnOA8';

function supabaseRequest(subpath, method, body) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(SUPABASE_URL + '/rest/v1' + subpath);
      const postData = body ? JSON.stringify(body) : null;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: method || 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      };
      if (postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      if (postData) req.write(postData);
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sheet-Url');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const sheetUrl = process.env.GOOGLE_SHEET_URL || req.headers['x-sheet-url'];

  // GET - Listar
  if (req.method === 'GET') {
    let list = getInscripciones();

    // Consultar Supabase
    const cloudData = await supabaseRequest('/inscripciones?select=*&order=created_at.desc');
    if (Array.isArray(cloudData) && cloudData.length > 0) {
      const map = new Map();
      cloudData.forEach(item => {
        const key = item.id || item.cedula;
        if (key) {
          map.set(key, {
            id: item.id,
            fecha: item.fecha || item.created_at,
            nombre: item.nombre,
            cedula: item.cedula,
            telefono: item.telefono,
            ruta: item.ruta,
            tipoCamiseta: item.tipo_camiseta || item.tipoCamiseta,
            tallaCamiseta: item.talla_camiseta || item.tallaCamiseta,
            valorPagado: Number(item.valor_pagado || item.valorPagado),
            tipoSangre: item.tipo_sangre || item.tipoSangre,
            contactoEmergenciaNombre: item.contacto_emergencia_nombre || item.contactoEmergenciaNombre,
            contactoEmergenciaTelefono: item.contacto_emergencia_telefono || item.contactoEmergenciaTelefono,
            referenciaPago: item.referencia_pago || item.referenciaPago,
            comprobante: item.comprobante,
            estado: item.estado
          });
        }
      });
      list.forEach(item => {
        const key = item.id || item.cedula;
        if (key && !map.has(key)) map.set(key, item);
      });
      list = Array.from(map.values());
    }

    if (sheetUrl) {
      const remoteList = await fetchFromGoogleSheet(sheetUrl);
      if (Array.isArray(remoteList) && remoteList.length > 0) {
        const map = new Map();
        [...remoteList, ...list].forEach(item => {
          const key = item.id || item.cedula;
          if (key && !map.has(key)) map.set(key, item);
        });
        list = Array.from(map.values());
      }
    }

    return res.status(200).json(list);
  }

  // POST - Guardar nueva
  if (req.method === 'POST') {
    const payload = req.body || {};
    if (!payload.nombre || !payload.cedula || !payload.telefono) {
      return res.status(400).json({ error: 'Nombre, cédula y teléfono son requeridos' });
    }

    const list = getInscripciones();
    const nueva = {
      id: payload.id || ('INS-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      nombre: String(payload.nombre).trim(),
      cedula: String(payload.cedula).trim(),
      telefono: String(payload.telefono).trim(),
      tipoSangre: payload.tipoSangre || '',
      contactoEmergenciaNombre: payload.contactoEmergenciaNombre ? String(payload.contactoEmergenciaNombre).trim() : '',
      contactoEmergenciaTelefono: payload.contactoEmergenciaTelefono ? String(payload.contactoEmergenciaTelefono).trim() : '',
      ruta: payload.ruta || '10K',
      tipoCamiseta: payload.tipoCamiseta || 'Caballero',
      tallaCamiseta: payload.tallaCamiseta || 'M',
      valorPagado: Number(payload.valorPagado) || 140000,
      referenciaPago: payload.referenciaPago ? String(payload.referenciaPago).trim() : '',
      comprobante: payload.comprobante || null,
      fecha: payload.fecha || new Date().toISOString(),
      estado: payload.estado || (Number(payload.valorPagado) >= 140000 ? 'Confirmado' : 'Abono')
    };

    const existingIdx = list.findIndex(item => item.id === nueva.id || item.cedula === nueva.cedula);
    if (existingIdx !== -1) {
      list[existingIdx] = nueva;
    } else {
      list.unshift(nueva);
    }
    saveInscripciones(list);

    // Guardar en Supabase en segundo plano
    supabaseRequest('/inscripciones', 'POST', {
      id: nueva.id,
      fecha: nueva.fecha,
      nombre: nueva.nombre,
      cedula: nueva.cedula,
      telefono: nueva.telefono,
      ruta: nueva.ruta,
      tipo_camiseta: nueva.tipoCamiseta,
      talla_camiseta: nueva.tallaCamiseta,
      valor_pagado: nueva.valorPagado,
      tipo_sangre: nueva.tipoSangre,
      contacto_emergencia_nombre: nueva.contactoEmergenciaNombre,
      contacto_emergencia_telefono: nueva.contactoEmergenciaTelefono,
      referencia_pago: nueva.referenciaPago,
      comprobante: nueva.comprobante,
      estado: nueva.estado
    }).catch(() => {});

    if (sheetUrl) {
      postToGoogleSheet(sheetUrl, nueva).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Inscripción guardada correctamente',
      data: nueva
    });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id || (req.url ? req.url.split('/').pop().split('?')[0] : null);
    if (!id || id === 'inscripciones') return res.status(400).json({ error: 'ID requerido' });

    let list = getInscripciones();
    list = list.filter(item => item.id !== id);
    saveInscripciones(list);

    supabaseRequest('/inscripciones?id=eq.' + encodeURIComponent(id), 'DELETE').catch(() => {});

    return res.status(200).json({ success: true, message: 'Inscripción eliminada' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};

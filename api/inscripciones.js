const fs = require('fs');
const path = require('path');

// Almacenamiento en memoria para ejecución serverless
let memoryStore = [];
const TMP_FILE = path.join('/tmp', 'inscripciones.json');

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

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // GET - Listar
  if (req.method === 'GET') {
    const list = getInscripciones();
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
      id: 'INS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      nombre: String(payload.nombre).trim(),
      cedula: String(payload.cedula).trim(),
      telefono: String(payload.telefono).trim(),
      tipoCamiseta: payload.tipoCamiseta || 'Caballero',
      tallaCamiseta: payload.tallaCamiseta || 'M',
      valorPagado: Number(payload.valorPagado) || 140000,
      comprobante: payload.comprobante || null,
      fecha: payload.fecha || new Date().toISOString(),
      estado: payload.estado || 'Confirmado'
    };

    list.unshift(nueva);
    saveInscripciones(list);

    return res.status(201).json({
      success: true,
      message: 'Inscripción guardada correctamente',
      data: nueva
    });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    let list = getInscripciones();
    list = list.filter(item => item.id !== id);
    saveInscripciones(list);

    return res.status(200).json({ success: true, message: 'Inscripción eliminada' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'inscripciones.json');

// Asegurar que exista el archivo de inscripciones
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function readInscripciones() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error leyendo inscripciones.json:', e);
    return [];
  }
}

function writeInscripciones(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error escribiendo inscripciones.json:', e);
    return false;
  }
}

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // API ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/inscripciones - Listar todas las inscripciones
  if (req.method === 'GET' && pathname === '/api/inscripciones') {
    const list = readInscripciones();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(list));
    return;
  }

  // POST /api/inscripciones - Registrar nueva persona
  if (req.method === 'POST' && pathname === '/api/inscripciones') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protección de tamaño máximo 15MB para imágenes base64
      if (body.length > 15 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'El comprobante excede el tamaño máximo permitido' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        if (!payload.nombre || !payload.cedula || !payload.telefono) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nombre, cédula y teléfono son obligatorios' }));
          return;
        }

        const list = readInscripciones();

        const nuevaInscripcion = {
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

        // Agregar al inicio para ver las más recientes primero
        list.unshift(nuevaInscripcion);
        writeInscripciones(list);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: 'Inscripción registrada correctamente',
          data: nuevaInscripcion
        }));
      } catch (err) {
        console.error('Error parseando POST payload:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Datos JSON inválidos' }));
      }
    });
    return;
  }

  // PATCH /api/inscripciones/:id - Actualizar estado
  if (req.method === 'PATCH' && pathname.startsWith('/api/inscripciones/')) {
    const id = pathname.replace('/api/inscripciones/', '');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const list = readInscripciones();
        const index = list.findIndex(item => item.id === id);

        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Inscripción no encontrada' }));
          return;
        }

        list[index] = { ...list[index], ...payload };
        writeInscripciones(list);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: list[index] }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al actualizar' }));
      }
    });
    return;
  }

  // DELETE /api/inscripciones/:id - Eliminar inscripción
  if (req.method === 'DELETE' && pathname.startsWith('/api/inscripciones/')) {
    const id = pathname.replace('/api/inscripciones/', '');
    let list = readInscripciones();
    const prevLen = list.length;
    list = list.filter(item => item.id !== id);

    if (list.length === prevLen) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Inscripción no encontrada' }));
      return;
    }

    writeInscripciones(list);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Inscripción eliminada' }));
    return;
  }

  // -------------------------------------------------------------
  // SERVICIO DE ARCHIVOS ESTÁTICOS Y RUTAS WEB
  // -------------------------------------------------------------
  let reqUrl = pathname;
  
  // Soporte directo para /admin
  if (reqUrl === '/admin' || reqUrl === '/admin/') {
    reqUrl = '/index.html';
  } else if (reqUrl === '/') {
    reqUrl = '/index.html';
  }

  const filePath = path.join(__dirname, decodeURIComponent(reqUrl));
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Redirigir rutas no encontradas a index.html (SPA fallback)
        const fallbackPath = path.join(__dirname, 'index.html');
        fs.readFile(fallbackPath, (fallbackErr, fallbackContent) => {
          if (!fallbackErr) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallbackContent);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🌿 Ecoruta Huellas del Alma 10K`);
  console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}/`);
  console.log(`🔐 Panel Admin:             http://localhost:${PORT}/#admin`);
  console.log(`======================================================\n`);
});

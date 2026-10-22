/**
 * Cliente de Base de Datos Compartida - Ecoruta Huellas del Alma 10K
 * Integración con Supabase para sincronización en tiempo real y persistencia multi-dispositivo.
 */

(function () {
  'use strict';

  // Configuración predeterminada de Supabase (Persistente para todos los dispositivos)
  const DEFAULT_SUPABASE_URL = 'https://dgvbpsdifnvhxmaronhf.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmJwc2RpZm52aHhtYXJvbmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MjA4NDQsImV4cCI6MjEwODE5Njg0NH0.gk3NyhyrK6K3LsDqgWSYY9Emg6llsstvwylmaXfnOA8';

  const STORAGE_KEY_URL = 'ecoruta_supabase_url';
  const STORAGE_KEY_KEY = 'ecoruta_supabase_anon_key';
  const STORAGE_KEY_OFFLINE = 'ecoruta_inscripciones_offline_v1';

  function getSupabaseUrl() {
    return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_SUPABASE_URL || '';
  }

  function getSupabaseKey() {
    return localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_SUPABASE_KEY || '';
  }

  function isSupabaseConfigured() {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();
    return !!(url && key && url.includes('supabase.co') && key.length > 20);
  }

  let clientInstance = null;

  function getSupabaseClient() {
    if (!isSupabaseConfigured()) return null;
    if (clientInstance) return clientInstance;

    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        clientInstance = window.supabase.createClient(getSupabaseUrl(), getSupabaseKey(), {
          auth: { persistSession: false }
        });
        return clientInstance;
      } catch (err) {
        console.error('Error inicializando cliente Supabase:', err);
      }
    }
    return null;
  }

  // Normaliza cualquier registro (de Supabase snake_case o de frontend camelCase)
  function normalizeInscripcion(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ('INS-' + Date.now())),
      fecha: raw.fecha || raw.created_at || new Date().toISOString(),
      nombre: String(raw.nombre || '').trim(),
      cedula: String(raw.cedula || '').trim(),
      telefono: String(raw.telefono || '').trim(),
      ruta: raw.ruta || '10K',
      tipoCamiseta: raw.tipo_camiseta || raw.tipoCamiseta || 'Caballero',
      tallaCamiseta: raw.talla_camiseta || raw.tallaCamiseta || 'M',
      valorPagado: Number(raw.valor_pagado !== undefined ? raw.valor_pagado : raw.valorPagado) || 140000,
      tipoSangre: raw.tipo_sangre || raw.tipoSangre || '',
      contactoEmergenciaNombre: raw.contacto_emergencia_nombre || raw.contactoEmergenciaNombre || '',
      contactoEmergenciaTelefono: String(raw.contacto_emergencia_telefono || raw.contactoEmergenciaTelefono || ''),
      referenciaPago: raw.referencia_pago || raw.referenciaPago || '',
      comprobante: raw.comprobante || null,
      estado: raw.estado || 'Confirmado'
    };
  }

  // Guardar nueva inscripción (Persistente: Supabase -> Servidor API -> Respaldo Local)
  async function dbSaveInscripcion(payload) {
    const recordId = payload.id || ('INS-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    const normalized = normalizeInscripcion({ ...payload, id: recordId });

    // Preparar objeto para PostgreSQL en Supabase (snake_case)
    const supabaseRow = {
      id: normalized.id,
      fecha: normalized.fecha,
      nombre: normalized.nombre,
      cedula: normalized.cedula,
      telefono: normalized.telefono,
      ruta: normalized.ruta,
      tipo_camiseta: normalized.tipoCamiseta,
      talla_camiseta: normalized.tallaCamiseta,
      valor_pagado: normalized.valorPagado,
      tipo_sangre: normalized.tipoSangre,
      contacto_emergencia_nombre: normalized.contactoEmergenciaNombre,
      contacto_emergencia_telefono: normalized.contactoEmergenciaTelefono,
      referencia_pago: normalized.referenciaPago,
      comprobante: normalized.comprobante,
      estado: normalized.estado
    };

    let savedInCloud = false;
    const client = getSupabaseClient();

    if (client) {
      try {
        const { error } = await client.from('inscripciones').insert([supabaseRow]);
        if (error) {
          console.error('Error insertando en Supabase:', error);
          throw error;
        }
        savedInCloud = true;
        console.log('✓ Inscripción guardada en Supabase con éxito');
      } catch (cloudErr) {
        console.warn('Fallo en Supabase, reintentando con endpoint de servidor...', cloudErr);
      }
    }

    // Enviar también al endpoint del servidor local/serverless como respaldo
    try {
      await fetch('/api/inscripciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized)
      });
    } catch (apiErr) {
      // Ignorar si está estático o sin backend local
    }

    // Guardar copia local de seguridad
    try {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
      const filtered = localList.filter(item => item.id !== normalized.id && item.cedula !== normalized.cedula);
      filtered.unshift(normalized);
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Aviso cuota almacenamiento local:', e);
    }

    return {
      success: true,
      savedInCloud,
      data: normalized
    };
  }

  // Obtener todas las inscripciones consolidadas
  async function dbGetInscripciones() {
    let cloudList = [];
    const client = getSupabaseClient();

    if (client) {
      try {
        const { data, error } = await client
          .from('inscripciones')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          cloudList = data.map(normalizeInscripcion);
        } else if (error) {
          console.warn('Error leyendo Supabase:', error);
        }
      } catch (err) {
        console.warn('No se pudo conectar a Supabase:', err);
      }
    }

    // Si Supabase trajo datos, sincronizar con localStorage y retornar
    if (cloudList.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(cloudList));
      } catch (e) {}
      return cloudList;
    }

    // Si Supabase no está configurado o no trajo datos, consultar API del servidor
    let serverList = [];
    try {
      const res = await fetch('/api/inscripciones');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          serverList = data.map(normalizeInscripcion);
        }
      }
    } catch (e) {}

    // Respaldo local
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]').map(normalizeInscripcion);
    } catch (e) {}

    // Consolidar sin duplicados
    const map = new Map();
    [...cloudList, ...serverList, ...localList].forEach(item => {
      if (item && (item.id || item.cedula)) {
        const key = item.id || item.cedula;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
    });

    const consolidated = Array.from(map.values());
    try {
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(consolidated));
    } catch (e) {}
    return consolidated;
  }

  // Eliminar una inscripción
  async function dbDeleteInscripcion(id) {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('inscripciones').delete().eq('id', id);
      } catch (e) {
        console.warn('Error eliminando en Supabase:', e);
      }
    }

    try {
      await fetch(`/api/inscripciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {}

    try {
      await fetch(`/api/inscripciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {}

    // Actualizar localStorage
    try {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
      const filtered = localList.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(filtered));
    } catch (e) {}

    return true;
  }

  // Actualizar una inscripción
  async function dbUpdateInscripcion(id, patch) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const supabasePatch = {};
        if (patch.estado !== undefined) supabasePatch.estado = patch.estado;
        if (patch.valorPagado !== undefined) supabasePatch.valor_pagado = patch.valorPagado;
        if (patch.referenciaPago !== undefined) supabasePatch.referencia_pago = patch.referenciaPago;

        await client.from('inscripciones').update(supabasePatch).eq('id', id);
      } catch (e) {
        console.warn('Error actualizando en Supabase:', e);
      }
    }

    try {
      await fetch(`/api/inscripciones/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
    } catch (e) {}

    // Actualizar localStorage
    try {
      const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');
      const updated = localList.map(item => item.id === id ? { ...item, ...patch } : item);
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(updated));
    } catch (e) {}

    return true;
  }

  // Guardar configuración de credenciales
  function dbSaveConfig(url, key) {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY_KEY);

    clientInstance = null; // Reiniciar instancia
    return isSupabaseConfigured();
  }

  // Exportar al objeto global window
  window.EcorutaDB = {
    isConfigured: isSupabaseConfigured,
    getUrl: getSupabaseUrl,
    getKey: getSupabaseKey,
    saveConfig: dbSaveConfig,
    saveInscripcion: dbSaveInscripcion,
    getInscripciones: dbGetInscripciones,
    deleteInscripcion: dbDeleteInscripcion,
    updateInscripcion: dbUpdateInscripcion,
    normalize: normalizeInscripcion
  };

})();

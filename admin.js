/**
 * Panel de Administración - Ecoruta Huellas del Alma 10K
 * Gestión y consulta de personas inscritas con persistencia local y sincronización Google Sheets
 */

(function () {
  'use strict';

  const adminListContainer = document.getElementById('adminListContainer');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnReloadData = document.getElementById('btnReloadData');
  const filterPills = document.getElementById('adminFilterPills');
  const toastFeedback = document.getElementById('toastFeedback');
  const cloudStatusBadge = document.getElementById('cloudStatusBadge');

  // Modales
  const modalReceiptViewer = document.getElementById('modalReceiptViewer');
  const receiptViewerImg = document.getElementById('receiptViewerImg');
  const receiptViewerTitle = document.getElementById('receiptViewerTitle');
  const receiptViewerDetails = document.getElementById('receiptViewerDetails');
  const btnCloseReceiptViewer = document.getElementById('btnCloseReceiptViewer');

  const modalAddParticipant = document.getElementById('modalAddParticipant');
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnEmptyAddTrigger = document.getElementById('btnEmptyAddTrigger');
  const btnCloseAddModal = document.getElementById('btnCloseAddModal');
  const btnCancelAddModal = document.getElementById('btnCancelAddModal');
  const adminManualForm = document.getElementById('adminManualForm');

  const modalCloudConfig = document.getElementById('modalCloudConfig');
  const btnOpenCloudModal = document.getElementById('btnOpenCloudModal');
  const btnCloseCloudModal = document.getElementById('btnCloseCloudModal');
  const btnSaveCloudConfig = document.getElementById('btnSaveCloudConfig');
  const btnDisconnectCloud = document.getElementById('btnDisconnectCloud');
  const btnCopyAppsScript = document.getElementById('btnCopyAppsScript');
  const cloudSheetUrlInput = document.getElementById('cloudSheetUrl');

  let allInscripciones = [];
  let currentFilter = 'all';
  let toastTimer = null;

  const STORAGE_KEY_OFFLINE = 'ecoruta_inscripciones_offline_v1';
  const STORAGE_KEY_SHEET_URL = 'ecoruta_google_sheet_url';

  // Código estándar de Google Apps Script para copiar y pegar
  const APPS_SCRIPT_CODE = `// ======================================================
// Código Google Apps Script para Ecoruta Huellas del Alma 10K
// 1. Abre tu Google Sheets > Extensiones > Apps Script
// 2. Pega este código y guarda
// 3. Implementar > Nueva implementación > Aplicación web
//    Acceso: "Cualquier usuario" > Copia la URL generada
// ======================================================
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID", "Fecha", "Nombre", "Cédula", "Teléfono", "Ruta",
        "Tipo Sangre", "Emergencia Nombre", "Emergencia Tel",
        "Camiseta", "Talla", "Valor Pagado", "Ref Consignación", "Estado", "Comprobante"
      ]);
      sheet.getRange(1, 1, 1, 15).setFontWeight("bold").setBackground("#194830").setFontColor("#FFFFFF");
    }
    sheet.appendRow([
      data.id || ("INS-" + new Date().getTime()),
      data.fecha || new Date().toLocaleString("es-CO"),
      data.nombre || "",
      data.cedula || "",
      data.telefono || "",
      data.ruta || "10K",
      data.tipoSangre || "",
      data.contactoEmergenciaNombre || "",
      data.contactoEmergenciaTelefono || "",
      data.tipoCamiseta || "",
      data.tallaCamiseta || "",
      data.valorPagado || 140000,
      data.referenciaPago || "",
      data.estado || "Confirmado",
      data.comprobante ? "Adjunto" : ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  var headers = rows[0];
  var results = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      if (key === "Nombre") obj.nombre = row[j];
      else if (key === "Cédula") obj.cedula = String(row[j]);
      else if (key === "Teléfono") obj.telefono = String(row[j]);
      else if (key === "Ruta") obj.ruta = row[j];
      else if (key === "Tipo Sangre") obj.tipoSangre = row[j];
      else if (key === "Emergencia Nombre") obj.contactoEmergenciaNombre = row[j];
      else if (key === "Emergencia Tel") obj.contactoEmergenciaTelefono = String(row[j]);
      else if (key === "Camiseta") obj.tipoCamiseta = row[j];
      else if (key === "Talla") obj.tallaCamiseta = row[j];
      else if (key === "Valor Pagado") obj.valorPagado = Number(row[j]) || 0;
      else if (key === "Ref Consignación") obj.referenciaPago = String(row[j]);
      else if (key === "Estado") obj.estado = row[j];
      else if (key === "ID") obj.id = String(row[j]);
      else if (key === "Fecha") obj.fecha = row[j];
      else obj[key] = row[j];
    }
    results.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
}`;

  function showToast(message) {
    if (!toastFeedback) return;
    toastFeedback.textContent = message;
    toastFeedback.classList.add('active');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastFeedback.classList.remove('active');
    }, 3200);
  }

  function formatMoney(num) {
    const val = Number(num) || 0;
    return '$' + val.toLocaleString('es-CO') + ' COP';
  }

  function cleanPhone(phone) {
    if (!phone) return '3183800831';
    return String(phone).replace(/\D/g, '');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateCloudBadge() {
    if (!cloudStatusBadge) return;
    const sheetUrl = localStorage.getItem(STORAGE_KEY_SHEET_URL);
    if (sheetUrl) {
      cloudStatusBadge.className = 'cloud-badge online';
      cloudStatusBadge.textContent = '☁️ Nube Activa';
      cloudStatusBadge.title = 'Conectado a Google Sheets en tiempo real';
    } else {
      cloudStatusBadge.className = 'cloud-badge offline';
      cloudStatusBadge.textContent = '● Modo Local';
      cloudStatusBadge.title = 'Los datos se guardan en este navegador y servidor local. Conecta Google Sheets para respaldo permanente.';
    }
  }

  // Cargar datos de la API, Google Sheets y sincronizar con respaldo local
  async function loadAdminData() {
    updateCloudBadge();
    const sheetUrl = localStorage.getItem(STORAGE_KEY_SHEET_URL);

    let serverList = [];
    let googleSheetList = [];

    // 1. Intentar cargar desde API del servidor
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sheetUrl) headers['X-Sheet-Url'] = sheetUrl;
      const res = await fetch('/api/inscripciones', { headers });
      if (res.ok) {
        serverList = await res.json();
      }
    } catch (e) {
      console.warn('Conexión con /api/inscripciones offline:', e);
    }

    // 2. Intentar cargar directamente desde Google Sheets si está configurado
    if (sheetUrl) {
      try {
        const sheetRes = await fetch(sheetUrl);
        if (sheetRes.ok) {
          const sheetData = await sheetRes.json();
          if (Array.isArray(sheetData)) {
            googleSheetList = sheetData;
          }
        }
      } catch (e) {
        console.warn('Consulta directa a Google Sheets falló (CORS o enlace offline):', e);
      }
    }

    // 3. Respaldo local del navegador
    const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE) || '[]');

    // Combinar todas las fuentes sin duplicados por ID o Cédula
    const map = new Map();
    [...googleSheetList, ...serverList, ...localList].forEach(item => {
      if (item && (item.id || item.cedula)) {
        const key = item.cedula || item.id;
        if (!map.has(key)) {
          map.set(key, item);
        } else {
          // Si ya existe pero el nuevo tiene comprobante, priorizar el más completo
          const existing = map.get(key);
          if (!existing.comprobante && item.comprobante) {
            map.set(key, { ...existing, ...item });
          }
        }
      }
    });

    allInscripciones = Array.from(map.values());
    // Guardar lista consolidada en localStorage
    localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(allInscripciones));

    renderAdminMetrics();
    renderAdminList();
  }

  // Renderizar tarjetas de métricas
  function renderAdminMetrics() {
    const statTotalInscritos = document.getElementById('statTotalInscritos');
    const statTotalRecaudado = document.getElementById('statTotalRecaudado');
    const statPagadosCompletos = document.getElementById('statPagadosCompletos');
    const statAbonos = document.getElementById('statAbonos');
    const countAll = document.getElementById('countAll');

    const total = allInscripciones.length;
    let rec = 0;
    let completos = 0;
    let abonos = 0;

    allInscripciones.forEach(item => {
      const v = Number(item.valorPagado) || 0;
      rec += v;
      if (v >= 140000) {
        completos++;
      } else {
        abonos++;
      }
    });

    if (statTotalInscritos) statTotalInscritos.textContent = total;
    if (countAll) countAll.textContent = total;
    if (statTotalRecaudado) statTotalRecaudado.textContent = '$' + rec.toLocaleString('es-CO');
    if (statPagadosCompletos) statPagadosCompletos.textContent = completos;
    if (statAbonos) statAbonos.textContent = abonos;
  }

  // Renderizar lista de inscritos con filtros y búsqueda
  function renderAdminList() {
    if (!adminListContainer) return;
    const query = (adminSearchInput ? adminSearchInput.value : '').toLowerCase().trim();

    let filtered = allInscripciones.filter(item => {
      const matchQuery = !query || 
        (item.cedula && item.cedula.toLowerCase().includes(query)) ||
        (item.nombre && item.nombre.toLowerCase().includes(query)) ||
        (item.telefono && item.telefono.toLowerCase().includes(query));

      if (!matchQuery) return false;

      if (currentFilter === 'confirmado') {
        return (Number(item.valorPagado) >= 140000) || (item.estado === 'Confirmado');
      }
      if (currentFilter === 'abono') {
        return (Number(item.valorPagado) < 140000);
      }
      if (currentFilter === 'comprobante') {
        return !!item.comprobante;
      }

      return true;
    });

    if (filtered.length === 0) {
      adminListContainer.innerHTML = '';
      if (adminEmptyState) adminEmptyState.style.display = 'block';
      return;
    }

    if (adminEmptyState) adminEmptyState.style.display = 'none';

    adminListContainer.innerHTML = filtered.map(item => {
      const isComprobante = !!item.comprobante;
      const isAbono = Number(item.valorPagado) < 140000;
      const statusClass = isAbono ? 'status-abono' : 'status-confirmado';
      const statusText = isAbono ? 'Abono Parcial' : 'Pago Completo ($140.000)';
      const formattedDate = item.fecha ? new Date(item.fecha).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'Fecha no reg.';

      return `
        <div class="participant-card" data-id="${item.id}">
          <div class="participant-header">
            <div class="participant-name-box">
              <h3>${escapeHtml(item.nombre)}</h3>
              <span class="participant-id">Cédula: <strong>${escapeHtml(item.cedula)}</strong></span>
            </div>
            <span class="participant-status-badge ${statusClass}">${statusText}</span>
          </div>

          <div class="participant-details-grid">
            <div class="p-detail-item">
              <span>Ruta</span>
              <strong style="color: #194830; font-weight: 800;">${escapeHtml(item.ruta || '10K')}</strong>
            </div>
            <div class="p-detail-item">
              <span>Camiseta</span>
              <strong>${escapeHtml(item.tipoCamiseta || 'N/A')} (${escapeHtml(item.tallaCamiseta || 'N/A')})</strong>
            </div>
            <div class="p-detail-item val-pagado">
              <span>Valor Pagado</span>
              <strong>${formatMoney(item.valorPagado)}</strong>
            </div>
            <div class="p-detail-item">
              <span>Teléfono</span>
              <strong>${escapeHtml(item.telefono)}</strong>
            </div>
            <div class="p-detail-item">
              <span>Ref. Consignación</span>
              <strong style="color: #059669; font-weight: 700;">${escapeHtml(item.referenciaPago || 'Sin ref.')}</strong>
            </div>
            <div class="p-detail-item">
              <span>Tipo de Sangre</span>
              <strong>${escapeHtml(item.tipoSangre || 'N/A')}</strong>
            </div>
            <div class="p-detail-item">
              <span>Contacto Emergencia</span>
              <strong>${escapeHtml(item.contactoEmergenciaNombre || 'N/A')}${item.contactoEmergenciaTelefono ? ` (${escapeHtml(item.contactoEmergenciaTelefono)})` : ''}</strong>
            </div>
            <div class="p-detail-item">
              <span>Fecha Registro</span>
              <small>${formattedDate}</small>
            </div>
          </div>

          <div class="participant-actions">
            <!-- Botón WhatsApp directo -->
            <a href="https://wa.me/57${cleanPhone(item.telefono)}?text=Hola%20${encodeURIComponent(item.nombre)}%2C%20te%20escribimos%20de%20la%20Ecoruta%20Huellas%20del%20Alma%2010K%20para%20tu%20inscripci%C3%B3n%20(C%C3%A9dula%3A%20${encodeURIComponent(item.cedula)})." target="_blank" rel="noopener noreferrer" class="btn-card-action btn-action-wpp">
              💬 Escribir WhatsApp
            </a>

            <!-- Ver comprobante si existe -->
            ${isComprobante ? `
              <button type="button" class="btn-card-action btn-action-receipt view-receipt-btn" data-id="${item.id}">
                📷 Ver Comprobante
              </button>
            ` : `
              <span style="font-size: 0.78rem; color: #9CA3AF; margin-left: 6px;">Sin foto adjunta</span>
            `}

            <!-- Botón de eliminar -->
            <button type="button" class="btn-card-action btn-action-delete delete-participant-btn" data-id="${item.id}" title="Eliminar registro">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');

    attachParticipantCardEvents();
  }

  // Eventos de botones en tarjetas
  function attachParticipantCardEvents() {
    // Ver comprobante
    document.querySelectorAll('.view-receipt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const participant = allInscripciones.find(p => p.id === id);
        if (participant && participant.comprobante) {
          openReceiptViewer(participant);
        } else {
          showToast('Esta persona no adjuntó imagen de comprobante.');
        }
      });
    });

    // Eliminar participante
    document.querySelectorAll('.delete-participant-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const participant = allInscripciones.find(p => p.id === id);
        const nombre = participant ? participant.nombre : 'este participante';

        if (!confirm(`¿Estás seguro de eliminar a "${nombre}" de la lista?`)) {
          return;
        }

        try {
          await fetch(`/api/inscripciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          console.warn('Error eliminando en servidor:', err);
        }

        allInscripciones = allInscripciones.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(allInscripciones));
        renderAdminMetrics();
        renderAdminList();
        showToast(`✓ Participante "${nombre}" eliminado.`);
      });
    });
  }

  // Visor de comprobante
  function openReceiptViewer(participant) {
    if (!modalReceiptViewer || !receiptViewerImg) return;
    receiptViewerImg.src = participant.comprobante;
    if (receiptViewerTitle) receiptViewerTitle.textContent = `Comprobante: ${participant.nombre}`;
    if (receiptViewerDetails) {
      receiptViewerDetails.textContent = `Cédula: ${participant.cedula} • Valor: ${formatMoney(participant.valorPagado)} • Ref: ${participant.referenciaPago || 'N/A'}`;
    }
    modalReceiptViewer.style.display = 'flex';
  }

  function closeReceiptViewer() {
    if (modalReceiptViewer) {
      modalReceiptViewer.style.display = 'none';
      if (receiptViewerImg) receiptViewerImg.src = '';
    }
  }

  if (btnCloseReceiptViewer) {
    btnCloseReceiptViewer.addEventListener('click', closeReceiptViewer);
  }

  if (modalReceiptViewer) {
    modalReceiptViewer.addEventListener('click', (e) => {
      if (e.target === modalReceiptViewer) closeReceiptViewer();
    });
  }

  // =========================================================================
  // GESTIÓN DE REGISTRO MANUAL DE PARTICIPANTES (➕)
  // =========================================================================
  function openAddModal() {
    if (modalAddParticipant) {
      modalAddParticipant.style.display = 'flex';
      const firstInput = document.getElementById('manualNombre');
      if (firstInput) firstInput.focus();
    }
  }

  function closeAddModal() {
    if (modalAddParticipant) {
      modalAddParticipant.style.display = 'none';
      if (adminManualForm) adminManualForm.reset();
    }
  }

  if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', openAddModal);
  if (btnEmptyAddTrigger) btnEmptyAddTrigger.addEventListener('click', openAddModal);
  if (btnCloseAddModal) btnCloseAddModal.addEventListener('click', closeAddModal);
  if (btnCancelAddModal) btnCancelAddModal.addEventListener('click', closeAddModal);

  if (modalAddParticipant) {
    modalAddParticipant.addEventListener('click', (e) => {
      if (e.target === modalAddParticipant) closeAddModal();
    });
  }

  if (adminManualForm) {
    adminManualForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nombre = document.getElementById('manualNombre').value.trim();
      const cedula = document.getElementById('manualCedula').value.trim().replace(/\D/g, '');
      const telefono = document.getElementById('manualTelefono').value.trim().replace(/\D/g, '');
      const ruta = document.getElementById('manualRuta').value;
      const tipoSangre = document.getElementById('manualTipoSangre').value;
      const tipoCamiseta = document.getElementById('manualCamiseta').value;
      const tallaCamiseta = document.getElementById('manualTalla').value;
      const valorPagado = Number(document.getElementById('manualValor').value) || 140000;
      const referenciaPago = document.getElementById('manualReferencia').value.trim();
      const emergenciaNombre = document.getElementById('manualEmergenciaNombre').value.trim();
      const emergenciaTel = document.getElementById('manualEmergenciaTel').value.trim().replace(/\D/g, '');

      if (!nombre || !cedula || !telefono) {
        alert('Por favor ingresa nombre, cédula y celular.');
        return;
      }

      const nuevoParticipante = {
        id: 'INS-MANUAL-' + Date.now(),
        nombre,
        cedula,
        telefono,
        ruta,
        tipoSangre,
        contactoEmergenciaNombre: emergenciaNombre,
        contactoEmergenciaTelefono: emergenciaTel,
        tipoCamiseta,
        tallaCamiseta,
        valorPagado,
        referenciaPago: referenciaPago || 'Reg. Manual',
        comprobante: null,
        fecha: new Date().toISOString(),
        estado: valorPagado >= 140000 ? 'Confirmado' : 'Abono'
      };

      // 1. Guardar en memoria local
      allInscripciones.unshift(nuevoParticipante);
      localStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(allInscripciones));

      // 2. Guardar en API serverless
      try {
        fetch('/api/inscripciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nuevoParticipante)
        }).catch(err => console.warn('Error guardando en API:', err));
      } catch (err) {}

      // 3. Guardar en Google Sheets si está conectado
      const sheetUrl = localStorage.getItem(STORAGE_KEY_SHEET_URL);
      if (sheetUrl) {
        try {
          fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoParticipante)
          }).catch(err => console.warn('Error enviando a Google Sheets:', err));
        } catch (err) {}
      }

      renderAdminMetrics();
      renderAdminList();
      closeAddModal();
      showToast(`✓ Participante "${nombre}" registrado con éxito.`);
    });
  }

  // =========================================================================
  // GESTIÓN DE CONEXIÓN CON GOOGLE SHEETS EN LA NUBE (☁️)
  // =========================================================================
  function openCloudModal() {
    if (modalCloudConfig) {
      modalCloudConfig.style.display = 'flex';
      if (cloudSheetUrlInput) {
        cloudSheetUrlInput.value = localStorage.getItem(STORAGE_KEY_SHEET_URL) || '';
      }
    }
  }

  function closeCloudModal() {
    if (modalCloudConfig) modalCloudConfig.style.display = 'none';
  }

  if (btnOpenCloudModal) btnOpenCloudModal.addEventListener('click', openCloudModal);
  if (btnCloseCloudModal) btnCloseCloudModal.addEventListener('click', closeCloudModal);

  if (modalCloudConfig) {
    modalCloudConfig.addEventListener('click', (e) => {
      if (e.target === modalCloudConfig) closeCloudModal();
    });
  }

  if (btnCopyAppsScript) {
    btnCopyAppsScript.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
          showToast('✓ Código de Google Apps Script copiado al portapapeles');
        });
      } else {
        const t = document.createElement('textarea');
        t.value = APPS_SCRIPT_CODE;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        showToast('✓ Código copiado');
      }
    });
  }

  if (btnSaveCloudConfig) {
    btnSaveCloudConfig.addEventListener('click', () => {
      const url = cloudSheetUrlInput ? cloudSheetUrlInput.value.trim() : '';
      if (!url) {
        alert('Por favor pega el enlace de tu Web App de Google Apps Script.');
        return;
      }
      if (!url.startsWith('https://script.google.com/')) {
        if (!confirm('El enlace no parece ser una URL de script.google.com. ¿Deseas guardarlo de todas formas?')) {
          return;
        }
      }
      localStorage.setItem(STORAGE_KEY_SHEET_URL, url);
      updateCloudBadge();
      closeCloudModal();
      showToast('☁️ Conexión con Google Sheets guardada.');
      loadAdminData();
    });
  }

  if (btnDisconnectCloud) {
    btnDisconnectCloud.addEventListener('click', () => {
      if (confirm('¿Deseas desconectar Google Sheets? La aplicación volverá a guardar en modo local.')) {
        localStorage.removeItem(STORAGE_KEY_SHEET_URL);
        updateCloudBadge();
        if (cloudSheetUrlInput) cloudSheetUrlInput.value = '';
        closeCloudModal();
        showToast('Desconectado de Google Sheets.');
      }
    });
  }

  // =========================================================================
  // BÚSQUEDA Y FILTROS
  // =========================================================================
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
      if (btnClearSearch) {
        btnClearSearch.style.display = adminSearchInput.value ? 'block' : 'none';
      }
      renderAdminList();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (adminSearchInput) {
        adminSearchInput.value = '';
        adminSearchInput.focus();
      }
      btnClearSearch.style.display = 'none';
      renderAdminList();
    });
  }

  if (filterPills) {
    filterPills.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterPills.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter') || 'all';
        renderAdminList();
      });
    });
  }

  if (btnReloadData) {
    btnReloadData.addEventListener('click', () => {
      btnReloadData.disabled = true;
      btnReloadData.textContent = 'Actualizando...';
      loadAdminData();
      setTimeout(() => {
        btnReloadData.disabled = false;
        btnReloadData.textContent = '🔄 Actualizar';
        showToast('✓ Lista de inscritos actualizada.');
      }, 500);
    });
  }

  // =========================================================================
  // EXPORTAR A EXCEL / CSV
  // =========================================================================
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (allInscripciones.length === 0) {
        alert('No hay participantes registrados para exportar.');
        return;
      }

      const headers = [
        'ID Inscripción',
        'Fecha y Hora',
        'Nombre Completo',
        'Cédula',
        'Teléfono',
        'Ruta',
        'Tipo de Sangre',
        'Contacto Emergencia Nombre',
        'Contacto Emergencia Teléfono',
        'Tipo Camiseta',
        'Talla Camiseta',
        'Valor Pagado COP',
        'Ref. Consignación',
        'Estado',
        'Tiene Comprobante'
      ];

      const rows = allInscripciones.map(item => {
        const fechaHora = item.fecha ? new Date(item.fecha).toLocaleString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : '';

        return [
          `"${item.id || ''}"`,
          `"${fechaHora}"`,
          `"${(item.nombre || '').replace(/"/g, '""')}"`,
          `"${item.cedula || ''}"`,
          `"${item.telefono || ''}"`,
          `"${item.ruta || '10K'}"`,
          `"${item.tipoSangre || ''}"`,
          `"${(item.contactoEmergenciaNombre || '').replace(/"/g, '""')}"`,
          `"${item.contactoEmergenciaTelefono || ''}"`,
          `"${item.tipoCamiseta || ''}"`,
          `"${item.tallaCamiseta || ''}"`,
          item.valorPagado || 0,
          `"${(item.referenciaPago || '').replace(/"/g, '""')}"`,
          `"${item.estado || (item.valorPagado >= 140000 ? 'Confirmado' : 'Abono')}"`,
          item.comprobante ? 'SI' : 'NO'
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ecoruta_inscritos_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Archivo Excel/CSV descargado con éxito.');
    });
  }

  // Tecla Escape para cerrar modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeReceiptViewer();
      closeAddModal();
      closeCloudModal();
    }
  });

  // Inicialización
  document.addEventListener('DOMContentLoaded', loadAdminData);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadAdminData();
  }
})();

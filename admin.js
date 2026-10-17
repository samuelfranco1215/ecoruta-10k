/**
 * Panel de Administración - Ecoruta Huellas del Alma 10K
 * Gestión y consulta de personas inscritas
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

  // Modal Comprobante
  const modalReceiptViewer = document.getElementById('modalReceiptViewer');
  const receiptViewerImg = document.getElementById('receiptViewerImg');
  const receiptViewerTitle = document.getElementById('receiptViewerTitle');
  const receiptViewerDetails = document.getElementById('receiptViewerDetails');
  const btnCloseReceiptViewer = document.getElementById('btnCloseReceiptViewer');

  let allInscripciones = [];
  let currentFilter = 'all';
  let toastTimer = null;

  function showToast(message) {
    if (!toastFeedback) return;
    toastFeedback.textContent = message;
    toastFeedback.classList.add('active');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastFeedback.classList.remove('active');
    }, 2800);
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

  // Cargar datos de la API y sincronizar con respaldo local
  async function loadAdminData() {
    let serverList = [];
    try {
      const res = await fetch('/api/inscripciones');
      if (res.ok) {
        serverList = await res.json();
      }
    } catch (e) {
      console.warn('Conexión con /api/inscripciones offline:', e);
    }

    const localList = JSON.parse(localStorage.getItem('ecoruta_inscripciones_offline_v1') || '[]');

    // Combinar sin duplicados
    const map = new Map();
    [...serverList, ...localList].forEach(item => {
      if (item && (item.id || item.cedula)) {
        const key = item.id || item.cedula;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
    });

    allInscripciones = Array.from(map.values());
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

  // Renderizar lista de inscritos con filtros
  function renderAdminList() {
    if (!adminListContainer) return;
    const query = (adminSearchInput ? adminSearchInput.value : '').toLowerCase().trim();

    let filtered = allInscripciones.filter(item => {
      // 1. Búsqueda por cédula, nombre o teléfono
      const matchQuery = !query || 
        (item.cedula && item.cedula.toLowerCase().includes(query)) ||
        (item.nombre && item.nombre.toLowerCase().includes(query)) ||
        (item.telefono && item.telefono.toLowerCase().includes(query));

      if (!matchQuery) return false;

      // 2. Filtro por estado
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
        const nombre = participant ? participant.nombre : 'este registro';

        if (!confirm(`¿Estás seguro de eliminar a ${nombre} (Cédula: ${participant ? participant.cedula : ''})?`)) {
          return;
        }

        try {
          await fetch(`/api/inscripciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          console.warn('Error en DELETE servidor:', err);
        }

        // Eliminar del almacenamiento local
        allInscripciones = allInscripciones.filter(p => p.id !== id);
        try {
          const LOCAL_STORAGE_DB = 'ecoruta_inscripciones_offline_v1';
          const localExisting = JSON.parse(localStorage.getItem(LOCAL_STORAGE_DB) || '[]');
          const updated = localExisting.filter(p => p.id !== id);
          localStorage.setItem(LOCAL_STORAGE_DB, JSON.stringify(updated));
        } catch (e) {}

        showToast('✓ Registro eliminado correctamente.');
        renderAdminMetrics();
        renderAdminList();
      });
    });
  }

  // Visor de comprobante
  function openReceiptViewer(participant) {
    if (!modalReceiptViewer || !receiptViewerImg) return;
    receiptViewerImg.src = participant.comprobante;
    if (receiptViewerTitle) {
      receiptViewerTitle.textContent = `Comprobante de: ${participant.nombre}`;
    }
    if (receiptViewerDetails) {
      receiptViewerDetails.textContent = `Cédula: ${participant.cedula} • Valor: ${formatMoney(participant.valorPagado)} • Ref: ${participant.referenciaPago || 'N/A'} • Sangre: ${participant.tipoSangre || 'N/A'}`;
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

  // Búsqueda en vivo por Cédula o Nombre
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
      const hasVal = adminSearchInput.value.trim().length > 0;
      if (btnClearSearch) btnClearSearch.style.display = hasVal ? 'block' : 'none';
      renderAdminList();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      adminSearchInput.value = '';
      btnClearSearch.style.display = 'none';
      adminSearchInput.focus();
      renderAdminList();
    });
  }

  // Filtros rápidos
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

  // Botón Recargar
  if (btnReloadData) {
    btnReloadData.addEventListener('click', async () => {
      btnReloadData.disabled = true;
      btnReloadData.textContent = '🔄 Cargando...';
      await loadAdminData();
      setTimeout(() => {
        btnReloadData.disabled = false;
        btnReloadData.textContent = '🔄 Actualizar';
        showToast('✓ Lista de inscritos actualizada.');
      }, 400);
    });
  }

  // Exportar Excel / CSV con todas las columnas de verificación
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (allInscripciones.length === 0) {
        alert('No hay inscripciones para exportar.');
        return;
      }

      const headers = [
        'Nombre Completo',
        'Cédula',
        'Teléfono',
        'Talla Camiseta',
        'Tipo Camiseta',
        'Valor Pagado COP',
        'Fecha y Hora de Inscripción',
        'Número de Referencia de la Consignación',
        'Contacto de Emergencia',
        'Teléfono de Emergencia',
        'Tipo de Sangre',
        'Estado',
        'Tiene Comprobante'
      ];

      const rows = allInscripciones.map(item => {
        const fechaHora = item.fecha ? new Date(item.fecha).toLocaleString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : '';

        return [
          `"${(item.nombre || '').replace(/"/g, '""')}"`,
          `"${item.cedula || ''}"`,
          `"${item.telefono || ''}"`,
          `"${item.tallaCamiseta || ''}"`,
          `"${item.tipoCamiseta || ''}"`,
          item.valorPagado || 0,
          `"${fechaHora}"`,
          `"${(item.referenciaPago || '').replace(/"/g, '""')}"`,
          `"${(item.contactoEmergenciaNombre || '').replace(/"/g, '""')}"`,
          `"${item.contactoEmergenciaTelefono || ''}"`,
          `"${item.tipoSangre || ''}"`,
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
    }
  });

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
    loadAdminData();
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadAdminData();
  }
})();

/**
 * Ecoruta Huellas del Alma 10K
 * Lógica principal: Inscripción, Persistencia de Estado, Métodos de Pago, Panel Admin y PWA
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. GESTIÓN DE PWA (PROGRESIVE WEB APP & INSTALACIÓN)
  // =========================================================================
  let deferredPrompt = null;
  const btnInstallHeader = document.getElementById('btnInstallHeader');
  const pwaTriggers = document.querySelectorAll('.btn-pwa-trigger');
  const modalInstallPWA = document.getElementById('modalInstallPWA');
  const btnCloseInstallModal = document.getElementById('btnCloseInstallModal');
  const btnConfirmInstallNative = document.getElementById('btnConfirmInstallNative');
  const installInstructionsIos = document.getElementById('installInstructionsIos');
  const installInstructionsAndroid = document.getElementById('installInstructionsAndroid');

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('PWA Service Worker registrado con éxito:', reg.scope);
      }).catch((err) => {
        console.log('Fallo al registrar Service Worker:', err);
      });
    });
  }

  // Detectar si es iOS / Safari
  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };

  const isInStandaloneMode = () => {
    return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone === true);
  };

  // Capturar evento de instalación de navegador
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallHeader) btnInstallHeader.style.display = 'inline-flex';
    const heroPwa = document.getElementById('pwaHeroBanner');
    if (heroPwa) heroPwa.style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (btnInstallHeader) btnInstallHeader.style.display = 'none';
    const heroPwa = document.getElementById('pwaHeroBanner');
    if (heroPwa) heroPwa.style.display = 'none';
    console.log('App instalada exitosamente');
  });

  function openPwaModal() {
    if (isInStandaloneMode()) {
      showToast('✓ Ya tienes la App instalada en tu dispositivo');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó instalar PWA');
        }
        deferredPrompt = null;
      });
    } else {
      // Mostrar instrucciones según SO
      if (modalInstallPWA) {
        modalInstallPWA.style.display = 'flex';
        if (isIos()) {
          if (installInstructionsIos) installInstructionsIos.style.display = 'block';
          if (installInstructionsAndroid) installInstructionsAndroid.style.display = 'none';
        } else {
          if (installInstructionsIos) installInstructionsIos.style.display = 'none';
          if (installInstructionsAndroid) installInstructionsAndroid.style.display = 'block';
        }
      }
    }
  }

  pwaTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPwaModal();
    });
  });

  if (btnConfirmInstallNative) {
    btnConfirmInstallNative.addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        if (modalInstallPWA) modalInstallPWA.style.display = 'none';
      } else {
        alert('Para instalar: Toca los 3 puntos del navegador en la esquina superior y selecciona "Instalar app" o "Agregar a la pantalla principal".');
        if (modalInstallPWA) modalInstallPWA.style.display = 'none';
      }
    });
  }

  if (btnCloseInstallModal && modalInstallPWA) {
    btnCloseInstallModal.addEventListener('click', () => {
      modalInstallPWA.style.display = 'none';
    });
    modalInstallPWA.addEventListener('click', (e) => {
      if (e.target === modalInstallPWA) modalInstallPWA.style.display = 'none';
    });
  }

  // =========================================================================
  // 2. INTERACCIÓN DE PRECIO ($140.000 COP) Y MÉTODOS DE PAGO (NEQUI, BANCOLOMBIA, BRE-B)
  // =========================================================================
  const toastFeedback = document.getElementById('toastFeedback');
  let toastTimer;

  function showToast(message) {
    if (!toastFeedback) return;
    toastFeedback.textContent = message;
    toastFeedback.classList.add('active');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastFeedback.classList.remove('active');
    }, 3200);
  }

  function copyText(text, callback) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        if (callback) callback();
      }).catch(err => {
        fallbackCopy(text, callback);
      });
    } else {
      fallbackCopy(text, callback);
    }
  }

  function fallbackCopy(text, callback) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    try {
      const ok = document.execCommand('copy');
      if (ok && callback) callback();
    } catch (e) {
      console.error('Fallback copy fail:', e);
    }
    document.body.removeChild(tempInput);
  }

  // Configuración de entidades de pago (Nequi, Bancolombia, Bre-B)
  const ENTITY_CONFIGS = {
    nequi: {
      name: 'Nequi',
      number: '3183000831',
      androidIntent: 'intent://#Intent;package=com.nequi.MobileApp;scheme=nequi;end',
      iosScheme: 'nequi://',
      webFallback: 'https://recarga.nequi.com.co/'
    },
    bancolombia: {
      name: 'Bancolombia',
      number: '18547223388',
      androidIntent: 'intent://#Intent;package=com.todo1.mobile;end',
      iosScheme: 'bancolombiapersonas://',
      webFallback: 'https://sucursalvirtual.bancolombia.com/'
    },
    breb: {
      name: 'Bre-B',
      number: '0089610981',
      androidIntent: null,
      iosScheme: null,
      webFallback: 'https://www.banrep.gov.co/es/bre-b'
    },
    daviplata: {
      name: 'Daviplata',
      number: '0089610981',
      androidIntent: 'intent://#Intent;package=com.davivienda.daviplataapp;end',
      iosScheme: 'daviplata://',
      webFallback: 'https://www.daviplata.com/'
    }
  };

  // Apertura de app bancaria con fallback web
  function openBankingApp(entityKey) {
    const config = ENTITY_CONFIGS[entityKey];
    if (!config) return;

    // Asegurar copiado previo del número/llave
    copyText(config.number);

    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (entityKey === 'breb') {
      showToast(`✓ ¡Llave Bre-B ${config.number} copiada! Abre tu app bancaria para transferir.`);
      if (isAndroid || isIOS) {
        setTimeout(() => {
          if (config.webFallback) {
            window.open(config.webFallback, '_blank', 'noopener,noreferrer');
          }
        }, 600);
      } else if (config.webFallback) {
        window.open(config.webFallback, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    showToast(`✓ ¡Dato ${config.number} copiado! Abriendo ${config.name}...`);

    if (isAndroid && config.androidIntent) {
      window.location.href = config.androidIntent;
      setTimeout(() => {
        if (document.hasFocus() && config.webFallback) {
          window.open(config.webFallback, '_blank', 'noopener,noreferrer');
        }
      }, 1800);
    } else if (isIOS && config.iosScheme) {
      window.location.href = config.iosScheme;
      setTimeout(() => {
        if (document.hasFocus() && config.webFallback) {
          window.open(config.webFallback, '_blank', 'noopener,noreferrer');
        }
      }, 1800);
    } else if (config.webFallback) {
      window.open(config.webFallback, '_blank', 'noopener,noreferrer');
    }
  }

  // Función para scroll suave a métodos de pago
  function scrollToPayment(highlight = true) {
    const pagoSec = document.getElementById('pago');
    if (!pagoSec) return;

    const headerOffset = 64;
    const targetPosition = pagoSec.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });

    if (highlight) {
      pagoSec.classList.add('section-highlight-pulse');
      setTimeout(() => {
        pagoSec.classList.remove('section-highlight-pulse');
      }, 1600);
    }
  }

  // 1. Al tocar el precio ($140.000 COP) -> Scroll suave a Métodos de Pago
  const priceAmountWrap = document.getElementById('priceAmountWrap');
  const priceTapHint = document.getElementById('priceTapHint');
  const pricingBox = document.getElementById('pricingBox');
  const msaPriceInfo = document.getElementById('msaPriceInfo');

  if (priceAmountWrap) {
    priceAmountWrap.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToPayment(true);
    });
    priceAmountWrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToPayment(true);
      }
    });
  }

  if (priceTapHint) {
    priceTapHint.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToPayment(true);
    });
    priceTapHint.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToPayment(true);
      }
    });
  }

  if (pricingBox) {
    pricingBox.addEventListener('click', (e) => {
      // Si el clic es en un enlace o botón del pricing box, dejar actuar normalmente
      if (e.target.closest('a') || e.target.closest('button')) return;
      // Si hizo clic en el valor o cabecera del precio
      if (e.target.closest('.price-amount-wrap') || e.target.closest('.pricing-tag') || e.target.closest('.price-sub')) {
        scrollToPayment(true);
      }
    });
  }

  if (msaPriceInfo) {
    msaPriceInfo.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToPayment(true);
    });
    msaPriceInfo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToPayment(true);
      }
    });
  }

  // 2. Botones de accesos directos de pago en el formulario (.open-app-trigger)
  document.querySelectorAll('.open-app-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entity = btn.getAttribute('data-entity');
      if (entity) {
        btn.classList.add('bda-clicked');
        setTimeout(() => btn.classList.remove('bda-clicked'), 800);
        openBankingApp(entity);
      }
    });
  });

  // =========================================================================
  // 3. PERSISTENCIA DE ESTADO (NO REGRESAR AL INICIO AL RECARGAR/SALIR)
  //    (Solución definitiva al problema de Imperio Barber)
  // =========================================================================
  const FORM_DRAFT_KEY = 'ecoruta_form_draft_v1';
  const LAST_SECTION_KEY = 'ecoruta_last_section_v1';
  const LAST_SCROLL_KEY = 'ecoruta_scroll_pos_v1';
  const stateRestoredPill = document.getElementById('stateRestoredPill');

  const formNombre = document.getElementById('formNombre');
  const formCedula = document.getElementById('formCedula');
  const formTelefono = document.getElementById('formTelefono');
  const formValorCustom = document.getElementById('formValorCustom');
  const adultSizesSelector = document.getElementById('adultSizesSelector');
  const kidsSizeBox = document.getElementById('kidsSizeBox');
  const customAmountWrap = document.getElementById('customAmountWrap');
  const receiptDropzone = document.getElementById('receiptDropzone');
  const formComprobante = document.getElementById('formComprobante');
  const dropzoneEmpty = document.getElementById('dropzoneEmpty');
  const dropzonePreview = document.getElementById('dropzonePreview');
  const receiptImgPreview = document.getElementById('receiptImgPreview');
  const receiptFileName = document.getElementById('receiptFileName');
  const btnRemoveReceipt = document.getElementById('btnRemoveReceipt');

  let currentReceiptBase64 = null;
  let currentReceiptName = null;

  // Restaurar borrador del formulario
  function restoreFormDraft() {
    try {
      const saved = localStorage.getItem(FORM_DRAFT_KEY);
      if (!saved) return false;
      const data = JSON.parse(saved);

      if (formNombre && data.nombre) formNombre.value = data.nombre;
      if (formCedula && data.cedula) formCedula.value = data.cedula;
      if (formTelefono && data.telefono) formTelefono.value = data.telefono;

      // Tipo de camiseta
      if (data.tipoCamiseta) {
        const radTipo = document.querySelector(`input[name="tipoCamiseta"][value="${data.tipoCamiseta}"]`);
        if (radTipo) {
          radTipo.checked = true;
          handleTipoCamisetaChange(data.tipoCamiseta);
        }
      }

      // Talla
      if (data.tallaCamiseta) {
        const radTalla = document.querySelector(`input[name="tallaCamiseta"][value="${data.tallaCamiseta}"]`);
        if (radTalla) radTalla.checked = true;
      }

      // Monto
      if (data.valorPreset) {
        const radMonto = document.querySelector(`input[name="valorAbonoPreset"][value="${data.valorPreset}"]`);
        if (radMonto) {
          radMonto.checked = true;
          if (data.valorPreset === 'otro' && customAmountWrap) {
            customAmountWrap.style.display = 'flex';
            if (formValorCustom && data.valorCustom) formValorCustom.value = data.valorCustom;
          }
        }
      }

      // Comprobante
      if (data.comprobanteBase64) {
        currentReceiptBase64 = data.comprobanteBase64;
        currentReceiptName = data.comprobanteName || 'comprobante_guardado.jpg';
        showReceiptPreview(currentReceiptBase64, currentReceiptName);
      }

      return true;
    } catch (e) {
      console.warn('Error recuperando borrador:', e);
      return false;
    }
  }

  // Guardar borrador en tiempo real
  function saveFormDraft() {
    try {
      const tipoCamiseta = document.querySelector('input[name="tipoCamiseta"]:checked')?.value || 'Dama';
      let tallaCamiseta = 'M';
      if (tipoCamiseta === 'Niño') {
        tallaCamiseta = 'XS';
      } else {
        tallaCamiseta = document.querySelector('input[name="tallaCamiseta"]:checked')?.value || 'M';
      }

      const valorPreset = document.querySelector('input[name="valorAbonoPreset"]:checked')?.value || '140000';
      const valorCustom = formValorCustom ? formValorCustom.value : '';

      const draft = {
        nombre: formNombre ? formNombre.value : '',
        cedula: formCedula ? formCedula.value : '',
        telefono: formTelefono ? formTelefono.value : '',
        tipoCamiseta,
        tallaCamiseta,
        valorPreset,
        valorCustom,
        comprobanteBase64: currentReceiptBase64,
        comprobanteName: currentReceiptName,
        timestamp: Date.now()
      };

      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // Ignore quota errors gracefully
    }
  }

  // Escuchar inputs para guardado automático inmediato
  [formNombre, formCedula, formTelefono, formValorCustom].forEach(input => {
    if (input) {
      input.addEventListener('input', saveFormDraft);
    }
  });

  // Guardar al cambiar radio buttons
  document.querySelectorAll('input[name="tipoCamiseta"], input[name="tallaCamiseta"], input[name="valorAbonoPreset"]').forEach(radio => {
    radio.addEventListener('change', saveFormDraft);
  });

  // Seguir sección activa con Scroll
  const trackableSections = document.querySelectorAll('section[id], header[id]');
  let scrollTimeout;

  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollPos = window.scrollY;
      localStorage.setItem(LAST_SCROLL_KEY, String(scrollPos));

      let currentSecId = '';
      trackableSections.forEach(sec => {
        const top = sec.offsetTop - 120;
        const height = sec.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          currentSecId = sec.id;
        }
      });

      if (currentSecId && window.location.hash !== '#admin') {
        localStorage.setItem(LAST_SECTION_KEY, currentSecId);
      }
    }, 150);
  }, { passive: true });

  // Manejo de cambio de tipo de camiseta
  function handleTipoCamisetaChange(tipo) {
    if (tipo === 'Niño') {
      if (adultSizesSelector) adultSizesSelector.style.display = 'none';
      if (kidsSizeBox) kidsSizeBox.style.display = 'block';
    } else {
      if (adultSizesSelector) adultSizesSelector.style.display = 'grid';
      if (kidsSizeBox) kidsSizeBox.style.display = 'none';
    }
  }

  document.querySelectorAll('input[name="tipoCamiseta"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      handleTipoCamisetaChange(e.target.value);
      saveFormDraft();
    });
  });

  // Manejo de cambio de montos predefinidos
  document.querySelectorAll('input[name="valorAbonoPreset"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'otro') {
        if (customAmountWrap) {
          customAmountWrap.style.display = 'flex';
          if (formValorCustom) formValorCustom.focus();
        }
      } else {
        if (customAmountWrap) customAmountWrap.style.display = 'none';
      }
      saveFormDraft();
    });
  });

  // =========================================================================
  // 4. SUBIDA Y PREVIEW DEL COMPROBANTE DE PAGO
  // =========================================================================
  function showReceiptPreview(base64Url, name) {
    if (!dropzoneEmpty || !dropzonePreview || !receiptImgPreview || !receiptFileName) return;
    receiptImgPreview.src = base64Url;
    receiptFileName.textContent = name || 'Comprobante seleccionado';
    dropzoneEmpty.style.display = 'none';
    dropzonePreview.style.display = 'flex';
  }

  function clearReceipt() {
    currentReceiptBase64 = null;
    currentReceiptName = null;
    if (formComprobante) formComprobante.value = '';
    if (dropzoneEmpty) dropzoneEmpty.style.display = 'flex';
    if (dropzonePreview) dropzonePreview.style.display = 'none';
    saveFormDraft();
  }

  if (btnRemoveReceipt) {
    btnRemoveReceipt.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      clearReceipt();
    });
  }

  if (formComprobante) {
    formComprobante.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Limitar a 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen seleccionada supera los 10MB. Por favor sube una captura o foto más ligera.');
        formComprobante.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(event) {
        currentReceiptBase64 = event.target.result;
        currentReceiptName = file.name;
        showReceiptPreview(currentReceiptBase64, currentReceiptName);
        saveFormDraft();
      };
      reader.readAsDataURL(file);
    });
  }

  // =========================================================================
  // 5. ENVÍO DE FORMULARIO DE INSCRIPCIÓN Y CONFIRMACIÓN
  // =========================================================================
  const registroForm = document.getElementById('registroForm');
  const modalExito = document.getElementById('modalExito');
  const successDetailsCard = document.getElementById('successDetailsCard');
  const btnSendWhatsappConfirmation = document.getElementById('btnSendWhatsappConfirmation');
  const btnCloseSuccessModal = document.getElementById('btnCloseSuccessModal');

  function validateForm() {
    let isValid = true;

    // Nombre
    const errNombre = document.getElementById('errNombre');
    if (!formNombre.value.trim()) {
      if (errNombre) {
        errNombre.textContent = 'Por favor escribe tu nombre y apellidos completos.';
        errNombre.classList.add('active');
      }
      isValid = false;
    } else if (errNombre) {
      errNombre.classList.remove('active');
    }

    // Cédula
    const errCedula = document.getElementById('errCedula');
    if (!formCedula.value.trim()) {
      if (errCedula) {
        errCedula.textContent = 'El número de cédula es obligatorio para identificar tu kit y pago.';
        errCedula.classList.add('active');
      }
      isValid = false;
    } else if (errCedula) {
      errCedula.classList.remove('active');
    }

    // Teléfono
    const errTelefono = document.getElementById('errTelefono');
    if (!formTelefono.value.trim() || formTelefono.value.trim().length < 7) {
      if (errTelefono) {
        errTelefono.textContent = 'Escribe un número de celular válido para coordinar la chiva.';
        errTelefono.classList.add('active');
      }
      isValid = false;
    } else if (errTelefono) {
      errTelefono.classList.remove('active');
    }

    return isValid;
  }

  function getEffectivePaymentAmount() {
    const preset = document.querySelector('input[name="valorAbonoPreset"]:checked')?.value || '140000';
    if (preset === 'otro') {
      const customVal = Number(formValorCustom.value) || 0;
      return customVal > 0 ? customVal : 140000;
    }
    return Number(preset) || 140000;
  }

  function formatMoney(amount) {
    return '$' + Number(amount).toLocaleString('es-CO') + ' COP';
  }

  if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      const btnSubmit = document.getElementById('btnSubmitForm');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Guardando inscripción...</span>';
      }

      const tipoCamiseta = document.querySelector('input[name="tipoCamiseta"]:checked')?.value || 'Dama';
      let tallaCamiseta = 'M';
      if (tipoCamiseta === 'Niño') {
        tallaCamiseta = 'XS';
      } else {
        tallaCamiseta = document.querySelector('input[name="tallaCamiseta"]:checked')?.value || 'M';
      }

      const valorPagado = getEffectivePaymentAmount();
      const payload = {
        nombre: formNombre.value.trim(),
        cedula: formCedula.value.trim(),
        telefono: formTelefono.value.trim(),
        tipoCamiseta,
        tallaCamiseta,
        valorPagado,
        comprobante: currentReceiptBase64,
        fecha: new Date().toISOString(),
        estado: valorPagado >= 140000 ? 'Confirmado' : 'Abono'
      };

      try {
        // Enviar a la API del servidor
        const response = await fetch('./api/inscripciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let savedData = null;
        if (response.ok) {
          const resJson = await response.json();
          savedData = resJson.data;
        }

        // Guardar copia local offline de seguridad
        saveOfflineRegistration(savedData || {
          ...payload,
          id: 'INS-' + Date.now()
        });

        // Limpiar borrador ya enviado
        localStorage.removeItem(FORM_DRAFT_KEY);

        // Mostrar Modal de Éxito
        showSuccessModal(payload);

      } catch (err) {
        console.warn('Servidor no disponible, guardando localmente:', err);
        const fallbackObj = {
          ...payload,
          id: 'INS-LOC-' + Date.now()
        };
        saveOfflineRegistration(fallbackObj);
        localStorage.removeItem(FORM_DRAFT_KEY);
        showSuccessModal(payload);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `
            <span>Confirmar mi Inscripción</span>
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          `;
        }
      }
    });
  }

  function saveOfflineRegistration(record) {
    try {
      const LOCAL_STORAGE_DB = 'ecoruta_inscripciones_offline_v1';
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_DB) || '[]');
      existing.unshift(record);
      localStorage.setItem(LOCAL_STORAGE_DB, JSON.stringify(existing));
    } catch (e) {
      console.warn('Storage quota offline:', e);
    }
  }

  function showSuccessModal(data) {
    if (!modalExito || !successDetailsCard) return;

    const isAbono = data.valorPagado < 140000;
    const estadoTxt = isAbono ? `Abono de ${formatMoney(data.valorPagado)}` : `Pago Total ${formatMoney(data.valorPagado)}`;

    successDetailsCard.innerHTML = `
      <div class="summary-row">
        <span>Participante:</span>
        <strong>${data.nombre}</strong>
      </div>
      <div class="summary-row">
        <span>Cédula:</span>
        <strong>${data.cedula}</strong>
      </div>
      <div class="summary-row">
        <span>Teléfono:</span>
        <strong>${data.telefono}</strong>
      </div>
      <div class="summary-row">
        <span>Camiseta:</span>
        <strong>${data.tipoCamiseta} (${data.tallaCamiseta})</strong>
      </div>
      <div class="summary-row">
        <span>Inversión registrada:</span>
        <strong>${estadoTxt}</strong>
      </div>
      <div class="summary-row">
        <span>Comprobante:</span>
        <strong>${data.comprobante ? '✓ Adjuntado en formulario' : 'Pendiente por WhatsApp'}</strong>
      </div>
    `;

    // Mensaje preescrito para WhatsApp que incluye la cédula
    const msg = `Hola, confirmo mi inscripción a Ecoruta Huellas del Alma 10K:%0A%0A` +
      `👤 *Nombre:* ${encodeURIComponent(data.nombre)}%0A` +
      `🪪 *Cédula:* ${encodeURIComponent(data.cedula)}%0A` +
      `📱 *Teléfono:* ${encodeURIComponent(data.telefono)}%0A` +
      `👕 *Camiseta:* ${encodeURIComponent(data.tipoCamiseta)} - Talla ${encodeURIComponent(data.tallaCamiseta)}%0A` +
      `💰 *Valor pagado:* ${encodeURIComponent(formatMoney(data.valorPagado))}%0A%0A` +
      `Adjunto mi comprobante de transferencia bancaria con mi cédula.`;

    if (btnSendWhatsappConfirmation) {
      btnSendWhatsappConfirmation.href = `https://wa.me/573183800831?text=${msg}`;
    }

    modalExito.style.display = 'flex';
  }

  if (btnCloseSuccessModal && modalExito) {
    btnCloseSuccessModal.addEventListener('click', () => {
      modalExito.style.display = 'none';
      // Desplazar a sección de pago para que tenga los números a la mano si requiere
      const pagoSec = document.getElementById('pago');
      if (pagoSec) {
        pagoSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // =========================================================================
  // 6. ENRUTAMIENTO Y PANEL DE ADMINISTRACIÓN (#admin)
  // =========================================================================
  const landingView = document.getElementById('landingView');
  const adminView = document.getElementById('adminView');
  const btnExitAdmin = document.getElementById('btnExitAdmin');
  const adminListContainer = document.getElementById('adminListContainer');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnReloadData = document.getElementById('btnReloadData');

  let allInscripciones = [];
  let currentFilter = 'all';

  function showAdminView() {
    if (landingView) landingView.style.display = 'none';
    if (adminView) adminView.style.display = 'block';
    const topNav = document.getElementById('topNav');
    if (topNav) topNav.style.display = 'none';
    const mobileBar = document.getElementById('mobileStickyBar');
    if (mobileBar) mobileBar.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'instant' });
    loadAdminData();
  }

  function showLandingView() {
    if (adminView) adminView.style.display = 'none';
    if (landingView) landingView.style.display = 'block';
    const topNav = document.getElementById('topNav');
    if (topNav) topNav.style.display = 'block';
    const mobileBar = document.getElementById('mobileStickyBar');
    if (mobileBar) mobileBar.style.display = 'block';

    if (window.location.hash === '#admin') {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    if (window.location.pathname.endsWith('/admin') || window.location.pathname.endsWith('/admin/')) {
      history.pushState("", document.title, '/');
    }
  }

  // Manejar cambio de Hash en URL y ruta privada /admin
  function checkUrlHash() {
    const hash = window.location.hash;
    const pathname = window.location.pathname;

    if (hash === '#admin') {
      window.location.href = '/admin';
      return;
    }

    if (pathname.endsWith('/admin') || pathname.endsWith('/admin/')) {
      showAdminView();
    } else {
      showLandingView();
    }
  }

  window.addEventListener('hashchange', checkUrlHash);
  window.addEventListener('popstate', checkUrlHash);

  if (btnExitAdmin) {
    btnExitAdmin.addEventListener('click', () => {
      showLandingView();
      if (window.location.pathname.endsWith('/admin') || window.location.pathname.endsWith('/admin/')) {
        history.pushState("", document.title, '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Cargar datos de inscripciones para el Admin
  async function loadAdminData() {
    try {
      const res = await fetch('./api/inscripciones');
      if (res.ok) {
        allInscripciones = await res.json();
      } else {
        throw new Error('API offline');
      }
    } catch (e) {
      console.warn('Leyendo respaldo local offline de inscripciones...');
      allInscripciones = JSON.parse(localStorage.getItem('ecoruta_inscripciones_offline_v1') || '[]');
    }

    renderAdminMetrics();
    renderAdminList();
  }

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

  function renderAdminList() {
    if (!adminListContainer) return;
    const query = (adminSearchInput ? adminSearchInput.value : '').toLowerCase().trim();

    let filtered = allInscripciones.filter(item => {
      // Búsqueda por cédula o nombre
      const matchQuery = !query || 
        (item.cedula && item.cedula.toLowerCase().includes(query)) ||
        (item.nombre && item.nombre.toLowerCase().includes(query)) ||
        (item.telefono && item.telefono.toLowerCase().includes(query));

      if (!matchQuery) return false;

      // Filtros rápidos
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
      const statusText = isAbono ? 'Abono Parcial' : 'Cupo Confirmado';
      const formattedDate = item.fecha ? new Date(item.fecha).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
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
              <strong>${escapeHtml(item.tipoCamiseta)} (${escapeHtml(item.tallaCamiseta)})</strong>
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

    // Eventos para botones dentro de las tarjetas
    attachParticipantCardEvents();
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
      .replace(/"/g, '&quot;');
  }

  function attachParticipantCardEvents() {
    // Ver comprobante modal
    document.querySelectorAll('.view-receipt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = allInscripciones.find(p => p.id === id);
        if (item && item.comprobante) {
          openReceiptViewer(item);
        }
      });
    });

    // Eliminar participante
    document.querySelectorAll('.delete-participant-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const item = allInscripciones.find(p => p.id === id);
        const nombre = item ? item.nombre : 'este participante';

        if (confirm(`¿Estás seguro de eliminar la inscripción de ${nombre}?`)) {
          try {
            await fetch(`./api/inscripciones/${id}`, { method: 'DELETE' });
          } catch (e) {}

          allInscripciones = allInscripciones.filter(p => p.id !== id);
          localStorage.setItem('ecoruta_inscripciones_offline_v1', JSON.stringify(allInscripciones));
          renderAdminMetrics();
          renderAdminList();
          showToast('✓ Registro eliminado');
        }
      });
    });
  }

  // Buscador reactivo
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
      if (btnClearSearch) {
        btnClearSearch.style.display = adminSearchInput.value ? 'block' : 'none';
      }
      renderAdminList();
    });
  }

  if (btnClearSearch && adminSearchInput) {
    btnClearSearch.addEventListener('click', () => {
      adminSearchInput.value = '';
      btnClearSearch.style.display = 'none';
      renderAdminList();
      adminSearchInput.focus();
    });
  }

  // Filtros rápidos admin
  document.querySelectorAll('#adminFilterPills .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#adminFilterPills .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderAdminList();
    });
  });

  if (btnReloadData) {
    btnReloadData.addEventListener('click', () => {
      loadAdminData();
      showToast('✓ Lista actualizada');
    });
  }

  // Exportar lista a CSV para Excel
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (allInscripciones.length === 0) {
        alert('No hay inscripciones registradas para exportar.');
        return;
      }

      let csv = '\uFEFF'; // BOM para que Excel abra UTF-8 con tildes y caracteres colombianos correctamente
      csv += 'ID,Nombre Completo,Cédula,Teléfono,Tipo Camiseta,Talla,Valor Pagado COP,Estado,Fecha de Registro\n';

      allInscripciones.forEach(item => {
        const row = [
          `"${item.id || ''}"`,
          `"${(item.nombre || '').replace(/"/g, '""')}"`,
          `"${item.cedula || ''}"`,
          `"${item.telefono || ''}"`,
          `"${item.tipoCamiseta || ''}"`,
          `"${item.tallaCamiseta || ''}"`,
          item.valorPagado || 0,
          `"${item.estado || ''}"`,
          `"${item.fecha || ''}"`
        ];
        csv += row.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Inscritos_Ecoruta_10K_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Reporte CSV descargado para Excel');
    });
  }

  // Modal Visor de Comprobante
  const modalReceiptViewer = document.getElementById('modalReceiptViewer');
  const receiptViewerImg = document.getElementById('receiptViewerImg');
  const receiptViewerTitle = document.getElementById('receiptViewerTitle');
  const receiptViewerDetails = document.getElementById('receiptViewerDetails');
  const btnCloseReceiptViewer = document.getElementById('btnCloseReceiptViewer');

  function openReceiptViewer(item) {
    if (!modalReceiptViewer || !receiptViewerImg) return;
    receiptViewerImg.src = item.comprobante;
    if (receiptViewerTitle) receiptViewerTitle.textContent = `Comprobante de ${item.nombre}`;
    if (receiptViewerDetails) {
      receiptViewerDetails.textContent = `Cédula: ${item.cedula} • Valor: ${formatMoney(item.valorPagado)} • Camiseta: ${item.tipoCamiseta} ${item.tallaCamiseta}`;
    }
    modalReceiptViewer.style.display = 'flex';
  }

  if (btnCloseReceiptViewer && modalReceiptViewer) {
    btnCloseReceiptViewer.addEventListener('click', () => {
      modalReceiptViewer.style.display = 'none';
    });
    modalReceiptViewer.addEventListener('click', (e) => {
      if (e.target === modalReceiptViewer) modalReceiptViewer.style.display = 'none';
    });
  }

  // =========================================================================
  // 7. RESTAURACIÓN AUTOMÁTICA DE UBICACIÓN Y SCROLL AL CARGAR
  // =========================================================================
  // Desactivar comportamiento nativo que fuerza a saltar a (0,0)
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Restaurar borrador de inputs
  const hadDraft = restoreFormDraft();

  // Revisar ruta inicial
  checkUrlHash();

  const isAdminActive = window.location.hash === '#admin' || window.location.pathname.endsWith('/admin') || window.location.pathname.endsWith('/admin/');

  if (!isAdminActive) {
    // Si viene con un hash específico en la URL (ej: #inscripcion, #pago)
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      // Revisar si el usuario estaba en una sección previa o tenía formulario abierto
      const lastSection = localStorage.getItem(LAST_SECTION_KEY);
      const lastScroll = localStorage.getItem(LAST_SCROLL_KEY);

      if (hadDraft && formNombre && formNombre.value.trim().length > 0) {
        // Estaba llenando el formulario: volver directo a la inscripción
        const inscripcionSec = document.getElementById('inscripcion');
        if (inscripcionSec) {
          setTimeout(() => {
            inscripcionSec.scrollIntoView({ behavior: 'smooth' });
            if (stateRestoredPill) {
              stateRestoredPill.classList.add('show');
              setTimeout(() => stateRestoredPill.classList.remove('show'), 3200);
            }
          }, 150);
        }
      } else if (lastScroll && Number(lastScroll) > 150) {
        // Volver al scroll donde estaba
        setTimeout(() => {
          window.scrollTo({
            top: Number(lastScroll),
            behavior: 'smooth'
          });
          if (stateRestoredPill) {
            stateRestoredPill.classList.add('show');
            setTimeout(() => stateRestoredPill.classList.remove('show'), 3200);
          }
        }, 150);
      }
    }
  }

  // Smooth scroll para todos los enlaces internos tipo #seccion
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '#admin') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerOffset = 64;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Ocultar barra móvil flotante al llegar al formulario o footer
  const mobileBar = document.getElementById('mobileStickyBar');
  const formSec = document.getElementById('inscripcion');

  if (mobileBar && formSec) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mobileBar.style.transform = 'translateY(120%)';
        } else {
          mobileBar.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    observer.observe(formSec);
  }

});

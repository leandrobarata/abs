/**
 * ABS Long Coding Master - 2Q0 Platform Exclusive Logic
 * Mapeamento completo, decodificação binária de bits, cálculo de espelhos/checksums e seleção sincronizada Hex/Binário
 */

(function () {
  'use strict';

  // Application State
  const state = {
    platform: '2q0',
    originalCode: '',
    currentBytes: [],
    baselineBytes: [],
    selectedByteIndex: 0,
    autoSyncMirrors: true,
    history: [],
    historyIndex: -1
  };

  // Helper Functions
  function hexToBin(hexStr) {
    const val = parseInt(hexStr, 16) || 0;
    return val.toString(2).padStart(8, '0');
  }

  function binToHex(binStr) {
    const val = parseInt(binStr, 2) || 0;
    return val.toString(16).toUpperCase().padStart(2, '0');
  }

  function reverseBits(hexStr) {
    const val = parseInt(hexStr, 16) || 0;
    let rev = 0;
    for (let i = 0; i < 8; i++) {
      if ((val >> i) & 1) {
        rev |= (1 << (7 - i));
      }
    }
    return rev.toString(16).toUpperCase().padStart(2, '0');
  }

  function cleanHex(str) {
    return (str || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  }

  function parseLongCode(codeStr) {
    const cleaned = cleanHex(codeStr);
    const bytes = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      if (i + 1 < cleaned.length) {
        bytes.push(cleaned.substring(i, i + 2));
      }
    }
    return bytes;
  }

  function formatCodeSpaced(bytes) {
    return bytes.join(' ');
  }

  function formatCodeContinuous(bytes) {
    return bytes.join('');
  }

  function formatFullBinary(bytes) {
    return bytes.map((b, idx) => `B${idx}: ${hexToBin(b)}`).join(' | ');
  }

  function getMirrorMap() {
    return window.ABS_DATA.mirrors_2q0;
  }

  function getVinRules() {
    return window.ABS_DATA.vin_rules_2q0;
  }

  function getPlatformData() {
    return window.ABS_DATA.platform_2q0;
  }

  // History Management
  function pushState() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push([...state.currentBytes]);
    state.historyIndex = state.history.length - 1;
    updateUndoRedoUI();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.currentBytes = [...state.history[state.historyIndex]];
      renderAll();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      state.currentBytes = [...state.history[state.historyIndex]];
      renderAll();
    }
  }

  function updateUndoRedoUI() {
    const undoBtn = document.getElementById('btnUndo');
    const redoBtn = document.getElementById('btnRedo');
    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  // Init App
  function init() {
    setupEventListeners();
    loadPreset('2q0_tcross_polo');
  }

  function loadPreset(presetId) {
    const preset = window.ABS_DATA.presets.find(p => p.id === presetId);
    if (!preset) return;
    setLongCode(preset.code);
  }

  function setLongCode(codeStr) {
    const bytes = parseLongCode(codeStr);
    if (bytes.length === 0) return;

    state.originalCode = codeStr;
    state.currentBytes = [...bytes];
    state.baselineBytes = [...bytes];

    state.history = [[...bytes]];
    state.historyIndex = 0;

    renderAll();
  }

  // Sync Mirrors Logic
  function syncMirrors() {
    const mirrorMap = getMirrorMap();
    const bytes = state.currentBytes;

    let syncCount = 0;
    Object.keys(mirrorMap).forEach(key => {
      const srcIdx = parseInt(key, 10);
      const tgtIdx = mirrorMap[srcIdx];

      if (srcIdx < tgtIdx && srcIdx < bytes.length && tgtIdx < bytes.length) {
        const expected = reverseBits(bytes[srcIdx]);
        if (bytes[tgtIdx] !== expected) {
          bytes[tgtIdx] = expected;
          syncCount++;
        }
      }
    });

    if (syncCount > 0) {
      pushState();
      renderAll();
      showToast(`Recalculados ${syncCount} espelhos/checksums no 2Q0 com sucesso!`, 'success');
    } else {
      showToast('Todos os espelhos 2Q0 já estão sincronizados.', 'info');
    }
  }

  function autoSyncIfNeeded(changedByteIdx) {
    if (!state.autoSyncMirrors) return;

    const mirrorMap = getMirrorMap();
    if (changedByteIdx in mirrorMap) {
      const targetIdx = mirrorMap[changedByteIdx];
      if (targetIdx < state.currentBytes.length) {
        state.currentBytes[targetIdx] = reverseBits(state.currentBytes[changedByteIdx]);
      }
    }
  }

  // VIN Calculator
  function applyVin(vinStr) {
    vinStr = (vinStr || '').trim().toUpperCase();
    if (vinStr.length !== 17) {
      showToast('O VIN deve conter exatamente 17 caracteres!', 'warning');
      return;
    }

    const rules = getVinRules();
    let updatedCount = 0;

    Object.keys(rules).forEach(bIdx => {
      const idx = parseInt(bIdx, 10);
      const rule = rules[idx];
      const vinChar = vinStr[rule.vin_char_index - 1];

      if (vinChar && idx < state.currentBytes.length) {
        const valHex = vinChar.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
        state.currentBytes[idx] = valHex;
        autoSyncIfNeeded(idx);
        updatedCount++;
      }
    });

    pushState();
    renderAll();
    showToast(`VIN aplicado! ${updatedCount} Bytes 2Q0 atualizados.`, 'success');
  }

  // Quick Retrofits Engine for 2Q0
  function applyRetrofit(type, value) {
    const bytes = state.currentBytes;

    if (type === 'esc_mode') {
      const byteIdx = 26;
      if (byteIdx < bytes.length) {
        const curBin = hexToBin(bytes[byteIdx]).split('');
        const escVal = parseInt(value, 16) & 0x0F;
        const escBin = escVal.toString(2).padStart(4, '0');

        curBin[4] = escBin[0];
        curBin[5] = escBin[1];
        curBin[6] = escBin[2];
        curBin[7] = escBin[3];

        bytes[byteIdx] = binToHex(curBin.join(''));
        autoSyncIfNeeded(byteIdx);
      }
    } else if (type === 'hhc') {
      const byteIdx = 26;
      if (byteIdx < bytes.length) {
        const curVal = parseInt(bytes[byteIdx], 16);
        const newVal = value ? (curVal | 0x20) : (curVal & ~0x20);
        bytes[byteIdx] = newVal.toString(16).toUpperCase().padStart(2, '0');
        autoSyncIfNeeded(byteIdx);
      }
    } else if (type === 'front_brake') {
      if (2 < bytes.length) {
        bytes[2] = value.toUpperCase();
        autoSyncIfNeeded(2);
      }
    } else if (type === 'rear_brake') {
      if (4 < bytes.length) {
        bytes[4] = value.toUpperCase();
        autoSyncIfNeeded(4);
      }
    } else if (type === 'side_assist') {
      if (51 < bytes.length) {
        bytes[51] = 'F2';
        autoSyncIfNeeded(51);
      }
    }

    pushState();
    renderAll();
    showToast(`Modificação de serviço/função (${type}) aplicada ao 2Q0!`, 'success');
  }

  // Highlight Textarea Selection for Selected Byte
  function highlightTextareaByte(byteIdx) {
    const input = document.getElementById('longCodeInput');
    if (!input) return;

    const start = byteIdx * 2;
    const end = start + 2;

    if (start < input.value.length) {
      input.focus();
      input.setSelectionRange(start, Math.min(end, input.value.length));
    }
  }

  // Select Byte Master Function
  function selectByte(byteIdx, highlightInput = true) {
    state.selectedByteIndex = byteIdx;
    renderAll();

    if (highlightInput) {
      highlightTextareaByte(byteIdx);
    }
  }

  // Render Functions
  function renderAll() {
    renderMainInput();
    renderByteGrid();
    renderByteDetail(state.selectedByteIndex);
    renderHealthInspector();
    renderDiffViewer();
    renderFullBinaryView();
    updateBadges();
  }

  function renderMainInput() {
    const input = document.getElementById('longCodeInput');
    if (input) {
      input.value = formatCodeContinuous(state.currentBytes);
    }
  }

  function renderFullBinaryView() {
    const container = document.getElementById('fullBinaryView');
    if (!container) return;

    let html = '<div class="binary-stream-grid">';
    state.currentBytes.forEach((hexVal, idx) => {
      const binStr = hexToBin(hexVal);
      const isSelected = idx === state.selectedByteIndex;
      html += `
        <div class="bin-byte-box ${isSelected ? 'selected' : ''}" onclick="ABS_APP.selectByte(${idx}, true)" title="Clique para selecionar e marcar Byte ${idx} no Long Code">
          <div class="bin-byte-label">B${idx} (0x${hexVal})</div>
          <div class="bin-byte-val">${binStr.substring(0, 4)} ${binStr.substring(4)}</div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function updateBadges() {
    const lenBadge = document.getElementById('byteLengthBadge');
    if (lenBadge) {
      lenBadge.textContent = `${state.currentBytes.length} Bytes (${state.currentBytes.length * 2} Caracteres)`;
    }

    const mirrorMap = getMirrorMap();
    let desyncedCount = 0;
    Object.keys(mirrorMap).forEach(k => {
      const srcIdx = parseInt(k, 10);
      const tgtIdx = mirrorMap[srcIdx];
      if (srcIdx < tgtIdx && srcIdx < state.currentBytes.length && tgtIdx < state.currentBytes.length) {
        if (state.currentBytes[tgtIdx] !== reverseBits(state.currentBytes[srcIdx])) {
          desyncedCount++;
        }
      }
    });

    const mirrorBadge = document.getElementById('mirrorStatusBadge');
    if (mirrorBadge) {
      if (desyncedCount === 0) {
        mirrorBadge.className = 'badge badge-success';
        mirrorBadge.innerHTML = '<i class="fas fa-check-circle"></i> Espelhos 2Q0 OK';
      } else {
        mirrorBadge.className = 'badge badge-danger';
        mirrorBadge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${desyncedCount} Espelhos Desincronizados`;
      }
    }
  }

  function renderByteGrid() {
    const gridContainer = document.getElementById('byteGrid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    const mirrorMap = getMirrorMap();
    const vinRules = getVinRules();
    const platformData = getPlatformData();

    state.currentBytes.forEach((hexVal, idx) => {
      const card = document.createElement('div');
      card.className = 'byte-card';
      if (idx === state.selectedByteIndex) {
        card.classList.add('selected');
      }

      if (state.baselineBytes[idx] && state.baselineBytes[idx] !== hexVal) {
        card.classList.add('modified');
      }

      let isMirrorSource = false;
      let isMirrorTarget = false;
      let isMirrorDesynced = false;

      if (idx in mirrorMap) {
        const partner = mirrorMap[idx];
        if (idx < partner) {
          isMirrorSource = true;
          if (partner < state.currentBytes.length && state.currentBytes[partner] !== reverseBits(hexVal)) {
            isMirrorDesynced = true;
          }
        } else {
          isMirrorTarget = true;
          if (partner < state.currentBytes.length && hexVal !== reverseBits(state.currentBytes[partner])) {
            isMirrorDesynced = true;
          }
        }
      }

      if (isMirrorDesynced) {
        card.classList.add('mirror-error');
      }

      let tagHtml = '';
      if (idx in vinRules) {
        tagHtml = '<span class="byte-tag tag-vin">VIN</span>';
      } else if (idx === 0) {
        tagHtml = '<span class="byte-tag tag-variant">Variante</span>';
      } else if (idx === 2) {
        tagHtml = '<span class="byte-tag tag-brake">Freio Dt</span>';
      } else if (idx === 4) {
        tagHtml = '<span class="byte-tag tag-brake">Freio Tr</span>';
      } else if (isMirrorSource) {
        tagHtml = `<span class="byte-tag tag-mirror">Orig. M${mirrorMap[idx]}</span>`;
      } else if (isMirrorTarget) {
        tagHtml = `<span class="byte-tag tag-target">Esp. M${mirrorMap[idx]}</span>`;
      }

      const byteTitle = (platformData[idx] && platformData[idx].title) ? platformData[idx].title : `Byte ${idx}`;
      const binStr = hexToBin(hexVal);

      card.innerHTML = `
        <div class="byte-card-header">
          <span class="byte-num">B${idx}</span>
          ${tagHtml}
        </div>
        <div class="byte-val">${hexVal}</div>
        <div class="byte-bin-display">${binStr.substring(0, 4)} ${binStr.substring(4)}</div>
        <div class="byte-desc" title="${byteTitle}">${byteTitle.substring(0, 22)}${byteTitle.length > 22 ? '...' : ''}</div>
      `;

      card.addEventListener('click', () => {
        selectByte(idx, true);
      });

      gridContainer.appendChild(card);
    });
  }

  function renderByteDetail(byteIdx) {
    const detailPanel = document.getElementById('byteDetailPanel');
    if (!detailPanel || byteIdx >= state.currentBytes.length) return;

    const hexVal = state.currentBytes[byteIdx];
    const binStr = hexToBin(hexVal);
    const platformData = getPlatformData();
    const bData = platformData[byteIdx] || { title: `Byte ${byteIdx}`, options: [], notes: [] };

    const mirrorMap = getMirrorMap();
    let mirrorInfo = 'Nenhum espelho associado a este Byte no 2Q0.';
    if (byteIdx in mirrorMap) {
      const partner = mirrorMap[byteIdx];
      const partnerVal = state.currentBytes[partner] || '--';
      const expectedVal = reverseBits(hexVal);
      const isSynced = partnerVal === expectedVal;

      mirrorInfo = `
        <div class="mirror-box ${isSynced ? 'mirror-ok' : 'mirror-warn'}">
          <div><i class="fas ${isSynced ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> Par Espelho 2Q0: <strong>Byte ${partner}</strong></div>
          <div>Valor Atual no Byte ${partner}: <code>${partnerVal} (${hexToBin(partnerVal)})</code></div>
          <div>Valor Calculado Bit-Reverse: <code>${expectedVal} (${hexToBin(expectedVal)})</code></div>
          ${!isSynced ? `<button class="btn btn-sm btn-outline-warning mt-2" onclick="ABS_APP.syncSingleMirror(${byteIdx})">Sincronizar Byte ${partner}</button>` : ''}
        </div>
      `;
    }

    let optionsHtml = '<option value="">-- Selecionar Valor Predefinido na Planilha 2Q0 --</option>';
    if (bData.options && bData.options.length > 0) {
      bData.options.forEach(opt => {
        const isSelected = opt.hex.toUpperCase() === hexVal ? 'selected' : '';
        const optBin = hexToBin(opt.hex);
        optionsHtml += `<option value="${opt.hex}" ${isSelected}>[0x${opt.hex} | ${optBin}] ${opt.desc}</option>`;
      });
    }

    const bitWeights = [128, 64, 32, 16, 8, 4, 2, 1];
    let bitsHtml = '';

    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = binStr[7 - bit] === '1';
      const weight = bitWeights[7 - bit];
      bitsHtml += `
        <div class="bit-item ${bitVal ? 'active' : ''}">
          <label class="bit-label" for="bit_check_${bit}">
            <input type="checkbox" id="bit_check_${bit}" ${bitVal ? 'checked' : ''} onchange="ABS_APP.toggleBit(${byteIdx}, ${bit}, this.checked)">
            <span class="bit-badge">Bit ${bit}</span>
            <span class="bit-weight">(Peso ${weight})</span>
            <span class="bit-binary-val">${bitVal ? '1' : '0'}</span>
          </label>
        </div>
      `;
    }

    detailPanel.innerHTML = `
      <div class="card detail-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h4 class="m-0"><i class="fas fa-microchip"></i> Detalhes do Byte ${byteIdx} (2Q0)</h4>
          <span class="badge bg-primary fs-6 font-monospace">Hex: 0x${hexVal} | Bin: ${binStr.substring(0, 4)} ${binStr.substring(4)}</span>
        </div>
        <div class="card-body">
          <h5 class="text-info">${bData.title}</h5>

          <div class="binary-ribbon my-3">
            <div class="ribbon-title"><i class="fas fa-binary me-1"></i> Representação Binária Completa dos 8 Bits:</div>
            <div class="ribbon-bits">
              ${binStr.split('').map((b, i) => `
                <div class="ribbon-bit-box ${b === '1' ? 'bit-on' : 'bit-off'}">
                  <span class="ribbon-bit-num">B${7 - i}</span>
                  <span class="ribbon-bit-val">${b}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="row my-3 align-items-center">
            <div class="col-md-4">
              <label class="form-label font-weight-bold">Valor Hex (00-FF):</label>
              <input type="text" id="byteHexInput" class="form-control form-control-lg text-uppercase font-weight-bold" maxlength="2" value="${hexVal}" onchange="ABS_APP.updateByteHex(${byteIdx}, this.value)">
            </div>
            <div class="col-md-8">
              <label class="form-label font-weight-bold">Opções Conhecidas na Planilha 2Q0:</label>
              <select class="form-select form-select-lg" onchange="ABS_APP.updateByteHex(${byteIdx}, this.value)">
                ${optionsHtml}
              </select>
            </div>
          </div>

          <div class="my-3">
            <h6>Inspecionar/Editar Bits Binários Individuais (Bit 7 -> Bit 0):</h6>
            <div class="bit-grid">
              ${bitsHtml}
            </div>
          </div>

          <div class="mt-3">
            <h6>Status de Espelhamento & Checksum 2Q0:</h6>
            ${mirrorInfo}
          </div>

          ${bData.notes && bData.notes.length > 0 ? `
            <div class="mt-3">
              <h6>Notas e Detalhes da Planilha 2Q0:</h6>
              <div class="notes-box">
                ${bData.notes.map(n => `<p class="mb-1 text-muted"><i class="fas fa-info-circle"></i> ${n}</p>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderHealthInspector() {
    const tableBody = document.getElementById('mirrorHealthTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const mirrorMap = getMirrorMap();
    const bytes = state.currentBytes;

    const checkedPairs = new Set();

    Object.keys(mirrorMap).forEach(key => {
      const srcIdx = parseInt(key, 10);
      const tgtIdx = mirrorMap[srcIdx];

      const pairKey = Math.min(srcIdx, tgtIdx) + '_' + Math.max(srcIdx, tgtIdx);
      if (checkedPairs.has(pairKey)) return;
      checkedPairs.add(pairKey);

      if (srcIdx < bytes.length && tgtIdx < bytes.length) {
        const valSrc = bytes[srcIdx];
        const valTgt = bytes[tgtIdx];
        const expectedTgt = reverseBits(valSrc);
        const isOk = valTgt === expectedTgt;

        const tr = document.createElement('tr');
        tr.className = 'cursor-pointer';
        tr.onclick = () => selectByte(srcIdx, true);
        tr.innerHTML = `
          <td><strong>Byte ${srcIdx}</strong> (0x${valSrc} | <code>${hexToBin(valSrc)}</code>)</td>
          <td><i class="fas fa-arrow-right text-muted"></i> Mirror</td>
          <td><strong>Byte ${tgtIdx}</strong> (0x${valTgt} | <code>${hexToBin(valTgt)}</code>)</td>
          <td><code>0x${expectedTgt} (${hexToBin(expectedTgt)})</code></td>
          <td>
            ${isOk ?
              '<span class="badge bg-success"><i class="fas fa-check"></i> Sincronizado</span>' :
              '<span class="badge bg-danger"><i class="fas fa-times"></i> Desincronizado</span>'
            }
          </td>
          <td>
            ${!isOk ? `<button class="btn btn-xs btn-warning" onclick="event.stopPropagation(); ABS_APP.syncSingleMirror(${srcIdx})">Corrigir</button>` : ''}
          </td>
        `;
        tableBody.appendChild(tr);
      }
    });
  }

  function renderDiffViewer() {
    const diffContainer = document.getElementById('diffViewer');
    if (!diffContainer) return;

    diffContainer.innerHTML = '';

    const orig = state.baselineBytes;
    const curr = state.currentBytes;

    let diffHtml = '<div class="diff-bytes">';
    let diffCount = 0;

    curr.forEach((hexVal, i) => {
      const origVal = orig[i] || '--';
      const isDiff = origVal !== hexVal;
      if (isDiff) diffCount++;

      diffHtml += `
        <div class="diff-chip ${isDiff ? 'changed' : 'unchanged'}" onclick="ABS_APP.selectByte(${i}, true)" style="cursor: pointer;">
          <span class="diff-idx">B${i}</span>
          <span class="diff-val">${origVal} [${hexToBin(origVal)}] &rarr; <strong>${hexVal} [${hexToBin(hexVal)}]</strong></span>
        </div>
      `;
    });
    diffHtml += '</div>';

    diffContainer.innerHTML = `
      <div class="diff-summary mb-2">
        <span class="badge bg-info fs-6">Total de Bytes Modificados: ${diffCount}</span>
      </div>
      ${diffHtml}
    `;
  }

  // Toast System
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `<i class="fas fa-info-circle me-2"></i> ${message}`;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // Event Listeners Setup
  function setupEventListeners() {
    document.getElementById('presetSelect')?.addEventListener('change', (e) => {
      if (e.target.value) {
        loadPreset(e.target.value);
      }
    });

    document.getElementById('longCodeInput')?.addEventListener('input', (e) => {
      const bytes = parseLongCode(e.target.value);
      if (bytes.length > 0) {
        state.currentBytes = bytes;
        pushState();
        renderAll();
      }
    });

    // Detect click position in Textarea to auto-select corresponding Byte
    document.getElementById('longCodeInput')?.addEventListener('click', (e) => {
      const cursorPos = e.target.selectionStart;
      const byteIdx = Math.floor(cursorPos / 2);
      if (byteIdx >= 0 && byteIdx < state.currentBytes.length) {
        selectByte(byteIdx, false);
      }
    });

    document.getElementById('chkAutoSync')?.addEventListener('change', (e) => {
      state.autoSyncMirrors = e.target.checked;
      showToast(`Sincronização Automática: ${state.autoSyncMirrors ? 'ATIVADA' : 'DESATIVADA'}`, 'info');
    });

    document.getElementById('btnCopyCode')?.addEventListener('click', () => {
      const code = formatCodeContinuous(state.currentBytes);
      navigator.clipboard.writeText(code);
      showToast('Long Code copiado para a área de transferência!', 'success');
    });

    document.getElementById('btnCopyCodeSpaced')?.addEventListener('click', () => {
      const code = formatCodeSpaced(state.currentBytes);
      navigator.clipboard.writeText(code);
      showToast('Long Code formatado (com espaços) copiado!', 'success');
    });

    document.getElementById('btnCopyBinaryStream')?.addEventListener('click', () => {
      const binStream = formatFullBinary(state.currentBytes);
      navigator.clipboard.writeText(binStream);
      showToast('Stream Binário Completo copiado!', 'success');
    });

    document.getElementById('btnSyncMirrors')?.addEventListener('click', () => {
      syncMirrors();
    });

    document.getElementById('btnApplyVin')?.addEventListener('click', () => {
      const vinStr = document.getElementById('vinInput').value;
      applyVin(vinStr);
    });

    document.getElementById('btnUndo')?.addEventListener('click', undo);
    document.getElementById('btnRedo')?.addEventListener('click', redo);
  }

  // Public API exposed on window.ABS_APP
  window.ABS_APP = {
    init,
    selectByte,
    updateByteHex: function (byteIdx, newHex) {
      newHex = cleanHex(newHex);
      if (!newHex) return;
      newHex = newHex.padStart(2, '0').substring(0, 2);

      state.currentBytes[byteIdx] = newHex;
      autoSyncIfNeeded(byteIdx);
      pushState();
      renderAll();
    },

    toggleBit: function (byteIdx, bitIdx, isChecked) {
      const curBin = hexToBin(state.currentBytes[byteIdx]).split('');
      curBin[7 - bitIdx] = isChecked ? '1' : '0';
      const newHex = binToHex(curBin.join(''));

      state.currentBytes[byteIdx] = newHex;
      autoSyncIfNeeded(byteIdx);
      pushState();
      renderAll();
    },

    syncSingleMirror: function (byteIdx) {
      const mirrorMap = getMirrorMap();
      if (byteIdx in mirrorMap) {
        const partner = mirrorMap[byteIdx];
        state.currentBytes[partner] = reverseBits(state.currentBytes[byteIdx]);
        pushState();
        renderAll();
        showToast(`Espelho do Byte ${partner} atualizado com sucesso!`, 'success');
      }
    },

    applyRetrofit
  };

  document.addEventListener('DOMContentLoaded', init);

})();

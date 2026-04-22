console.log('form.js loaded');
document.addEventListener('DOMContentLoaded', function () {
  // guard to avoid double initialization if other scripts also run
  if (window.customAccordionInitialized) {
    console.log('customAccordion already initialized, skipping duplicate init.');
  } else {
    // --- Accordion: only one open at a time ---
    (function initAccordion() {
      const headers = document.querySelectorAll('.accordion-header');
      headers.forEach(h => {
        h.style.cursor = 'pointer';
        h.addEventListener('click', () => {
          const id = h.dataset.accordion;
          let content = id ? document.getElementById(id) : h.nextElementSibling;
          if (!content) return;
          const isOpen = content.style.display === 'block';
          document.querySelectorAll('.accordion-content').forEach(c => {
            c.style.display = 'none';
            c.classList.add('collapsed-content');
          });
          if (!isOpen) {
            content.style.display = 'block';
            content.classList.remove('collapsed-content');
          }
        });
      });
      window.customAccordionInitialized = true;
    })();
  }

  // --- Tag UI (Emissions section) ---
  (function initTags() {
    const root = document.getElementById('tags-root');
    const list = document.getElementById('tag-list');
    const input = document.getElementById('tag-input');
    const addBtn = document.getElementById('add-tag');
    const hidden = document.getElementById('tags-hidden');
    if (!root || !list || !input || !addBtn || !hidden) return;

    let tags = [];
    function render() {
      list.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.textContent = t;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'tag-remove';
        x.textContent = '×';
        x.addEventListener('click', () => {
          tags.splice(i, 1);
          sync();
          render();
        });
        chip.appendChild(x);
        list.appendChild(chip);
      });
      hidden.value = tags.join(',');
    }

    function sync() {
      hidden.value = tags.join(',');
    }

    addBtn.addEventListener('click', () => {
      const v = input.value.trim();
      if (!v) return;
      if (!tags.includes(v.toLowerCase())) tags.push(v);
      input.value = '';
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });

    // initialize from hidden if present
    if (hidden.value) {
      tags = hidden.value.split(',').filter(Boolean);
      render();
    }
  })();

  // --- Customer phone input: only digits, auto-insert dashes XXX-XXX-XXXX ---
  (function initPhoneFormatting() {
    const el = document.getElementById('custPhone');
    if (!el) return;

    function onlyDigits(s) { return (s || '').replace(/\D/g, ''); }
    function formatPhone(digits) {
      const d = digits.slice(0, 10);
      if (d.length <= 3) return d;
      if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3);
      return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    }

    function digitsBeforeCursor(value, cursorPos) {
      return (value.slice(0, cursorPos).match(/\d/g) || []).length;
    }

    function cursorPosFromDigits(formatted, digitsCount) {
      if (digitsCount <= 0) return 0;
      let seen = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) {
          seen++;
          if (seen === digitsCount) return i + 1;
        }
      }
      return formatted.length;
    }

    el.addEventListener('keydown', function (e) {
      // allow control keys, navigation, backspace/delete
      const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
      if (allowed.includes(e.key)) return;
      // allow Ctrl/Cmd combos
      if (e.ctrlKey || e.metaKey) return;
      // allow digits
      if (/^[0-9]$/.test(e.key)) return;
      // otherwise prevent
      e.preventDefault();
    });

    el.addEventListener('paste', function (ev) {
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text') || '';
      const digits = onlyDigits(text);
      const currentDigits = onlyDigits(el.value);
      // insert pasted digits at cursor position
      const selStart = el.selectionStart || 0;
      const selEnd = el.selectionEnd || 0;
      const before = onlyDigits(el.value.slice(0, selStart));
      const after = onlyDigits(el.value.slice(selEnd));
      const newDigits = (before + digits + after).slice(0, 10);
      const formatted = formatPhone(newDigits);
      el.value = formatted;
      const cursor = cursorPosFromDigits(formatted, before.length + digits.length);
      try { el.setSelectionRange(cursor, cursor); } catch (e) { }
    });

    el.addEventListener('input', function (e) {
      const orig = el.value || '';
      const sel = el.selectionStart || 0;
      const digitsBefore = digitsBeforeCursor(orig, sel);
      const digits = onlyDigits(orig).slice(0, 10);
      const formatted = formatPhone(digits);
      el.value = formatted;
      const newPos = cursorPosFromDigits(formatted, digitsBefore);
      try { el.setSelectionRange(newPos, newPos); } catch (err) { }
    });

    // ensure format on blur
    el.addEventListener('blur', function () {
      const digits = onlyDigits(el.value).slice(0, 10);
      el.value = formatPhone(digits);
    });
  })();

  // --- Video upload (keeps previous upload flow intact) ---
  (function setupVideoUpload() {
    const uploadZone = document.getElementById('video-upload-zone');
    const videoFileInput = document.getElementById('video-file');
    const uploadTrigger = document.getElementById('upload-trigger');
    const uploadBtn = document.getElementById('upload-btn');
    if (!uploadZone || !videoFileInput || !uploadBtn) return;

    let selectedFile = null;

    // clicking the choose button opens file picker
    if (uploadTrigger) {
      uploadTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        videoFileInput.click();
      });
    }

    // clicking the zone also opens picker (mockup behavior)
    uploadZone.addEventListener('click', function (e) {
      if (e.target !== uploadTrigger && e.target !== uploadBtn) videoFileInput.click();
    });

    // when a file is selected
    videoFileInput.addEventListener('change', function (e) {
      selectedFile = e.target.files[0];
      const p = uploadZone.querySelector('p');
      if (selectedFile) {
        if (p) p.textContent = `Selected: ${selectedFile.name}`;
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';
      } else {
        if (p) p.textContent = 'Drop video here or click to upload';
        uploadBtn.disabled = true;
      }
    });

    // upload to server
    uploadBtn.addEventListener('click', function () {
      if (!selectedFile) {
        alert('Please select a video file first.');
        return;
      }
      const formData = new FormData();
      formData.append('video', selectedFile);

      uploadBtn.textContent = 'Uploading...';
      uploadBtn.disabled = true;

      fetch('/upload-video', {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            alert('Video uploaded successfully!');
            const p = uploadZone.querySelector('p');
            if (p) p.textContent = 'Video uploaded successfully!';
            uploadZone.style.backgroundColor = '#d4edda';
            uploadZone.style.borderColor = '#c3e6cb';
            // clear selection
            videoFileInput.value = '';
            selectedFile = null;
          } else {
            alert('Upload failed: ' + (data && data.message ? data.message : 'Unknown'));
          }
        })
        .catch(err => {
          console.error('Upload error:', err);
          alert('Upload failed. Please try again.');
        })
        .finally(() => {
          uploadBtn.textContent = 'Upload';
          uploadBtn.disabled = false;
        });
    });
  })();

  // --- Image upload (click/drag-preview + upload) ---
  (function setupImageUpload() {
    const zone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-file');
    const trigger = document.getElementById('image-upload-trigger');
    const uploadBtn = document.getElementById('image-upload-btn');
    const previewEl = document.getElementById('image-preview');
    if (!zone || !fileInput || !uploadBtn) return;

    // enable multi-select on the input (ensure HTML has multiple attribute)
    fileInput.multiple = true;

    let selectedFiles = []; // array of File
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB per file
    const MAX_FILES = 10;

    function showPreview(files) {
      if (!previewEl) return;
      previewEl.innerHTML = '';
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexWrap = 'wrap';
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.width = '120px';
          img.style.height = '90px';
          img.style.objectFit = 'cover';
          img.style.margin = '4px';
          img.alt = file.name;
          list.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
      previewEl.appendChild(list);
    }

    if (trigger) {
      trigger.addEventListener('click', function (e) { e.preventDefault(); fileInput.click(); });
    }

    zone.addEventListener('click', function (e) {
      if (e.target !== trigger && e.target !== uploadBtn) fileInput.click();
    });

    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); zone.classList.remove('dragover');
      const fileList = e.dataTransfer && e.dataTransfer.files;
      if (fileList && fileList.length) {
        const arr = Array.from(fileList);
        handleFilesChosen(arr);
        // guard: setting input.files may throw in some browsers
        try { fileInput.files = fileList; } catch (err) { console.warn('Could not set fileInput.files', err); }
      }
    });

    fileInput.addEventListener('change', function (e) {
      const fileList = e.target.files;
      if (fileList && fileList.length) handleFilesChosen(Array.from(fileList));
    });

    function handleFilesChosen(filesArr) {
      // merge and dedupe by name+size to avoid duplicates
      const combined = selectedFiles.concat(filesArr);
      const dedup = [];
      const seen = new Set();
      for (const f of combined) {
        const key = f.name + '|' + f.size;
        if (seen.has(key)) continue;
        seen.add(key);
        // validation
        if (!f.type.startsWith('image/')) continue;
        if (f.size > MAX_BYTES) continue;
        dedup.push(f);
        if (dedup.length >= MAX_FILES) break;
      }
      selectedFiles = dedup;
      if (selectedFiles.length === 0) {
        uploadBtn.disabled = true;
        uploadBtn.style.opacity = '0.5';
      } else {
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';
      }
      const p = zone.querySelector('p');
      if (p) p.textContent = `Selected ${selectedFiles.length} image(s)`;
      showPreview(selectedFiles);
    }

    uploadBtn.addEventListener('click', function () {
      if (!selectedFiles || selectedFiles.length === 0) { alert('Please select one or more images first.'); return; }
      const fd = new FormData();
      // append multiple files using the same field name "image"
      selectedFiles.forEach(f => fd.append('image', f));
      // include ticketID if needed: fd.append('ticketID', ticketIdValue);
      uploadBtn.textContent = 'Uploading...'; uploadBtn.disabled = true;

      fetch('/upload-image', { method: 'POST', body: fd })
        .then(res => res.json())
        .then((data) => {
          if (data && data.success) {
            alert('Images uploaded successfully!');
            const p = zone.querySelector('p');
            if (p) p.textContent = 'Upload complete';
            zone.style.backgroundColor = '#d4edda';
            zone.style.borderColor = '#c3e6cb';
            fileInput.value = '';
            selectedFiles = [];
            if (previewEl) previewEl.innerHTML = '';
          } else {
            alert('Upload failed: ' + (data && data.message ? data.message : 'Unknown'));
          }
        })
        .catch(err => { console.error('Image upload error:', err); alert('Upload failed.'); })
        .finally(() => { uploadBtn.textContent = 'Upload'; uploadBtn.disabled = false; });
    });
  })();

  // --- Recommended Repairs: row wiring, calc, add/remove, block '-' input ---
  (function initRepairs() {
    const table = document.getElementById('repairs-table');
    const addBtn = document.querySelector('.add-repair-line');
    const subPartsEl = document.getElementById('subTotParts');
    const subLaborEl = document.getElementById('subTotLabor');
    const taxEl = document.getElementById('tax');
    const totEstimateEl = document.getElementById('totEstimate');

    if (!table) return;

    // utility
    function toNum(v) { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
    function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }

    function calcRow(row) {
      const desc = row.querySelector('.rp-desc');
      const qtyEl = row.querySelector('.rp-qty');
      const partsPriceEl = row.querySelector('.rp-partprice');
      const partsTotalEl = row.querySelector('.rp-partstotal');
      const laborHoursEl = row.querySelector('.rp-laborhours');
      const laborTotalEl = row.querySelector('.rp-labortotal');

      // parse and clamp numeric inputs so negatives don't affect totals
      let qty = toNum(qtyEl ? qtyEl.value : 0);
      let price = toNum(partsPriceEl ? partsPriceEl.value : 0);
      let laborHours = toNum(laborHoursEl ? laborHoursEl.value : 0);
      qty = Math.max(0, qty);
      price = Math.max(0, price);
      laborHours = Math.max(0, laborHours);

      const partsTotal = qty * price;
      const laborTotal = laborHours * 100; // per your request

      if (partsTotalEl) { partsTotalEl.value = fmt(partsTotal); }
      if (laborTotalEl) { laborTotalEl.value = fmt(laborTotal); }

      updateSubtotals();
    }

    function updateSubtotals() {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      let partsSum = 0, laborSum = 0;
      rows.forEach(r => {
        const pt = toNum(r.querySelector('.rp-partstotal')?.value);
        const lt = toNum(r.querySelector('.rp-labortotal')?.value);
        partsSum += pt;
        laborSum += lt;
      });
      if (subPartsEl) subPartsEl.value = fmt(partsSum);
      if (subLaborEl) subLaborEl.value = fmt(laborSum);
      // tax = 6% of parts sum
      const tax = partsSum * 0.06;
      if (taxEl) { taxEl.value = fmt(tax); taxEl.readOnly = true; taxEl.tabIndex = -1; }
      // total estimate excludes labor
      if (totEstimateEl) totEstimateEl.value = fmt(partsSum + tax);
    }

    function sanitizeMinusInput(el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === '-' || e.key === 'Subtract' || e.key === 'Decimal') e.preventDefault();
      });
      el.addEventListener('paste', function (ev) {
        ev.preventDefault();
        const txt = (ev.clipboardData || window.clipboardData).getData('text').replace(/-/g, '');
        document.execCommand('insertText', false, txt);
      });
      el.addEventListener('input', function () {
        if (el.value.includes('-')) el.value = el.value.replace(/-/g, '');
      });
    }

    // If a row's inputs don't have the expected classes (old markup), assign them by column position
    function ensureRowClasses(row) {
      const inputs = Array.from(row.querySelectorAll('input,select'));
      // mapping by column: 0-desc,1-qty,2-part#,3-partprice,4-partstotal,5-laborhours,6-labortotal
      if (inputs.length >= 1 && !inputs[0].classList.contains('rp-desc')) inputs[0].classList.add('rp-desc');
      if (inputs.length >= 2 && !inputs[1].classList.contains('rp-qty')) {
        inputs[1].classList.add('rp-qty');
        // ensure numeric constraints
        try { inputs[1].setAttribute('type', 'number'); inputs[1].setAttribute('min', '0'); } catch (e) { }
      }
      if (inputs.length >= 4 && !inputs[3].classList.contains('rp-partprice')) {
        inputs[3].classList.add('rp-partprice');
        try { inputs[3].setAttribute('type', 'number'); inputs[3].setAttribute('min', '0'); inputs[3].setAttribute('step', '0.01'); } catch (e) { }
      }
      if (inputs.length >= 5 && !inputs[5].classList.contains('rp-laborhours')) {
        inputs[5].classList.add('rp-laborhours');
        try { inputs[5].setAttribute('type', 'number'); inputs[5].setAttribute('min', '0'); inputs[5].setAttribute('step', '0.01'); } catch (e) { }
      }
      if (inputs.length >= 4 && !inputs[4].classList.contains('rp-partstotal')) inputs[4].classList.add('rp-partstotal');
      if (inputs.length >= 6 && !inputs[6].classList.contains('rp-labortotal')) inputs[6].classList.add('rp-labortotal');
    }

    function wireRow(row) {
      // expect inputs with classes used above; when adding rows, ensure same classes are used
      const qty = row.querySelector('.rp-qty');
      const partPrice = row.querySelector('.rp-partprice');
      const laborHours = row.querySelector('.rp-laborhours');
      const partsTotal = row.querySelector('.rp-partstotal');
      const laborTotal = row.querySelector('.rp-labortotal');

      [qty, partPrice, laborHours].forEach(el => {
        if (!el) return;
        // prevent minus sign and sanitize paste
        sanitizeMinusInput(el);
        el.addEventListener('input', () => calcRow(row));
        // enforce integer & non-negative for qty on blur
        if (el.classList && el.classList.contains('rp-qty')) {
          el.addEventListener('blur', () => {
            if (el.value === '' || el.value == null) return;
            let n = Math.floor(Number(el.value) || 0);
            if (n < 0) n = 0;
            el.value = n;
            calcRow(row);
          });
        }
        if (el.classList && (el.classList.contains('rp-partprice') || el.classList.contains('rp-laborhours'))) {
          el.addEventListener('blur', () => {
            if (el.value === '' || el.value == null) return;
            let v = Number(el.value) || 0;
            if (v < 0) v = 0;
            el.value = (Math.round(v * 100) / 100).toFixed(2);
            calcRow(row);
          });
        }
      });

      // make totals readonly and unfocusable
      if (partsTotal) { partsTotal.readOnly = true; partsTotal.tabIndex = -1; partsTotal.setAttribute('aria-readonly', 'true'); }
      if (laborTotal) { laborTotal.readOnly = true; laborTotal.tabIndex = -1; laborTotal.setAttribute('aria-readonly', 'true'); }

      // remove buttons
      const removeBtn = row.querySelector('.remove-repair-line');
      if (removeBtn) removeBtn.addEventListener('click', () => {
        row.parentElement.removeChild(row);
        updateSubtotals();
      });
    }

    // wire existing rows (ensure classes exist first)
    Array.from(table.querySelectorAll('tbody tr')).forEach(r => { ensureRowClasses(r); wireRow(r); });

    // add new row handler (keep markup consistent with your table)
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const tbody = table.querySelector('tbody');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
          <td><input type="text" class="rp-desc" placeholder="Description"></td>
          <td><input type="number" min="0" class="rp-qty" placeholder="1" style="width:4em"></td>
          <td><input type="text" class="rp-um" placeholder="Part #"></td>
          <td><input type="number" min="0" step="0.01" class="rp-partprice" placeholder="0.00"></td>
          <td><input type="text" class="rp-partstotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
          <td><input type="number" min="0" step="0.01" class="rp-laborhours" placeholder="0.00"></td>
          <td><input type="text" class="rp-labortotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
          <td><button type="button" class="remove-repair-line">Remove</button></td>
        `;
        tbody.appendChild(newRow);
        wireRow(newRow);
      });
    }

    // initial subtotal calc
    updateSubtotals();
  })();

  // --- Time pickers (full minute granularity) + total time compute ---
  (function initTimePickers() {
    const form = document.getElementById('repForm');
    if (!form) return;

    function populateTimePickers() {
      const parts = ['timeIn', 'timeOut'];
      parts.forEach(prefix => {
        const hour = document.getElementById(prefix + 'Hour');
        const minute = document.getElementById(prefix + 'Minute');
        const ampm = document.getElementById(prefix + 'AmPm');
        if (!hour || !minute || !ampm) return;

        hour.innerHTML = '';
        hour.add(new Option('Hour', ''));
        for (let h = 1; h <= 12; h++) hour.add(new Option(String(h), String(h)));

        minute.innerHTML = '';
        minute.add(new Option('Min', ''));
        for (let m = 0; m < 60; m++) minute.add(new Option(String(m).padStart(2, '0'), String(m).padStart(2, '0')));

        ampm.innerHTML = '';
        ampm.add(new Option('AM/PM', ''));
        ['AM', 'PM'].forEach(x => ampm.add(new Option(x, x)));
      });
    }

    function computeTotalTime() {
      const inHour = document.getElementById('timeInHour')?.value;
      const inMin = document.getElementById('timeInMinute')?.value;
      const inAmPm = document.getElementById('timeInAmPm')?.value;
      const outHour = document.getElementById('timeOutHour')?.value;
      const outMin = document.getElementById('timeOutMinute')?.value;
      const outAmPm = document.getElementById('timeOutAmPm')?.value;
      const totTimeField = document.getElementById('totTime');
      const hiddenIn = document.getElementById('timeIn');
      const hiddenOut = document.getElementById('timeOut');

      if (!inHour || !inMin || !inAmPm || !outHour || !outMin || !outAmPm) {
        if (totTimeField) totTimeField.value = '';
        if (hiddenIn) hiddenIn.value = '';
        if (hiddenOut) hiddenOut.value = '';
        return;
      }

      const inStr = `${inHour}:${inMin} ${inAmPm}`;
      const outStr = `${outHour}:${outMin} ${outAmPm}`;
      if (hiddenIn) hiddenIn.value = inStr;
      if (hiddenOut) hiddenOut.value = outStr;

      function timeToMinutes(timeStr) {
        let [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      }

      let tIn = timeToMinutes(inStr);
      let tOut = timeToMinutes(outStr);
      if (tOut <= tIn) tOut += 24 * 60; // cross-midnight
      const diff = tOut - tIn; // minutes
      const hh = Math.floor(diff / 60);
      const mm = diff % 60;
      const mmPad = String(mm).padStart(2, '0');
      if (totTimeField) totTimeField.value = ` (${hh}:${mmPad})`;
    }

    populateTimePickers();
    ['timeIn', 'timeOut'].forEach(prefix => {
      ['Hour', 'Minute', 'AmPm'].forEach(suffix => {
        const el = document.getElementById(prefix + suffix);
        if (el) el.addEventListener('change', computeTotalTime);
      });
    });

    // initialize once
    computeTotalTime();
  })();

  // --- Signature canvas setup ---
  (function setupSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const signatureData = document.getElementById('signatureData');
    const clearBtn = document.getElementById('clearSignature');
    if (!canvas || !signatureData) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0, lastY = 0;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x; lastY = y;
    });
    function endDraw(e) {
      if (!isDrawing) return;
      isDrawing = false;
      try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch (err) { }
      try { signatureData.value = canvas.toDataURL('image/png'); } catch (err) { }
    }
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
    canvas.addEventListener('pointerout', endDraw);

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        signatureData.value = '';
      });
    }
  })();

  // helper: create a local filename/path for the signature PNG (no upload)
  function createSignatureFileInfo() {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = 'signature-' + unique + '.png';
    // server-side storage path expected (adjust if your server uses a different folder)
    const relativePath = 'upload/signatures/' + filename;
    return { filename, relativePath };
  }

  // --- Form validation & submit handling (main) ---
  (function initValidation() {
    const form = document.getElementById('repForm');
    if (!form) return;

    function showErrors(errors) {
      if (!errors || errors.length === 0) return;
      alert(errors.join('\n'));
    }

    async function validateAndSubmit(e) {
      e.preventDefault();
      const errors = [];

      // collect elements used earlier in your validation
      const roNumEl = document.getElementById('roNum');
      const roDateEl = document.getElementById('roDate');
      const technicianEl = document.getElementById('technician');
      const timeInEl = document.getElementById('timeIn');
      const timeOutEl = document.getElementById('timeOut');
      const custNameEl = document.getElementById('custName');
      const custAddressEl = document.getElementById('custAddress');
      const diagnosisEl = document.getElementById('diagnosis');
      const taxEl = document.getElementById('tax');
      const totEstimateEl = document.getElementById('totEstimate');
      const signatureData = document.getElementById('signatureData');

      // if the user clicked Complete Ticket, we should validate the Digital Courtesy Check first
      const ticketStatusElTop = document.getElementById('ticketStatus');
      const tryingToCompleteTop = ticketStatusElTop && ticketStatusElTop.value === 'complete';
      if (tryingToCompleteTop) {
        const courtesy = document.getElementById('courtesy-check');
        if (courtesy) {
          const table = courtesy.querySelector('table');
          if (table) {
            const headers = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent||'').trim());
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            const courtesyErrors = [];
            rows.forEach((row, rowIdx) => {
              const firstCell = row.querySelector('td');
              const itemName = (firstCell && firstCell.textContent) ? firstCell.textContent.trim() : `Row ${rowIdx+1}`;
              const selects = Array.from(row.querySelectorAll('select'));
              selects.forEach((sel) => {
                if (!sel.value || String(sel.value).trim() === '') {
                  const cell = sel.closest('td');
                  let colIdx = -1;
                  if (cell && cell.parentElement) colIdx = Array.from(cell.parentElement.children).indexOf(cell);
                  const header = headers[colIdx] || 'Status';
                  courtesyErrors.push(`Courtesy Check — ${itemName}: ${header} is required.`);
                }
              });
              const inputs = Array.from(row.querySelectorAll('input'));
              if (inputs.length > 0) {
                inputs.forEach((inp) => {
                  const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
                  if (ph.includes('note') || ph.includes('comment')) return;
                  const cell = inp.closest('td');
                  if (cell) {
                    const cellIdx = Array.from(cell.parentElement.children).indexOf(cell);
                    const isLastColumn = cellIdx === (row.children.length - 1);
                    if (isLastColumn) return;
                    const header = headers[cellIdx] || `Column ${cellIdx+1}`;
                    const val = (inp.value || '').toString().trim();
                    if (!val) courtesyErrors.push(`Courtesy Check — ${itemName}: ${header} is required.`);
                  }
                });
              }
            });
            if (courtesyErrors.length > 0) {
              showErrors(courtesyErrors);
              return false;
            }
          }
        }
      }

      // basic required checks
      const roNum = roNumEl ? roNumEl.value.trim() : '';
      if (!roNum) errors.push('Repair Order number is required.');
      else if (isNaN(Number(roNum))) errors.push('Repair Order number must be a valid number.');

      const roDate = roDateEl ? roDateEl.value : '';
      if (!roDate) errors.push('Date is required.');

      const technician = technicianEl ? technicianEl.value.trim() : '';
      if (!technician) errors.push('Technician is required.');

      if (!timeInEl || !timeInEl.value) errors.push('Time In must be selected.');
      if (!timeOutEl || !timeOutEl.value) errors.push('Time Out must be selected.');

      const custName = custNameEl ? custNameEl.value.trim() : '';
      if (!custName) errors.push('Customer name is required.');

      const custAddress = custAddressEl ? custAddressEl.value.trim() : '';
      if (!custAddress) errors.push('Customer address is required.');

      // (mileage validation removed)

      const diagnosis = diagnosisEl ? diagnosisEl.value.trim() : '';
      if (!diagnosis) errors.push('Diagnosis is required. Put N/A if none.');

      if (taxEl) {
        const t = taxEl.value.trim();
        if (t !== '' && (isNaN(parseFloat(t)) || parseFloat(t) < 0)) errors.push('Tax must be a non-negative number.');
      }
      if (totEstimateEl) {
        const tt = totEstimateEl.value.trim();
        if (tt !== '' && (isNaN(parseFloat(tt)) || parseFloat(tt) < 0)) errors.push('Total Estimate must be a non-negative number.');
      }

      if (!signatureData || !signatureData.value) errors.push('Customer signature is required.');

      // recommended repairs table validation
      const repairsTable = document.getElementById('repairs-table');
      if (repairsTable) {
        const rows = Array.from(repairsTable.querySelectorAll('tbody tr'));
        rows.forEach((r, idx) => {
          const desc = r.querySelector('.rp-desc')?.value.trim() || '';
          const qty = r.querySelector('.rp-qty')?.value.trim() || '';
          const partPrice = r.querySelector('.rp-partprice')?.value.trim() || '';
          const laborHours = r.querySelector('.rp-laborhours')?.value.trim() || '';
          if (!desc && !qty && !partPrice && !laborHours) return;
          if (qty === '') errors.push(`Row ${idx + 1}: Qty is required when adding a repair line.`);
          else {
            const qn = Number(qty);
            if (!Number.isInteger(qn) || qn < 0) errors.push(`Row ${idx + 1}: Qty must be a non-negative integer.`);
          }
          if (partPrice !== '' && (isNaN(parseFloat(partPrice)) || parseFloat(partPrice) < 0)) errors.push(`Row ${idx + 1}: Part Price must be a non-negative number.`);
          if (laborHours !== '' && (isNaN(parseFloat(laborHours)) || parseFloat(laborHours) < 0)) errors.push(`Row ${idx + 1}: Labor Hours must be a non-negative number.`);
        });
      }

      if (errors.length > 0) {
        showErrors(errors);
        return false;
      }

      // all good -> upload signature (so server stores PNG) then submit
      if (signatureData && signatureData.value) {
        try {
          // do not upload from client. create filename/path and leave dataURL in signatureData.
          // server can save the dataURL to disk using these values when processing the form.
          const fileInfo = createSignatureFileInfo();
          // ensure hidden inputs for server-side form processing
          let sigFileEl = document.getElementById('signatureFilename');
          if (!sigFileEl) {
            sigFileEl = document.createElement('input');
            sigFileEl.type = 'hidden';
            sigFileEl.id = 'signatureFilename';
            sigFileEl.name = 'signatureFilename';
            form.appendChild(sigFileEl);
          }
          let sigPathEl = document.getElementById('signaturePath');
          if (!sigPathEl) {
            sigPathEl = document.createElement('input');
            sigPathEl.type = 'hidden';
            sigPathEl.id = 'signaturePath';
            sigPathEl.name = 'signaturePath';
            form.appendChild(sigPathEl);
          }
          // ensure signatureData contains the PNG dataURL; if not, create from canvas
          const canvas = document.getElementById('signatureCanvas');
          if ((!signatureData.value || signatureData.value === '') && canvas) {
            try { signatureData.value = canvas.toDataURL('image/png'); } catch (e) { /* ignore */ }
          }
          sigFileEl.value = fileInfo.filename;
          sigPathEl.value = fileInfo.relativePath;
        } catch (err) {
          console.error('Signature processing failed:', err);
          showErrors(['Failed to process signature. Please try again.']);
          return false;
        }
      } // end if (signatureData && signatureData.value)

      // If completing the ticket, enforce full Digital Courtesy Check validation
      const ticketStatusEl = document.getElementById('ticketStatus');
      const tryingToComplete = ticketStatusEl && ticketStatusEl.value === 'complete';
      if (tryingToComplete) {
        const courtesy = document.getElementById('courtesy-check');
        if (courtesy) {
          const table = courtesy.querySelector('table');
          if (table) {
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            rows.forEach((row, idx) => {
              // require all select elements in the row (status) to have a value
              const selects = Array.from(row.querySelectorAll('select'));
              selects.forEach((sel) => {
                if (!sel.value || String(sel.value).trim() === '') {
                  errors.push(`Courtesy Check row ${idx+1}: status must be selected.`);
                }
              });

              // require any inputs in the row other than the last column (notes) to be filled
              const inputs = Array.from(row.querySelectorAll('input'));
              if (inputs.length > 0) {
                // treat the last input in the row as 'notes' (optional)
                inputs.forEach((inp, i) => {
                  if (i === inputs.length - 1) return; // skip notes
                  if (!String(inp.value || '').trim()) {
                    errors.push(`Courtesy Check row ${idx+1}: required field is empty.`);
                  }
                });
              }
            });
          }
        }
        // comprehensive required-fields check across the main form (excluding notes/comments and optional fields)
        (function comprehensiveCheck() {
          const main = document.querySelector('main');
          if (!main) return;
          const candidates = Array.from(main.querySelectorAll('input,select,textarea'));
          candidates.forEach((el) => {
            try {
              if (!el) return;
              // skip hidden, disabled, readonly
              if (el.type === 'hidden' || el.disabled) return;
              if (el.hasAttribute('readonly') && el.getAttribute('aria-readonly') === 'true') return;
              // skip file inputs and buttons
              if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
              // skip known hidden helpers
              const skipNames = ['repairs','tags','signature','ticketStatus','subTotParts','subTotLabor','tax','totEstimate','timeIn','timeOut','timeInHour','timeInMinute','timeInAmPm','timeOutHour','timeOutMinute','timeOutAmPm','totTime'];
              if (el.name && skipNames.includes(el.name)) return;
              if (el.id && skipNames.includes(el.id)) return;

              // skip inputs that are clearly notes/comments: placeholder or nearby label contains "Comments" or "Notes"
              const ph = (el.getAttribute('placeholder') || '').toLowerCase();
              if (ph.includes('notes') || ph.includes('comments')) return;
              // find a nearby label
              let labelText = '';
              if (el.id) {
                const lab = main.querySelector(`label[for="${el.id}"]`);
                if (lab) labelText = (lab.textContent || '').trim();
              }
              if (!labelText) {
                const parentLabel = el.closest('.form-group')?.querySelector('label');
                if (parentLabel) labelText = (parentLabel.textContent || '').trim();
              }
              const lowerLabel = (labelText || '').toLowerCase();
              if (lowerLabel.includes('comments') || lowerLabel.includes('notes')) return;

              // skip inputs that are part of the repairs table (we validate repairs separately)
              if (el.closest && el.closest('#repairs-table')) return;

              // For selects, ensure a non-empty value
              if (el.tagName.toLowerCase() === 'select') {
                if (!el.value || String(el.value).trim() === '') {
                  const name = labelText || (el.name || el.id) || 'Unnamed select';
                  errors.push(`Required: ${name}`);
                }
                return;
              }

              // For text inputs and textareas, require non-empty
              const val = (el.value || '').toString().trim();
              if (!val) {
                const name = labelText || (el.name || el.id) || 'Unnamed field';
                errors.push(`Required: ${name}`);
              }
            } catch (e) {
              console.warn('Validation check error for element', el, e);
            }
          });
        })();
      }

      // If the complete-ticket checks added any errors, show them and stop submission
      if (errors.length > 0) {
        showErrors(errors);
        return false;
      }

      // all good -> submit
      // serialize recommended repairs into hidden input so server can process them
      try {
        const repairsHidden = document.getElementById('repairs-hidden');
        const repairsTable = document.getElementById('repairs-table');
        const repairs = [];
        if (repairsTable) {
          const rows = Array.from(repairsTable.querySelectorAll('tbody tr'));
          rows.forEach(r => {
            // prefer class names, fallback to positional inputs
            const desc = (r.querySelector('.rp-desc')?.value || (r.querySelectorAll('input,select')[0]?.value || '')).trim();
            const qty = (r.querySelector('.rp-qty')?.value || (r.querySelectorAll('input,select')[1]?.value || '')).trim();
            const partNumber = (r.querySelector('.rp-um')?.value || (r.querySelectorAll('input,select')[2]?.value || '')).trim();
            const partPrice = (r.querySelector('.rp-partprice')?.value || (r.querySelectorAll('input,select')[3]?.value || '')).trim();
            const partsTotal = (r.querySelector('.rp-partstotal')?.value || (r.querySelectorAll('input,select')[4]?.value || '')).trim();
            const laborHours = (r.querySelector('.rp-laborhours')?.value || (r.querySelectorAll('input,select')[5]?.value || '')).trim();
            const laborTotal = (r.querySelector('.rp-labortotal')?.value || (r.querySelectorAll('input,select')[6]?.value || '')).trim();
            // skip empty rows
            if (!desc && !qty && !partNumber && !partPrice && !laborHours) return;
            repairs.push({ repairDescription: desc, qty: qty, partNumber: partNumber, partPrice: partPrice, partsTotal: partsTotal, laborHours: laborHours, laborTotal: laborTotal });
          });
        }
        if (repairsHidden) repairsHidden.value = JSON.stringify(repairs);
      } catch (err) {
        console.error('Failed to serialize repairs:', err);
      }

      form.submit();
      return true;
    }

    form.addEventListener('submit', validateAndSubmit);

  })();
  
  // --- Brake pads/rotors color coding based on thickness ---
  (function initBrakeColorCoding() {
    const brakesSection = document.getElementById('brakes');
    if (!brakesSection) return;

    const brakesTable = brakesSection.querySelector('table');
    if (!brakesTable) return;

    // Get all select elements in the brakes table
    const selects = brakesTable.querySelectorAll('select');

    function updateSelectColor(select) {
      const value = parseInt(select.value, 10);
      let bgColor = '';

      if (value >= 1 && value <= 2) {
        bgColor = '#ffcccc'; // light red
      } else if (value >= 3 && value <= 4) {
        bgColor = '#ffffcc'; // light yellow
      } else if (value >= 5 && value <= 12) {
        bgColor = '#ccffcc'; // light green
      }

      select.style.backgroundColor = bgColor;
    }

    // Initialize colors and add change listeners
    selects.forEach(select => {
      updateSelectColor(select);
      select.addEventListener('change', function () {
        updateSelectColor(this);
      });
    });
  })();


  // --- Complete Ticket button at bottom wiring ---
  (function wireCompleteTicketBottom() {
    const btn = document.getElementById('completeTicketBottom');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const form = document.getElementById('repForm');
      if (!form) return alert('Main form not found');

      // Run an immediate courtesy-check here and block if missing items
      const courtesy = document.getElementById('courtesy-check');
      if (courtesy) {
        const table = courtesy.querySelector('table');
        if (table) {
          const headers = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent||'').trim());
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          const courtesyErrors = [];
          rows.forEach((row, rowIdx) => {
            const firstCell = row.querySelector('td');
            const itemName = (firstCell && firstCell.textContent) ? firstCell.textContent.trim() : `Row ${rowIdx+1}`;
            const selects = Array.from(row.querySelectorAll('select'));
            selects.forEach((sel) => {
              if (!sel.value || String(sel.value).trim() === '') {
                const cell = sel.closest('td');
                let colIdx = -1;
                if (cell && cell.parentElement) colIdx = Array.from(cell.parentElement.children).indexOf(cell);
                const header = headers[colIdx] || 'Status';
                courtesyErrors.push(`Courtesy Check — ${itemName}: ${header} is required.`);
              }
            });
            const inputs = Array.from(row.querySelectorAll('input'));
            if (inputs.length > 0) {
              inputs.forEach((inp) => {
                const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
                if (ph.includes('note') || ph.includes('comment')) return;
                const cell = inp.closest('td');
                if (cell) {
                  const cellIdx = Array.from(cell.parentElement.children).indexOf(cell);
                  const isLastColumn = cellIdx === (row.children.length - 1);
                  if (isLastColumn) return;
                  const header = headers[cellIdx] || `Column ${cellIdx+1}`;
                  const val = (inp.value || '').toString().trim();
                  if (!val) courtesyErrors.push(`Courtesy Check — ${itemName}: ${header} is required.`);
                }
              });
            }
          });
          if (courtesyErrors.length > 0) {
            alert(courtesyErrors.join('\n'));
            return;
          }
        }
      }

      const status = document.getElementById('ticketStatus');
      if (status) status.value = 'complete';
      // use requestSubmit so the form's submit handler runs
      try { form.requestSubmit(); } catch (e) { form.submit(); }
    });
  })();

});

// --- Populate form from server-provided ticket JSON (if present) ---
(function populateFromServerTicket() {
  try {
    // attempt to read hidden input first
    var serverEl = document.getElementById('server-ticket');
    var raw = serverEl ? serverEl.value : null;
    if (!raw && window.__SERVER_TICKET__) raw = JSON.stringify(window.__SERVER_TICKET__);
    if (!raw) return;
    var ticket = JSON.parse(raw);
    if (!ticket) return;

    // run when DOM is ready
    function applyTicket() {
      try {
        console.log('populateFromServerTicket: applying ticket', ticket);
        if (ticket.date) document.getElementById('roDate') && (document.getElementById('roDate').value = ticket.date || '');
        if (ticket.techName) document.getElementById('technician') && (document.getElementById('technician').value = ticket.techName || '');
        // Repair order can be named differently in DB: try several possibilities
        const ro = ticket.roNum || ticket.repairOrderNumber || ticket.ro || ticket.repairOrder || ticket.repair_order || '';
        if (ro) {
          const roEl = document.getElementById('roNum');
          if (roEl) roEl.value = ro;
        }

        // timeIn/timeOut: set hidden fields and the individual selects if present
        if (ticket.timeIn) document.getElementById('timeIn') && (document.getElementById('timeIn').value = ticket.timeIn || '');
        if (ticket.timeOut) document.getElementById('timeOut') && (document.getElementById('timeOut').value = ticket.timeOut || '');
        if (ticket.totalTime) document.getElementById('totTime') && (document.getElementById('totTime').value = ticket.totalTime || '');
        if (ticket.customerName) document.getElementById('custName') && (document.getElementById('custName').value = ticket.customerName || '');
        if (ticket.customerAddress) document.getElementById('custAddress') && (document.getElementById('custAddress').value = ticket.customerAddress || '');
        if (ticket.customerPhone) document.getElementById('custPhone') && (document.getElementById('custPhone').value = ticket.customerPhone || '');
        if (ticket.customerEmail) document.getElementById('custEmail') && (document.getElementById('custEmail').value = ticket.customerEmail.toLowerCase() || '');
        if (ticket.concern) document.getElementById('concern') && (document.getElementById('concern').value = ticket.concern || '');
        if (ticket.diagnosis) document.getElementById('diagnosis') && (document.getElementById('diagnosis').value = ticket.diagnosis || '');
        if (ticket.dateSigned) document.getElementById('sDate') && (document.getElementById('sDate').value = ticket.dateSigned || '');
        if (ticket.customerSignature) {
          var sigField = document.getElementById('signatureData');
          if (sigField) sigField.value = ticket.customerSignature || '';
        }

        // populate repairs table: use same markup as the add-row template so classes are correct
        if (Array.isArray(ticket.repairs) && ticket.repairs.length) {
          var tbody = document.querySelector('#repairs-table tbody');
          if (tbody) {
            tbody.innerHTML = '';
            ticket.repairs.forEach(function(r){
              var tr = document.createElement('tr');
              tr.innerHTML = `
                <td><input type="text" class="rp-desc" placeholder="Description"></td>
                <td><input type="number" min="0" class="rp-qty" placeholder="1" style="width:4em"></td>
                <td><input type="text" class="rp-um" placeholder="Part #"></td>
                <td><input type="number" min="0" step="0.01" class="rp-partprice" placeholder="0.00"></td>
                <td><input type="text" class="rp-partstotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
                <td><input type="number" min="0" step="0.01" class="rp-laborhours" placeholder="0.00"></td>
                <td><input type="text" class="rp-labortotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
                <td><button type="button" class="remove-repair-line">Remove</button></td>
              `;
              tbody.appendChild(tr);
              // fill values
              try { tr.querySelector('.rp-desc').value = r.repairDescription || ''; } catch (e) {}
              try { tr.querySelector('.rp-qty').value = (r.qty != null) ? r.qty : ''; } catch (e) {}
              try { tr.querySelector('.rp-um').value = r.partNumber || ''; } catch (e) {}
              try { tr.querySelector('.rp-partprice').value = (r.partPrice != null) ? r.partPrice : ''; } catch (e) {}
              try { tr.querySelector('.rp-partstotal').value = (r.partsTotal != null) ? r.partsTotal : ''; } catch (e) {}
              try { tr.querySelector('.rp-laborhours').value = (r.laborHours != null) ? r.laborHours : ''; } catch (e) {}
              try { tr.querySelector('.rp-labortotal').value = (r.laborTotal != null) ? r.laborTotal : ''; } catch (e) {}
              // wire the row behaviors already present in the page if available
              try { if (typeof ensureRowClasses === 'function') ensureRowClasses(tr); } catch(e){}
              try { if (typeof wireRow === 'function') wireRow(tr); } catch(e){}
            });
            // update subtotals after populating: attempt to call existing helper, otherwise compute locally
            try {
              if (typeof updateSubtotals === 'function') updateSubtotals();
              else {
                // compute sums locally
                const rowsNow = Array.from(tbody.querySelectorAll('tr'));
                let partsSum = 0, laborSum = 0;
                rowsNow.forEach(rr => {
                  const pt = parseFloat((rr.querySelector('.rp-partstotal') && rr.querySelector('.rp-partstotal').value) || '') || 0;
                  const lt = parseFloat((rr.querySelector('.rp-labortotal') && rr.querySelector('.rp-labortotal').value) || '') || 0;
                  // fallback: compute from qty * price or laborHours * 100
                  if (!pt) {
                    const qty = parseFloat((rr.querySelector('.rp-qty') && rr.querySelector('.rp-qty').value) || '') || 0;
                    const price = parseFloat((rr.querySelector('.rp-partprice') && rr.querySelector('.rp-partprice').value) || '') || 0;
                    partsSum += qty * price;
                  } else partsSum += pt;
                  if (!lt) {
                    const lh = parseFloat((rr.querySelector('.rp-laborhours') && rr.querySelector('.rp-laborhours').value) || '') || 0;
                    laborSum += lh * 100;
                  } else laborSum += lt;
                });
                const subPartsEl = document.getElementById('subTotParts');
                const subLaborEl = document.getElementById('subTotLabor');
                const taxEl = document.getElementById('tax');
                const totEstimateEl = document.getElementById('totEstimate');
                function fmt(n){ return (Math.round(n * 100) / 100).toFixed(2); }
                if (subPartsEl) subPartsEl.value = fmt(partsSum);
                if (subLaborEl) subLaborEl.value = fmt(laborSum);
                const tax = partsSum * 0.06;
                if (taxEl) taxEl.value = fmt(tax);
                if (totEstimateEl) totEstimateEl.value = fmt(partsSum + tax);
              }
            } catch(e){}
          }
        }
        
        // set time picker select values (if individual selects exist) by parsing the ticket.timeIn/timeOut
        function setTimeSelects(prefix, timeStr) {
          if (!timeStr) return;
          const parts = timeStr.split(' ');
          if (parts.length < 2) return;
          const time = parts[0];
          const period = parts[1];
          const [h, m] = time.split(':');
          const hEl = document.getElementById(prefix + 'Hour');
          const mEl = document.getElementById(prefix + 'Minute');
          const pEl = document.getElementById(prefix + 'AmPm');
          try { if (hEl) { hEl.value = String(parseInt(h,10)); hEl.dispatchEvent(new Event('change')); } } catch(e){}
          try { if (mEl) { mEl.value = String(m).padStart(2,'0'); mEl.dispatchEvent(new Event('change')); } } catch(e){}
          try { if (pEl) { pEl.value = period; pEl.dispatchEvent(new Event('change')); } } catch(e){}
        }

        setTimeSelects('timeIn', ticket.timeIn);
        setTimeSelects('timeOut', ticket.timeOut);
        // populate other sections from ticket.sections by table name
        try {
          const sections = ticket.sections || {};
          const tableKeys = Object.keys(sections || {});
          if (tableKeys.length) {
            tableKeys.forEach(tname => {
              if (!tname) return;
              const key = String(tname).toLowerCase();
              const rows = sections[tname] || sections[key] || [];
              if (!rows || !rows.length) return;

              // helper to set inputs/selects inside a container by matching name/id (case-insensitive)
              function setFormValuesFromRow(container, row) {
                try {
                  const inputs = Array.from(container.querySelectorAll('input,select,textarea'));
                  Object.keys(row).forEach(k => {
                    if (k == null) return;
                    const lk = String(k).toLowerCase();
                    const v = row[k] == null ? '' : row[k];
                    // find by name or id (case-insensitive)
                    const el = inputs.find(i => ((i.name && i.name.toLowerCase() === lk) || (i.id && i.id.toLowerCase() === lk)));
                    if (el) { try { el.value = v; el.dispatchEvent(new Event('change')); } catch (e) {} }
                  });
                } catch (e) { console.warn('setFormValuesFromRow error', e); }
              }

              // mapping by table name
              if (key === 'vechicleinfo' || key === 'vehicleinfo' || key === 'vehicle_info') {
                const form = document.getElementById('vehicle-info-form');
                if (form) setFormValuesFromRow(form, rows[0]);
                return;
              }

              if (key === 'recrepairs' || key === 'recrepair' || key === 'recrepairs' || key === 'recrepairs' || key === 'recrepairs') {
                // populate repairs table similarly to ticket.repairs
                const tbody = document.querySelector('#repairs-table tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                rows.forEach(r => {
                  const tr = document.createElement('tr');
                  tr.innerHTML = `
                    <td><input type="text" class="rp-desc" placeholder="Description"></td>
                    <td><input type="number" min="0" class="rp-qty" placeholder="1" style="width:4em"></td>
                    <td><input type="text" class="rp-um" placeholder="Part #"></td>
                    <td><input type="number" min="0" step="0.01" class="rp-partprice" placeholder="0.00"></td>
                    <td><input type="text" class="rp-partstotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
                    <td><input type="number" min="0" step="0.01" class="rp-laborhours" placeholder="0.00"></td>
                    <td><input type="text" class="rp-labortotal" placeholder="0.00" readonly tabindex="-1" aria-readonly="true"></td>
                    <td><button type="button" class="remove-repair-line">Remove</button></td>
                  `;
                  tbody.appendChild(tr);
                  try { tr.querySelector('.rp-desc').value = r.repairDescription || r.item || ''; } catch(e){}
                  try { tr.querySelector('.rp-qty').value = r.qty || ''; } catch(e){}
                  try { tr.querySelector('.rp-um').value = r.partNumber || r.part || ''; } catch(e){}
                  try { tr.querySelector('.rp-partprice').value = (r.partPrice != null) ? r.partPrice : ''; } catch(e){}
                  try { tr.querySelector('.rp-partstotal').value = (r.partsTotal != null) ? r.partsTotal : ''; } catch(e){}
                  try { tr.querySelector('.rp-laborhours').value = (r.laborHours != null) ? r.laborHours : ''; } catch(e){}
                  try { tr.querySelector('.rp-labortotal').value = (r.laborTotal != null) ? r.laborTotal : ''; } catch(e){}
                  try { if (typeof ensureRowClasses === 'function') ensureRowClasses(tr); } catch(e){}
                  try { if (typeof wireRow === 'function') wireRow(tr); } catch(e){}
                });
                try { if (typeof updateSubtotals === 'function') updateSubtotals(); } catch(e) {}
                return;
              }

              if (key === 'courtytable' || key === 'courtytableitems' || key === 'courtesytable' || key === 'courtesytableitems' || key === 'courtesy') {
                const courtesySection = document.getElementById('courtesy-check');
                const table = courtesySection ? courtesySection.querySelector('table') : document.querySelector('#courtesy-table');
                if (!table) return;
                const headers = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent || '').trim().toLowerCase());
                const rowsDom = Array.from(table.querySelectorAll('tbody tr'));
                rows.forEach(item => {
                  const name = item.item || item.name || item.label || item.Item || '';
                  if (!name) return;
                  let rowDom = rowsDom.find(r => r.dataset && r.dataset.item === name);
                  if (!rowDom) {
                    rowDom = rowsDom.find(r => {
                      const first = r.cells && r.cells[0];
                      return first && first.textContent && first.textContent.trim() === name.trim();
                    });
                  }
                  if (!rowDom) return;
                  // status -> second column select, notes -> third column input
                  try {
                    const status = item.status || item.Status || '';
                    const notes = item.notes || item.Notes || item.comments || '';
                    const sel = rowDom.querySelector('select');
                    if (sel && status) { sel.value = status; sel.dispatchEvent(new Event('change')); }
                    const noteIn = rowDom.querySelector('input[type="text"]');
                    if (noteIn && notes) noteIn.value = notes;
                  } catch (e) { }
                });
                // set parent comments (full-width) if the server provided them via joined rows
                try {
                  const parentComments = (rows[0] && (rows[0].courtesyComments || rows[0].comments)) || '';
                  if (parentComments) {
                    const commentsInput = (courtesySection && courtesySection.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea')) || document.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
                    if (commentsInput) {
                      commentsInput.value = parentComments;
                    }
                  }
                } catch (e) { }
                return;
              }

              if (key === 'tires') {
                const sec = document.getElementById('tires');
                if (!sec) return;
                const groups = Array.from(sec.querySelectorAll('.form-group'));
                // take first row
                const r = rows[0];
                if (!r) return;
                groups.forEach(g => {
                  const lab = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
                  const input = g.querySelector('input,select');
                  if (!input) return;
                  if (lab.includes('size')) input.value = r.size || r.Size || '';
                  else if (lab.includes('speed')) input.value = r.speedRating || r.SpeedRating || r.speedrating || '';
                  else if (lab.includes('lf')) input.value = r.LF || r.lf || '';
                  else if (lab.includes('rf')) input.value = r.RF || r.rf || '';
                  else if (lab.includes('lr')) input.value = r.LR || r.lr || '';
                  else if (lab.includes('rr')) input.value = r.RR || r.rr || '';
                  else if (lab.includes('sp')) input.value = r.SP || r.sp || '';
                  else if (lab.includes('tread')) input.value = r.treadDepth32 || r.treadDepth || r.treadDepth32 || '';
                  else if (lab.includes('rotation')) input.value = r.rotationDue || r.rotation || '';
                  else if (lab.includes('balance')) input.value = r.balance || '';
                  else if (lab.includes('alignment')) input.value = r.alignment || '';
                  else if (lab.includes('comments')) input.value = r.comments || '';
                });
                return;
              }

              if (key === 'steeringsuspension' || key === 'steeringsuspensiontable' || key === 'steering' || key === 'steering_suspension') {
                const sec = document.getElementById('steering');
                if (!sec) return;
                const rowsDom = Array.from(sec.querySelectorAll('tbody tr'));
                // helper to normalize labels for tolerant matching
                const normalize = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                const unmatched = [];
                rows.forEach(r => {
                  const name = r.item || r.Item || r.itemName || r.name || r.label || '';
                  if (!name) return;
                  const targetNorm = normalize(name);
                  let rowDom = rowsDom.find(rr => {
                    try {
                      const txt = (rr.cells && rr.cells[0] && rr.cells[0].textContent) ? rr.cells[0].textContent : '';
                      const tnorm = normalize(txt);
                      return tnorm === targetNorm;
                    } catch (e) { return false; }
                  });
                  if (!rowDom) {
                    // try partial or reverse match
                    rowDom = rowsDom.find(rr => {
                      try {
                        const txt = (rr.cells && rr.cells[0] && rr.cells[0].textContent) ? rr.cells[0].textContent : '';
                        const tnorm = normalize(txt);
                        return tnorm.includes(targetNorm) || targetNorm.includes(tnorm);
                      } catch (e) { return false; }
                    });
                  }
                  if (!rowDom) {
                    unmatched.push(name);
                    return;
                  }
                  if (!rowDom) return;
                  // set left/right/front/rear if present
                  try {
                    ['left','right','front','rear'].forEach(col => {
                      const val = r[col] || r[col.charAt(0).toUpperCase()+col.slice(1)] || '';
                      if (!val) return;
                      // find corresponding cell by header names
                      const headerCells = Array.from(sec.querySelectorAll('thead th')).map(h=> (h.textContent||'').toLowerCase());
                      const idx = headerCells.findIndex(h => h.includes(col));
                      if (idx !== -1 && rowDom.cells[idx]) {
                        const cell = rowDom.cells[idx];
                        const input = cell.querySelector('select, input');
                        if (input) {
                          try {
                            input.value = val;
                            // if direct assign didn't match an option (select stays unchanged), try fuzzy-matching options by text/value
                            if (input.tagName && input.tagName.toLowerCase() === 'select') {
                              const cur = input.value;
                              const norm = s => (s||'').toString().toLowerCase().trim();
                              if (norm(cur) !== norm(val)) {
                                const opt = Array.from(input.options).find(o => norm(o.text) === norm(val) || norm(o.value) === norm(val));
                                if (opt) input.value = opt.value;
                              }
                            }
                            input.dispatchEvent(new Event('change'));
                          } catch (e) {
                            try { input.value = val; input.dispatchEvent(new Event('change')); } catch (e2) { /* ignore */ }
                          }
                        } else {
                          // No input/select in this cell — do not overwrite plain text dashes; try to find a select elsewhere in the row that corresponds to this header
                          try {
                            const headerCells = Array.from(sec.querySelectorAll('thead th')).map(h=> (h.textContent||'').toLowerCase());
                            // find select in same row whose header includes the column name
                            const sel = Array.from(rowDom.querySelectorAll('select')).find(s => {
                              try {
                                const selIdx = Array.from(rowDom.cells).indexOf(s.closest('td'));
                                const hdr = headerCells[selIdx] || '';
                                return hdr.includes(col);
                              } catch (e) { return false; }
                            });
                            if (sel) {
                              try {
                                sel.value = val;
                                const norm = s => (s||'').toString().toLowerCase().trim();
                                if (norm(sel.value) !== norm(val)) {
                                  const opt = Array.from(sel.options).find(o => norm(o.text) === norm(val) || norm(o.value) === norm(val));
                                  if (opt) sel.value = opt.value;
                                }
                                sel.dispatchEvent(new Event('change'));
                              } catch (e) {}
                            }
                          } catch (e) { /* ignore fallback */ }
                        }
                      }
                    });
                  } catch (e) { }
                });
                if (unmatched.length) {
                  console.warn('Steering populate: unmatched items (no DOM row found):', unmatched);
                }

                // populate parent comments from the joined rows if present
                try {
                  const parentComments = (rows[0] && (rows[0].steeringComments || rows[0].comments)) || '';
                  if (parentComments) {
                    const commentsInput = sec.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
                    if (commentsInput) commentsInput.value = parentComments;
                  }
                } catch (e) {}
                return;
              }

              if (key === 'brakestable' || key === 'brakes' || key === 'brakes_table') {
                const sec = document.getElementById('brakes');
                if (!sec) return;
                const rowsDom = Array.from(sec.querySelectorAll('tbody tr'));
                // helper to normalize labels
                const normalize = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                // find header indexes
                const headerCells = Array.from(sec.querySelectorAll('thead th')).map(h => (h.textContent||'').toLowerCase());
                const findIdx = (keys) => {
                  const ks = Array.isArray(keys) ? keys : [keys];
                  return headerCells.findIndex(h => ks.some(k => h.includes(k)));
                };
                const specIdx = findIdx(['spec']);
                const actualIdx = findIdx(['actual','value']);
                const statusIdx = findIdx(['status']);
                const commentsIdx = findIdx(['comment','notes','note']);

                const unmatched = [];
                rows.forEach(r => {
                  const name = r.item || r.Item || r.itemName || r.name || r.label || '';
                  if (!name) return;
                  const targetNorm = normalize(name);
                  let rowDom = rowsDom.find(rr => {
                    try { return normalize((rr.cells && rr.cells[0] && rr.cells[0].textContent) ? rr.cells[0].textContent : '') === targetNorm; } catch (e) { return false; }
                  });
                  if (!rowDom) {
                    rowDom = rowsDom.find(rr => {
                      try {
                        const txt = (rr.cells && rr.cells[0] && rr.cells[0].textContent) ? rr.cells[0].textContent : '';
                        const tnorm = normalize(txt);
                        return tnorm.includes(targetNorm) || targetNorm.includes(tnorm);
                      } catch (e) { return false; }
                    });
                  }
                  if (!rowDom) { unmatched.push(name); return; }

                  // helper to set a cell value by index
                  const setCellVal = (idx, val) => {
                    if (idx === -1) return;
                    try {
                      const cell = rowDom.cells[idx];
                      if (!cell) return;
                      const input = cell.querySelector('select, input, textarea');
                      if (input) {
                        // try direct assign
                        input.value = val || '';
                        // if select didn't match, try fuzzy match on options
                        if (input.tagName && input.tagName.toLowerCase() === 'select') {
                          const norm = s => (s||'').toString().toLowerCase().trim();
                          if (norm(input.value) !== norm(val)) {
                            const opt = Array.from(input.options).find(o => norm(o.text) === norm(val) || norm(o.value) === norm(val));
                            if (opt) input.value = opt.value;
                          }
                        }
                        input.dispatchEvent(new Event('change'));
                      } else {
                        // no input; leave text alone (do not overwrite '-')
                      }
                    } catch (e) { /* ignore */ }
                  };

                  setCellVal(specIdx, r.Spec || r.spec || '');
                  setCellVal(actualIdx, r.actual || r.Actual || r.value || '');
                  setCellVal(statusIdx, r.status || r.Status || '');
                  setCellVal(commentsIdx, r.comments || r.Notes || r.notes || '');
                });

                if (unmatched.length) console.warn('Brakes populate: unmatched items:', unmatched);
                // populate parent comments from joined rows if present
                try {
                  const parentComments = (rows[0] && (rows[0].brakesComments || rows[0].comments)) || '';
                  if (parentComments) {
                    const commentsInput = sec.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
                    if (commentsInput) commentsInput.value = parentComments;
                  }
                } catch (e) {}
                return;
              }

              if (key === 'emissionstable' || key === 'emissions' || key === 'emissions_table') {
                // emissionsTable -> top emissions list
                const sec = document.getElementById('emissions');
                if (!sec) return;
                const topTable = sec.querySelector('table');
                if (topTable) {
                  const rowsDom = Array.from(topTable.querySelectorAll('tbody tr'));
                  rows.forEach(r => {
                    const name = r.item || r.Item || r.name || '';
                    if (!name) return;
                    const rowDom = rowsDom.find(rr => (rr.cells && rr.cells[0] && rr.cells[0].textContent && rr.cells[0].textContent.trim() === name.trim()));
                    if (!rowDom) return;
                    try {
                      const status = r.status || r.Status || '';
                      const notes = r.notes || r.Notes || r.comments || '';
                      const sel = rowDom.querySelector('select'); if (sel && status) { sel.value = status; sel.dispatchEvent(new Event('change')); }
                      const ni = rowDom.querySelector('input[type="text"]'); if (ni && notes) ni.value = notes;
                    } catch (e) {}
                  });
                }
                // Populate parent emissions fields and warnings from ticket.sections.emissions (if present)
                try {
                  const parent = (ticket && ticket.sections && (ticket.sections.emissions || ticket.sections['emissions'])) || null;
                  if (parent) {
                    // populate middle form-grid fields by matching labels
                    const groups = Array.from(sec.querySelectorAll('.form-grid .form-group'));
                    const mapKeys = {
                      OBD: ['obd','obd/emissions','obd_emissions','obd'],
                      inspections: ['inspections','inspection','inspected'],
                      emissionsDue: ['emissionsdue','emissions_due','emissionsdue','emissiondue','emission_due','emission due'],
                      nextOilChange: ['nextoilchange','nextOilChange','next_oil_change','nextoilchange','next oil change','next oil','nextoil'],
                      inspectedBy: ['inspectedby','inspectedBy','inspected_by'],
                      reInspectedBy: ['reinspectedby','reInspectedBy','re_inspected_by']
                    };
                    Object.keys(mapKeys).forEach(k => {
                      const aliases = mapKeys[k];
                      for (const g of groups) {
                        const lbl = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
                        if (!lbl) continue;
                        const matched = aliases.some(a => lbl.includes(a.toLowerCase()) || a.toLowerCase().includes(lbl));
                        if (matched) {
                          const inp = g.querySelector('input,select,textarea');
                          if (inp && (parent[k] != null && parent[k] !== '')) {
                            try { inp.value = parent[k]; inp.dispatchEvent(new Event('change')); } catch(e) {}
                          }
                        }
                      }
                    });

                    // populate parent comments (full-width)
                    try {
                      const parentComments = parent.comments || parent.emissionsComments || parent.comments || '';
                      if (parentComments) {
                        const commentsGroup = Array.from(sec.querySelectorAll('.form-group.full-width')).find(g => { const l=(g.querySelector('label')&&g.querySelector('label').textContent||'').toLowerCase(); return l.includes('comment'); });
                        const cinput = commentsGroup && commentsGroup.querySelector('input,textarea');
                        if (cinput) { cinput.value = parentComments; cinput.dispatchEvent(new Event('change')); }
                      }
                    } catch(e) {}
                  }

                  // populate warnings/tags from ticket.sections.emissionsWarnings or fallback keys
                  const warnRows = (ticket && ticket.sections && (ticket.sections.emissionsWarnings || ticket.sections.warningstable || ticket.sections.warnings || [])) || [];
                  if (Array.isArray(warnRows) && warnRows.length) {
                    try {
                      const tagsHidden = document.getElementById('tags-hidden');
                      const list = document.getElementById('tag-list');
                      if (tagsHidden && list) {
                        const items = warnRows.map(r => (r.item || r.Item || r.name || '').toString()).filter(Boolean);
                        tagsHidden.value = items.join(',');
                        list.innerHTML = '';
                        items.forEach((t) => {
                          const chip = document.createElement('div'); chip.className = 'tag-chip'; chip.textContent = t;
                          const x = document.createElement('button'); x.type='button'; x.className='tag-remove'; x.textContent='×';
                          x.addEventListener('click', () => { /* no-op on load */ });
                          chip.appendChild(x); list.appendChild(chip);
                        });
                      }
                    } catch (e) { /* ignore */ }
                  }
                } catch (e) { /* ignore */ }
                // emissions (form inputs) may exist under 'emissions' table (separate)
                if (key === 'emissions') {
                  // rows may represent a single row with form fields
                  const row = rows[0];
                  if (row) {
                    const mapping = {
                      OBD: ['obd','obd/emissions','obd_emissions','obd'],
                      inspections: ['inspections','inspection','inspected'],
                      emissionsDue: ['emissionsdue','emissions_due','emissionsdue'],
                      nextOilChange: ['nextoilchange','nextOilChange','next_oil_change','nextOilChange'],
                      inspectedBy: ['inspectedby','inspectedBy','inspected_by'],
                      reInspectedBy: ['reinspectedby','reInspectedBy','re_inspected_by','reInspectedBy'],
                      warnings: ['warnings','warnings'],
                      comments: ['comments','comment']
                    };
                    Object.keys(mapping).forEach(k => {
                      const keys = mapping[k];
                      let val = '';
                      for (let i=0;i<keys.length;i++) { if (row[keys[i]] != null) { val = row[keys[i]]; break; } }
                      if (!val && row[k] != null) val = row[k];
                      if (val != null && val !== '') {
                        // try to find input by id/name first
                        let found = null;
                        try {
                          const inputs = Array.from(sec.querySelectorAll('input,select,textarea'));
                          found = inputs.find(inp => {
                            const id = (inp.id||'').toLowerCase(); const name = (inp.name||'').toLowerCase();
                            return id.includes(k.toLowerCase()) || name.includes(k.toLowerCase());
                          });
                        } catch(e) { found = null; }

                        // fallback: find by label text in the .form-grid groups
                        if (!found) {
                          try {
                            const groups = Array.from(sec.querySelectorAll('.form-grid .form-group'));
                            for (const g of groups) {
                              const lbl = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
                              if (!lbl) continue;
                              // check any alias for this mapping
                              const aliasMatch = keys.some(alias => lbl.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lbl));
                              if (aliasMatch || lbl.includes(k.toLowerCase())) {
                                const inp = g.querySelector('input,select,textarea');
                                if (inp) { found = inp; break; }
                              }
                            }
                          } catch (e) { /* ignore */ }
                        }

                        if (found) { try { found.value = val; found.dispatchEvent(new Event('change')); } catch(e){} }
                      }
                    });
                  }

                  // populate parent fields (OBD..reInspectedBy) from ticket.sections.emissions if available
                  try {
                    const parent = (ticket && ticket.sections && (ticket.sections.emissions || ticket.sections['emissions'])) || null;
                    if (parent) {
                      const groups = Array.from(sec.querySelectorAll('.form-grid .form-group'));
                      const mapKeys = {
                        OBD: ['obd','obd/emissions','obd_emissions','obd'],
                        inspections: ['inspections','inspection','inspected'],
                        emissionsDue: ['emissionsdue','emissions_due','emissionsdue'],
                        nextOilChange: ['nextoilchange','nextOilChange','next_oil_change','nextoilchange'],
                        inspectedBy: ['inspectedby','inspectedBy','inspected_by'],
                        reInspectedBy: ['reinspectedby','reInspectedBy','re_inspected_by']
                      };
                      Object.keys(mapKeys).forEach(k => {
                        const aliases = mapKeys[k];
                        // find matching group by label
                        for (const g of groups) {
                          const lbl = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
                          if (!lbl) continue;
                          const matched = aliases.some(a => lbl.includes(a.toLowerCase()) || a.toLowerCase().includes(lbl));
                          if (matched) {
                            const inp = g.querySelector('input,select,textarea');
                            if (inp && (parent[k] != null && parent[k] !== '')) {
                              try { inp.value = parent[k]; inp.dispatchEvent(new Event('change')); } catch(e) {}
                            }
                          }
                        }
                      });

                      // populate parent comments (full-width)
                      try {
                        const parentComments = parent.comments || parent.emissionsComments || parent.comments || '';
                        if (parentComments) {
                          const commentsGroup = Array.from(sec.querySelectorAll('.form-group.full-width')).find(g => { const l=(g.querySelector('label')&&g.querySelector('label').textContent||'').toLowerCase(); return l.includes('comment'); });
                          const cinput = commentsGroup && commentsGroup.querySelector('input,textarea');
                          if (cinput) { cinput.value = parentComments; cinput.dispatchEvent(new Event('change')); }
                        }
                      } catch(e) {}
                    }
                  } catch(e) {}
                }
                return;
              }

              if (key === 'warningstable' || key === 'warnings' || key === 'warnings_table') {
                // populate tags list
                try {
                  const tagsHidden = document.getElementById('tags-hidden');
                  const list = document.getElementById('tag-list');
                  if (!tagsHidden || !list) return;
                  const items = rows.map(r => r.item || r.Item || r.name || '').filter(Boolean);
                  tagsHidden.value = items.join(',');
                  // render chips
                  list.innerHTML = '';
                  items.forEach((t) => {
                    const chip = document.createElement('div'); chip.className = 'tag-chip'; chip.textContent = t;
                    const x = document.createElement('button'); x.type='button'; x.className='tag-remove'; x.textContent='×';
                    x.addEventListener('click', () => { /* no-op on load */ });
                    chip.appendChild(x); list.appendChild(chip);
                  });
                } catch (e) {}
                return;
              }
            });
          }
        } catch (err) { console.warn('populate sections error', err); }
        // populate Digital Courtesy Check from saved sectionData if available
        try {
          const sections = ticket.sections || {};
          const courtesyPayload = sections['courtesy-check'] || sections['digital-courtesy-check'] || sections.courtesy || sections['courtesy'] || null;
          const items = courtesyPayload && (Array.isArray(courtesyPayload.items) ? courtesyPayload.items : (Array.isArray(courtesyPayload) ? courtesyPayload : null));
          if (items && items.length) {
            const courtesySection = document.getElementById('courtesy-check');
            const table = courtesySection ? courtesySection.querySelector('table') : (document.querySelector('#courtesy-table') || document.querySelector('table[data-section="courtesy-check"]'));
            if (table) {
              const headers = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent || '').trim().toLowerCase());
              const rows = Array.from(table.querySelectorAll('tbody tr'));
              items.forEach(item => {
                const name = item.item || item.name || item.label || '';
                if (!name) return;
                // find row by data-item attribute or by first cell text
                let row = rows.find(r => r.dataset && r.dataset.item === name);
                if (!row) {
                  row = rows.find(r => {
                    const first = r.cells && r.cells[0];
                    return first && first.textContent && first.textContent.trim() === name.trim();
                  });
                }
                if (!row) return;
                Object.keys(item).forEach(key => {
                  if (['item','name','label'].includes(key)) return;
                  const val = item[key];
                  const headerIndex = headers.findIndex(h => h.includes(key.toLowerCase()) || key.toLowerCase().includes(h));
                  let cell = null;
                  if (headerIndex !== -1) cell = row.cells[headerIndex];
                  if (!cell) {
                    // fallback: find input/select by name or class
                    const el = row.querySelector(`[name="${key}"], .${key}`);
                    if (el) { try { el.value = val; el.dispatchEvent(new Event('change')); } catch (e) {} }
                    return;
                  }
                  const input = cell.querySelector('select, input, textarea');
                  if (input) { try { input.value = val; input.dispatchEvent(new Event('change')); } catch (e) {} }
                  else { cell.textContent = val; }
                });
              });
            }
          }
        } catch (err) { console.warn('populate courtesy error', err); }
      } catch (e) { console.error('Error applying server ticket to form', e); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTicket);
    else applyTicket();
  } catch (err) {
    console.warn('populateFromServerTicket: no server ticket or parse failed', err);
  }
})();

// --- Enforce mode: when a ticket is loaded but not in edit mode, lock UI to Repair Order only ---
(function enforceRepairOrderOnlyMode() {
  function run() {
    try {
      const hasTicket = !!window.__SERVER_TICKET__;
      const editMode = !!window.__MECHANIC_EDIT_MODE__;
      // allow full interaction only when a ticket is present AND editMode is true
      if (hasTicket && editMode) return; // editing an existing ticket -> allow full interaction
      // otherwise lock down so only Repair Order section is interactive (covers new/blank tickets and view-only)

      const main = document.querySelector('main');
      const allowed = document.getElementById('repForm');
      if (!main || !allowed) return;

      // disable interactive elements outside the repair-order form
      const interactive = main.querySelectorAll('input,select,textarea,button, a, [role="button"]');
      interactive.forEach(el => {
        try {
          if (allowed.contains(el)) return; // keep repair order interactive
          const tag = (el.tagName || '').toLowerCase();
          if (tag === 'a') {
            // keep top-level navigation links interactive (back/new ticket) and anything inside the site header
            const href = el.getAttribute && el.getAttribute('href');
            const isBack = el.classList && el.classList.contains('back-link');
            const isNewTicket = href === '/mechanic' || (href && href.indexOf('/mechanic?') === 0);
            const inHeader = el.closest && el.closest('.site-header');
            if (isBack || isNewTicket || inHeader) return; // allow interaction for these

            // disable other links by removing href (store it in data-attr)
            if (el.getAttribute('href')) el.dataset._href = el.getAttribute('href');
            el.removeAttribute('href');
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.6';
            el.setAttribute('aria-disabled', 'true');
            return;
          }
          // allow interactive elements that live inside the site header (top buttons)
          if (el.closest && el.closest('.site-header')) return;
          if ('disabled' in el) el.disabled = true;
          else el.setAttribute('aria-disabled', 'true');
          // make unfocusable
          try { el.tabIndex = -1; } catch (e) {}
        } catch (e) { /* ignore individual failures */ }
      });

      // also visually indicate accordion headers are inactive
      const headers = document.querySelectorAll('.accordion-header');
      headers.forEach(h => {
        if (allowed.contains(h)) return;
        h.style.pointerEvents = 'none';
        h.style.opacity = '0.6';
        h.title = 'Locked while viewing a saved ticket';
      });

      // collapse all accordion contents except repair-order section (if any)
      document.querySelectorAll('.accordion-content').forEach(c => {
        if (allowed.contains(c)) return;
        c.style.display = 'none';
        c.classList.add('collapsed-content');
      });

      // explicitly disable media upload controls when in view-only mode
      const uploadControls = ['video-upload-zone','video-file','upload-trigger','upload-btn','image-upload-zone','image-file','image-upload-trigger','image-upload-btn'];
      uploadControls.forEach(id => {
        try {
          const el = document.getElementById(id);
          if (!el) return;
          if (allowed.contains(el)) return; // keep if part of repair-order
          if (el.tagName && el.tagName.toLowerCase() === 'input' && el.type === 'file') {
            el.disabled = true;
          } else {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.6';
            el.setAttribute('aria-disabled', 'true');
          }
        } catch (e) { /* ignore per-element failures */ }
      });

    } catch (err) {
      console.warn('enforceRepairOrderOnlyMode error', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

// --- Courtesy Check: save all rows (item/status/notes) to /mechanic/courtesy-check ---
(function wireCourtesyCheckSave() {
  const bind = function () {
    try {
      const saveBtn = document.querySelector('.section-save[data-section="courtesy-check"]');
      const courtesySection = document.getElementById('courtesy-check');
      if (!saveBtn || !courtesySection) return;
      if (saveBtn.dataset.boundCourtesySave === '1') return;
      saveBtn.dataset.boundCourtesySave = '1';

      saveBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const ticketId =
          (window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) ||
          document.getElementById('vehicle-ticketId')?.value ||
          document.getElementById('ticketId')?.value ||
          '';

        if (!ticketId) {
          console.error('Cannot save courtesy check: missing ticket id. Save Repair Order first.');
          return;
        }

        const table = courtesySection.querySelector('table');
        const items = [];
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          rows.forEach((row) => {
            const item = (row.cells && row.cells[0] ? row.cells[0].textContent : '').trim();
            const status = (row.querySelector('select')?.value || '').trim();
            const notes = (row.querySelector('input[type="text"], textarea')?.value || '').trim();
            if (!item) return;
            items.push({ item, status, notes });
          });
        }

        const commentsInput = courtesySection.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
        const comments = commentsInput ? (commentsInput.value || '').trim() : '';

        try {
          const res = await fetch('/mechanic/courtesy-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, items, comments })
          });

          if (res.status === 204) {
            console.log('Courtesy check saved (204)');
            return;
          }

          if (res.ok) {
            let payload = null;
            try { payload = await res.json(); } catch (err) { payload = null; }
            if (payload && payload.success) {
              console.log('Courtesy check saved');
              return;
            }
            console.warn('Courtesy check save response', res.status, payload);
            return;
          }

          let errPayload = null;
          try { errPayload = await res.json(); } catch (err) { errPayload = null; }
          console.error('Courtesy check save failed', res.status, errPayload);
        } catch (err) {
          console.error('Courtesy check save failed', err);
        }
      });
    } catch (err) {
      console.warn('wireCourtesyCheckSave error', err);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();


// --- Steering & Suspension: save rows (item/left/right/front/rear) + comments to /mechanic/steering-suspension ---
(function wireSteeringSave() {
  const bind = function () {
    try {
      const saveBtn = document.querySelector('.section-save[data-section="steering"]');
      const steeringSection = document.getElementById('steering');
      if (!saveBtn || !steeringSection) return;
      if (saveBtn.dataset.boundSteeringSave === '1') return;
      saveBtn.dataset.boundSteeringSave = '1';

      saveBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const ticketId = (window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) || document.getElementById('vehicle-ticketId')?.value || document.getElementById('ticketId')?.value || '';
        if (!ticketId) {
          console.error('Cannot save steering-suspension: missing ticket id. Save Repair Order first.');
          return;
        }

        const table = steeringSection.querySelector('table');
        const items = [];
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          const headerCells = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent||'').toLowerCase());
          // helper to find column index by header keyword
          const findColIdx = (keywords) => {
            const k = Array.isArray(keywords) ? keywords : [keywords];
            return headerCells.findIndex(h => k.some(kw => h.includes(kw)));
          };
          const leftIdx = findColIdx(['left']);
          const rightIdx = findColIdx(['right']);
          const frontIdx = findColIdx(['front']);
          const rearIdx = findColIdx(['rear']);

          rows.forEach((row) => {
            const itemLabel = (row.cells && row.cells[0] ? row.cells[0].textContent : '').trim();
            if (!itemLabel) return;
            const getCellValue = (idx) => {
              try {
                if (idx === -1 || !row.cells[idx]) return '';
                const cell = row.cells[idx];
                const input = cell.querySelector('select, input');
                if (input) return input.value || '';
                // if no input, return text content (could be '-')
                return (cell.textContent || '').trim();
              } catch (e) { return ''; }
            };

            const left = getCellValue(leftIdx);
            const right = getCellValue(rightIdx);
            const front = getCellValue(frontIdx);
            const rear = getCellValue(rearIdx);
            items.push({ item: itemLabel, left, right, front, rear });
          });
        }

        const commentsInput = steeringSection.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
        const comments = commentsInput ? (commentsInput.value || '').trim() : '';

        try {
          const res = await fetch('/mechanic/steering-suspension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, items, comments })
          });

          if (res.status === 204) {
            console.log('Steering & Suspension saved (204)');
            return;
          }

          if (res.ok) {
            let payload = null;
            try { payload = await res.json(); } catch (err) { payload = null; }
            if (payload && payload.success) {
              console.log('Steering & Suspension saved');
              return;
            }
            console.warn('Steering save response', res.status, payload);
            return;
          }

          let errPayload = null;
          try { errPayload = await res.json(); } catch (err) { errPayload = null; }
          console.error('Steering save failed', res.status, errPayload);
        } catch (err) {
          console.error('Steering save failed', err);
        }
      });
    } catch (err) {
      console.warn('wireSteeringSave error', err);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

// --- Brakes: save brakes table rows to /mechanic/brakes ---
(function wireBrakesSave() {
  const bind = function() {
    try {
      const saveBtn = document.querySelector('.section-save[data-section="brakes"]');
      const brakesSection = document.getElementById('brakes');
      if (!saveBtn || !brakesSection) return;
      if (saveBtn.dataset.boundBrakesSave === '1') return;
      saveBtn.dataset.boundBrakesSave = '1';

      saveBtn.addEventListener('click', async function (e) {
        e.preventDefault(); e.stopPropagation();

        const ticketId = (window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) || document.getElementById('vehicle-ticketId')?.value || document.getElementById('ticketId')?.value || '';
        if (!ticketId) {
          console.error('Cannot save brakes: missing ticket id. Save Repair Order first.');
          return;
        }

        const table = brakesSection.querySelector('table');
        const items = [];
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          const headerCells = Array.from(table.querySelectorAll('thead th')).map(h => (h.textContent||'').toLowerCase());
          const findIdx = (keys) => {
            const ks = Array.isArray(keys) ? keys : [keys];
            return headerCells.findIndex(h => ks.some(k => h.includes(k)));
          };
          const specIdx = findIdx(['spec']);
          const actualIdx = findIdx(['actual','value']);
          const statusIdx = findIdx(['status']);
          const commentsIdx = findIdx(['comment','notes','note']);

          rows.forEach(row => {
            try {
              const itemLabel = (row.cells && row.cells[0] ? row.cells[0].textContent : '').trim();
              if (!itemLabel) return;
              const getCell = (idx) => {
                if (idx === -1 || !row.cells[idx]) return '';
                const cell = row.cells[idx];
                const input = cell.querySelector('select, input, textarea');
                if (input) return input.value || '';
                return (cell.textContent || '').trim();
              };
              const Spec = getCell(specIdx);
              const actual = getCell(actualIdx);
              const status = getCell(statusIdx);
              const comments = getCell(commentsIdx);
              items.push({ item: itemLabel, Spec, actual, status, comments });
            } catch (e) { /* ignore row */ }
          });
        }

        // parent comments (full-width comments input)
        const parentCommentsInput = brakesSection.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
        const parentComments = parentCommentsInput ? (parentCommentsInput.value || '').trim() : '';

        try {
          const res = await fetch('/mechanic/brakes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, items, comments: parentComments })
          });

          if (res.status === 204) { console.log('Brakes saved (204)'); return; }
          if (res.ok) {
            let payload = null; try { payload = await res.json(); } catch (e) { payload = null; }
            if (payload && payload.success) { console.log('Brakes saved'); return; }
            console.warn('Brakes save response', res.status, payload); return;
          }
          let errPayload = null; try { errPayload = await res.json(); } catch (e) { errPayload = null; }
          console.error('Brakes save failed', res.status, errPayload);
        } catch (err) {
          console.error('Brakes save failed', err);
        }
      });
    } catch (err) {
      console.warn('wireBrakesSave error', err);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

// --- Emissions: save emissions table, middle info, and warnings to /mechanic/emissions ---
(function wireEmissionsSave() {
  const bind = function() {
    try {
      const saveBtn = document.querySelector('.section-save[data-section="emissions"]');
      const emissionsSection = document.getElementById('emissions');
      if (!saveBtn || !emissionsSection) return;
      if (saveBtn.dataset.boundEmissionsSave === '1') return;
      saveBtn.dataset.boundEmissionsSave = '1';

      saveBtn.addEventListener('click', async function(e) {
        e.preventDefault(); e.stopPropagation();
        const ticketId = (window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) || document.getElementById('vehicle-ticketId')?.value || document.getElementById('ticketId')?.value || '';
        if (!ticketId) { console.error('Cannot save emissions: missing ticket id. Save Repair Order first.'); return; }

        // collect table rows
        const table = emissionsSection.querySelector('table');
        const items = [];
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          rows.forEach(row => {
            try {
              const item = (row.cells && row.cells[0] ? row.cells[0].textContent : '').trim();
              if (!item) return;
              const status = row.querySelector('select') ? (row.querySelector('select').value || '').trim() : '';
              const notes = row.querySelector('input[type="text"], textarea') ? (row.querySelector('input[type="text"], textarea').value || '').trim() : '';
              items.push({ item, status, notes });
            } catch (e) { /* ignore row */ }
          });
        }

        // collect middle emissions info
        const emissionsInfo = {};
        try {
          const selects = emissionsSection.querySelectorAll('.form-grid .form-group');
          // find inputs by label text
          const groups = Array.from(emissionsSection.querySelectorAll('.form-grid .form-group'));
          groups.forEach(g => {
            const label = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
            const input = g.querySelector('input,select,textarea');
            if (!input) return;
            const val = input.value || '';
            if (label.includes('obd')) emissionsInfo.OBD = val;
            else if (label.includes('state') || label.includes('inspection')) emissionsInfo.inspections = val;
            else if (label.includes('emission') && label.includes('due')) emissionsInfo.emissionsDue = val;
            else if (label.includes('next oil') || label.includes('next oil change')) emissionsInfo.nextOilChange = val;
            else if (label.includes('inspected by') && !label.includes('re-')) emissionsInfo.inspectedBy = val;
            else if (label.includes('re-inspected') || label.includes('re inspected')) emissionsInfo.reInspectedBy = val;
          });
        } catch (e) { /* ignore */ }

        // tags (warnings)
        const tagsHidden = document.getElementById('tags-hidden');
        let tags = [];
        if (tagsHidden && tagsHidden.value) tags = tagsHidden.value.split(',').map(s=>s.trim()).filter(Boolean);

        // parent comments - find the full-width form-group whose label contains 'comment'
        let parentCommentsInput = null;
        try {
          const fullGroups = Array.from(emissionsSection.querySelectorAll('.form-group.full-width'));
          for (const g of fullGroups) {
            const lbl = (g.querySelector('label') && g.querySelector('label').textContent || '').toLowerCase();
            if (lbl.includes('comment')) { parentCommentsInput = g.querySelector('input[type="text"], textarea'); break; }
          }
        } catch (e) {}
        if (!parentCommentsInput) parentCommentsInput = emissionsSection.querySelector('.form-group.full-width input[type="text"], .form-group.full-width textarea');
        const parentComments = parentCommentsInput ? (parentCommentsInput.value || '').trim() : '';

        // assemble payload
        console.log('Emissions save - parentComments (client):', parentComments);
        const payload = { ticketId, items, emissions: emissionsInfo, tags, comments: parentComments };

        try {
          const res = await fetch('/mechanic/emissions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          if (res.status === 204) { console.log('Emissions saved (204)'); return; }
          if (res.ok) { let p = null; try { p = await res.json(); } catch(e){ } if (p && p.success) { console.log('Emissions saved'); return; } console.warn('Emissions save unexpected ok response', res.status, p); return; }
          let err = null; try { err = await res.json(); } catch(e) { err = null; } console.error('Emissions save failed', res.status, err);
        } catch (err) { console.error('Emissions save failed', err); }
      });
    } catch (err) { console.warn('wireEmissionsSave error', err); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

 // --- Vehicle Info: force AJAX submit to /mechanic/vehicle-info to avoid interfering with main ticket submit ---
 (function wireVehicleInfoForm() {
  try {
    const vForm = document.getElementById('vehicle-info-form');
    if (!vForm) return;
    vForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      // collect form data
      const fd = new FormData(vForm);
      const obj = {};
      for (const [k, v] of fd.entries()) obj[k] = v;

      // ensure there's a ticket id
      if (!obj.ticketId && !obj.ticketID && !obj.id) {
        console.error('Cannot save vehicle info: missing ticket id. Save the Repair Order first.');
        return;
      }

      try {
        const res = await fetch(vForm.action || '/mechanic/vehicle-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj)
        });
        // accept 204 No Content as successful silent save
        if (res.status === 204) {
          console.log('Vehicle info saved (204)');
          return;
        }
        if (res.ok) {
          // attempt to parse JSON success response if server provides it
          let json = null;
          try { json = await res.json(); } catch (e) { json = null; }
          if (json && json.success) {
            console.log('Vehicle info saved', json);
            return;
          }
          console.error('Vehicle info save: unexpected OK response', res.status, json);
          return;
        }
        // non-OK: try to surface error message
        let errJson = null;
        try { errJson = await res.json(); } catch (e) { errJson = null; }
        console.error('Vehicle info save failed', res.status, errJson);
      } catch (err) {
        console.error('Vehicle info save failed', err);
      }
    }, { capture: true });
  } catch (err) { console.warn('wireVehicleInfoForm error', err); }
})();

document.addEventListener('DOMContentLoaded', () => {
  const tiresForm = document.getElementById('tires-form');
  if (tiresForm) {
    tiresForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      // ensure ticketId present
      const ticketInput = document.getElementById('tires-ticketId');
      if (!ticketInput || !ticketInput.value) {
        // try fallback from server ticket object
        if (window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) {
          if (ticketInput) ticketInput.value = window.__SERVER_TICKET__.id;
          else tiresForm.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name: 'ticketId', value: window.__SERVER_TICKET__.id }));
        } else {
          console.error('Tires save failed: missing ticketId');
          alert('Cannot save tires: ticketId missing.');
          return;
        }
      }

      // convert form to plain object and send JSON so server's express.json() can parse it
      const fd = new FormData(tiresForm);
      const obj = {};
      fd.forEach((value, key) => {
        // handle multiple values for same key
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
          obj[key].push(value);
        } else {
          obj[key] = value;
        }
      });

      // ensure ticketId included (fallback to server-injected object)
      if (!obj.ticketId && window.__SERVER_TICKET__ && window.__SERVER_TICKET__.id) obj.ticketId = window.__SERVER_TICKET__.id;

      try {
        const res = await fetch(tiresForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj)
        });
        if (res.status === 204) {
          console.log('Tires saved (204).');
          return;
        }
        if (!res.ok) throw new Error(`Tires save failed: ${res.status}`);
        // optionally parse OK JSON
        let json = null;
        try { json = await res.json(); } catch (e) { json = null; }
        console.log('Tires save response', res.status, json);
      } catch (err) {
        console.error(err);
        alert('Tires save failed. See console for details.');
      }
    }, { capture: true });
  }
});

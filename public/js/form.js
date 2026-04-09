console.log('Merged form + column script loaded.');

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
      if (d.length <= 6) return d.slice(0,3) + '-' + d.slice(3);
      return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6);
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
      const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
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
      try { el.setSelectionRange(cursor, cursor); } catch (e) {}
    });

    el.addEventListener('input', function (e) {
      const orig = el.value || '';
      const sel = el.selectionStart || 0;
      const digitsBefore = digitsBeforeCursor(orig, sel);
      const digits = onlyDigits(orig).slice(0,10);
      const formatted = formatPhone(digits);
      el.value = formatted;
      const newPos = cursorPosFromDigits(formatted, digitsBefore);
      try { el.setSelectionRange(newPos, newPos); } catch (err) {}
    });

    // ensure format on blur
    el.addEventListener('blur', function () {
      const digits = onlyDigits(el.value).slice(0,10);
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
      const previewEl = document.getElementById('image-preview'); // optional <img> or container
      if (!zone || !fileInput || !uploadBtn) return;

      let selectedImage = null;
      const MAX_BYTES = 5 * 1024 * 1024; // 5MB

      function showPreview(file) {
        if (!previewEl) return;
        // if previewEl is an <img>, set src; otherwise create/replace an img inside
        const reader = new FileReader();
        reader.onload = function (e) {
          if (previewEl.tagName && previewEl.tagName.toLowerCase() === 'img') {
            previewEl.src = e.target.result;
          } else {
            previewEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '160px';
            img.style.maxHeight = '120px';
            img.alt = 'Selected image preview';
            previewEl.appendChild(img);
          }
        };
        reader.readAsDataURL(file);
      }

      // clicking trigger opens picker
      if (trigger) {
        trigger.addEventListener('click', function (e) { e.preventDefault(); fileInput.click(); });
      }

      // click on zone opens picker (but avoid clicking the upload button)
      zone.addEventListener('click', function (e) {
        if (e.target !== trigger && e.target !== uploadBtn) fileInput.click();
      });

      // dragover/drop support
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('dragover');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) {
          fileInput.files = e.dataTransfer.files; // update input
          handleFileChosen(f);
        }
      });

      fileInput.addEventListener('change', function (e) {
        const f = e.target.files && e.target.files[0];
        if (f) handleFileChosen(f);
      });

      function handleFileChosen(f) {
        if (!f) return;
        if (!f.type.startsWith('image/')) {
          alert('Please select an image file.');
          fileInput.value = '';
          selectedImage = null;
          return;
        }
        if (f.size > MAX_BYTES) {
          alert('Image is too large (max 5MB).');
          fileInput.value = '';
          selectedImage = null;
          return;
        }
        selectedImage = f;
        const p = zone.querySelector('p');
        if (p) p.textContent = `Selected: ${f.name}`;
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';
        showPreview(f);
      }

      uploadBtn.addEventListener('click', function () {
        if (!selectedImage) { alert('Please select an image first.'); return; }
        const fd = new FormData();
        fd.append('image', selectedImage);
        uploadBtn.textContent = 'Uploading...'; uploadBtn.disabled = true;
        fetch('/upload-image', { method: 'POST', body: fd })
          .then(res => res.json())
          .then(data => {
            if (data && data.success) {
              alert('Image uploaded successfully!');
              const p = zone.querySelector('p'); if (p) p.textContent = 'Image uploaded successfully!';
              zone.style.backgroundColor = '#d4edda'; zone.style.borderColor = '#c3e6cb';
              fileInput.value = '';
              selectedImage = null;
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
  function toNum(v) { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n) ? 0 : n; }
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
        try { inputs[1].setAttribute('type','number'); inputs[1].setAttribute('min','0'); } catch(e){}
      }
      if (inputs.length >= 4 && !inputs[3].classList.contains('rp-partprice')) {
        inputs[3].classList.add('rp-partprice');
        try { inputs[3].setAttribute('type','number'); inputs[3].setAttribute('min','0'); inputs[3].setAttribute('step','0.01'); } catch(e){}
      }
      if (inputs.length >= 5 && !inputs[5].classList.contains('rp-laborhours')) {
        inputs[5].classList.add('rp-laborhours');
        try { inputs[5].setAttribute('type','number'); inputs[5].setAttribute('min','0'); inputs[5].setAttribute('step','0.01'); } catch(e){}
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
      if (partsTotal) { partsTotal.readOnly = true; partsTotal.tabIndex = -1; partsTotal.setAttribute('aria-readonly','true'); }
      if (laborTotal) { laborTotal.readOnly = true; laborTotal.tabIndex = -1; laborTotal.setAttribute('aria-readonly','true'); }

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
        ['AM','PM'].forEach(x => ampm.add(new Option(x, x)));
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
    ['timeIn','timeOut'].forEach(prefix => {
      ['Hour','Minute','AmPm'].forEach(suffix => {
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
      try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      try { signatureData.value = canvas.toDataURL('image/png'); } catch (err) {}
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

  // --- Form validation & submit handling (main) ---
  (function initValidation() {
    const form = document.getElementById('repForm');
    if (!form) return;

    function showErrors(errors) {
      if (!errors || errors.length === 0) return;
      alert(errors.join('\n'));
    }

    function validateAndSubmit(e) {
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
          if (qty === '') errors.push(`Row ${idx+1}: Qty is required when adding a repair line.`);
          else {
            const qn = Number(qty);
            if (!Number.isInteger(qn) || qn < 0) errors.push(`Row ${idx+1}: Qty must be a non-negative integer.`);
          }
          if (partPrice !== '' && (isNaN(parseFloat(partPrice)) || parseFloat(partPrice) < 0)) errors.push(`Row ${idx+1}: Part Price must be a non-negative number.`);
          if (laborHours !== '' && (isNaN(parseFloat(laborHours)) || parseFloat(laborHours) < 0)) errors.push(`Row ${idx+1}: Labor Hours must be a non-negative number.`);
        });
      }

      if (errors.length > 0) {
        showErrors(errors);
        return false;
      }

      // all good -> submit
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

  // --- small helper: wire section Save buttons to submit closest form or trigger partial save ---
  (function wireSectionSaves() {
    document.querySelectorAll('.section-save').forEach(btn => {
      btn.addEventListener('click', function () {
        // find nearest form inside this accordion content; if none, fallback to main form
        const section = btn.closest('.accordion-content') || btn.closest('.section');
        const form = section ? section.querySelector('form') : null;
        if (form) form.requestSubmit();
        else {
          // fallback: submit main repForm
          const main = document.getElementById('repForm');
          if (main) main.requestSubmit();
        }
      });
    });
  })();

});
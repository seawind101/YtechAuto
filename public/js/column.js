// Ensure the accordion setup runs after the DOM is ready. This prevents the script
// from running too early when included in the <head>.
document.addEventListener('DOMContentLoaded', function () {
  // Hide any content with the collapsed-content class (unless already shown inline)
  document.querySelectorAll('.accordion-content.collapsed-content').forEach(c => {
    if (!c.style.display) c.style.display = 'none';
  });

  const headers = document.querySelectorAll('.accordion-header');
  headers.forEach(header => {
    header.style.cursor = 'pointer';

    header.addEventListener('click', () => {
      const id = header.dataset.accordion;
      let content = id ? document.getElementById(id) : header.nextElementSibling;
      if (!content) return;

      const isOpen = content.style.display === 'block';

      // Close all
      document.querySelectorAll('.accordion-content').forEach(c => {
        c.style.display = 'none';
        c.classList.add('collapsed-content');
      });

      // Toggle the clicked one
      if (!isOpen) {
        content.style.display = 'block';
        content.classList.remove('collapsed-content');
      } else {
        content.style.display = 'none';
        content.classList.add('collapsed-content');
      }
    });
  });

  // --- Tags input UI logic (only run if tags elements are present) ---
  const tagListEl = document.getElementById('tag-list');
  const tagInputEl = document.getElementById('tag-input');
  const addTagBtn = document.getElementById('add-tag');
  const tagsHidden = document.getElementById('tags-hidden');

  if (tagListEl && tagInputEl && addTagBtn && tagsHidden) {
    let tags = [];

    function renderTags() {
      tagListEl.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = t;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-tag';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove tag';
        removeBtn.addEventListener('click', () => {
          tags.splice(i, 1);
          updateHidden();
          renderTags();
        });

        chip.appendChild(removeBtn);
        tagListEl.appendChild(chip);
      });
    }

    function updateHidden() {
      tagsHidden.value = tags.join(',');
    }

    function addTagFromInput() {
      const v = tagInputEl.value.trim();
      if (!v) return;
      // avoid duplicates (case-insensitive)
      const exists = tags.some(t => t.toLowerCase() === v.toLowerCase());
      if (!exists) {
        tags.push(v);
        renderTags();
        updateHidden();
      }
      tagInputEl.value = '';
      tagInputEl.focus();
    }

    addTagBtn.addEventListener('click', addTagFromInput);
    tagInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagFromInput();
      }
    });

    // initialize from hidden input if present
    if (tagsHidden.value) {
      tags = tagsHidden.value.split(',').map(s => s.trim()).filter(Boolean);
      renderTags();
    }
    // mark that we initialized the accordion so other scripts can skip theirs
    try { window.customAccordionInitialized = true; } catch (e) { /* noop */ }
  }

  // --- Recommended Repairs: auto-calculation and add-row support ---
  (function setupRepairs() {
    const table = document.getElementById('repairs-table');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const addBtn = document.querySelector('.add-repair-line');
    const subPartsEl = document.getElementById('subTotParts');
    const subLaborEl = document.getElementById('subTotLabor');
    const taxEl = document.getElementById('tax');
    const totEstimateEl = document.getElementById('totEstimate');

    function toNum(v) {
      const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }

    function calculateRow(row) {
      const inputs = Array.from(row.querySelectorAll('input'));
      // inputs order: 0 desc, 1 qty, 2 part#, 3 partPrice, 4 partsTotal, 5 laborHours, 6 laborTotal
      const qty = toNum(inputs[1]?.value);
      const partPrice = toNum(inputs[3]?.value);
      const partsTotal = qty * partPrice;
      if (inputs[4]) inputs[4].value = fmt(partsTotal);

      const laborHours = toNum(inputs[5]?.value);
      const laborTotal = laborHours * 100; // $100 per hour as requested
      if (inputs[6]) inputs[6].value = fmt(laborTotal);

      updateSubtotals();
    }

    function updateSubtotals() {
      let sumParts = 0;
      let sumLabor = 0;
      tbody.querySelectorAll('tr').forEach(r => {
        const inputs = Array.from(r.querySelectorAll('input'));
        sumParts += toNum(inputs[4]?.value);
        sumLabor += toNum(inputs[6]?.value);
      });
      if (subPartsEl) subPartsEl.value = fmt(sumParts);
      if (subLaborEl) subLaborEl.value = fmt(sumLabor);

      // Tax is 6% of parts subtotal (auto-calculated)
      const tax = sumParts * 0.06;
      if (taxEl) {
        taxEl.value = fmt(tax);
        try { taxEl.readOnly = true; } catch (e) { /* ignore */ }
      }

      // Total Estimate excludes labor (parts + tax)
      if (totEstimateEl) totEstimateEl.value = fmt(sumParts + tax);
    }

    function wireRow(row) {
      const inputs = Array.from(row.querySelectorAll('input'));
      // qty (index 1), partPrice (3), laborHours (5)
      [1,3,5].forEach(idx => {
        const el = inputs[idx];
        if (!el) return;
        el.addEventListener('input', () => calculateRow(row));
      });
    }

    // wire existing rows
    tbody.querySelectorAll('tr').forEach(r => wireRow(r));

    // add new repair line
    if (addBtn) {
      addBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="text" placeholder="Description"></td>
          <td><input type="number" placeholder="1" style="width:4em" value="1"></td>
          <td><input type="text" placeholder="Part #"></td>
          <td><input type="text" placeholder="0.00" value="0.00"></td>
          <td><input type="text" placeholder="0.00" value="0.00" readonly></td>
          <td><input type="text" placeholder="0.00" value="0.00"></td>
          <td><input type="text" placeholder="0.00" value="0.00" readonly></td>
        `;
        tbody.appendChild(tr);
        wireRow(tr);
        // calculate the newly added row once
        calculateRow(tr);
      });
    }

    // tax is derived from parts (6%) so recalc when parts/labor rows change; also recalc when tax element exists manually
    if (taxEl) {
      try { taxEl.readOnly = true; } catch (e) {}
    }
    // initial subtotal calc
    updateSubtotals();
  })();
});
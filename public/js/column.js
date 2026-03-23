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
});
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
});
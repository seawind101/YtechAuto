/**
 * Auto Repair Ticket System - Mockup Scripts
 * Video play/download work; other buttons are non-functional mockups.
 */
(function () {
  'use strict';

  // Accordion code: skip if another script already initialized it
  if (!window.customAccordionInitialized) {
    // Accordion toggle for Vehicle Inspection sections
    document.querySelectorAll('.accordion-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var contentId = this.getAttribute('data-accordion');
        var content = contentId ? document.getElementById(contentId) : null;
        if (content) {
          var isHidden = content.style.display === 'none';
          document.querySelectorAll('.accordion-content').forEach(function (c) {
            c.style.display = 'none';
          });
          document.querySelectorAll('.accordion-header').forEach(function (h) {
            h.classList.add('collapsed');
          });
          if (isHidden) {
            content.style.display = 'block';
            this.classList.remove('collapsed');
          }
        }
      });
    });

    // Set initial state: Vehicle Info expanded, others collapsed
    document.querySelectorAll('.accordion-content.collapsed-content').forEach(function (c) {
      c.style.display = 'none';
    });
    document.querySelectorAll('.accordion-item:not(:first-child) .accordion-header').forEach(function (h) {
      h.classList.add('collapsed');
    });
  }

  // Video upload zone click (mock - opens file dialog but upload doesn't persist)
  var uploadZone = document.getElementById('video-upload-zone');
  var videoFile = document.getElementById('video-file');
  var uploadTrigger = document.getElementById('upload-trigger');
  if (uploadZone && videoFile) {
    uploadZone.addEventListener('click', function (e) {
      if (e.target !== uploadTrigger && e.target !== videoFile) {
        videoFile.click();
      }
    });
  }
  if (uploadTrigger && videoFile) {
    uploadTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      videoFile.click();
    });
  }

  // Save Ticket and Upload - no-op (mockup). Do NOT intercept add-repair-line so real handler can run.
  document.querySelectorAll('.save-ticket, #upload-btn').forEach(function (btn) {
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        // Mock: could show alert "This is a mockup - no action taken"
      });
    }
  });
})();

// Current working Apps Script Web App URL. It must end with /exec.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

// UI patch: hide "Unassigned" from Cascaded Priority performance only.
// The underlying table data remains unchanged.
(function () {
  function hideUnassignedCascadedPerformance() {
    var box = document.getElementById('cascadedPriorityPerformance');
    if (!box) return;
    Array.prototype.slice.call(box.children).forEach(function (row) {
      var name = row.querySelector('.catName');
      if (name && name.textContent.trim().toLowerCase() === 'unassigned') {
        row.style.display = 'none';
      }
    });
  }

  function startPatch() {
    hideUnassignedCascadedPerformance();
    var box = document.getElementById('cascadedPriorityPerformance');
    if (!box || !window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      hideUnassignedCascadedPerformance();
    });
    observer.observe(box, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
  window.setInterval(hideUnassignedCascadedPerformance, 1000);
})();

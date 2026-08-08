// Current working Apps Script Web App URL. It must end with /exec.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

(function () {
  function sortHighToLow(items) {
    return (items || []).slice().sort(function (a, b) {
      return (Number(b.completionRate || 0) - Number(a.completionRate || 0)) ||
             (Number(b.progressScore || 0) - Number(a.progressScore || 0)) ||
             (Number(b.completed || 0) - Number(a.completed || 0)) ||
             (Number(b.total || 0) - Number(a.total || 0));
    });
  }

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

  function patchSortingFunctions() {
    if (window.__dashboardSortPatchApplied) return;

    if (typeof window.renderEmployeeChart === 'function') {
      var originalRenderEmployeeChart = window.renderEmployeeChart;
      window.renderEmployeeChart = function (items) {
        return originalRenderEmployeeChart(sortHighToLow(items).slice(0, 10));
      };
    }

    if (typeof window.renderEmployeeCards === 'function') {
      var originalRenderEmployeeCards = window.renderEmployeeCards;
      window.renderEmployeeCards = function (items) {
        return originalRenderEmployeeCards(sortHighToLow(items));
      };
    }

    if (typeof window.renderCascaded === 'function') {
      var originalRenderCascaded = window.renderCascaded;
      window.renderCascaded = function (items) {
        return originalRenderCascaded(sortHighToLow(items));
      };
    }

    if (typeof window.buildGroup === 'function') {
      var originalBuildGroup = window.buildGroup;
      window.buildGroup = function (items, key) {
        var result = originalBuildGroup(items, key);
        if (key === 'employee' || key === 'cascadedPriority') {
          return sortHighToLow(result);
        }
        return result;
      };
    }

    window.__dashboardSortPatchApplied = true;
  }

  function forceSortRenderedSections() {
    patchSortingFunctions();
    hideUnassignedCascadedPerformance();
  }

  function addMobileUxPatch() {
    if (document.getElementById('mobileUxPatchV32')) return;
    var css = `
      @media (max-width: 700px) {
        html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
        body { background: #f3f6fb; }
        .shell { display: block !important; min-height: auto !important; width: 100% !important; }
        .side { position: relative !important; height: auto !important; width: 100% !important; padding: 12px 12px 10px !important; border-radius: 0 0 20px 20px !important; overflow: visible !important; }
        .brand { margin-bottom: 10px !important; gap: 10px !important; }
        .logo { width: 38px !important; height: 38px !important; border-radius: 13px !important; font-size: 16px !important; }
        .brand h1 { font-size: 15px !important; line-height: 1.2 !important; }
        .brand small { font-size: 11px !important; }
        .sideFoot { display: none !important; }
        .navItem { display: inline-flex !important; align-items: center !important; width: auto !important; margin: 3px 3px 4px 0 !important; padding: 8px 9px !important; border-radius: 999px !important; font-size: 12px !important; white-space: nowrap !important; }
        .main { width: 100% !important; max-width: 100% !important; padding: 12px 10px 28px !important; overflow-x: hidden !important; }
        .hero { display: block !important; padding: 15px !important; margin-bottom: 12px !important; border-radius: 18px !important; }
        .hero h2 { font-size: 22px !important; line-height: 1.2 !important; }
        .hero p { font-size: 13px !important; }
        .heroActions { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; margin-top: 12px !important; }
        .heroActions .btn, .quickActions .btn, .filters .btn { width: 100% !important; padding: 10px 8px !important; font-size: 12px !important; }
        .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
        .card { padding: 12px !important; border-radius: 16px !important; }
        .kpiValue { font-size: 22px !important; }
        .kpiLabel, .kpiHint { font-size: 10.5px !important; }
        .summaryGrid { grid-template-columns: 1fr !important; gap: 8px !important; }
        .summaryItem { padding: 11px !important; border-radius: 15px !important; }
        .quickActions { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 7px !important; }
        .filters { grid-template-columns: 1fr !important; gap: 8px !important; margin: 12px 0 !important; }
        .filters input, .filters select, .modal input, .modal select, .modal textarea { min-height: 42px !important; font-size: 14px !important; }
        .check { background: #fff !important; border: 1px solid #e5eaf2 !important; border-radius: 13px !important; padding: 10px 12px !important; }
        .twoCol { grid-template-columns: 1fr !important; gap: 12px !important; }
        .sectionTitle { display: block !important; }
        .sectionTitle h3 { font-size: 18px !important; }
        .chartBox { height: 180px !important; overflow-x: auto !important; align-items: flex-end !important; }
        .employeeGrid { grid-template-columns: 1fr !important; gap: 10px !important; }
        .board { grid-template-columns: 1fr !important; }
        .categoryList { gap: 12px !important; }
        .catRow { grid-template-columns: 1fr 44px !important; gap: 8px !important; }
        .catName { white-space: normal !important; line-height: 1.25 !important; font-size: 14px !important; }
        .tableWrap { width: 100% !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; border-radius: 16px !important; }
        table { min-width: 1040px !important; }
        th, td { padding: 10px 9px !important; font-size: 12px !important; }
        th { font-size: 10px !important; }
        .objective { max-width: 360px !important; }
        .modalBackdrop { align-items: flex-end !important; padding: 8px !important; }
        .modal { width: 100% !important; max-height: 92vh !important; overflow-y: auto !important; border-radius: 20px 20px 0 0 !important; padding: 16px !important; }
        .modalHead h3 { font-size: 18px !important; }
        .formGrid { grid-template-columns: 1fr !important; gap: 10px !important; }
        .approvalTools { grid-template-columns: 1fr !important; }
        .approvalChanges { grid-template-columns: 1fr !important; }
        .toast { left: 10px !important; right: 10px !important; bottom: 12px !important; width: auto !important; max-width: none !important; text-align: center !important; font-size: 13px !important; }
      }
    `;
    var style = document.createElement('style');
    style.id = 'mobileUxPatchV32';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function startPatch() {
    addMobileUxPatch();
    forceSortRenderedSections();
    var box = document.getElementById('cascadedPriorityPerformance');
    if (box && window.MutationObserver) {
      var observer = new MutationObserver(forceSortRenderedSections);
      observer.observe(box, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
  window.setInterval(function () {
    addMobileUxPatch();
    forceSortRenderedSections();
  }, 1000);
})();

// Current working Apps Script Web App URL. It must end with /exec.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

(function () {
  var SHEET_ID = '1Yw6dYNGRxq1gps71p3sMzu0f-IePVYdoiQIycyC5Qg4';
  var SHEET_NAME = 'Objectives status and detail re';
  var liveCascadeMap = null;
  var liveCascadePromise = null;

  function cleanText(v) {
    return String(v == null ? '' : v).trim();
  }

  function isAssigned(v) {
    var s = cleanText(v).toLowerCase();
    return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null';
  }

  function parentKey(priority) {
    return cleanText(priority).replace(/\.$/, '').split('.').slice(0, 2).join('.');
  }

  function priorityLevel(priority) {
    var p = cleanText(priority).replace(/\.$/, '');
    return p ? p.split('.').length : 1;
  }

  function sortHighToLow(items) {
    return (items || []).slice().sort(function (a, b) {
      return (Number(b.completionRate || 0) - Number(a.completionRate || 0)) ||
             (Number(b.progressScore || 0) - Number(a.progressScore || 0)) ||
             (Number(b.completed || 0) - Number(a.completed || 0)) ||
             (Number(b.total || 0) - Number(a.total || 0));
    });
  }

  function readLiveCascadeMap() {
    if (liveCascadePromise) return liveCascadePromise;
    liveCascadePromise = new Promise(function (resolve) {
      var cb = 'cascadeGviz_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var done = false;

      function finish(map) {
        if (done) return;
        done = true;
        try { delete window[cb]; } catch (e) {}
        try { script.remove(); } catch (e) {}
        liveCascadeMap = map || {};
        resolve(liveCascadeMap);
      }

      window[cb] = function (res) {
        try {
          var rows = res && res.table && Array.isArray(res.table.rows) ? res.table.rows : [];
          var map = {};
          var currentCascade = '';
          var currentParent = '';
          var currentEmployee = '';

          rows.slice(1).forEach(function (row, index) {
            var c = row.c || [];
            var rowNumber = index + 5;
            var employee = cleanText(c[0] && (c[0].f != null ? c[0].f : c[0].v));
            var priority = cleanText(c[1] && (c[1].f != null ? c[1].f : c[1].v)).replace(/\.$/, '');
            var cascaded = cleanText(c[6] && (c[6].f != null ? c[6].f : c[6].v));
            var pKey = parentKey(priority);
            var level = priorityLevel(priority);

            if (employee && employee !== currentEmployee) {
              currentEmployee = employee;
              currentCascade = '';
              currentParent = '';
            }

            if (isAssigned(cascaded)) {
              currentCascade = cascaded;
              currentParent = pKey;
              map[rowNumber] = cascaded;
              return;
            }

            if (level <= 2) {
              currentCascade = '';
              currentParent = '';
              map[rowNumber] = '';
              return;
            }

            if (currentCascade && pKey === currentParent) {
              map[rowNumber] = currentCascade;
            } else {
              map[rowNumber] = '';
            }
          });
          finish(map);
        } catch (e) {
          finish({});
        }
      };

      script.onerror = function () { finish({}); };
      script.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?sheet=' + encodeURIComponent(SHEET_NAME) + '&range=A4:K367&tqx=out:json;responseHandler:' + cb + '&_=' + Date.now();
      document.body.appendChild(script);
      window.setTimeout(function () { finish({}); }, 12000);
    });
    return liveCascadePromise;
  }

  function applyLiveCascadeToRows(items) {
    var map = liveCascadeMap || {};
    var currentEmployee = '';
    var currentCascade = '';
    var currentParent = '';

    return (items || []).map(function (r, index) {
      var copy = Object.assign({}, r);
      var rowNumber = Number(copy.rowNumber || (index + 5));
      var employee = cleanText(copy.employee);
      var priority = cleanText(copy.priority).replace(/\.$/, '');
      var pKey = parentKey(priority);
      var level = priorityLevel(priority);
      var sheetValue = cleanText(map[rowNumber]);
      var apiValue = cleanText(copy.cascadedPriority);
      var cp = isAssigned(sheetValue) ? sheetValue : (isAssigned(apiValue) ? apiValue : '');

      if (employee && employee !== currentEmployee) {
        currentEmployee = employee;
        currentCascade = '';
        currentParent = '';
      }

      if (isAssigned(cp)) {
        currentCascade = cp;
        currentParent = pKey;
      } else if (level <= 2) {
        currentCascade = '';
        currentParent = '';
      } else if (currentCascade && pKey === currentParent) {
        cp = currentCascade;
      }

      copy.cascadedPriority = isAssigned(cp) ? cp : 'Unassigned';
      return copy;
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

  function patchDashboardDataFunctions() {
    if (window.__cascadeLiveSheetPatchApplied) return;

    if (typeof window.normalizeApiRows === 'function') {
      var originalNormalizeApiRows = window.normalizeApiRows;
      window.normalizeApiRows = function (items) {
        var normalized = originalNormalizeApiRows(items || []);
        return applyLiveCascadeToRows(normalized);
      };
    }

    if (typeof window.applyLocalFilters === 'function') {
      var originalApplyLocalFilters = window.applyLocalFilters;
      window.applyLocalFilters = function (items) {
        return originalApplyLocalFilters(applyLiveCascadeToRows(items || []));
      };
    }

    if (typeof window.loadData === 'function') {
      var originalLoadData = window.loadData;
      window.loadData = function () {
        var args = arguments;
        return readLiveCascadeMap().then(function () {
          return originalLoadData.apply(window, args);
        });
      };
    }

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
        var source = key === 'cascadedPriority' ? applyLiveCascadeToRows(items || []) : (items || []);
        var result = originalBuildGroup(source, key);
        if (key === 'employee' || key === 'cascadedPriority') return sortHighToLow(result);
        return result;
      };
    }

    window.__cascadeLiveSheetPatchApplied = true;
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
    readLiveCascadeMap().then(function () {
      patchDashboardDataFunctions();
      hideUnassignedCascadedPerformance();
      if (typeof window.loadData === 'function' && !window.__cascadeReloadedOnce) {
        window.__cascadeReloadedOnce = true;
        window.loadData();
      }
    });

    var observerTarget = document.documentElement;
    if (observerTarget && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        patchDashboardDataFunctions();
        hideUnassignedCascadedPerformance();
      });
      observer.observe(observerTarget, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }

  window.setInterval(function () {
    addMobileUxPatch();
    patchDashboardDataFunctions();
    hideUnassignedCascadedPerformance();
  }, 1000);
})();

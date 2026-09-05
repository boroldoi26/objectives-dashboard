// Current working Apps Script Web App URL. It must end with /exec.
// Stable API-only config. Dashboard data is served by Apps Script.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

// Cascaded Priority display label aliases.
(function () {
  var OLD_LABEL = 'Enabling Safe and Productive Operations';
  var NEW_LABEL = 'Placement Test / Gap Training and 360 Training';

  function normalizeCpLabel(v) {
    return String(v || '').trim() === OLD_LABEL ? NEW_LABEL : v;
  }

  function patchTextNodeLabels(root) {
    try {
      var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (node.nodeValue && node.nodeValue.indexOf(OLD_LABEL) !== -1) {
          node.nodeValue = node.nodeValue.split(OLD_LABEL).join(NEW_LABEL);
        }
      });
    } catch (e) {}
  }

  window.normalizeCascadedPriorityLabel = normalizeCpLabel;
  window.CASCADED_PRIORITY_LABEL_ALIASES = window.CASCADED_PRIORITY_LABEL_ALIASES || {};
  window.CASCADED_PRIORITY_LABEL_ALIASES[OLD_LABEL] = NEW_LABEL;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { patchTextNodeLabels(document.body); });
  } else {
    patchTextNodeLabels(document.body);
  }

  window.setInterval(function () { patchTextNodeLabels(document.body); }, 800);
})();

// Cascaded Priority fallback map generated from uploaded Excel file:
// objectives_dashboard_google_sheet_template (1).xlsx
// Sheet: Objectives status and detail re, column G = Cascaded Priority.
(function () {
  var CP_RANGES_EXACT = [
    [9,14,'Digital & Online Training Enablement'],
    [15,19,'Learning Profile Match-Up for Workday'],
    [29,34,'Training Validity Optimization'],
    [35,40,'Digital & Online Training Enablement'],
    [41,45,'Learning Profile Match-Up for Workday'],
    [46,51,'Training Validity Optimization'],
    [63,69,'Digital & Online Training Enablement'],
    [73,79,'Digital & Online Training Enablement'],
    [80,85,'Training Validity Optimization'],
    [86,93,'Duplicated Training Optimization'],
    [94,105,'Training Validity Optimization'],
    [115,124,'Digital & Online Training Enablement'],
    [125,136,'Training Validity Optimization'],
    [148,153,'Training Validity Optimization'],
    [154,157,'Learning Profile Match-Up for Workday'],
    [162,165,'Learning Profile Match-Up for Workday'],
    [166,171,'Training Validity Optimization'],
    [172,179,'Duplicated Training Optimization'],
    [180,185,'Training Validity Optimization'],
    [186,191,'Digital & Online Training Enablement'],
    [197,202,'Training Validity Optimization'],
    [203,208,'Digital & Online Training Enablement'],
    [214,219,'Digital & Online Training Enablement'],
    [220,232,'Training Validity Optimization'],
    [238,245,'Digital & Online Training Enablement'],
    [250,254,'Training Validity Optimization'],
    [267,283,'Placement Test / Gap Training and 360 Training'],
    [300,328,'Placement Test / Gap Training and 360 Training'],
    [332,351,'Placement Test / Gap Training and 360 Training'],
    [355,359,'Training Validity Optimization'],
    [360,364,'Duplicated Training Optimization'],
    [365,367,'Digital & Online Training Enablement']
  ];

  function assigned(v) {
    var s = String(v || '').trim().toLowerCase();
    return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null' && s !== '-';
  }

  function normalize(v) {
    if (typeof window.normalizeCascadedPriorityLabel === 'function') return window.normalizeCascadedPriorityLabel(v);
    return v;
  }

  function exactCp(rowNumber, current) {
    current = normalize(current);
    if (assigned(current)) return current;
    var n = Number(rowNumber || 0);
    for (var i = 0; i < CP_RANGES_EXACT.length; i++) {
      var r = CP_RANGES_EXACT[i];
      if (n >= r[0] && n <= r[1]) return normalize(r[2]);
    }
    return current || 'Unassigned';
  }

  function installExactFallback() {
    try {
      window.CP_RANGES_EXACT = CP_RANGES_EXACT;
      window.fallbackCp = exactCp;
      window.isCpAssigned = assigned;
    } catch (e) {}
  }

  installExactFallback();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installExactFallback();
      setTimeout(function () {
        installExactFallback();
        if (typeof window.loadData === 'function') window.loadData();
      }, 300);
    });
  } else {
    installExactFallback();
    setTimeout(function () {
      installExactFallback();
      if (typeof window.loadData === 'function') window.loadData();
    }, 300);
  }
})();

// Mobile responsive layout fix. UI-only patch; data logic is unchanged.
(function () {
  function installMobileCss() {
    if (document.getElementById('mobileResponsiveFixV4')) return;
    var css = `
      @media (max-width: 820px) {
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }
        body {
          min-width: 0 !important;
          background: #f3f6fb !important;
        }
        .shell {
          display: block !important;
          width: 100% !important;
          min-height: auto !important;
          overflow-x: hidden !important;
        }
        .side {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 12px 12px 10px !important;
          border-radius: 0 0 18px 18px !important;
          overflow: visible !important;
        }
        .brand {
          margin-bottom: 10px !important;
          gap: 10px !important;
          align-items: center !important;
        }
        .logo {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border-radius: 13px !important;
          font-size: 16px !important;
        }
        .brand h1 {
          font-size: 15px !important;
          line-height: 1.15 !important;
        }
        .brand small {
          font-size: 11px !important;
        }
        .sideFoot {
          display: none !important;
        }
        .navItem {
          display: inline-flex !important;
          align-items: center !important;
          width: auto !important;
          max-width: 100% !important;
          margin: 3px 3px 4px 0 !important;
          padding: 8px 9px !important;
          border-radius: 999px !important;
          font-size: 12px !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
        }
        .main {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 12px 10px 28px !important;
          margin: 0 !important;
          overflow-x: hidden !important;
        }
        .hero {
          display: block !important;
          width: 100% !important;
          padding: 15px !important;
          margin: 0 0 12px !important;
          border-radius: 18px !important;
        }
        .hero h2 {
          font-size: 22px !important;
          line-height: 1.18 !important;
          margin-bottom: 8px !important;
        }
        .hero p {
          font-size: 13px !important;
          line-height: 1.4 !important;
        }
        .heroActions {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
          margin-top: 12px !important;
          justify-content: stretch !important;
        }
        .btn, .heroActions .btn, .quickActions .btn, .filters .btn {
          width: 100% !important;
          min-height: 42px !important;
          padding: 10px 8px !important;
          font-size: 12px !important;
          line-height: 1.15 !important;
        }
        .grid {
          gap: 10px !important;
        }
        .kpis {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        .card {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 12px !important;
          border-radius: 16px !important;
        }
        .kpiLabel {
          font-size: 10px !important;
          letter-spacing: .04em !important;
        }
        .kpiValue {
          font-size: 24px !important;
          line-height: 1.05 !important;
          margin-top: 7px !important;
        }
        .kpiHint {
          font-size: 10.5px !important;
        }
        .summaryGrid {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
        }
        .summaryItem {
          padding: 11px !important;
          border-radius: 15px !important;
          min-width: 0 !important;
        }
        .quickActions {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 7px !important;
          margin-bottom: 10px !important;
        }
        .filters {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          margin: 10px 0 12px !important;
          width: 100% !important;
        }
        .filters input, .filters select, .modal input, .modal select, .modal textarea {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 42px !important;
          font-size: 14px !important;
          padding: 10px 12px !important;
        }
        .check {
          width: 100% !important;
          background: #fff !important;
          border: 1px solid #e5eaf2 !important;
          border-radius: 13px !important;
          padding: 10px 12px !important;
        }
        .twoCol, .board {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }
        .sectionTitle {
          display: block !important;
          margin-bottom: 10px !important;
        }
        .sectionTitle h3 {
          font-size: 18px !important;
          line-height: 1.2 !important;
        }
        .sectionTitle span {
          display: block !important;
          margin-top: 3px !important;
          font-size: 12px !important;
        }
        .chartBox {
          height: 175px !important;
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          align-items: flex-end !important;
          gap: 10px !important;
          padding-bottom: 4px !important;
        }
        .chartCol {
          min-width: 54px !important;
          flex: 0 0 54px !important;
        }
        .chartBar {
          max-width: 38px !important;
        }
        .chartLabel {
          font-size: 10px !important;
        }
        .employeeGrid {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }
        .empTop {
          align-items: flex-start !important;
        }
        .empName {
          font-size: 15px !important;
        }
        .percent {
          font-size: 25px !important;
        }
        .categoryList {
          gap: 12px !important;
        }
        .catRow {
          grid-template-columns: 1fr 44px !important;
          gap: 8px !important;
        }
        .catName {
          white-space: normal !important;
          line-height: 1.25 !important;
          font-size: 14px !important;
        }
        .meta {
          font-size: 11px !important;
          gap: 5px !important;
        }
        .pill {
          padding: 4px 7px !important;
          font-size: 11px !important;
        }
        .lane {
          min-height: auto !important;
          padding: 10px !important;
          border-radius: 15px !important;
        }
        .miniItem {
          font-size: 12px !important;
          padding: 9px !important;
        }
        .tableWrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          border-radius: 16px !important;
        }
        table {
          min-width: 980px !important;
        }
        th, td {
          padding: 9px 8px !important;
          font-size: 12px !important;
        }
        th {
          font-size: 10px !important;
        }
        .objective {
          max-width: 330px !important;
        }
        .modalBackdrop {
          align-items: flex-end !important;
          padding: 8px !important;
        }
        .modal {
          width: 100% !important;
          max-height: 92vh !important;
          overflow-y: auto !important;
          border-radius: 20px 20px 0 0 !important;
          padding: 16px !important;
        }
        .modalHead h3 {
          font-size: 18px !important;
        }
        .formGrid, .approvalTools, .approvalChanges {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }
        .approvalActions {
          justify-content: stretch !important;
        }
        .approvalActions .btn {
          width: 100% !important;
        }
        .toast {
          left: 10px !important;
          right: 10px !important;
          bottom: 12px !important;
          width: auto !important;
          max-width: none !important;
          text-align: center !important;
          font-size: 13px !important;
        }
      }
      @media (max-width: 390px) {
        .heroActions, .quickActions, .kpis {
          grid-template-columns: 1fr !important;
        }
        .navItem {
          font-size: 11px !important;
          padding: 7px 8px !important;
        }
        .hero h2 {
          font-size: 20px !important;
        }
      }
    `;
    var style = document.createElement('style');
    style.id = 'mobileResponsiveFixV4';
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMobileCss);
  } else {
    installMobileCss();
  }
})();

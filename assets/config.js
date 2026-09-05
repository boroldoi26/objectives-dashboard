// Current working Apps Script Web App URL. It must end with /exec.
// Stable API-only config. Dashboard data is served by Apps Script.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

// Cascaded Priority fallback and display corrections based on the live Google Sheet G column.
(function () {
  var OLD_LABEL = 'Enabling Safe and Productive Operations';
  var NEW_LABEL = 'Placement Test / Gap Training and 360 Training';

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
    [267,283,NEW_LABEL],
    [300,328,NEW_LABEL],
    [332,338,NEW_LABEL],
    [342,360,NEW_LABEL],
    [364,368,'Training Validity Optimization'],
    [369,373,'Duplicated Training Optimization'],
    [374,376,'Digital & Online Training Enablement']
  ];

  function normalizeCpLabel(v) {
    return String(v || '').trim() === OLD_LABEL ? NEW_LABEL : v;
  }

  function assigned(v) {
    var s = String(v || '').trim().toLowerCase();
    return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null' && s !== '-';
  }

  function exactCp(rowNumber, current) {
    current = normalizeCpLabel(current);
    if (assigned(current)) return current;
    var n = Number(rowNumber || 0);
    for (var i = 0; i < CP_RANGES_EXACT.length; i++) {
      var r = CP_RANGES_EXACT[i];
      if (n >= r[0] && n <= r[1]) return normalizeCpLabel(r[2]);
    }
    return current || 'Unassigned';
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

  function installFallback() {
    try {
      window.CP_RANGES_EXACT = CP_RANGES_EXACT;
      window.CASCADED_PRIORITY_LABEL_ALIASES = window.CASCADED_PRIORITY_LABEL_ALIASES || {};
      window.CASCADED_PRIORITY_LABEL_ALIASES[OLD_LABEL] = NEW_LABEL;
      window.normalizeCascadedPriorityLabel = normalizeCpLabel;
      window.fallbackCp = exactCp;
      window.isCpAssigned = assigned;
      if (document.body) patchTextNodeLabels(document.body);
    } catch (e) {}
  }

  installFallback();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installFallback();
      setTimeout(function () {
        installFallback();
        if (typeof window.loadData === 'function') window.loadData();
      }, 300);
    });
  } else {
    setTimeout(function () {
      installFallback();
      if (typeof window.loadData === 'function') window.loadData();
    }, 300);
  }
  window.setInterval(function () { if (document.body) patchTextNodeLabels(document.body); }, 1000);
})();

// Mobile responsive layout fix. UI-only patch; data logic is unchanged.
(function () {
  function installMobileCss() {
    if (document.getElementById('mobileResponsiveFixV5')) return;
    var css = `
      @media (max-width: 820px) {
        html, body { width:100% !important; max-width:100% !important; overflow-x:hidden !important; }
        body { min-width:0 !important; background:#f3f6fb !important; }
        .shell { display:block !important; width:100% !important; min-height:auto !important; overflow-x:hidden !important; }
        .side { position:relative !important; width:100% !important; height:auto !important; padding:12px !important; border-radius:0 0 18px 18px !important; overflow:visible !important; }
        .brand { margin-bottom:10px !important; gap:10px !important; }
        .logo { width:38px !important; height:38px !important; min-width:38px !important; border-radius:13px !important; font-size:16px !important; }
        .brand h1 { font-size:15px !important; line-height:1.15 !important; }
        .brand small { font-size:11px !important; }
        .sideFoot { display:none !important; }
        .navItem { display:inline-flex !important; width:auto !important; margin:3px 3px 4px 0 !important; padding:8px 9px !important; border-radius:999px !important; font-size:12px !important; white-space:nowrap !important; }
        .main { width:100% !important; max-width:100% !important; min-width:0 !important; padding:12px 10px 28px !important; margin:0 !important; overflow-x:hidden !important; }
        .hero { display:block !important; width:100% !important; padding:15px !important; margin:0 0 12px !important; border-radius:18px !important; }
        .hero h2 { font-size:22px !important; line-height:1.18 !important; }
        .hero p { font-size:13px !important; line-height:1.4 !important; }
        .heroActions { display:grid !important; grid-template-columns:1fr 1fr !important; gap:8px !important; margin-top:12px !important; }
        .btn, .heroActions .btn, .quickActions .btn, .filters .btn { width:100% !important; min-height:42px !important; padding:10px 8px !important; font-size:12px !important; }
        .kpis { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:8px !important; }
        .card { width:100% !important; max-width:100% !important; min-width:0 !important; padding:12px !important; border-radius:16px !important; }
        .kpiValue { font-size:24px !important; line-height:1.05 !important; }
        .summaryGrid, .filters, .twoCol, .board { display:grid !important; grid-template-columns:1fr !important; gap:8px !important; }
        .quickActions { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:7px !important; }
        .filters input, .filters select, .modal input, .modal select, .modal textarea { width:100% !important; min-width:0 !important; min-height:42px !important; font-size:14px !important; }
        .check { width:100% !important; background:#fff !important; border:1px solid #e5eaf2 !important; border-radius:13px !important; padding:10px 12px !important; }
        .sectionTitle { display:block !important; margin-bottom:10px !important; }
        .sectionTitle h3 { font-size:18px !important; line-height:1.2 !important; }
        .sectionTitle span { display:block !important; margin-top:3px !important; font-size:12px !important; }
        .chartBox { height:175px !important; width:100% !important; overflow-x:auto !important; overflow-y:hidden !important; -webkit-overflow-scrolling:touch !important; gap:10px !important; }
        .chartCol { min-width:54px !important; flex:0 0 54px !important; }
        .employeeGrid { display:grid !important; grid-template-columns:1fr !important; gap:10px !important; }
        .catRow { grid-template-columns:1fr 44px !important; gap:8px !important; }
        .catName { white-space:normal !important; line-height:1.25 !important; font-size:14px !important; }
        .tableWrap { width:100% !important; max-width:100% !important; overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; border-radius:16px !important; }
        table { min-width:980px !important; }
        th, td { padding:9px 8px !important; font-size:12px !important; }
        th { font-size:10px !important; }
        .modalBackdrop { align-items:flex-end !important; padding:8px !important; }
        .modal { width:100% !important; max-height:92vh !important; overflow-y:auto !important; border-radius:20px 20px 0 0 !important; padding:16px !important; }
        .formGrid, .approvalTools, .approvalChanges { grid-template-columns:1fr !important; gap:10px !important; }
        .toast { left:10px !important; right:10px !important; bottom:12px !important; width:auto !important; max-width:none !important; text-align:center !important; font-size:13px !important; }
      }
      @media (max-width:390px) { .heroActions, .quickActions, .kpis { grid-template-columns:1fr !important; } .hero h2 { font-size:20px !important; } }
    `;
    var style = document.createElement('style');
    style.id = 'mobileResponsiveFixV5';
    style.textContent = css;
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMobileCss);
  else installMobileCss();
})();

// Current working Apps Script Web App URL. It must end with /exec.
// Stable API-only config. Dashboard data is served by Apps Script.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

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
    [267,283,'Enabling Safe and Productive Operations'],
    [300,328,'Enabling Safe and Productive Operations'],
    [332,351,'Enabling Safe and Productive Operations'],
    [355,359,'Training Validity Optimization'],
    [360,364,'Duplicated Training Optimization'],
    [365,367,'Digital & Online Training Enablement']
  ];

  function assigned(v) {
    var s = String(v || '').trim().toLowerCase();
    return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null' && s !== '-';
  }

  function exactCp(rowNumber, current) {
    if (assigned(current)) return current;
    var n = Number(rowNumber || 0);
    for (var i = 0; i < CP_RANGES_EXACT.length; i++) {
      var r = CP_RANGES_EXACT[i];
      if (n >= r[0] && n <= r[1]) return r[2];
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

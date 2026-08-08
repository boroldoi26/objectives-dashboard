// Current working Apps Script Web App URL. It must end with /exec.
window.DASHBOARD_API_URL = 'https://script.google.com/macros/s/AKfycbxe5EGNuv8clDlvaq_d6xt95ZBLoqG5IEgMSmPQ-MUn94ZdQ0iBuOn2GQ90tvk-NbIrzw/exec';

// Vercel frontend patch: Cascaded Priority-г Google Sheet-ийн G баганаас шууд авч,
// API-аас ирсэн rows дээр давхар тааруулж performance/dropdown/summary-г сэргээдэг.
(function () {
  var SHEET_ID = '1Yw6dYNGRxq1gps71p3sMzu0f-IePVYdoiQIycyC5Qg4';
  var SHEET_NAME = 'Objectives status and detail re';
  var RANGE = 'A4:K367';
  var liveRows = null;
  var livePromise = null;
  var patching = false;

  function clean(v) { return String(v == null ? '' : v).trim(); }
  function isAssigned(v) {
    var s = clean(v).toLowerCase();
    return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null' && s !== '-';
  }
  function cleanPriority(v) { return clean(v).replace(/\.$/, ''); }
  function level(priority) {
    var p = cleanPriority(priority);
    return p ? p.split('.').filter(Boolean).length : 1;
  }
  function parentKey(priority) {
    return cleanPriority(priority).split('.').filter(Boolean).slice(0, 2).join('.');
  }
  function cleanStatus(v) {
    var s = clean(v);
    if (/^completed/i.test(s)) return 'Completed';
    if (/^in progress/i.test(s)) return 'In Progress';
    if (/^not started/i.test(s)) return 'Not Started';
    return s || 'Not Started';
  }
  function daysLeft(dueDateText) {
    var s = clean(dueDateText);
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - t.getTime()) / 86400000);
  }
  function unique(arr) {
    return Array.from(new Set((arr || []).filter(Boolean))).sort();
  }
  function sortHighToLow(items) {
    return (items || []).slice().sort(function (a, b) {
      return (Number(b.completionRate || 0) - Number(a.completionRate || 0)) ||
        (Number(b.progressScore || 0) - Number(a.progressScore || 0)) ||
        (Number(b.completed || 0) - Number(a.completed || 0)) ||
        (Number(b.total || 0) - Number(a.total || 0)) ||
        clean(a.name).localeCompare(clean(b.name));
    });
  }

  function readSheetRows() {
    if (livePromise) return livePromise;
    livePromise = new Promise(function (resolve) {
      var cb = 'cp_sheet_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var done = false;

      function finish(rows) {
        if (done) return;
        done = true;
        try { delete window[cb]; } catch (e) {}
        try { script.remove(); } catch (e) {}
        liveRows = rows || [];
        resolve(liveRows);
      }

      window[cb] = function (res) {
        try {
          var gRows = res && res.table && Array.isArray(res.table.rows) ? res.table.rows : [];
          var currentEmployee = '';
          var currentCategory = '';
          var currentCascade = '';
          var currentParent = '';
          var out = [];

          gRows.slice(1).forEach(function (row, idx) {
            var c = row.c || [];
            function cell(i) { return clean(c[i] && (c[i].f != null ? c[i].f : c[i].v)); }
            var rowNumber = idx + 5;
            var rawEmployee = cell(0);
            var priority = cleanPriority(cell(1));
            var objective = cell(2);
            var currentState = cell(3);
            var status = cleanStatus(cell(4));
            var rawCategory = cell(5);
            var rawCascade = cell(6);
            var dueDate = cell(7);
            var notes = cell(8);
            var lastUpdated = cell(9);
            var updatedBy = cell(10);

            if (rawEmployee) {
              currentEmployee = rawEmployee;
              currentCategory = '';
              currentCascade = '';
              currentParent = '';
            }
            if (rawCategory) currentCategory = rawCategory;

            var pKey = parentKey(priority);
            var lvl = level(priority);
            var cp = '';
            if (isAssigned(rawCascade)) {
              cp = rawCascade;
              currentCascade = rawCascade;
              currentParent = pKey;
            } else if (lvl <= 2) {
              currentCascade = '';
              currentParent = '';
            } else if (currentCascade && pKey === currentParent) {
              cp = currentCascade;
            }

            var dl = daysLeft(dueDate);
            var overdue = status !== 'Completed' && dl !== '' && dl < 0;
            var dueSoon = status !== 'Completed' && dl !== '' && dl >= 0 && dl <= 14;
            var risk = status === 'Completed' ? 'Done' : overdue ? 'Critical' : dueSoon ? 'Due Soon' : dl === '' ? 'No Due Date' : 'On Track';
            var score = status === 'Completed' ? 100 : status === 'In Progress' ? 50 : 0;

            if (priority || objective) {
              out.push({
                rowNumber: rowNumber,
                employee: currentEmployee || 'Unassigned',
                priority: priority,
                objective: objective,
                currentState: currentState,
                status: status,
                category: currentCategory || 'Unassigned',
                cascadedPriority: isAssigned(cp) ? cp : 'Unassigned',
                dueDate: dueDate,
                notes: notes,
                lastUpdated: lastUpdated,
                updatedBy: updatedBy,
                level: lvl,
                isParent: lvl <= 2,
                daysLeft: dl,
                overdue: overdue,
                dueSoon: dueSoon,
                risk: risk,
                progressScore: score
              });
            }
          });
          finish(out);
        } catch (e) {
          finish([]);
        }
      };

      script.onerror = function () { finish([]); };
      script.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?sheet=' + encodeURIComponent(SHEET_NAME) + '&range=' + encodeURIComponent(RANGE) + '&tqx=out:json;responseHandler:' + cb + '&_=' + Date.now();
      document.body.appendChild(script);
      setTimeout(function () { finish([]); }, 12000);
    });
    return livePromise;
  }

  function buildSummary(rows, pendingCount) {
    var s = { total: rows.length, completed: 0, inProgress: 0, notStarted: 0, other: 0, dueSoon: 0, pendingApprovalCount: pendingCount || 0, progressScore: 0, completionRate: 0 };
    var score = 0;
    rows.forEach(function (r) {
      if (r.status === 'Completed') s.completed++;
      else if (r.status === 'In Progress') s.inProgress++;
      else if (r.status === 'Not Started') s.notStarted++;
      else s.other++;
      if (r.dueSoon) s.dueSoon++;
      score += Number(r.progressScore || 0);
    });
    s.completionRate = s.total ? Math.round(s.completed / s.total * 100) : 0;
    s.progressScore = s.total ? Math.round(score / s.total) : 0;
    return s;
  }

  function buildGroup(rows, key) {
    var g = {};
    (rows || []).forEach(function (r) {
      var name = clean(r[key]) || 'Unassigned';
      if (!g[name]) g[name] = { name: name, total: 0, completed: 0, inProgress: 0, notStarted: 0, other: 0, overdue: 0, dueSoon: 0, progressScoreTotal: 0 };
      var x = g[name];
      x.total++;
      if (r.status === 'Completed') x.completed++;
      else if (r.status === 'In Progress') x.inProgress++;
      else if (r.status === 'Not Started') x.notStarted++;
      else x.other++;
      if (r.overdue) x.overdue++;
      if (r.dueSoon) x.dueSoon++;
      x.progressScoreTotal += Number(r.progressScore || 0);
    });
    return sortHighToLow(Object.keys(g).map(function (k) {
      var x = g[k];
      x.completionRate = x.total ? Math.round(x.completed / x.total * 100) : 0;
      x.progressScore = x.total ? Math.round(x.progressScoreTotal / x.total) : 0;
      delete x.progressScoreTotal;
      return x;
    }));
  }

  function managerSummary(rows) {
    var emp = buildGroup(rows, 'employee')[0];
    var cat = buildGroup(rows, 'category').sort(function (a, b) { return b.dueSoon - a.dueSoon; })[0];
    var cp = buildGroup(rows, 'cascadedPriority').filter(function (x) { return x.name !== 'Unassigned'; }).sort(function (a, b) { return b.dueSoon - a.dueSoon; })[0];
    return {
      text: 'Overall completion ' + (buildSummary(rows).completionRate || 0) + '%, weighted progress ' + (buildSummary(rows).progressScore || 0) + '%.',
      topEmployee: emp ? (emp.name + ' — ' + emp.completionRate + '%') : '-',
      attention: rows.filter(function (r) { return r.risk === 'Critical'; }).length + ' critical, ' + rows.filter(function (r) { return r.risk === 'At Risk'; }).length + ' at risk, ' + rows.filter(function (r) { return r.dueSoon; }).length + ' due soon',
      delayedCategory: cat ? cat.name : '-',
      delayedCascadedPriority: cp ? cp.name : '-'
    };
  }

  function filterRows(rows) {
    var f = typeof window.collectFiltersSafe === 'function' ? window.collectFiltersSafe() : {};
    var search = clean(f.search).toLowerCase();
    return (rows || []).filter(function (r) {
      var hay = [r.employee, r.priority, r.objective, r.status, r.category, r.cascadedPriority].join(' ').toLowerCase();
      return (!search || hay.indexOf(search) >= 0) &&
        (!f.employee || r.employee === f.employee) &&
        (!f.status || r.status === f.status) &&
        (!f.category || r.category === f.category) &&
        (!f.cascadedPriority || r.cascadedPriority === f.cascadedPriority) &&
        (!f.onlyOverdue || r.overdue) &&
        (!f.onlyDueSoon || r.dueSoon);
    });
  }

  function rebuildData(apiData, sheetRows) {
    var pending = apiData && apiData.pendingApprovalCount ? apiData.pendingApprovalCount : 0;
    var source = sheetRows && sheetRows.length ? sheetRows : ((apiData && apiData.rows) || []);
    var filtered = filterRows(source);
    return Object.assign({}, apiData || {}, {
      rows: filtered,
      summary: buildSummary(filtered, pending),
      employeePerformance: buildGroup(filtered, 'employee'),
      categoryPerformance: buildGroup(filtered, 'category'),
      cascadedPriorityPerformance: buildGroup(filtered, 'cascadedPriority').filter(function (x) { return x.name !== 'Unassigned'; }),
      filters: {
        employees: unique(source.map(function (r) { return r.employee; })),
        statuses: unique(source.map(function (r) { return r.status; })),
        categories: unique(source.map(function (r) { return r.category; })),
        cascadedPriorities: unique(source.map(function (r) { return r.cascadedPriority; })).filter(function (x) { return x !== 'Unassigned'; })
      },
      managerSummary: managerSummary(filtered),
      dataHealth: { cascadedPriorityColumnFound: true, cascadedUnassigned: source.filter(function (r) { return r.cascadedPriority === 'Unassigned'; }).length }
    });
  }

  function patchLoadData() {
    if (window.__cpVercelPatchApplied || typeof window.loadData !== 'function') return;
    var originalLoadData = window.loadData;
    window.loadData = function () {
      if (patching) return originalLoadData.apply(window, arguments);
      var args = arguments;
      if (typeof window.showLoading === 'function') window.showLoading(true);
      return Promise.all([readSheetRows(), window.apiJsonp ? window.apiJsonp(Object.assign({ action: 'data' }, args[0] || {})).catch(function () { return {}; }) : Promise.resolve({})])
        .then(function (pair) {
          var sheetRows = pair[0] || [];
          var apiData = pair[1] || {};
          var data = rebuildData(apiData, sheetRows);
          window.latestData = data;
          window.rows = data.rows || [];
          window.statusOptions = data.statusOptions || ['Not Started', 'In Progress', 'Completed'];
          if (typeof window.renderAll === 'function') window.renderAll(data);
          if (typeof window.showLoading === 'function') window.showLoading(false);
        })
        .catch(function () {
          patching = true;
          originalLoadData.apply(window, args);
          patching = false;
        });
    };
    window.__cpVercelPatchApplied = true;
  }

  function addMobileUxPatch() {
    if (document.getElementById('mobileUxPatchV32')) return;
    var style = document.createElement('style');
    style.id = 'mobileUxPatchV32';
    style.textContent = '@media (max-width:700px){html,body{width:100%;max-width:100%;overflow-x:hidden}.shell{display:block!important}.side{position:relative!important;height:auto!important;width:100%!important;padding:12px!important;border-radius:0 0 20px 20px!important}.main{width:100%!important;max-width:100%!important;padding:12px 10px 28px!important;overflow-x:hidden!important}.navItem{display:inline-flex!important;margin:3px 3px 4px 0!important;padding:8px 9px!important;border-radius:999px!important;font-size:12px!important}.hero{display:block!important;padding:15px!important;border-radius:18px!important}.hero h2{font-size:22px!important}.heroActions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:12px!important}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.filters{grid-template-columns:1fr!important;gap:8px!important}.summaryGrid,.twoCol,.board{grid-template-columns:1fr!important}.employeeGrid{grid-template-columns:1fr!important}.tableWrap{width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}table{min-width:1040px!important}.modalBackdrop{align-items:flex-end!important;padding:8px!important}.modal{width:100%!important;max-height:92vh!important;overflow-y:auto!important;border-radius:20px 20px 0 0!important}.approvalTools,.approvalChanges,.formGrid{grid-template-columns:1fr!important}.toast{left:10px!important;right:10px!important;bottom:12px!important;text-align:center!important}}';
    document.head.appendChild(style);
  }

  function start() {
    addMobileUxPatch();
    patchLoadData();
    setTimeout(function () {
      patchLoadData();
      if (window.__cpVercelPatchApplied && typeof window.loadData === 'function') window.loadData();
    }, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  setInterval(function () { addMobileUxPatch(); patchLoadData(); }, 1000);
})();

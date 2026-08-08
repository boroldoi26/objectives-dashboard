/* Objectives Dashboard Apps Script backend
 * Version: v3.4.0
 * Fix: Cascaded Priority is read from the live Google Sheet G column.
 */

const SPREADSHEET_ID = '1Yw6dYNGRxq1gps71p3sMzu0f-IePVYdoiQIycyC5Qg4';
const DATA_SHEET_NAME = 'Objectives status and detail re';
const PENDING_SHEET_NAME = 'Pending_Updates';
const CHANGE_LOG_SHEET_NAME = 'Change_Log';
const DATA_START_ROW = 5;

const COL = {
  employee: 1,
  priority: 2,
  objective: 3,
  currentState: 4,
  status: 5,
  category: 6,
  cascadedPriority: 7,
  dueDate: 8,
  notes: 9,
  lastUpdated: 10,
  updatedBy: 11
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || 'data');
  const callback = params.callback;

  try {
    let result;
    switch (action) {
      case '':
      case 'data':
      case 'init':
      case 'getInitialData':
        result = getInitialData_(params);
        break;
      case 'update':
      case 'submitUpdate':
        result = submitUpdate_(params);
        break;
      case 'approvals':
      case 'getApprovals':
        result = getApprovals_(params);
        break;
      case 'approve':
      case 'approveUpdate':
        result = reviewUpdate_(params, 'Approved');
        break;
      case 'reject':
      case 'rejectUpdate':
        result = reviewUpdate_(params, 'Rejected');
        break;
      default:
        throw new Error('Unknown API action: ' + action);
    }
    return output_({ ok: true, data: result }, callback);
  } catch (err) {
    return output_({ ok: false, error: err && err.message ? err.message : String(err) }, callback);
  }
}

function output_(payload, callback) {
  const text = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function getInitialData_(params) {
  const sh = sheet_(DATA_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < DATA_START_ROW) return emptyData_();

  const values = sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 11).getDisplayValues();
  const dueSoonDays = Number(params.dueDays || 14);
  const rows = normalizeRows_(values, DATA_START_ROW, dueSoonDays);
  const filtered = filterRows_(rows, params);
  const pendingCount = countPending_();

  return {
    rows: filtered,
    summary: buildSummary_(filtered, pendingCount),
    employeePerformance: buildGroup_(filtered, 'employee'),
    categoryPerformance: buildGroup_(filtered, 'category'),
    cascadedPriorityPerformance: buildGroup_(filtered, 'cascadedPriority').filter(x => x.name !== 'Unassigned'),
    filters: {
      employees: unique_(rows.map(r => r.employee)),
      statuses: unique_(rows.map(r => r.status)),
      categories: unique_(rows.map(r => r.category)),
      cascadedPriorities: unique_(rows.map(r => r.cascadedPriority)).filter(x => x !== 'Unassigned')
    },
    statusOptions: ['Not Started', 'In Progress', 'Completed'],
    dueSoonDays: dueSoonDays,
    pendingApprovalCount: pendingCount,
    recentUpdates: getRecentUpdates_(),
    managerSummary: managerSummary_(filtered)
  };
}

function normalizeRows_(values, firstRowNumber, dueSoonDays) {
  let currentEmployee = '';
  let currentCategory = '';
  let currentCascade = '';
  let currentCascadeParent = '';

  return values.map((r, i) => {
    const rowNumber = firstRowNumber + i;
    const rawEmployee = clean_(r[COL.employee - 1]);
    const priority = clean_(r[COL.priority - 1]).replace(/\.$/, '');
    const objective = clean_(r[COL.objective - 1]);
    const currentState = clean_(r[COL.currentState - 1]);
    const status = cleanStatus_(r[COL.status - 1]);
    const rawCategory = clean_(r[COL.category - 1]);
    const rawCascade = clean_(r[COL.cascadedPriority - 1]);
    const dueDate = clean_(r[COL.dueDate - 1]);
    const notes = clean_(r[COL.notes - 1]);
    const lastUpdated = clean_(r[COL.lastUpdated - 1]);
    const updatedBy = clean_(r[COL.updatedBy - 1]);

    if (rawEmployee) {
      currentEmployee = rawEmployee;
      currentCategory = '';
      currentCascade = '';
      currentCascadeParent = '';
    }

    if (rawCategory) currentCategory = rawCategory;

    const pKey = parentKey_(priority);
    const level = priorityLevel_(priority);
    let cascadedPriority = rawCascade;

    if (isAssigned_(rawCascade)) {
      currentCascade = rawCascade;
      currentCascadeParent = pKey;
      cascadedPriority = rawCascade;
    } else if (level <= 2) {
      currentCascade = '';
      currentCascadeParent = '';
      cascadedPriority = '';
    } else if (currentCascade && pKey === currentCascadeParent) {
      cascadedPriority = currentCascade;
    }

    const daysLeft = calcDaysLeft_(dueDate);
    const overdue = status !== 'Completed' && daysLeft !== '' && daysLeft < 0;
    const dueSoon = status !== 'Completed' && daysLeft !== '' && daysLeft >= 0 && daysLeft <= dueSoonDays;
    const risk = status === 'Completed' ? 'Done' : overdue ? 'Critical' : dueSoon ? 'Due Soon' : daysLeft === '' ? 'No Due Date' : 'On Track';
    const progressScore = status === 'Completed' ? 100 : status === 'In Progress' ? 50 : 0;

    return {
      rowNumber,
      employee: currentEmployee || 'Unassigned',
      priority,
      objective,
      currentState,
      status,
      category: currentCategory || 'Unassigned',
      cascadedPriority: isAssigned_(cascadedPriority) ? cascadedPriority : 'Unassigned',
      dueDate,
      notes,
      lastUpdated,
      updatedBy,
      level,
      isParent: level <= 2,
      daysLeft,
      overdue,
      dueSoon,
      risk,
      progressScore
    };
  }).filter(r => r.priority || r.objective || r.employee !== 'Unassigned');
}

function filterRows_(rows, params) {
  const search = clean_(params.search).toLowerCase();
  const employee = clean_(params.employee);
  const status = clean_(params.status);
  const category = clean_(params.category);
  const cascadedPriority = clean_(params.cascadedPriority);
  const onlyOverdue = String(params.onlyOverdue) === 'true';
  const onlyDueSoon = String(params.onlyDueSoon) === 'true';

  return rows.filter(r => {
    const hay = [r.employee, r.priority, r.objective, r.status, r.category, r.cascadedPriority].join(' ').toLowerCase();
    return (!search || hay.indexOf(search) >= 0) &&
      (!employee || r.employee === employee) &&
      (!status || r.status === status) &&
      (!category || r.category === category) &&
      (!cascadedPriority || r.cascadedPriority === cascadedPriority) &&
      (!onlyOverdue || r.overdue) &&
      (!onlyDueSoon || r.dueSoon);
  });
}

function submitUpdate_(params) {
  const rowNumber = Number(params.rowNumber);
  if (!rowNumber || rowNumber < DATA_START_ROW) throw new Error('Invalid rowNumber');
  ensurePendingSheet_();

  const dataSh = sheet_(DATA_SHEET_NAME);
  const row = dataSh.getRange(rowNumber, 1, 1, 11).getDisplayValues()[0];
  const requestId = 'REQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 10000);

  const pending = sheet_(PENDING_SHEET_NAME);
  pending.appendRow([
    requestId,
    rowNumber,
    row[COL.priority - 1],
    row[COL.employee - 1],
    row[COL.status - 1],
    clean_(params.status),
    row[COL.dueDate - 1],
    clean_(params.dueDate),
    row[COL.notes - 1],
    clean_(params.notes),
    clean_(params.requestedBy),
    new Date(),
    'Pending',
    '',
    '',
    clean_(params.requestComment)
  ]);

  return { requestId, message: 'Approval request submitted' };
}

function getApprovals_(params) {
  validateAdminPasscode_(params.adminPasscode);
  ensurePendingSheet_();
  const sh = sheet_(PENDING_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 16).getDisplayValues();
  return values
    .filter(r => clean_(r[12]) === 'Pending')
    .map(r => ({
      requestId: r[0],
      rowNumber: Number(r[1]),
      priority: r[2],
      employee: r[3],
      oldStatus: r[4],
      newStatus: r[5],
      oldDueDate: r[6],
      newDueDate: r[7],
      oldNotes: r[8],
      newNotes: r[9],
      requestedBy: r[10],
      requestedAt: r[11],
      objective: getObjectiveByRow_(Number(r[1])),
      requestComment: r[15]
    }));
}

function reviewUpdate_(params, decision) {
  validateAdminPasscode_(params.adminPasscode);
  const requestId = clean_(params.requestId);
  if (!requestId) throw new Error('requestId is required');

  ensurePendingSheet_();
  const pending = sheet_(PENDING_SHEET_NAME);
  const lastRow = pending.getLastRow();
  const values = lastRow >= 2 ? pending.getRange(2, 1, lastRow - 1, 16).getValues() : [];
  const idx = values.findIndex(r => clean_(r[0]) === requestId);
  if (idx < 0) throw new Error('Request not found: ' + requestId);

  const sheetRow = idx + 2;
  const req = values[idx];
  if (clean_(req[12]) !== 'Pending') throw new Error('Request already reviewed');

  if (decision === 'Approved') {
    const rowNumber = Number(req[1]);
    const dataSh = sheet_(DATA_SHEET_NAME);
    dataSh.getRange(rowNumber, COL.status).setValue(req[5]);
    dataSh.getRange(rowNumber, COL.dueDate).setValue(req[7]);
    dataSh.getRange(rowNumber, COL.notes).setValue(req[9]);
    dataSh.getRange(rowNumber, COL.lastUpdated).setValue(new Date());
    dataSh.getRange(rowNumber, COL.updatedBy).setValue(req[10]);
    logChange_(req, params.adminComment);
  }

  pending.getRange(sheetRow, 13).setValue(decision);
  pending.getRange(sheetRow, 14).setValue(Session.getActiveUser().getEmail() || 'Admin');
  pending.getRange(sheetRow, 15).setValue(new Date());
  pending.getRange(sheetRow, 16).setValue(clean_(params.adminComment));

  return { message: decision };
}

function validateAdminPasscode_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE');
  if (!expected) throw new Error('ADMIN_PASSCODE script property is not set');
  if (String(provided || '') !== String(expected)) throw new Error('Invalid admin passcode');
}

function ensurePendingSheet_() {
  let sh = ss_().getSheetByName(PENDING_SHEET_NAME);
  if (!sh) sh = ss_().insertSheet(PENDING_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['RequestID','RowNumber','PriorityNo','Employee','OldStatus','NewStatus','OldDueDate','NewDueDate','OldNotes','NewNotes','RequestedBy','RequestedAt','ApprovalStatus','ReviewedBy','ReviewedAt','AdminComment']);
  }
}

function getObjectiveByRow_(rowNumber) {
  if (!rowNumber) return '';
  return sheet_(DATA_SHEET_NAME).getRange(rowNumber, COL.objective).getDisplayValue();
}

function countPending_() {
  const sh = ss_().getSheetByName(PENDING_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 13, sh.getLastRow() - 1, 1).getDisplayValues().filter(r => r[0] === 'Pending').length;
}

function logChange_(req, comment) {
  let sh = ss_().getSheetByName(CHANGE_LOG_SHEET_NAME);
  if (!sh) sh = ss_().insertSheet(CHANGE_LOG_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(['Timestamp','RequestID','RowNumber','Priority','Field','OldValue','NewValue','User','Comment']);
  const now = new Date();
  sh.appendRow([now, req[0], req[1], req[2], 'Status', req[4], req[5], req[10], comment || '']);
  sh.appendRow([now, req[0], req[1], req[2], 'Due Date', req[6], req[7], req[10], comment || '']);
  sh.appendRow([now, req[0], req[1], req[2], 'Notes', req[8], req[9], req[10], comment || '']);
}

function getRecentUpdates_() {
  const sh = ss_().getSheetByName(CHANGE_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  const lastRow = sh.getLastRow();
  const start = Math.max(2, lastRow - 19);
  return sh.getRange(start, 1, lastRow - start + 1, 9).getDisplayValues().reverse().map(r => ({
    timestamp: r[0], requestId: r[1], rowNumber: r[2], priority: r[3], field: r[4], oldValue: r[5], newValue: r[6], user: r[7], comment: r[8], objective: getObjectiveByRow_(Number(r[2]))
  }));
}

function buildSummary_(rows, pendingCount) {
  const s = { total: rows.length, completed: 0, inProgress: 0, notStarted: 0, other: 0, dueSoon: 0, pendingApprovalCount: pendingCount || 0, progressScore: 0, completionRate: 0 };
  let score = 0;
  rows.forEach(r => {
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

function buildGroup_(rows, key) {
  const group = {};
  rows.forEach(r => {
    const name = clean_(r[key]) || 'Unassigned';
    if (!group[name]) group[name] = { name, total: 0, completed: 0, inProgress: 0, notStarted: 0, other: 0, overdue: 0, dueSoon: 0, progressScoreTotal: 0 };
    const g = group[name];
    g.total++;
    if (r.status === 'Completed') g.completed++;
    else if (r.status === 'In Progress') g.inProgress++;
    else if (r.status === 'Not Started') g.notStarted++;
    else g.other++;
    if (r.overdue) g.overdue++;
    if (r.dueSoon) g.dueSoon++;
    g.progressScoreTotal += Number(r.progressScore || 0);
  });
  return Object.keys(group).map(k => {
    const g = group[k];
    g.completionRate = g.total ? Math.round(g.completed / g.total * 100) : 0;
    g.progressScore = g.total ? Math.round(g.progressScoreTotal / g.total) : 0;
    delete g.progressScoreTotal;
    return g;
  }).sort((a, b) =>
    (b.completionRate - a.completionRate) ||
    (b.progressScore - a.progressScore) ||
    (b.completed - a.completed) ||
    (b.total - a.total) ||
    a.name.localeCompare(b.name)
  );
}

function managerSummary_(rows) {
  const emp = buildGroup_(rows, 'employee')[0];
  const cat = buildGroup_(rows, 'category').sort((a, b) => b.dueSoon - a.dueSoon)[0];
  const cp = buildGroup_(rows, 'cascadedPriority').filter(x => x.name !== 'Unassigned').sort((a, b) => b.dueSoon - a.dueSoon)[0];
  return {
    text: 'Filtered dashboard summary',
    topEmployee: emp ? emp.name : '-',
    attention: rows.filter(r => r.overdue).length + ' overdue',
    delayedCategory: cat ? cat.name : '-',
    delayedCascadedPriority: cp ? cp.name : '-'
  };
}

function emptyData_() {
  return { rows: [], summary: buildSummary_([], 0), employeePerformance: [], categoryPerformance: [], cascadedPriorityPerformance: [], filters: { employees: [], statuses: [], categories: [], cascadedPriorities: [] }, pendingApprovalCount: 0 };
}

function clean_(v) {
  return String(v == null ? '' : v).trim();
}

function isAssigned_(v) {
  const s = clean_(v).toLowerCase();
  return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null';
}

function cleanStatus_(v) {
  const s = clean_(v);
  if (/^completed/i.test(s)) return 'Completed';
  if (/^in progress/i.test(s)) return 'In Progress';
  if (/^not started/i.test(s)) return 'Not Started';
  return s || 'Not Started';
}

function parentKey_(priority) {
  return clean_(priority).replace(/\.$/, '').split('.').slice(0, 2).join('.');
}

function priorityLevel_(priority) {
  const p = clean_(priority).replace(/\.$/, '');
  return p ? p.split('.').length : 1;
}

function calcDaysLeft_(dueDateText) {
  const s = clean_(dueDateText);
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function unique_(arr) {
  return Array.from(new Set((arr || []).filter(Boolean))).sort();
}

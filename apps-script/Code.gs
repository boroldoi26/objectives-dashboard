/**
 * Objectives Dashboard - Google Sheets + Apps Script Web App
 * Data source: Excel/Google Sheet with columns:
 * Employee Name | Priority# | Objectives & Activities | Current State | Status | Objective Category | Due Date
 */

const CONFIG = {
  // Leave blank to auto-detect the sheet that contains the required headers.
  SHEET_NAME: '',
  HEADER_ROW: 4,
  REQUIRED_HEADERS: [
    'Employee Name',
    'Priority#',
    'Objectives & Activities',
    'Current State',
    'Status',
    'Objective Category',
    'Due Date'
  ],
  STATUS_OPTIONS: ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
  DUE_SOON_DAYS: 30,
  // Optional: set Script Property UPDATE_PASSCODE, or place a value here. Leave blank for no passcode.
  // In approval mode, user updates are saved to Pending_Updates first.
  UPDATE_PASSCODE: '',
  ADMIN_PASSCODE: '',
  LOG_SHEET: 'Change_Log',
  PENDING_SHEET: 'Pending_Updates'
};

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  if (params.action) return handleApiRequest_(params);

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Critical Few Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  return handleApiRequest_(params);
}

function handleApiRequest_(params) {
  try {
    let result;
    const action = String(params.action || '').toLowerCase();

    if (action === 'data') {
      result = getDashboardData({
        search: params.search || '',
        employee: params.employee || '',
        status: params.status || '',
        category: params.category || '',
        onlyOverdue: params.onlyOverdue === 'true',
        onlyDueSoon: params.onlyDueSoon === 'true',
        dueDays: Number(params.dueDays || CONFIG.DUE_SOON_DAYS)
      });
    } else if (action === 'update') {
      result = submitUpdateRequest(Number(params.rowNumber), {
        status: params.status || '',
        dueDate: params.dueDate || '',
        notes: params.notes || '',
        requestedBy: params.requestedBy || '',
        requestComment: params.requestComment || ''
      });
    } else if (action === 'approvals') {
      result = getPendingApprovals();
    } else if (action === 'approve') {
      result = approvePendingUpdate(params.requestId || '', {
        adminPasscode: params.adminPasscode || '',
        adminComment: params.adminComment || ''
      });
    } else if (action === 'reject') {
      result = rejectPendingUpdate(params.requestId || '', {
        adminPasscode: params.adminPasscode || '',
        adminComment: params.adminComment || ''
      });
    } else {
      throw new Error('Unknown API action: ' + action);
    }

    return apiOutput_({ ok: true, data: result }, params.callback);
  } catch (err) {
    return apiOutput_({ ok: false, error: err.message || String(err) }, params.callback);
  }
}

function apiOutput_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getInitialData() {
  ensureSupportSheets_();
  return getDashboardData({});
}

function getDashboardData(filters) {
  const sheetInfo = getDataSheet_();
  const sheet = sheetInfo.sheet;
  const headerRow = sheetInfo.headerRow;

  // Read headers once; ensure tracking columns exist; re-read only the column map (no full row scan).
  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  const map = getHeaderMap_(headers);
  const addedColumns = ensureTrackingColumns_(sheet, headers, map);
  // If new columns were added the map was mutated in-place — no second getValues() needed.
  // Only re-fetch the last column count if columns were actually added.
  const finalMap = addedColumns ? getHeaderMap_(
    sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim())
  ) : map;

  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(0, lastRow - headerRow);
  if (rowCount === 0) {
    return { rows: [], summary: emptySummary_(), filters: emptyFilters_(), sheetName: sheet.getName() };
  }

  const values = sheet.getRange(headerRow + 1, 1, rowCount, sheet.getLastColumn()).getValues();
  const dueSoonDays = sanitizeDueDays_(filters && filters.dueDays);
  const rows = normalizeRows_(values, finalMap, headerRow, dueSoonDays);
  const filteredRows = applyFilters_(rows, filters || {});
  const summary = buildSummary_(filteredRows);
  summary.pendingApprovalCount = countPendingApprovals_();

  // Compute once and share with managerSummary to avoid redundant group-by passes.
  const employeePerformance = buildEmployeePerformance_(filteredRows);
  const categoryPerformance = buildCategoryPerformance_(filteredRows);

  return {
    sheetName: sheet.getName(),
    generatedAt: new Date().toISOString(),
    rows: filteredRows,
    summary: summary,
    employeePerformance: employeePerformance,
    categoryPerformance: categoryPerformance,
    managerSummary: buildManagerSummary_(filteredRows, employeePerformance, categoryPerformance),
    recentUpdates: getRecentUpdates_(8),
    pendingApprovalCount: countPendingApprovals_(),
    approvalMode: true,
    dueSoonDays: dueSoonDays,
    filters: buildFilters_(rows),
    statusOptions: CONFIG.STATUS_OPTIONS
  };
}

function submitUpdateRequest(rowNumber, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSupportSheets_();
    const sheetInfo = getDataSheet_();
    const sheet = sheetInfo.sheet;
    const headerRow = sheetInfo.headerRow;
    if (Number(rowNumber) <= headerRow || Number(rowNumber) > sheet.getLastRow()) {
      throw new Error('Invalid row number: ' + rowNumber);
    }

    const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const map = getHeaderMap_(headers);
    ensureTrackingColumns_(sheet, headers, map);

    const finalHeaders = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const finalMap = getHeaderMap_(finalHeaders);
    const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    const timestamp = new Date();

    const oldStatus = normalizeStatus_(cell_(rowValues, finalMap['Status']));
    const oldDueDate = toDateString_(cell_(rowValues, finalMap['Due Date']));
    const oldNotes = String(cell_(rowValues, finalMap['Notes']) || '');
    const newStatus = normalizeStatus_(payload.status || oldStatus);
    const newDueDate = payload.dueDate ? toDateString_(payload.dueDate) : '';
    const newNotes = String(payload.notes || '');

    if (oldStatus === newStatus && oldDueDate === newDueDate && oldNotes === newNotes) {
      throw new Error('Өөрчлөлт илрээгүй байна. Status, due date эсвэл notes өөрчилнө үү.');
    }

    // Давхардсан pending хүсэлт шалгах: нэг row-д ижил өөрчлөлттэй хүсэлт байвал татгалзана.
    const pendingSheet = getPendingSheet_();
    if (pendingSheet.getLastRow() > 1) {
      const existingRows = pendingSheet.getRange(2, 1, pendingSheet.getLastRow() - 1, 15).getValues();
      const duplicate = existingRows.some(r =>
        Number(r[3]) === Number(rowNumber) &&
        String(r[8] || '') === newStatus &&
        String(r[14] || '') === 'Pending'
      );
      if (duplicate) {
        throw new Error('Энэ зорилтод аль хэдийн хүлээгдэж буй хүсэлт байна. Admin шийдвэрлэхийг хүлээнэ үү.');
      }
    }

    const requester = String(payload.requestedBy || '').trim() || getUserEmail_();
    const requestId = 'REQ-' + Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    const pending = getPendingSheet_();
    const priority = String(cell_(rowValues, finalMap['Priority#']) || '');
    const employee = String(cell_(rowValues, finalMap['Employee Name']) || '');
    const objective = String(cell_(rowValues, finalMap['Objectives & Activities']) || '');

    pending.appendRow([
      requestId,
      timestamp,
      requester,
      rowNumber,
      priority,
      employee,
      objective,
      oldStatus,
      newStatus,
      oldDueDate,
      newDueDate,
      oldNotes,
      newNotes,
      String(payload.requestComment || ''),
      'Pending',
      '',
      '',
      ''
    ]);

    return { ok: true, requestId: requestId, message: 'Update request admin approval руу илгээгдлээ.' };
  } finally {
    lock.releaseLock();
  }
}

function getPendingApprovals() {
  ensureSupportSheets_();
  const pending = getPendingSheet_();
  if (pending.getLastRow() <= 1) return [];
  const values = pending.getRange(2, 1, pending.getLastRow() - 1, pending.getLastColumn()).getValues();
  return values
    .map((r, i) => pendingRowToObject_(r, i + 2))
    .filter(x => x.approvalStatus === 'Pending')
    .reverse();
}

function approvePendingUpdate(requestId, payload) {
  validateAdminPasscode_(payload && payload.adminPasscode);
  return reviewPendingUpdate_(requestId, 'Approved', payload && payload.adminComment);
}

function rejectPendingUpdate(requestId, payload) {
  validateAdminPasscode_(payload && payload.adminPasscode);
  return reviewPendingUpdate_(requestId, 'Rejected', payload && payload.adminComment);
}

function reviewPendingUpdate_(requestId, decision, adminComment) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSupportSheets_();
    const pending = getPendingSheet_();
    const found = findPendingRequest_(requestId);
    if (!found) throw new Error('Pending request олдсонгүй: ' + requestId);
    if (found.item.approvalStatus !== 'Pending') throw new Error('Энэ request аль хэдийн ' + found.item.approvalStatus + ' болсон байна.');

    const reviewer = getUserEmail_();
    const reviewedAt = new Date();

    if (decision === 'Approved') {
      applyApprovedUpdate_(found.item, reviewer, reviewedAt);
    }

    pending.getRange(found.rowNumber, 15).setValue(decision);
    pending.getRange(found.rowNumber, 16).setValue(reviewer);
    pending.getRange(found.rowNumber, 17).setValue(reviewedAt);
    pending.getRange(found.rowNumber, 18).setValue(String(adminComment || ''));

    return { ok: true, message: decision === 'Approved' ? 'Approved and updated' : 'Rejected', requestId: requestId };
  } finally {
    lock.releaseLock();
  }
}

function applyApprovedUpdate_(request, reviewer, timestamp) {
  const sheetInfo = getDataSheet_();
  const sheet = sheetInfo.sheet;
  const headerRow = sheetInfo.headerRow;
  const rowNumber = Number(request.rowNumber);
  if (rowNumber <= headerRow || rowNumber > sheet.getLastRow()) throw new Error('Target row invalid: ' + rowNumber);

  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  const map = getHeaderMap_(headers);
  ensureTrackingColumns_(sheet, headers, map);
  const finalHeaders = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  const finalMap = getHeaderMap_(finalHeaders);

  const changes = [];
  updateField_(sheet, rowNumber, finalMap, 'Status', normalizeStatus_(request.newStatus), changes);
  updateField_(sheet, rowNumber, finalMap, 'Due Date', request.newDueDate ? new Date(request.newDueDate) : '', changes);
  updateField_(sheet, rowNumber, finalMap, 'Notes', request.newNotes || '', changes);
  updateField_(sheet, rowNumber, finalMap, 'Last Updated', timestamp, changes);
  updateField_(sheet, rowNumber, finalMap, 'Updated By', reviewer, changes);
  changes.push({ field: 'Approval Request', oldValue: request.requestId, newValue: 'Approved' });
  appendLog_(rowNumber, changes, reviewer, timestamp);

  // Auto-complete parent if all children are now Completed
  if (normalizeStatus_(request.newStatus) === 'Completed') {
    autoCompleteParents_(sheet, rowNumber, headerRow, finalMap);
  }
}

// Checks if all direct children of the parent are Completed; if so, marks parent Completed too.
// Cascades upward (grandparent, etc.) as needed.
function autoCompleteParents_(sheet, updatedSheetRow, headerRow, map) {
  const priorityCol = map['Priority#'];
  const statusCol   = map['Status'];
  if (!priorityCol || !statusCol) return;

  const rowValues = sheet.getRange(updatedSheetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const priority   = String(cell_(rowValues, priorityCol) || '').trim();
  if (!priority) return;

  const parts = priority.split('.');
  if (parts.length <= 1) return; // top-level, no parent

  const parentPriority = parts.slice(0, -1).join('.');
  const parentParts    = parentPriority.split('.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return;

  const allValues = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, sheet.getLastColumn()).getValues();

  let parentSheetRow      = null;
  let parentCurrentStatus = null;
  const childStatuses     = [];

  allValues.forEach((row, i) => {
    const p = String(row[priorityCol - 1] || '').trim();
    if (!p) return;
    const pParts = p.split('.');

    if (p === parentPriority) {
      parentSheetRow      = headerRow + 1 + i;
      parentCurrentStatus = normalizeStatus_(row[statusCol - 1]);
    }
    // Direct children of parentPriority (exactly one level deeper)
    if (pParts.length === parentParts.length + 1 &&
        pParts.slice(0, parentParts.length).join('.') === parentPriority) {
      childStatuses.push(normalizeStatus_(row[statusCol - 1]));
    }
  });

  if (!parentSheetRow || !childStatuses.length) return;
  if (parentCurrentStatus === 'Completed') return;

  const allDone = childStatuses.every(s => s === 'Completed');
  if (!allDone) return;

  // All children are Completed → auto-complete parent
  const now = new Date();
  sheet.getRange(parentSheetRow, statusCol).setValue('Completed');
  if (map['Last Updated']) sheet.getRange(parentSheetRow, map['Last Updated']).setValue(now);
  if (map['Updated By'])   sheet.getRange(parentSheetRow, map['Updated By']).setValue('Auto (бүх дэд зорилт дууссан)');

  appendLog_(parentSheetRow, [{ field: 'Status', oldValue: parentCurrentStatus, newValue: 'Completed' }], 'system-auto', now);

  // Cascade: check grandparent
  autoCompleteParents_(sheet, parentSheetRow, headerRow, map);
}

function findPendingRequest_(requestId) {
  const pending = getPendingSheet_();
  if (pending.getLastRow() <= 1) return null;
  const values = pending.getRange(2, 1, pending.getLastRow() - 1, pending.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === String(requestId || '')) {
      return { rowNumber: i + 2, item: pendingRowToObject_(values[i], i + 2) };
    }
  }
  return null;
}

function pendingRowToObject_(r, rowNumber) {
  return {
    sheetRowNumber: rowNumber,
    requestId: String(r[0] || ''),
    requestedAt: toDateTimeString_(r[1]),
    requestedBy: String(r[2] || ''),
    rowNumber: r[3],
    priority: String(r[4] || ''),
    employee: String(r[5] || ''),
    objective: String(r[6] || ''),
    oldStatus: String(r[7] || ''),
    newStatus: String(r[8] || ''),
    oldDueDate: r[9] instanceof Date ? toDateString_(r[9]) : String(r[9] || ''),
    newDueDate: r[10] instanceof Date ? toDateString_(r[10]) : String(r[10] || ''),
    oldNotes: String(r[11] || ''),
    newNotes: String(r[12] || ''),
    requestComment: String(r[13] || ''),
    approvalStatus: String(r[14] || ''),
    reviewedBy: String(r[15] || ''),
    reviewedAt: toDateTimeString_(r[16]),
    adminComment: String(r[17] || '')
  };
}

function getFilterOptions() {
  return getDashboardData({}).filters;
}

function getDataSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet found. Bind this script to your Google Sheet.');

  if (CONFIG.SHEET_NAME) {
    const configured = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!configured) throw new Error('Configured sheet not found: ' + CONFIG.SHEET_NAME);
    return { sheet: configured, headerRow: CONFIG.HEADER_ROW };
  }

  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    const lastRow = Math.min(sheet.getLastRow(), 20);
    const lastCol = Math.min(sheet.getLastColumn(), 20);
    if (!lastRow || !lastCol) continue;
    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    for (let r = 0; r < values.length; r++) {
      const row = values[r].map(v => String(v || '').trim());
      const found = CONFIG.REQUIRED_HEADERS.every(h => row.indexOf(h) !== -1);
      if (found) return { sheet, headerRow: r + 1 };
    }
  }
  throw new Error('Could not find a data sheet with required headers: ' + CONFIG.REQUIRED_HEADERS.join(', '));
}

function getHeaderMap_(headers) {
  const map = {};
  headers.forEach((h, i) => {
    if (h) map[h] = i + 1;
  });
  return map;
}

function ensureTrackingColumns_(sheet, headers, map) {
  const needed = ['Notes', 'Last Updated', 'Updated By'];
  let lastCol = sheet.getLastColumn();
  let added = false;
  needed.forEach(name => {
    if (!map[name]) {
      lastCol += 1;
      sheet.getRange(CONFIG.HEADER_ROW, lastCol).setValue(name).setFontWeight('bold');
      map[name] = lastCol;
      added = true;
    }
  });
  return added;
}

function ensureSupportSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(CONFIG.LOG_SHEET)) {
    const log = ss.insertSheet(CONFIG.LOG_SHEET);
    log.getRange(1, 1, 1, 8).setValues([['Timestamp', 'User', 'Row Number', 'Priority#', 'Field', 'Old Value', 'New Value', 'Objective']]);
    log.getRange(1, 1, 1, 8).setFontWeight('bold');
    log.setFrozenRows(1);
  }
  getPendingSheet_();
}

function getPendingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.PENDING_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.PENDING_SHEET);
    sheet.getRange(1, 1, 1, 18).setValues([[
      'RequestID', 'RequestedAt', 'RequestedBy', 'RowNumber', 'Priority#', 'Employee', 'Objective',
      'OldStatus', 'NewStatus', 'OldDueDate', 'NewDueDate', 'OldNotes', 'NewNotes', 'RequestComment',
      'ApprovalStatus', 'ReviewedBy', 'ReviewedAt', 'AdminComment'
    ]]);
    sheet.getRange(1, 1, 1, 18).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function countPendingApprovals_() {
  try {
    const pending = getPendingSheet_();
    if (pending.getLastRow() <= 1) return 0;
    const statuses = pending.getRange(2, 15, pending.getLastRow() - 1, 1).getValues();
    return statuses.filter(r => String(r[0] || '') === 'Pending').length;
  } catch (e) {
    return 0;
  }
}

function normalizeRows_(values, map, headerRow, dueSoonDays) {
  let currentEmployee = '';
  let currentCategory = '';
  let currentDueDate = '';

  return values.map((r, i) => {
    const rowNumber = headerRow + 1 + i;
    const employee = cell_(r, map['Employee Name']);
    const category = cell_(r, map['Objective Category']);
    const dueDate = cell_(r, map['Due Date']);
    if (employee) currentEmployee = employee;
    if (category) currentCategory = category;
    if (dueDate) currentDueDate = dueDate;

    const priority = cell_(r, map['Priority#']);
    const objective = cell_(r, map['Objectives & Activities']);
    const currentState = cell_(r, map['Current State']);
    const status = normalizeStatus_(cell_(r, map['Status']));
    const normalizedDueDate = toDateString_(dueDate || currentDueDate);

    return {
      rowNumber,
      employee: employee || currentEmployee,
      priority: String(priority || ''),
      objective: String(objective || ''),
      currentState: String(currentState || ''),
      status,
      category: category || currentCategory,
      dueDate: normalizedDueDate,
      notes: String(cell_(r, map['Notes']) || ''),
      lastUpdated: toDateTimeString_(cell_(r, map['Last Updated'])),
      updatedBy: String(cell_(r, map['Updated By']) || ''),
      level: String(priority || '').split('.').length,
      isParent: String(priority || '').split('.').length <= 2,
      overdue: isOverdue_(normalizedDueDate, status),
      dueSoon: isDueSoon_(normalizedDueDate, status, dueSoonDays),
      daysLeft: daysLeft_(normalizedDueDate),
      risk: getRisk_(normalizedDueDate, status, dueSoonDays),
      progressScore: getProgressScore_(status)
    };
  }).filter(row => row.priority || row.objective);
}

function applyFilters_(rows, filters) {
  const q = String(filters.search || '').toLowerCase().trim();
  return rows.filter(row => {
    if (filters.employee && row.employee !== filters.employee) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.onlyOverdue && !row.overdue) return false;
    if (filters.onlyDueSoon && !row.dueSoon) return false;
    if (q) {
      const haystack = [row.employee, row.priority, row.objective, row.currentState, row.status, row.category, row.notes].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function buildSummary_(rows) {
  const summary = emptySummary_();
  summary.total = rows.length;
  let progressScoreTotal = 0;
  rows.forEach(row => {
    if (row.status === 'Completed') summary.completed += 1;
    else if (row.status === 'In Progress') summary.inProgress += 1;
    else if (row.status === 'Not Started') summary.notStarted += 1;
    else summary.other += 1;
    if (row.overdue) summary.overdue += 1;
    if (row.dueSoon) summary.dueSoon += 1;
    if (row.risk === 'Critical') summary.critical += 1;
    if (row.risk === 'At Risk') summary.atRisk += 1;
    progressScoreTotal += row.progressScore || 0;
  });
  summary.completionRate = summary.total ? Math.round(summary.completed / summary.total * 100) : 0;
  summary.progressScore = summary.total ? Math.round(progressScoreTotal / summary.total) : 0;
  return summary;
}

function buildEmployeePerformance_(rows) {
  return buildGroupPerformance_(rows, 'employee');
}

function buildCategoryPerformance_(rows) {
  return buildGroupPerformance_(rows, 'category');
}

function buildGroupPerformance_(rows, key) {
  const groups = {};
  rows.forEach(row => {
    const name = String(row[key] || 'Unassigned').trim() || 'Unassigned';
    if (!groups[name]) {
      groups[name] = { name, total: 0, completed: 0, inProgress: 0, notStarted: 0, other: 0, overdue: 0, dueSoon: 0, critical: 0, atRisk: 0, progressScoreTotal: 0 };
    }
    const g = groups[name];
    g.total += 1;
    if (row.status === 'Completed') g.completed += 1;
    else if (row.status === 'In Progress') g.inProgress += 1;
    else if (row.status === 'Not Started') g.notStarted += 1;
    else g.other += 1;
    if (row.overdue) g.overdue += 1;
    if (row.dueSoon) g.dueSoon += 1;
    if (row.risk === 'Critical') g.critical += 1;
    if (row.risk === 'At Risk') g.atRisk += 1;
    g.progressScoreTotal += row.progressScore || 0;
  });
  return Object.keys(groups).map(name => {
    const g = groups[name];
    g.completionRate = g.total ? Math.round(g.completed / g.total * 100) : 0;
    g.progressScore = g.total ? Math.round(g.progressScoreTotal / g.total) : 0;
    delete g.progressScoreTotal;
    return g;
  }).sort((a, b) => b.completionRate - a.completionRate || b.progressScore - a.progressScore || a.name.localeCompare(b.name));
}

function buildFilters_(rows) {
  return {
    employees: unique_(rows.map(r => r.employee).filter(Boolean)),
    statuses: unique_(rows.map(r => r.status).filter(Boolean)),
    categories: unique_(rows.map(r => r.category).filter(Boolean))
  };
}

function appendLog_(rowNumber, changes, user, timestamp) {
  if (!changes.length) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(CONFIG.LOG_SHEET) || ss.insertSheet(CONFIG.LOG_SHEET);
  const sheetInfo = getDataSheet_();
  const sheet = sheetInfo.sheet;
  const headers = sheet.getRange(sheetInfo.headerRow, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
  const map = getHeaderMap_(headers);
  const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const priority = cell_(rowValues, map['Priority#']);
  const objective = cell_(rowValues, map['Objectives & Activities']);

  const records = changes.map(c => [timestamp, user, rowNumber, priority, c.field, c.oldValue, c.newValue, objective]);
  log.getRange(log.getLastRow() + 1, 1, records.length, 8).setValues(records);
}

function updateField_(sheet, rowNumber, map, field, newValue, changes) {
  const col = map[field];
  if (!col) return;
  const cell = sheet.getRange(rowNumber, col);
  const oldValue = cell.getValue();
  const oldComparable = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue || '');
  const newComparable = newValue instanceof Date ? newValue.toISOString() : String(newValue || '');
  if (oldComparable !== newComparable) {
    cell.setValue(newValue);
    changes.push({ field, oldValue: oldValue instanceof Date ? toDateString_(oldValue) : oldValue, newValue: newValue instanceof Date ? toDateString_(newValue) : newValue });
  }
}

function cell_(row, col) {
  return col ? row[col - 1] : '';
}

function normalizeStatus_(value) {
  const s = String(value || '').trim().replace(/\s+/g, ' ');
  const lower = s.toLowerCase();
  if (lower === 'completed' || lower === 'complete') return 'Completed';
  if (lower === 'in progress' || lower === 'progress') return 'In Progress';
  if (lower === 'not started' || lower === 'not start') return 'Not Started';
  if (lower === 'on hold') return 'On Hold';
  if (lower === 'cancelled' || lower === 'canceled') return 'Cancelled';
  return s || 'Not Started';
}

function toDateString_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toDateTimeString_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function isOverdue_(dateString, status) {
  if (!dateString || status === 'Completed' || status === 'Cancelled') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateString);
  return due < today;
}

function isDueSoon_(dateString, status, dueSoonDays) {
  if (!dateString || status === 'Completed' || status === 'Cancelled') return false;
  const diff = daysLeft_(dateString);
  return diff !== '' && diff >= 0 && diff <= sanitizeDueDays_(dueSoonDays);
}

function daysLeft_(dateString) {
  if (!dateString) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateString);
  if (isNaN(due.getTime())) return '';
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function getRisk_(dateString, status, dueSoonDays) {
  if (status === 'Completed' || status === 'Cancelled') return 'Done';
  const days = daysLeft_(dateString);
  const windowDays = sanitizeDueDays_(dueSoonDays);
  if (days === '') return 'No Due Date';
  if (days < 0) return 'Critical';
  if (days <= windowDays && status === 'Not Started') return 'At Risk';
  if (days <= windowDays) return 'Due Soon';
  return 'On Track';
}


function sanitizeDueDays_(value) {
  const n = Number(value || CONFIG.DUE_SOON_DAYS);
  if (!n || isNaN(n)) return CONFIG.DUE_SOON_DAYS;
  return Math.max(1, Math.min(365, Math.round(n)));
}

// Accepts pre-computed employeePerformance and categoryPerformance to avoid redundant group-by calls.
function buildManagerSummary_(rows, employees, categories) {
  if (!employees) employees = buildEmployeePerformance_(rows);
  if (!categories) categories = buildCategoryPerformance_(rows);
  const topEmployee = employees.length ? employees[0] : null;
  const delayedCategory = categories.length
    ? categories.slice().sort((a, b) =>
        (b.notStarted + b.overdue + b.atRisk) - (a.notStarted + a.overdue + a.atRisk)
      )[0]
    : null;
  const s = buildSummary_(rows);
  return {
    text: 'Overall completion ' + s.completionRate + '%, weighted progress ' + s.progressScore + '%.',
    topEmployee: topEmployee ? topEmployee.name + ' — ' + topEmployee.completionRate + '%' : '',
    delayedCategory: delayedCategory ? delayedCategory.name : '',
    attention: (s.critical || 0) + ' critical, ' + (s.atRisk || 0) + ' at risk, ' + (s.dueSoon || 0) + ' due soon'
  };
}

function getRecentUpdates_(limit) {
  ensureSupportSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!log || log.getLastRow() <= 1) return [];
  const count = Math.min(Number(limit || 8), log.getLastRow() - 1);
  const start = Math.max(2, log.getLastRow() - count + 1);
  const values = log.getRange(start, 1, log.getLastRow() - start + 1, 8).getValues();
  return values.reverse().map(r => ({
    timestamp: toDateTimeString_(r[0]),
    user: String(r[1] || ''),
    rowNumber: r[2],
    priority: String(r[3] || ''),
    field: String(r[4] || ''),
    oldValue: r[5] instanceof Date ? toDateString_(r[5]) : String(r[5] || ''),
    newValue: r[6] instanceof Date ? toDateString_(r[6]) : String(r[6] || ''),
    objective: String(r[7] || '')
  }));
}

function validateUpdatePasscode_(provided) {
  const configured = getUpdatePasscode_();
  if (!configured) return;
  if (String(provided || '') !== configured) throw new Error('Update passcode буруу байна.');
}

function getUpdatePasscode_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('UPDATE_PASSCODE') || CONFIG.UPDATE_PASSCODE || '').trim();
  } catch (e) {
    return String(CONFIG.UPDATE_PASSCODE || '').trim();
  }
}

function validateAdminPasscode_(provided) {
  const configured = getAdminPasscode_();
  if (!configured) throw new Error('ADMIN_PASSCODE тохируулаагүй байна. Script Properties дээр ADMIN_PASSCODE нэмнэ үү.');
  if (String(provided || '') !== configured) throw new Error('Admin passcode буруу байна.');
}

function getAdminPasscode_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE') || CONFIG.ADMIN_PASSCODE || '').trim();
  } catch (e) {
    return String(CONFIG.ADMIN_PASSCODE || '').trim();
  }
}

function getProgressScore_(status) {
  if (status === 'Completed')  return 100;
  if (status === 'In Progress') return 50;
  if (status === 'On Hold')    return 25;
  if (status === 'Cancelled')  return 0;
  return 0;
}

function unique_(arr) {
  return Array.from(new Set(arr.map(v => String(v || '').trim()).filter(Boolean))).sort();
}

function emptySummary_() {
  return { total: 0, completed: 0, inProgress: 0, notStarted: 0, other: 0, overdue: 0, dueSoon: 0, critical: 0, atRisk: 0, completionRate: 0, progressScore: 0 };
}

function emptyFilters_() {
  return { employees: [], statuses: [], categories: [] };
}

function getUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'Unknown user';
  } catch (e) {
    return 'Unknown user';
  }
}

/* Objectives Dashboard Apps Script backend v3.4.0
 * Cascaded Priority fix: reads Google Sheet column G and inherits only inside the same parent objective.
 */

const SPREADSHEET_ID = '1Yw6dYNGRxq1gps71p3sMzu0f-IePVYdoiQIycyC5Qg4';
const DATA_SHEET_NAME = 'Objectives status and detail re';
const PENDING_SHEET_NAME = 'Pending_Updates';
const CHANGE_LOG_SHEET_NAME = 'Change_Log';
const DATA_START_ROW = 5;
const COL = { employee:1, priority:2, objective:3, currentState:4, status:5, category:6, cascadedPriority:7, dueDate:8, notes:9, lastUpdated:10, updatedBy:11 };

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'data');
  try {
    let data;
    if (['', 'data', 'init', 'getInitialData'].indexOf(action) >= 0) data = getInitialData_(p);
    else if (['update', 'submitUpdate'].indexOf(action) >= 0) data = submitUpdate_(p);
    else if (['approvals', 'getApprovals'].indexOf(action) >= 0) data = getApprovals_(p);
    else if (['approve', 'approveUpdate'].indexOf(action) >= 0) data = reviewUpdate_(p, 'Approved');
    else if (['reject', 'rejectUpdate'].indexOf(action) >= 0) data = reviewUpdate_(p, 'Rejected');
    else throw new Error('Unknown API action: ' + action);
    return output_({ ok:true, data:data }, p.callback);
  } catch (err) {
    return output_({ ok:false, error:err && err.message ? err.message : String(err) }, p.callback);
  }
}

function output_(payload, callback) {
  const text = JSON.stringify(payload);
  if (callback) return ContentService.createTextOutput(callback + '(' + text + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
function ss_(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sh_(name){ const s = ss_().getSheetByName(name); if(!s) throw new Error('Sheet not found: ' + name); return s; }
function clean_(v){ return String(v == null ? '' : v).trim(); }
function assigned_(v){ const s = clean_(v).toLowerCase(); return !!s && s !== 'unassigned' && s !== 'undefined' && s !== 'null'; }
function cleanStatus_(v){ const s=clean_(v); if(/^completed/i.test(s)) return 'Completed'; if(/^in progress/i.test(s)) return 'In Progress'; if(/^not started/i.test(s)) return 'Not Started'; return s || 'Not Started'; }
function parentKey_(p){ return clean_(p).replace(/\.$/,'').split('.').slice(0,2).join('.'); }
function level_(p){ p = clean_(p).replace(/\.$/,''); return p ? p.split('.').length : 1; }
function daysLeft_(d){ d=clean_(d); if(!d) return ''; const x=new Date(d); if(isNaN(x.getTime())) return ''; const t=new Date(); t.setHours(0,0,0,0); x.setHours(0,0,0,0); return Math.ceil((x-t)/86400000); }
function uniq_(a){ return Array.from(new Set((a||[]).filter(Boolean))).sort(); }

function getInitialData_(p) {
  const sheet = sh_(DATA_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return emptyData_();
  const dueSoonDays = Number(p.dueDays || 14);
  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 11).getDisplayValues();
  const allRows = normalizeRows_(values, DATA_START_ROW, dueSoonDays);
  const rows = filterRows_(allRows, p);
  const pending = countPending_();
  return {
    rows: rows,
    summary: summary_(rows, pending),
    employeePerformance: group_(rows, 'employee'),
    categoryPerformance: group_(rows, 'category'),
    cascadedPriorityPerformance: group_(rows, 'cascadedPriority').filter(x => x.name !== 'Unassigned'),
    filters: {
      employees: uniq_(allRows.map(r => r.employee)),
      statuses: uniq_(allRows.map(r => r.status)),
      categories: uniq_(allRows.map(r => r.category)),
      cascadedPriorities: uniq_(allRows.map(r => r.cascadedPriority)).filter(x => x !== 'Unassigned')
    },
    statusOptions: ['Not Started','In Progress','Completed'],
    dueSoonDays: dueSoonDays,
    pendingApprovalCount: pending,
    recentUpdates: recentUpdates_(),
    managerSummary: managerSummary_(rows)
  };
}

function normalizeRows_(values, firstRow, dueSoonDays) {
  let currentEmployee = '', currentCategory = '', currentCascade = '', currentCascadeParent = '';
  return values.map((r, i) => {
    const rowNumber = firstRow + i;
    const rawEmployee = clean_(r[COL.employee-1]);
    const priority = clean_(r[COL.priority-1]).replace(/\.$/,'');
    const objective = clean_(r[COL.objective-1]);
    const status = cleanStatus_(r[COL.status-1]);
    const rawCategory = clean_(r[COL.category-1]);
    const rawCascade = clean_(r[COL.cascadedPriority-1]);
    if (rawEmployee) { currentEmployee = rawEmployee; currentCategory = ''; currentCascade = ''; currentCascadeParent = ''; }
    if (rawCategory) currentCategory = rawCategory;
    const pk = parentKey_(priority);
    const lvl = level_(priority);
    let cp = rawCascade;
    if (assigned_(rawCascade)) { currentCascade = rawCascade; currentCascadeParent = pk; cp = rawCascade; }
    else if (lvl <= 2) { currentCascade = ''; currentCascadeParent = ''; cp = ''; }
    else if (currentCascade && pk === currentCascadeParent) cp = currentCascade;
    const dueDate = clean_(r[COL.dueDate-1]);
    const daysLeft = daysLeft_(dueDate);
    const overdue = status !== 'Completed' && daysLeft !== '' && daysLeft < 0;
    const dueSoon = status !== 'Completed' && daysLeft !== '' && daysLeft >= 0 && daysLeft <= dueSoonDays;
    const risk = status === 'Completed' ? 'Done' : overdue ? 'Critical' : dueSoon ? 'Due Soon' : daysLeft === '' ? 'No Due Date' : 'On Track';
    const score = status === 'Completed' ? 100 : status === 'In Progress' ? 50 : 0;
    return {
      rowNumber: rowNumber,
      employee: currentEmployee || 'Unassigned',
      priority: priority,
      objective: objective,
      currentState: clean_(r[COL.currentState-1]),
      status: status,
      category: currentCategory || 'Unassigned',
      cascadedPriority: assigned_(cp) ? cp : 'Unassigned',
      dueDate: dueDate,
      notes: clean_(r[COL.notes-1]),
      lastUpdated: clean_(r[COL.lastUpdated-1]),
      updatedBy: clean_(r[COL.updatedBy-1]),
      level: lvl,
      isParent: lvl <= 2,
      daysLeft: daysLeft,
      overdue: overdue,
      dueSoon: dueSoon,
      risk: risk,
      progressScore: score
    };
  }).filter(r => r.priority || r.objective || r.employee !== 'Unassigned');
}

function filterRows_(rows, p) {
  const search = clean_(p.search).toLowerCase();
  const employee = clean_(p.employee), status = clean_(p.status), category = clean_(p.category), cp = clean_(p.cascadedPriority);
  const onlyOverdue = String(p.onlyOverdue) === 'true';
  const onlyDueSoon = String(p.onlyDueSoon) === 'true';
  return rows.filter(r => {
    const hay = [r.employee,r.priority,r.objective,r.status,r.category,r.cascadedPriority].join(' ').toLowerCase();
    return (!search || hay.indexOf(search) >= 0) && (!employee || r.employee === employee) && (!status || r.status === status) && (!category || r.category === category) && (!cp || r.cascadedPriority === cp) && (!onlyOverdue || r.overdue) && (!onlyDueSoon || r.dueSoon);
  });
}

function summary_(rows, pending) {
  const s = { total: rows.length, completed:0, inProgress:0, notStarted:0, other:0, dueSoon:0, pendingApprovalCount:pending||0, progressScore:0, completionRate:0 };
  let score = 0;
  rows.forEach(r => { if(r.status==='Completed') s.completed++; else if(r.status==='In Progress') s.inProgress++; else if(r.status==='Not Started') s.notStarted++; else s.other++; if(r.dueSoon) s.dueSoon++; score += Number(r.progressScore||0); });
  s.completionRate = s.total ? Math.round(s.completed / s.total * 100) : 0;
  s.progressScore = s.total ? Math.round(score / s.total) : 0;
  return s;
}

function group_(rows, key) {
  const g = {};
  rows.forEach(r => {
    const name = clean_(r[key]) || 'Unassigned';
    if(!g[name]) g[name] = { name:name,total:0,completed:0,inProgress:0,notStarted:0,other:0,overdue:0,dueSoon:0,progressScoreTotal:0 };
    const x = g[name]; x.total++;
    if(r.status==='Completed') x.completed++; else if(r.status==='In Progress') x.inProgress++; else if(r.status==='Not Started') x.notStarted++; else x.other++;
    if(r.overdue) x.overdue++; if(r.dueSoon) x.dueSoon++; x.progressScoreTotal += Number(r.progressScore||0);
  });
  return Object.keys(g).map(k => { const x=g[k]; x.completionRate=x.total?Math.round(x.completed/x.total*100):0; x.progressScore=x.total?Math.round(x.progressScoreTotal/x.total):0; delete x.progressScoreTotal; return x; }).sort((a,b)=>(b.completionRate-a.completionRate)||(b.progressScore-a.progressScore)||(b.completed-a.completed)||(b.total-a.total)||a.name.localeCompare(b.name));
}

function managerSummary_(rows){
  const emp = group_(rows,'employee')[0];
  const cat = group_(rows,'category').sort((a,b)=>b.dueSoon-a.dueSoon)[0];
  const cp = group_(rows,'cascadedPriority').filter(x=>x.name!=='Unassigned').sort((a,b)=>b.dueSoon-a.dueSoon)[0];
  return { text:'Filtered dashboard summary', topEmployee:emp?emp.name:'-', attention:rows.filter(r=>r.overdue).length+' overdue', delayedCategory:cat?cat.name:'-', delayedCascadedPriority:cp?cp.name:'-' };
}

function emptyData_(){ return { rows:[], summary:summary_([],0), employeePerformance:[], categoryPerformance:[], cascadedPriorityPerformance:[], filters:{employees:[],statuses:[],categories:[],cascadedPriorities:[]}, pendingApprovalCount:0 }; }

function submitUpdate_(p) {
  const rowNumber = Number(p.rowNumber);
  if(!rowNumber || rowNumber < DATA_START_ROW) throw new Error('Invalid rowNumber');
  ensurePending_();
  const row = sh_(DATA_SHEET_NAME).getRange(rowNumber,1,1,11).getDisplayValues()[0];
  const id = 'REQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random()*10000);
  sh_(PENDING_SHEET_NAME).appendRow([id,rowNumber,row[1],row[0],row[4],clean_(p.status),row[7],clean_(p.dueDate),row[8],clean_(p.notes),clean_(p.requestedBy),new Date(),'Pending','','',clean_(p.requestComment)]);
  return { requestId:id, message:'Approval request submitted' };
}

function getApprovals_(p) {
  validateAdminPasscode_(p.adminPasscode);
  ensurePending_();
  const s = sh_(PENDING_SHEET_NAME), last = s.getLastRow();
  if(last < 2) return [];
  return s.getRange(2,1,last-1,16).getDisplayValues().filter(r => clean_(r[12]) === 'Pending').map(r => ({ requestId:r[0], rowNumber:Number(r[1]), priority:r[2], employee:r[3], oldStatus:r[4], newStatus:r[5], oldDueDate:r[6], newDueDate:r[7], oldNotes:r[8], newNotes:r[9], requestedBy:r[10], requestedAt:r[11], objective:getObjective_(Number(r[1])), requestComment:r[15] }));
}

function reviewUpdate_(p, decision) {
  validateAdminPasscode_(p.adminPasscode);
  const id = clean_(p.requestId);
  if(!id) throw new Error('requestId is required');
  ensurePending_();
  const ps = sh_(PENDING_SHEET_NAME), last = ps.getLastRow();
  const vals = last >= 2 ? ps.getRange(2,1,last-1,16).getValues() : [];
  const idx = vals.findIndex(r => clean_(r[0]) === id);
  if(idx < 0) throw new Error('Request not found: ' + id);
  const req = vals[idx], pendingRow = idx + 2;
  if(clean_(req[12]) !== 'Pending') throw new Error('Request already reviewed');
  if(decision === 'Approved') {
    const rowNumber = Number(req[1]), ds = sh_(DATA_SHEET_NAME);
    ds.getRange(rowNumber, COL.status).setValue(req[5]);
    ds.getRange(rowNumber, COL.dueDate).setValue(req[7]);
    ds.getRange(rowNumber, COL.notes).setValue(req[9]);
    ds.getRange(rowNumber, COL.lastUpdated).setValue(new Date());
    ds.getRange(rowNumber, COL.updatedBy).setValue(req[10]);
    logChange_(req, p.adminComment);
  }
  ps.getRange(pendingRow,13).setValue(decision);
  ps.getRange(pendingRow,14).setValue(Session.getActiveUser().getEmail() || 'Admin');
  ps.getRange(pendingRow,15).setValue(new Date());
  ps.getRange(pendingRow,16).setValue(clean_(p.adminComment));
  return { message:decision };
}

function validateAdminPasscode_(provided){ const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE'); if(!expected) throw new Error('ADMIN_PASSCODE script property is not set'); if(String(provided||'') !== String(expected)) throw new Error('Invalid admin passcode'); }
function ensurePending_(){ let s = ss_().getSheetByName(PENDING_SHEET_NAME); if(!s) s = ss_().insertSheet(PENDING_SHEET_NAME); if(s.getLastRow()===0) s.appendRow(['RequestID','RowNumber','PriorityNo','Employee','OldStatus','NewStatus','OldDueDate','NewDueDate','OldNotes','NewNotes','RequestedBy','RequestedAt','ApprovalStatus','ReviewedBy','ReviewedAt','AdminComment']); }
function getObjective_(rowNumber){ return rowNumber ? sh_(DATA_SHEET_NAME).getRange(rowNumber, COL.objective).getDisplayValue() : ''; }
function countPending_(){ const s = ss_().getSheetByName(PENDING_SHEET_NAME); if(!s || s.getLastRow()<2) return 0; return s.getRange(2,13,s.getLastRow()-1,1).getDisplayValues().filter(r=>r[0]==='Pending').length; }
function logChange_(req, comment){ let s = ss_().getSheetByName(CHANGE_LOG_SHEET_NAME); if(!s) s = ss_().insertSheet(CHANGE_LOG_SHEET_NAME); if(s.getLastRow()===0) s.appendRow(['Timestamp','RequestID','RowNumber','Priority','Field','OldValue','NewValue','User','Comment']); const now = new Date(); s.appendRow([now,req[0],req[1],req[2],'Status',req[4],req[5],req[10],comment||'']); s.appendRow([now,req[0],req[1],req[2],'Due Date',req[6],req[7],req[10],comment||'']); s.appendRow([now,req[0],req[1],req[2],'Notes',req[8],req[9],req[10],comment||'']); }
function recentUpdates_(){ const s = ss_().getSheetByName(CHANGE_LOG_SHEET_NAME); if(!s || s.getLastRow()<2) return []; const last=s.getLastRow(), start=Math.max(2,last-19); return s.getRange(start,1,last-start+1,9).getDisplayValues().reverse().map(r=>({timestamp:r[0],requestId:r[1],rowNumber:r[2],priority:r[3],field:r[4],oldValue:r[5],newValue:r[6],user:r[7],comment:r[8],objective:getObjective_(Number(r[2]))})); }

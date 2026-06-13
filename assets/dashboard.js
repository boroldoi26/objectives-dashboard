/* Objectives Dashboard — main script */
'use strict';

let rows = [], statusOptions = [], selectedRow = null, debounceTimer = null, latestData = null;
let currentPage = 1;
let isSubmitting = false;
const PAGE_SIZE = 50;
const API_TIMEOUT_MS = 30000;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.DASHBOARD_API_URL || window.DASHBOARD_API_URL.includes('PASTE_APPS_SCRIPT')) {
    toast('API URL тохируулаагүй байна. assets/config.js файлыг засна уу.', 'error');
    showLoading(false);
    const loadEl = document.getElementById('loading');
    loadEl.innerHTML = 'API URL тохируулаагүй байна. assets/config.js файлыг засна уу.';
    loadEl.style.display = 'block';
    return;
  }

  // Close modal when clicking the backdrop (not the modal content)
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalBackdrop')) closeModal();
  });

  // Click toast to dismiss
  document.getElementById('toast').addEventListener('click', () => {
    document.getElementById('toast').style.display = 'none';
  });

  loadData();
});

/* ── API ── */

function apiJsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('API request timeout'));
    }, API_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (payload) => {
      cleanup();
      if (payload && payload.ok) resolve(payload.data);
      else reject(new Error((payload && payload.error) ? payload.error : 'API error'));
    };

    const url = new URL(window.DASHBOARD_API_URL);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    url.searchParams.set('callback', callbackName);

    script.onerror = () => {
      cleanup();
      reject(new Error('Could not load Apps Script API. Check deployment access.'));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

/* ── Data loading ── */

function loadData(filters = collectFiltersSafe()) {
  showLoading(true);
  apiJsonp({ action: 'data', ...(filters || {}) })
    .then(data => {
      latestData = data;
      rows = data.rows || [];
      statusOptions = data.statusOptions || ['Not Started', 'In Progress', 'Completed'];
      currentPage = 1;
      renderAll(data);
      showLoading(false);
    })
    .catch(err => {
      toast('Error: ' + err.message, 'error');
      showLoading(false);
      const loadEl = document.getElementById('loading');
      loadEl.innerHTML = 'Алдаа: ' + esc(err.message);
      loadEl.style.display = 'block';
    });
}

/* ── Render all ── */

function renderAll(data) {
  const dateStr = 'Updated ' + new Date().toLocaleString();
  document.getElementById('sideDate').textContent = dateStr;
  const mobileDate = document.getElementById('mobileSideDate');
  if (mobileDate) mobileDate.textContent = dateStr;
  renderKpis(data.summary || {}, data.dueSoonDays || 14);
  renderManagerSummary(data.managerSummary || {});
  renderFilters(data.filters || {});
  renderEmployeeCards(data.employeePerformance || []);
  renderEmployeeChart((data.employeePerformance || []).slice(0, 10));
  renderCategory(data.categoryPerformance || []);
  renderBoard(rows);
  renderRiskLists(rows);
  renderRecentUpdates(data.recentUpdates || []);
  renderRows(rows);
  renderPendingBadge(data.pendingApprovalCount || 0);
}

/* ── KPI cards — 7 items, matches repeat(7,1fr) in CSS ── */

function renderKpis(s, dueDays) {
  const items = [
    ['Total',           s.total || 0,                    'Бүх objective',              ''],
    ['Completed',       s.completed || 0,                (s.completionRate || 0) + '% completion', 'var(--green)'],
    ['In progress',     s.inProgress || 0,               'Active work',                'var(--amber)'],
    ['Not started',     s.notStarted || 0,               'Pending',                    'var(--red)'],
    ['Due soon',        s.dueSoon || 0,                  'Next ' + (dueDays || 30) + ' days', 'var(--amber)'],
    ['Pending approval',s.pendingApprovalCount || 0,     'Admin review',               'var(--purple)'],
    ['Progress score',  (s.progressScore || 0) + '%',    'Weighted progress',          'var(--blue)']
  ];
  document.getElementById('kpis').innerHTML = items.map(([label, value, hint, color]) =>
    `<div class="card">
      <div class="kpiLabel">${label}</div>
      <div class="kpiValue" ${color ? `style="color:${color}"` : ''}>${value}</div>
      <div class="kpiHint">${hint}</div>
    </div>`
  ).join('');
}

function renderManagerSummary(m) {
  document.getElementById('managerSummary').innerHTML = `
    <div class="summaryItem"><b>Manager summary</b><span>${esc(m.text || 'No summary')}</span></div>
    <div class="summaryItem"><b>Top employee</b><span>${esc(m.topEmployee || '-')}</span></div>
    <div class="summaryItem"><b>Needs attention</b><span>${esc(m.attention || '-')}</span></div>
    <div class="summaryItem"><b>Focus category</b><span>${esc(m.delayedCategory || '-')}</span></div>
  `;
}

function renderRecentUpdates(items) {
  document.getElementById('recentUpdates').innerHTML = items.map(u =>
    `<div class="recentItem">
      <b>${esc(u.timestamp)} · ${esc(u.priority)} · ${esc(u.field)}</b>
      <span>${esc(u.oldValue || '-')} → ${esc(u.newValue || '-')}</span>
      <br><span class="muted">${esc(u.user || 'Unknown')} · ${esc(cut(u.objective || '', 120))}</span>
    </div>`
  ).join('') || '<div class="muted">Одоогоор update history байхгүй байна.</div>';
}

/* ── Filters ── */

function renderFilters(f) {
  fillSelect('employee', f.employees || [], 'All employees');
  fillSelect('status',   f.statuses  || statusOptions, 'All statuses');
  fillSelect('category', f.categories || [], 'All categories');
}

function fillSelect(id, items, all) {
  const el = document.getElementById(id);
  const cur = el.value;
  el.innerHTML = `<option value="">${all}</option>` +
    items.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  el.value = cur;
}

/* ── Employee cards & chart ── */

function renderEmployeeCards(items) {
  const currentEmp = document.getElementById('employee').value;
  const html = items.map(e =>
    `<div class="card emp ${currentEmp === e.name ? 'active' : ''}" onclick="setEmployeeFilter('${js(e.name)}')">
      <div class="empTop">
        <div class="empName">${esc(e.name)}</div>
        <div class="percent">${e.completionRate}%</div>
      </div>
      <div class="bar"><i style="width:${e.completionRate}%"></i></div>
      <div class="meta">
        <span class="pill">Total ${e.total}</span>
        <span class="pill">Done ${e.completed}</span>
        <span class="pill">Score ${e.progressScore}%</span>
        <span class="pill">Due ${e.dueSoon}</span>
        <span class="pill">Overdue ${e.overdue}</span>
      </div>
    </div>`
  ).join('') || '<div class="muted">No employees</div>';
  document.getElementById('employeeCards').innerHTML  = html;
  document.getElementById('employeeCards2').innerHTML = html;
}

function renderEmployeeChart(items) {
  const max = Math.max(1, ...items.map(x => x.completionRate || 0));
  document.getElementById('employeeChart').innerHTML = items.map(e =>
    `<div class="chartCol">
      <div class="chartVal">${e.completionRate}%</div>
      <div class="chartBar" style="height:${Math.max(6, Math.round((e.completionRate / max) * 70))}px"></div>
      <div class="chartLabel" title="${esc(e.name)}">${esc(shortName(e.name))}</div>
    </div>`
  ).join('') || '<div class="muted">No data</div>';
}

function renderCategory(items) {
  document.getElementById('categoryPerformance').innerHTML = items.map(c =>
    `<div class="catRow">
      <div>
        <div class="catName" title="${esc(c.name)}">${esc(c.name)}</div>
        <div class="bar green"><i style="width:${c.completionRate}%"></i></div>
        <div class="meta"><span>Total ${c.total}</span><span>Done ${c.completed}</span><span>Score ${c.progressScore}%</span></div>
      </div>
      <b>${c.completionRate}%</b>
    </div>`
  ).join('') || '<div class="muted">No category</div>';
}

/* ── Status board ── */

function renderBoard(items) {
  const groups = ['Completed', 'In Progress', 'Not Started', 'Critical'];
  const by = { Completed: [], 'In Progress': [], 'Not Started': [], Critical: [] };
  items.forEach(r => {
    if (r.risk === 'Critical') by.Critical.push(r);
    else if (by[r.status]) by[r.status].push(r);
  });
  document.getElementById('statusBoard').innerHTML = groups.map(g =>
    `<div class="lane">
      <h4>${g} (${by[g].length})</h4>
      ${by[g].slice(0, 5).map(r =>
        `<div class="miniItem">
          <b>${esc(r.priority)}</b>${esc(cut(r.objective, 80))}
          <br><span class="muted">${esc(r.employee || '')}</span>
        </div>`
      ).join('') || '<div class="muted">No items</div>'}
    </div>`
  ).join('');
}

function renderRiskLists(items) {
  const card = r =>
    `<div class="miniItem">
      <b>${esc(r.priority)} · ${esc(r.employee || '')}</b>
      ${esc(cut(r.objective, 120))}
      <br><span class="muted">Due: ${esc(r.dueDate || '-')} · ${r.daysLeft} days</span>
    </div>`;
  document.getElementById('criticalList').innerHTML =
    items.filter(r => r.risk === 'Critical').slice(0, 12).map(card).join('') ||
    '<div class="muted">No critical objectives</div>';
  document.getElementById('dueSoonList').innerHTML =
    items.filter(r => r.dueSoon).slice(0, 12).map(card).join('') ||
    '<div class="muted">No due soon objectives</div>';
}

/* ── Objectives table with pagination ── */

function renderRows(items) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = items.slice(start, start + PAGE_SIZE);

  document.getElementById('tbody').innerHTML = page.map(r =>
    `<tr class="${r.isParent ? 'parent' : ''} indent-${r.level}">
      <td data-label="Priority">${esc(r.priority)}</td>
      <td data-label="Зорилт">
        <div class="objective">${esc(r.objective)}</div>
        <div class="muted">${esc(cut(r.currentState || '', 120))}</div>
      </td>
      <td data-label="Ажилтан">${esc(r.employee)}</td>
      <td data-label="Статус">${badge(r.status)}</td>
      <td data-label="Эрсдэл">${riskBadge(r.risk)}</td>
      <td data-label="Категори">${esc(r.category)}</td>
      <td data-label="Хугацаа">${esc(r.dueDate || '')}</td>
      <td data-label="Хоног">${r.daysLeft === '' ? '-' : r.daysLeft}</td>
      <td data-label="Үйлдэл"><button class="btn small" onclick="openModal(${r.rowNumber})">Update</button></td>
    </tr>`
  ).join('');

  renderPagination(total, totalPages);
}

function renderPagination(total, totalPages) {
  const container = document.getElementById('paginationContainer');
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div class="pagination">
      <button class="btn secondary" onclick="goPage(${currentPage - 1})"
        ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="pageInfo">Хуудас ${currentPage} / ${totalPages} · Нийт ${total} мөр</span>
      <button class="btn secondary" onclick="goPage(${currentPage + 1})"
        ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    </div>`;
}

function goPage(n) {
  currentPage = n;
  renderRows(rows);
  document.getElementById('objectives').scrollIntoView({ behavior: 'smooth' });
}

/* ── Badges ── */

function badge(s) {
  const c = s === 'Completed' ? 'completed' : s === 'In Progress' ? 'progress' : 'notstarted';
  return `<span class="badge ${c}">${esc(s)}</span>`;
}

function riskBadge(s) {
  const c = s === 'Critical' ? 'critical'
    : s === 'At Risk'  ? 'risk'
    : s === 'Due Soon' ? 'soon'
    : s === 'Done'     ? 'done'
    : s === 'On Track' ? 'track'
    : 'nodue';
  return `<span class="badge ${c}">${esc(s)}</span>`;
}

/* ── Filters / actions ── */

function applyFilters() { currentPage = 1; loadData(collectFilters()); }
function debouncedApplyFilters() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 250);
}
function collectFiltersSafe() {
  return document.getElementById('search') ? collectFilters() : {};
}
function collectFilters() {
  return {
    search:       val('search'),
    employee:     val('employee'),
    status:       val('status'),
    category:     val('category'),
    dueDays:      val('dueDays'),
    onlyOverdue:  document.getElementById('onlyOverdue').checked,
    onlyDueSoon:  document.getElementById('onlyDueSoon').checked
  };
}

function clearFilters() {
  ['search', 'employee', 'status', 'category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('dueDays').value    = '30';
  document.getElementById('onlyOverdue').checked  = false;
  document.getElementById('onlyDueSoon').checked  = false;
  loadData({});
}
function clearEmployeeFilter() { document.getElementById('employee').value = ''; applyFilters(); }
function setEmployeeFilter(e)  { document.getElementById('employee').value = e;  applyFilters(); }
function setDueWindow(days) {
  document.getElementById('dueDays').value = String(days);
  document.getElementById('onlyDueSoon').checked = true;
  showTab('objectives', null);
  applyFilters();
}

/* ── Update modal ── */

function openModal(rowNumber) {
  selectedRow = rows.find(r => r.rowNumber === rowNumber);
  if (!selectedRow) return;
  document.getElementById('modalTitle').textContent = selectedRow.priority + ' Update request';
  document.getElementById('modalSub').textContent   = selectedRow.employee + ' · ' + cut(selectedRow.objective, 100);
  document.getElementById('editStatus').innerHTML   = statusOptions.map(s =>
    `<option value="${esc(s)}">${esc(s)}</option>`
  ).join('');
  document.getElementById('editStatus').value       = selectedRow.status;
  document.getElementById('editDueDate').value      = selectedRow.dueDate || '';
  document.getElementById('editNotes').value        = selectedRow.notes   || '';
  document.getElementById('editRequestedBy').value  = selectedRow.employee || '';
  document.getElementById('editRequestComment').value = '';
  document.getElementById('modalBackdrop').style.display = 'flex';
}

function closeModal() {
  isSubmitting = false;
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Submit for approval'; }
  document.getElementById('modalBackdrop').style.display = 'none';
}

function saveUpdate() {
  if (!selectedRow || isSubmitting) return;
  isSubmitting = true;
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  const payload = {
    action:         'update',
    rowNumber:      selectedRow.rowNumber,
    status:         val('editStatus'),
    dueDate:        val('editDueDate'),
    notes:          val('editNotes'),
    requestedBy:    val('editRequestedBy'),
    requestComment: val('editRequestComment')
  };
  apiJsonp(payload)
    .then(res => {
      isSubmitting = false;
      closeModal();
      toast((res && res.message) || 'Approval request submitted');
      loadData(collectFilters());
    })
    .catch(err => {
      isSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for approval'; }
      toast('Error: ' + err.message, 'error');
    });
}

/* ── Admin approvals ── */

function renderPendingBadge(n) {
  const el = document.getElementById('pendingBadge');
  if (el) el.textContent = n ? ('(' + n + ')') : '';
  const mob = document.getElementById('mobilePendingBadge');
  if (mob) {
    mob.textContent = n || '';
    mob.style.display = n ? 'block' : 'none';
  }
}

function loadApprovals() {
  apiJsonp({ action: 'approvals' })
    .then(items => renderApprovals(items || []))
    .catch(err  => toast('Error: ' + err.message, 'error'));
}

function renderApprovals(items) {
  const el = document.getElementById('approvalList');
  if (!items.length) {
    el.innerHTML = '<div class="muted">Pending approval байхгүй байна.</div>';
    return;
  }
  el.innerHTML = items.map(a =>
    `<div class="approvalCard">
      <div class="approvalTop">
        <div>
          <b>${esc(a.priority)} · ${esc(a.employee)}</b>
          <div class="muted">${esc(a.requestedAt)} · Requested by: ${esc(a.requestedBy || '-')} · ${esc(a.requestId)}</div>
        </div>
        <span class="badge soon">Pending</span>
      </div>
      <div style="margin-top:8px">${esc(cut(a.objective, 180))}</div>
      <div class="approvalChanges">
        <div><b>Status</b><br>${esc(a.oldStatus || '-')} → ${esc(a.newStatus || '-')}</div>
        <div><b>Due date</b><br>${esc(a.oldDueDate || '-')} → ${esc(a.newDueDate || '-')}</div>
        <div><b>Notes</b><br>${esc(cut(a.oldNotes || '-', 60))} → ${esc(cut(a.newNotes || '-', 60))}</div>
      </div>
      ${a.requestComment ? `<div class="muted"><b>Comment:</b> ${esc(a.requestComment)}</div>` : ''}
      <div class="approvalActions">
        <button class="btn small" onclick="reviewApproval('${js(a.requestId)}','approve')">Approve</button>
        <button class="btn danger small" onclick="reviewApproval('${js(a.requestId)}','reject')">Reject</button>
      </div>
    </div>`
  ).join('');
}

function reviewApproval(requestId, decision) {
  const pass = val('adminPasscode');
  if (!pass) { toast('Admin passcode оруулна уу.'); return; }
  apiJsonp({ action: decision, requestId, adminPasscode: pass, adminComment: val('adminComment') })
    .then(() => {
      toast(decision === 'approve' ? 'Approved' : 'Rejected');
      loadApprovals();
      loadData(collectFilters());
    })
    .catch(err => toast('Error: ' + err.message, 'error'));
}

/* ── Navigation ── */

function showTab(id, el) {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.navItem, .mobileNavBtn').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');
  const filtersEl = document.querySelector('.filters');
  if (filtersEl) filtersEl.classList.toggle('show', id === 'objectives');
}

function focusSearch() {
  setTimeout(() => document.getElementById('search').focus(), 100);
}

function showObjectivesQuick() {
  const target = Array.from(document.querySelectorAll('.navItem'))
    .find(x => x.textContent.includes('Objectives table'));
  showTab('objectives', target || null);
  focusSearch();
}

function scrollToUpdateTable() {
  showObjectivesQuick();
  document.getElementById('objectives').scrollIntoView({ behavior: 'smooth' });
}

/* ── Export / copy ── */

function copySummary() {
  const s = (latestData && latestData.summary) || {};
  const m = (latestData && latestData.managerSummary) || {};
  const text = [
    'Objectives Dashboard Summary',
    'Total: '          + (s.total || 0),
    'Completed: '      + (s.completed || 0),
    'In Progress: '    + (s.inProgress || 0),
    'Not Started: '    + (s.notStarted || 0),
    'Completion: '     + (s.completionRate || 0) + '%',
    'Progress Score: ' + (s.progressScore || 0) + '%',
    'Attention: '      + (m.attention || '')
  ].join('\n');
  navigator.clipboard && navigator.clipboard.writeText(text);
  toast('Summary copied');
}

function exportCsv() {
  const header = ['Priority', 'Employee', 'Status', 'Risk', 'Category', 'DueDate', 'DaysLeft', 'Objective'];
  const csv = [header].concat(rows.map(r => [
    r.priority, r.employee, r.status, r.risk, r.category,
    r.dueDate, r.daysLeft, String(r.objective || '').replace(/\n/g, ' ')
  ]));
  const text = csv.map(cols =>
    cols.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')
  ).join('\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'objectives_export.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Utilities ── */

function showLoading(on) {
  document.getElementById('loading').style.display = on ? 'block' : 'none';
  document.getElementById('table').style.display   = on ? 'none'  : 'table';
}

/**
 * @param {string} t      - message text
 * @param {string} [type] - 'error' for persistent red toast; omit for auto-dismiss
 */
function toast(t, type) {
  const el = document.getElementById('toast');
  el.textContent = t;
  el.className   = 'toast' + (type === 'error' ? ' error' : '');
  el.style.display = 'block';
  if (type !== 'error') {
    setTimeout(() => { el.style.display = 'none'; }, 2600);
  }
}

function val(id) { return document.getElementById(id).value; }

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])
  );
}

function js(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function cut(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function shortName(n) {
  return String(n || '').split(/\s+/).slice(0, 2).join(' ');
}

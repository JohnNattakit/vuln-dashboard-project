/* ═══════════════════════════════════════════════════════════
   VulnTrack — Frontend App  (Bootstrap 5.3 edition)
═══════════════════════════════════════════════════════════ */

const API = '';
let currentProject = null;
let findings = [];
let currentDetail = null;
let editFindingId = null;
let editProjectId = null;
let sortCol = 'no';
let sortDir = 'asc';
let curPage = 1;
const PER = 15;
let chartSev = null, chartStat = null;

/* ─── API helpers ────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ─── Bootstrap Modal helpers ────────────────────────────── */
function openModal(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}
function closeModal(id) {
  bootstrap.Modal.getInstance(document.getElementById(id))?.hide();
}

/* ─── Bootstrap Toast helper ─────────────────────────────── */
let _toast;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toast-body').textContent = msg;
  el.className = `toast align-items-center border-0 text-bg-${type === 'error' ? 'danger' : 'success'}`;
  if (!_toast) _toast = new bootstrap.Toast(el, { delay: 3500 });
  _toast = bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 });
  _toast.show();
}

/* ─── Projects page ──────────────────────────────────────── */
async function loadProjects() {
  try {
    const projects = await api('GET', '/api/projects');
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('projects-empty');
    grid.innerHTML = '';
    if (!projects.length) { empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    projects.forEach(p => grid.insertAdjacentHTML('beforeend', projectCard(p)));
  } catch (e) { showToast('Failed to load projects: ' + e.message, 'error'); }
}

function projectCard(p) {
  const dates = [p.start_date, p.end_date].filter(Boolean).join(' → ') || '';
  return `
  <div class="col-md-6 col-xl-4">
    <div class="card h-100 project-card" onclick="openProject(${p.id})">
      <div class="card-body pb-2">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <h6 class="card-title fw-semibold mb-0 me-2">${esc(p.name)}</h6>
          <div class="d-flex gap-1 flex-shrink-0" onclick="event.stopPropagation()">
            <button class="icon-btn" title="Edit" onclick="openProjectModal(${p.id})">✏️</button>
            <button class="icon-btn danger" title="Delete" onclick="confirmDeleteProject(${p.id})">🗑️</button>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
          ${p.project_code ? `<span class="badge bg-primary bg-opacity-25 text-primary font-monospace fw-semibold" style="font-size:11px;letter-spacing:.03em">${esc(p.project_code)}</span>` : ''}
          ${p.pentest_type ? `<span class="badge text-bg-secondary fw-normal" style="font-size:10px">${esc(p.pentest_type)}</span>` : ''}
          ${p.client ? `<span class="text-muted small">🏢 ${esc(p.client)}</span>` : ''}
          ${dates ? `<span class="text-muted small">📅 ${dates}</span>` : ''}
        </div>
        <div class="row g-2 text-center">
          <div class="col-3"><div class="pcs-mini"><div class="val text-primary">${p.findings_count}</div><div class="lbl">Total</div></div></div>
          <div class="col-3"><div class="pcs-mini"><div class="val text-danger">${p.critical_count}</div><div class="lbl">Critical</div></div></div>
          <div class="col-3"><div class="pcs-mini"><div class="val" style="color:var(--clr-high)">${p.high_count}</div><div class="lbl">High</div></div></div>
          <div class="col-3"><div class="pcs-mini"><div class="val text-warning">${p.open_count}</div><div class="lbl">Open</div></div></div>
        </div>
      </div>
    </div>
  </div>`;
}

async function openProject(id) {
  try {
    currentProject = await api('GET', `/api/projects/${id}`);
    document.getElementById('topbar-project').textContent =
      currentProject.name + (currentProject.client ? ` · ${currentProject.client}` : '');
    document.getElementById('page-projects').classList.remove('active');
    document.getElementById('page-dashboard').classList.add('active');
    await loadFindings();
    showView('dashboard');
  } catch (e) { showToast('Error opening project: ' + e.message, 'error'); }
}

function backToProjects() {
  currentProject = null;
  findings = [];
  document.getElementById('page-dashboard').classList.remove('active');
  document.getElementById('page-projects').classList.add('active');
  loadProjects();
}

/* ─── Project CRUD modal ─────────────────────────────────── */
function openProjectModal(id = null) {
  editProjectId = id;
  document.getElementById('modal-project-title').textContent = id ? 'Edit Project' : 'New Project';
  ['prefix','name','client','type','start','end','scope','desc'].forEach(f => {
    const el = document.getElementById(`p-${f}`);
    if (el) el.value = f === 'prefix' ? 'PT' : '';
  });
  if (id) {
    api('GET', `/api/projects/${id}`).then(p => {
      document.getElementById('p-prefix').value = p.prefix || 'PT';
      document.getElementById('p-name').value = p.name || '';
      document.getElementById('p-client').value = p.client || '';
      document.getElementById('p-type').value = p.pentest_type || '';
      document.getElementById('p-start').value = p.start_date || '';
      document.getElementById('p-end').value = p.end_date || '';
      document.getElementById('p-scope').value = p.scope || '';
      document.getElementById('p-desc').value = p.description || '';
    });
  }
  openModal('modal-project');
}

async function saveProject() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { showToast('Project name is required', 'error'); return; }
  const data = {
    name,
    prefix: (document.getElementById('p-prefix').value.trim() || 'PT').toUpperCase(),
    client: document.getElementById('p-client').value.trim(),
    pentest_type: document.getElementById('p-type').value,
    start_date: document.getElementById('p-start').value,
    end_date: document.getElementById('p-end').value,
    scope: document.getElementById('p-scope').value.trim(),
    description: document.getElementById('p-desc').value.trim(),
  };
  try {
    if (editProjectId) {
      await api('PUT', `/api/projects/${editProjectId}`, data);
      showToast('Project updated', 'success');
    } else {
      await api('POST', '/api/projects', data);
      showToast('Project created', 'success');
    }
    closeModal('modal-project');
    loadProjects();
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function confirmDeleteProject(id) {
  document.getElementById('confirm-msg').textContent =
    'Are you sure you want to delete this project and ALL its findings? This cannot be undone.';
  const btn = document.getElementById('confirm-delete-btn');
  btn.onclick = async () => {
    try {
      await api('DELETE', `/api/projects/${id}`);
      closeModal('modal-confirm');
      showToast('Project deleted', 'success');
      loadProjects();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };
  openModal('modal-confirm');
}

/* ─── Findings load & views ──────────────────────────────── */
async function loadFindings() {
  if (!currentProject) return;
  const params = new URLSearchParams({ limit: 1000 });
  const search = document.getElementById('search-input')?.value.trim();
  const sev = document.getElementById('filter-sev')?.value;
  const stat = document.getElementById('filter-stat')?.value;
  if (search) params.set('search', search);
  if (sev) params.set('severity', sev);
  if (stat) params.set('status', stat);
  params.set('sort_by', sortCol);
  params.set('sort_dir', sortDir);
  findings = await api('GET', `/api/projects/${currentProject.id}/findings?${params}`);
  updateSidebarStats();
}

async function applyFilters() {
  curPage = 1;
  await loadFindings();
  const view = document.querySelector('.view.active')?.id?.replace('view-', '');
  if (view === 'dashboard') renderDashboard();
  else if (view === 'findings') renderTable();
  else if (view === 'timeline') renderTimeline();
}

function showView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-link[data-view]').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${v}`)?.classList.add('active');
  document.querySelector(`.sidebar-link[data-view="${v}"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent =
    v === 'dashboard' ? 'Dashboard' : v === 'findings' ? 'Findings' : 'Timeline';
  if (v === 'dashboard') renderDashboard();
  else if (v === 'findings') renderTable();
  else if (v === 'timeline') renderTimeline();
}

/* ─── Sidebar quick stats ────────────────────────────────── */
function updateSidebarStats() {
  document.getElementById('qs-total').textContent  = findings.length;
  document.getElementById('qs-open').textContent   = findings.filter(f => f.status === 'Open').length;
  document.getElementById('qs-prog').textContent   = findings.filter(f => f.status === 'In Progress').length;
  document.getElementById('qs-closed').textContent = findings.filter(f => f.status === 'Closed').length;
}

/* ─── Dashboard ──────────────────────────────────────────── */
function renderDashboard() {
  renderStatCards();
  renderCharts();
  renderHighPriority();
  renderRemediationProg();
}

function renderStatCards() {
  const sev = r => findings.filter(f => f.risk_rating === r).length;
  const total = findings.length;
  const closed = findings.filter(f => f.status === 'Closed').length;
  const pct = total ? Math.round(closed / total * 100) : 0;

  const cards = [
    { val: total,              lbl: 'Total Findings',  color: 'text-primary' },
    { val: sev('Critical'),    lbl: 'Critical',        color: 'text-danger' },
    { val: sev('High'),        lbl: 'High',            color: '', style: 'color:var(--clr-high)' },
    { val: sev('Medium'),      lbl: 'Medium',          color: 'text-warning' },
    { val: sev('Low'),         lbl: 'Low',             color: 'text-success' },
    { val: sev('Information'), lbl: 'Information',     color: '', style: 'color:var(--clr-info-purple)' },
  ];

  document.getElementById('stat-cards').innerHTML =
    cards.map(c => `
      <div class="col-6 col-sm-4 col-md-3 col-lg-2">
        <div class="card text-center h-100">
          <div class="card-body py-3 px-2">
            <div class="stat-val ${c.color}" ${c.style ? `style="${c.style}"` : ''}>${c.val}</div>
            <div class="stat-lbl">${c.lbl}</div>
          </div>
        </div>
      </div>`).join('') + `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2">
      <div class="card text-center h-100">
        <div class="card-body py-3 px-2">
          <div class="stat-val text-primary">${pct}%</div>
          <div class="stat-lbl">Remediated</div>
          <div class="progress mt-2" style="height:4px">
            <div class="progress-bar bg-primary" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderCharts() {
  const sevLabels = ['Critical','High','Medium','Low','Information'];
  const sevColors = ['#ef4444','#f97316','#eab308','#22c55e','#a855f7'];
  const sevData   = sevLabels.map(s => findings.filter(f => f.risk_rating === s).length);
  const statLabels = ['Open','In Progress','Closed'];
  const statColors = ['#ef4444','#f97316','#22c55e'];
  const statData   = statLabels.map(s => findings.filter(f => f.status === s).length);

  if (chartSev)  chartSev.destroy();
  if (chartStat) chartStat.destroy();

  chartSev = new Chart(document.getElementById('chart-sev'), {
    type: 'doughnut',
    data: { labels: sevLabels, datasets: [{ data: sevData, backgroundColor: sevColors, borderWidth: 0 }] },
    options: {
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      cutout: '65%'
    }
  });
  chartStat = new Chart(document.getElementById('chart-stat'), {
    type: 'bar',
    data: { labels: statLabels, datasets: [{ data: statData, backgroundColor: statColors, borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#273549' } },
        y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#273549' } }
      }
    }
  });
}

function renderHighPriority() {
  const items = findings
    .filter(f => (f.risk_rating === 'Critical' || f.risk_rating === 'High') && f.status !== 'Closed')
    .slice(0, 8);
  const el = document.getElementById('high-priority-list');
  if (!items.length) {
    el.innerHTML = '<p class="text-muted small mb-0">No open high-priority findings.</p>';
    return;
  }
  el.innerHTML = items.map(f => `
    <div class="hp-row" onclick="openDetail(${f.id})">
      <div>
        <div class="hp-name">${esc(f.vulnerability)}</div>
        <div class="hp-meta">${f.reference || ''} ${f.date_found ? '· ' + f.date_found : ''}</div>
      </div>
      <div class="d-flex gap-1 flex-shrink-0">${sevBadge(f.risk_rating)} ${statBadge(f.status)}</div>
    </div>`).join('');
}

function renderRemediationProg() {
  const sevs   = ['Critical','High','Medium','Low','Information'];
  const bars   = { Critical:'bg-danger', High:'bg-high', Medium:'bg-medium', Low:'bg-success', Information:'bg-info-pur' };
  const el = document.getElementById('remediation-prog');
  el.innerHTML = sevs.map(s => {
    const total  = findings.filter(f => f.risk_rating === s).length;
    const closed = findings.filter(f => f.risk_rating === s && f.status === 'Closed').length;
    const pct    = total ? Math.round(closed / total * 100) : 0;
    return `
      <div class="mb-3">
        <div class="d-flex justify-content-between small mb-1">
          <span>${s}</span>
          <span class="text-muted">${closed}/${total} (${pct}%)</span>
        </div>
        <div class="progress" style="height:6px">
          <div class="progress-bar ${bars[s]}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* ─── Findings table ─────────────────────────────────────── */
function renderTable() {
  const total = findings.length;
  const start = (curPage - 1) * PER;
  const page  = findings.slice(start, start + PER);

  document.getElementById('table-count').textContent =
    `Showing ${total ? Math.min(start + 1, total) : 0}–${Math.min(start + PER, total)} of ${total}`;

  document.getElementById('findings-tbody').innerHTML = page.map(f => `
    <tr onclick="openDetail(${f.id})" style="cursor:pointer">
      <td class="ps-3 text-muted">${f.no}</td>
      <td class="font-monospace text-primary small fw-semibold" style="white-space:nowrap">${esc(f.finding_code || '—')}</td>
      <td style="max-width:260px">${esc(f.vulnerability)}</td>
      <td>${sevBadge(f.risk_rating)}</td>
      <td class="text-muted small">${esc(f.reference || '')}</td>
      <td>${statBadge(f.status)}</td>
      <td class="text-muted small">${f.date_found || '—'}</td>
      <td class="pe-3">
        <div class="row-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="openFindingModal(${f.id})" title="Edit">✏️</button>
          <button class="icon-btn danger" onclick="askDelete(${f.id})" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  renderPagination(total);
  updateSortIcons();
}

function renderPagination(total) {
  const pages = Math.ceil(total / PER);
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (curPage > 1) html += `<button class="page-btn" onclick="goPag(${curPage - 1})">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - curPage) <= 2)
      html += `<button class="page-btn${i === curPage ? ' active' : ''}" onclick="goPag(${i})">${i}</button>`;
    else if (Math.abs(i - curPage) === 3)
      html += `<span class="text-muted px-1">…</span>`;
  }
  if (curPage < pages) html += `<button class="page-btn" onclick="goPag(${curPage + 1})">›</button>`;
  html += `<span class="text-muted small ms-auto">Page ${curPage} of ${pages}</span>`;
  el.innerHTML = html;
}

function goPag(p) { curPage = p; renderTable(); }

function doSort(col) {
  if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortCol = col; sortDir = 'asc'; }
  curPage = 1;
  loadFindings().then(() => renderTable());
}

function updateSortIcons() {
  ['no','vulnerability','risk_rating','status','date_found'].forEach(c => {
    const el = document.getElementById(`s-${c}`);
    if (el) el.textContent = sortCol === c ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  });
}

/* ─── Timeline ───────────────────────────────────────────── */
function renderTimeline() {
  const sev  = document.getElementById('tl-filter-sev')?.value;
  const stat = document.getElementById('tl-filter-stat')?.value;
  const items = findings.filter(f =>
    (!sev || f.risk_rating === sev) && (!stat || f.status === stat) &&
    (f.date_found || f.due_date)
  );
  const container = document.getElementById('timeline-container');
  if (!items.length) {
    container.innerHTML = '<p class="text-muted small">No findings with dates to display.</p>';
    return;
  }
  const allDates = items.flatMap(f => [f.date_found, f.due_date].filter(Boolean)).map(d => new Date(d));
  const minD = new Date(Math.min(...allDates));
  const maxD = new Date(Math.max(...allDates));
  minD.setDate(1);
  maxD.setMonth(maxD.getMonth() + 1); maxD.setDate(1);
  const totalMs = maxD - minD;

  const sevColors = { Critical:'#ef4444', High:'#f97316', Medium:'#eab308', Low:'#22c55e', Information:'#a855f7' };
  const months = [];
  let d = new Date(minD);
  while (d < maxD) {
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    d.setMonth(d.getMonth() + 1);
  }
  const todayPct = Math.max(0, Math.min(100, (new Date() - minD) / totalMs * 100));

  let html = `<div class="tl-header">${months.map(m => `<div class="tl-month">${m}</div>`).join('')}</div>`;
  items.forEach(f => {
    const s   = f.date_found ? (new Date(f.date_found) - minD) / totalMs * 100 : 0;
    const e   = f.due_date   ? (new Date(f.due_date)   - minD) / totalMs * 100 : s + 5;
    const w   = Math.max(2, e - s);
    const clr = sevColors[f.risk_rating] || '#3b82f6';
    html += `
      <div class="tl-row">
        <div class="tl-label">${sevBadge(f.risk_rating)}<span class="tl-label-text" title="${esc(f.vulnerability)}">${esc(f.vulnerability)}</span></div>
        <div class="tl-track">
          <div class="tl-today" style="left:${todayPct}%"></div>
          <div class="tl-bar" style="left:${s}%;width:${w}%;background:${clr}${f.status==='Closed'?'99':''}"
               onclick="openDetail(${f.id})" title="${esc(f.vulnerability)}">
            <span class="tl-bar-text">${f.status === 'Closed' ? '✓' : ''}</span>
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

/* ─── Finding detail modal ───────────────────────────────── */
async function openDetail(id) {
  const f = findings.find(x => x.id === id);
  if (!f) return;
  currentDetail = id;
  document.getElementById('detail-vuln-name').innerHTML =
    `${f.finding_code ? `<span class="font-monospace text-primary me-2" style="font-size:13px">${esc(f.finding_code)}</span>` : ''}${esc(f.vulnerability)}`;
  document.getElementById('detail-body').innerHTML = `
    <div class="d-flex gap-2 flex-wrap mb-3">
      ${sevBadge(f.risk_rating)} ${statBadge(f.status)}
      ${f.reference  ? `<span class="badge sev-info fw-normal">${esc(f.reference)}</span>` : ''}
      ${f.cve_id     ? `<span class="badge sev-info fw-normal">${esc(f.cve_id)}</span>` : ''}
      ${f.cvss_score ? `<span class="badge sev-high fw-normal">CVSS ${esc(f.cvss_score)}</span>` : ''}
      ${f.date_found ? `<span class="text-muted small">📅 Found: ${f.date_found}</span>` : ''}
      ${f.due_date   ? `<span class="text-muted small">⏰ Due: ${f.due_date}</span>` : ''}
    </div>
    ${ds('Affected Endpoint / Location', f.affected, true)}
    ${ds('Observation & Implication', f.observation)}
    ${ds('Recommendation', f.recommendation)}
    ${f.remark ? ds('Remark', f.remark) : ''}`;
  openModal('modal-detail');
}

function ds(title, content, code = false) {
  if (!content) return '';
  return `<div class="detail-section"><h4>${title}</h4>${
    code ? `<code>${esc(content)}</code>` : `<p>${esc(content)}</p>`
  }</div>`;
}

function editFromDetail(id) {
  closeModal('modal-detail');
  setTimeout(() => openFindingModal(id), 300);
}

/* ─── Finding add/edit modal ─────────────────────────────── */
function openFindingModal(id = null) {
  editFindingId = id;
  const fields = ['vulnerability','risk_rating','status','reference','cve_id','cvss_score',
                  'date_found','due_date','affected','observation','recommendation','remark'];
  fields.forEach(f => {
    const el = document.getElementById(`f-${f}`);
    if (!el) return;
    if (f === 'risk_rating') el.value = 'Medium';
    else if (f === 'status') el.value = 'Open';
    else el.value = '';
  });
  document.getElementById('modal-finding-title').textContent = id ? 'Edit Finding' : 'Add Finding';
  if (id) {
    const f = findings.find(x => x.id === id);
    if (f) fields.forEach(field => {
      const el = document.getElementById(`f-${field}`);
      if (el) el.value = f[field] || '';
    });
  }
  openModal('modal-finding');
}

async function saveFinding() {
  const vuln = document.getElementById('f-vulnerability').value.trim();
  if (!vuln) { showToast('Vulnerability name is required', 'error'); return; }
  const data = {
    vulnerability:  vuln,
    risk_rating:    document.getElementById('f-risk_rating').value,
    status:         document.getElementById('f-status').value,
    reference:      document.getElementById('f-reference').value.trim(),
    cve_id:         document.getElementById('f-cve_id').value.trim(),
    cvss_score:     document.getElementById('f-cvss_score').value.trim(),
    date_found:     document.getElementById('f-date_found').value,
    due_date:       document.getElementById('f-due_date').value,
    affected:       document.getElementById('f-affected').value.trim(),
    observation:    document.getElementById('f-observation').value.trim(),
    recommendation: document.getElementById('f-recommendation').value.trim(),
    remark:         document.getElementById('f-remark').value.trim(),
  };
  try {
    if (editFindingId) {
      await api('PUT', `/api/projects/${currentProject.id}/findings/${editFindingId}`, data);
      showToast('Finding updated', 'success');
    } else {
      await api('POST', `/api/projects/${currentProject.id}/findings`, data);
      showToast('Finding added', 'success');
    }
    closeModal('modal-finding');
    await loadFindings();
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (view === 'dashboard') renderDashboard();
    else if (view === 'findings') renderTable();
    else renderTimeline();
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function askDelete(id) {
  document.getElementById('confirm-msg').textContent =
    'Are you sure you want to delete this finding? This action cannot be undone.';
  const btn = document.getElementById('confirm-delete-btn');
  btn.onclick = () => deleteFinding(id);
  openModal('modal-confirm');
}

function confirmDeleteAll() {
  if (!currentProject) return;
  const count = findings.length;
  if (count === 0) { showToast('No findings to delete', 'error'); return; }
  document.getElementById('confirm-msg').innerHTML =
    `Delete <strong>all ${count} finding${count > 1 ? 's' : ''}</strong> in this project?<br>
     <span class="text-danger small">This action cannot be undone.</span>`;
  const btn = document.getElementById('confirm-delete-btn');
  btn.onclick = async () => {
    try {
      const res = await api('DELETE', `/api/projects/${currentProject.id}/findings/all`);
      closeModal('modal-confirm');
      showToast(`Deleted ${res.deleted} finding${res.deleted !== 1 ? 's' : ''}`, 'success');
      await loadFindings();
      const view = document.querySelector('.view.active')?.id?.replace('view-', '');
      if (view === 'dashboard') renderDashboard();
      else if (view === 'findings') renderTable();
      else renderTimeline();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };
  openModal('modal-confirm');
}

async function deleteFinding(id) {
  try {
    await api('DELETE', `/api/projects/${currentProject.id}/findings/${id}`);
    closeModal('modal-confirm');
    closeModal('modal-detail');
    showToast('Finding deleted', 'success');
    await loadFindings();
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (view === 'dashboard') renderDashboard();
    else if (view === 'findings') renderTable();
    else renderTimeline();
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

/* ─── Upload / Export / Templates ───────────────────────── */
async function handleUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentProject) return;
  event.target.value = '';
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`/api/projects/${currentProject.id}/upload`, { method: 'POST', body: form });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Upload failed');
    showToast(`Imported: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`, 'success');
    await loadFindings();
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (view === 'dashboard') renderDashboard();
    else if (view === 'findings') renderTable();
    else renderTimeline();
  } catch (e) { showToast('Upload error: ' + e.message, 'error'); }
}

function exportCSV() {
  if (!currentProject) return;
  window.location = `/api/projects/${currentProject.id}/findings/export/csv`;
}

function downloadTemplate(fmt) {
  if (!currentProject) return;
  window.location = `/api/projects/${currentProject.id}/upload/template/${fmt}`;
}

/* ─── Badge helpers ──────────────────────────────────────── */
function sevBadge(r) {
  const cls = {
    Critical: 'sev-critical', High: 'sev-high',
    Medium: 'sev-medium', Low: 'sev-low', Information: 'sev-info'
  };
  return `<span class="badge ${cls[r] || 'sev-info'}">${r}</span>`;
}
function statBadge(s) {
  const cls = { Open: 'stat-open', 'In Progress': 'stat-prog', Closed: 'stat-closed' };
  return `<span class="badge ${cls[s] || ''}">${s}</span>`;
}

/* ─── Utility ────────────────────────────────────────────── */
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Keyboard shortcuts ─────────────────────────────────── */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && currentProject) {
    e.preventDefault();
    openFindingModal();
  }
});

/* ─── Init ───────────────────────────────────────────────── */
loadProjects();

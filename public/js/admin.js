import {
  apiRequest,
  showAlert,
  hideAlert,
  loadSessionUser,
  renderNavbar,
  statusBadgeClass,
  createEl,
  clearEl,
} from './api.js';

async function runAction(action, targetId) {
  await apiRequest('/api/admin', {
    method: 'PATCH',
    body: { action, targetId },
  });
  await loadAdminDashboard();
}

async function loadAdminDashboard() {
  const data = await apiRequest('/api/admin');

  const statsGrid = document.getElementById('admin-stats');
  clearEl(statsGrid);
  const statItems = [
    ['Students (Verified)', `${data.stats.totalStudents} (${data.stats.verifiedStudents})`],
    ['Employers (Verified)', `${data.stats.totalEmployers} (${data.stats.verifiedEmployers})`],
    ['Jobs (Approved / Pending)', `${data.stats.approvedJobs} / ${data.stats.pendingJobs}`],
    ['Applications / Offers', `${data.stats.totalApplications} / ${data.stats.offersAccepted}`],
  ];
  statItems.forEach(([label, value]) => {
    const card = createEl('div', 'stat-card');
    card.appendChild(createEl('div', 'stat-label', label));
    card.appendChild(createEl('div', 'stat-value', value));
    statsGrid.appendChild(card);
  });

  const chartBox = document.getElementById('dept-placement-chart');
  if (chartBox) {
    clearEl(chartBox);
    data.deptStats.forEach((d) => {
      const row = createEl('div', 'chart-row');
      const head = createEl('div', 'chart-row-head');
      head.appendChild(createEl('span', '', `${d.name} (${d.code})`));
      head.appendChild(
        createEl('span', '', `${d.placedStudents}/${d.totalStudents} (${d.placementRate}%)`)
      );
      row.appendChild(head);
      const bar = createEl('progress', 'visual-bar bar-high');
      bar.value = d.placementRate;
      bar.max = 100;
      row.appendChild(bar);
      chartBox.appendChild(row);
    });
  }

  const empBody = document.getElementById('admin-employers-body');
  clearEl(empBody);
  data.employers.forEach((emp) => {
    const tr = createEl('tr');
    tr.appendChild(createEl('td', '', emp.companyName));
    tr.appendChild(createEl('td', '', emp.email));
    const st = createEl('td');
    st.appendChild(
      createEl(
        'span',
        statusBadgeClass(emp.verifiedByAdmin),
        emp.verifiedByAdmin === 'true' ? 'VERIFIED' : 'PENDING'
      )
    );
    tr.appendChild(st);
    const act = createEl('td');
    if (emp.verifiedByAdmin !== 'true') {
      const btn = createEl('button', 'btn btn-success btn-sm', 'Verify');
      btn.addEventListener('click', () => runAction('VERIFY_EMPLOYER', emp.id));
      act.appendChild(btn);
    }
    tr.appendChild(act);
    empBody.appendChild(tr);
  });

  const stuBody = document.getElementById('admin-students-body');
  clearEl(stuBody);
  data.students.forEach((stu) => {
    const tr = createEl('tr');
    tr.appendChild(createEl('td', '', stu.fullName));
    tr.appendChild(createEl('td', '', stu.email));
    tr.appendChild(createEl('td', '', stu.studentIdNo || 'N/A'));
    const st = createEl('td');
    st.appendChild(
      createEl(
        'span',
        statusBadgeClass(stu.verifiedByAdmin),
        stu.verifiedByAdmin === 'true' ? 'VERIFIED' : 'PENDING'
      )
    );
    tr.appendChild(st);
    const act = createEl('td');
    if (stu.verifiedByAdmin !== 'true') {
      const btn = createEl('button', 'btn btn-success btn-sm', 'Verify');
      btn.addEventListener('click', () => runAction('VERIFY_STUDENT', stu.id));
      act.appendChild(btn);
    }
    tr.appendChild(act);
    stuBody.appendChild(tr);
  });

  const jobsBody = document.getElementById('admin-jobs-body');
  clearEl(jobsBody);
  data.jobs.forEach((job) => {
    const tr = createEl('tr');
    tr.appendChild(createEl('td', '', job.title));
    tr.appendChild(createEl('td', '', job.companyName));
    tr.appendChild(createEl('td', '', job.type));
    const st = createEl('td');
    st.appendChild(createEl('span', statusBadgeClass(job.status), job.status));
    tr.appendChild(st);
    const act = createEl('td');
    if (job.status === 'PENDING') {
      const appBtn = createEl('button', 'btn btn-success btn-sm', 'Approve');
      appBtn.addEventListener('click', () => runAction('APPROVE_JOB', job.id));
      const rejBtn = createEl('button', 'btn btn-danger btn-sm', 'Reject');
      rejBtn.addEventListener('click', () => runAction('REJECT_JOB', job.id));
      const row = createEl('div', 'actions-row');
      row.appendChild(appBtn);
      row.appendChild(rejBtn);
      act.appendChild(row);
    }
    tr.appendChild(act);
    jobsBody.appendChild(tr);
  });

  const repBody = document.getElementById('admin-reports-body');
  clearEl(repBody);
  if (data.reports.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', '', 'No reports filed.');
    td.colSpan = 4;
    tr.appendChild(td);
    repBody.appendChild(tr);
  } else {
    data.reports.forEach((rep) => {
      const tr = createEl('tr');
      tr.appendChild(createEl('td', '', `${rep.targetType} (${rep.targetId.slice(0, 8)})`));
      tr.appendChild(createEl('td', '', rep.reason));
      const st = createEl('td');
      st.appendChild(createEl('span', statusBadgeClass(rep.status), rep.status));
      tr.appendChild(st);
      const act = createEl('td');
      if (rep.status === 'OPEN') {
        const resBtn = createEl('button', 'btn btn-success btn-sm', 'Resolve');
        resBtn.addEventListener('click', () => runAction('RESOLVE_REPORT', rep.id));
        const disBtn = createEl('button', 'btn btn-outline btn-sm', 'Dismiss');
        disBtn.addEventListener('click', () => runAction('DISMISS_REPORT', rep.id));
        const row = createEl('div', 'actions-row');
        row.appendChild(resBtn);
        row.appendChild(disBtn);
        act.appendChild(row);
      }
      tr.appendChild(act);
      repBody.appendChild(tr);
    });
  }

  const auditBody = document.getElementById('admin-audit-body');
  clearEl(auditBody);
  data.auditLogs.forEach((log) => {
    const tr = createEl('tr');
    tr.appendChild(createEl('td', '', log.action));
    tr.appendChild(createEl('td', '', log.entity));
    tr.appendChild(createEl('td', '', log.ip));
    tr.appendChild(createEl('td', '', log.createdAt));
    auditBody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadSessionUser();
  if (!user || user.role !== 'UNIVERSITY_ADMIN') {
    window.location.href = '/login';
    return;
  }

  await renderNavbar(user);
  document.getElementById('admin-email').textContent = user.email;
  await loadAdminDashboard();

  document.getElementById('add-dept-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('dept-alert');
    try {
      await apiRequest('/api/departments', {
        method: 'POST',
        body: {
          name: document.getElementById('dept-name').value.trim(),
          code: document.getElementById('dept-code').value.trim(),
        },
      });
      showAlert('dept-alert', 'Department created.', 'success');
      e.target.reset();
      await loadAdminDashboard();
    } catch (err) {
      showAlert('dept-alert', err.message || 'Could not create department');
    }
  });
});

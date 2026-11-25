import {
  apiRequest,
  showAlert,
  hideAlert,
  loadSessionUser,
  renderNavbar,
  populateDepartmentSelect,
  renderNotificationsPanel,
  statusBadgeClass,
  createEl,
  clearEl,
} from './api.js';

let activeInterviewAppId = null;

async function loadCompanyProfile() {
  const data = await apiRequest('/api/employers/profile');
  const p = data.profile;
  document.getElementById('companyName').value = p.companyName || '';
  document.getElementById('website').value = p.website || '';
  document.getElementById('industry').value = p.industry || '';
  document.getElementById('description').value = p.description || '';

  const badge = document.getElementById('employer-verified-badge');
  badge.textContent = p.verifiedByAdmin === 'true' ? 'Verified Employer' : 'Pending Admin Verification';
  badge.className = statusBadgeClass(p.verifiedByAdmin);

  const notice = document.getElementById('unverified-notice');
  if (p.verifiedByAdmin === 'true') {
    notice.classList.add('hidden');
  } else {
    notice.classList.remove('hidden');
  }
}

async function loadOwnJobs() {
  const tbody = document.getElementById('employer-jobs-body');
  clearEl(tbody);
  const data = await apiRequest('/api/jobs?mine=true&limit=50');
  const jobs = data.jobs || [];

  if (jobs.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', '', 'No job postings created yet.');
    td.colSpan = 5;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  jobs.forEach((job) => {
    const tr = createEl('tr');
    tr.appendChild(createEl('td', '', job.title));
    tr.appendChild(createEl('td', '', job.type));
    tr.appendChild(createEl('td', '', job.deadline));
    const statusTd = createEl('td');
    statusTd.appendChild(createEl('span', statusBadgeClass(job.status), job.status));
    tr.appendChild(statusTd);

    const actionTd = createEl('td');
    if (job.status !== 'CLOSED') {
      const closeBtn = createEl('button', 'btn btn-outline btn-sm', 'Close');
      closeBtn.type = 'button';
      closeBtn.addEventListener('click', async () => {
        await apiRequest('/api/jobs', {
          method: 'PUT',
          body: { id: job.id, status: 'CLOSED' },
        });
        await loadOwnJobs();
      });
      actionTd.appendChild(closeBtn);
    }
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function loadApplicants() {
  const container = document.getElementById('applicants-list');
  const statusFilter = document.getElementById('applicant-status-filter')?.value || '';
  clearEl(container);

  const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
  const data = await apiRequest(`/api/applications${qs}`);
  const apps = data.applications || [];

  if (apps.length === 0) {
    container.appendChild(createEl('p', 'subtitle', 'No applicants found for the selected filter.'));
    return;
  }

  apps.forEach((app) => {
    const card = createEl('div', 'job-card');
    const top = createEl('div', 'section-header');
    top.appendChild(createEl('h3', '', `${app.studentName} — ${app.jobTitle}`));
    const badges = createEl('div', 'nav-links');
    badges.appendChild(createEl('span', 'badge', `${app.skillMatch.score}% Match`));
    badges.appendChild(createEl('span', statusBadgeClass(app.status), app.status));
    top.appendChild(badges);
    card.appendChild(top);

    card.appendChild(
      createEl(
        'p',
        'subtitle',
        `CGPA: ${app.studentCgpa || 'N/A'} | Skills: ${app.studentSkills || 'Not listed'}`
      )
    );
    card.appendChild(createEl('p', '', `Cover Letter: ${app.coverLetter}`));

    if (app.studentCvUrl) {
      const cvLink = createEl('a', 'nav-link', 'Open Student CV Link');
      cvLink.href = app.studentCvUrl;
      cvLink.target = '_blank';
      cvLink.rel = 'noopener noreferrer';
      card.appendChild(cvLink);
    }

    const actions = createEl('div', 'actions-row');
    (app.allowedNextStatuses || []).forEach((nextStatus) => {
      const cls =
        nextStatus === 'REJECTED'
          ? 'btn btn-danger btn-sm'
          : nextStatus === 'SELECTED'
          ? 'btn btn-success btn-sm'
          : 'btn btn-sm';
      const btn = createEl('button', cls, `Move to ${nextStatus}`);
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        if (nextStatus === 'INTERVIEW_SCHEDULED') {
          activeInterviewAppId = app.id;
          hideAlert('interview-alert');
          document.getElementById('interview-modal').classList.remove('hidden');
          return;
        }
        btn.disabled = true;
        await apiRequest('/api/applications', {
          method: 'PATCH',
          body: {
            applicationId: app.id,
            toStatus: nextStatus,
            note: `Transitioned to ${nextStatus} by employer`,
          },
        });
        await loadApplicants();
      });
      actions.appendChild(btn);
    });
    card.appendChild(actions);
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadSessionUser();
  if (!user || !['EMPLOYER', 'RECRUITER'].includes(user.role)) {
    window.location.href = '/login';
    return;
  }

  await renderNavbar(user);
  document.getElementById('employer-email').textContent = user.email;
  await populateDepartmentSelect('job-departmentId', 'All Departments');

  await Promise.all([
    loadCompanyProfile(),
    loadOwnJobs(),
    loadApplicants(),
    renderNotificationsPanel('notifications-list'),
  ]);

  document.getElementById('employer-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('company-alert');
    try {
      await apiRequest('/api/employers/profile', {
        method: 'PUT',
        body: {
          companyName: document.getElementById('companyName').value.trim(),
          website: document.getElementById('website').value.trim(),
          industry: document.getElementById('industry').value.trim(),
          description: document.getElementById('description').value.trim(),
        },
      });
      showAlert('company-alert', 'Company profile saved.', 'success');
    } catch (err) {
      showAlert('company-alert', err.message || 'Could not update profile');
    }
  });

  document.getElementById('post-job-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('job-post-alert');
    const btn = document.getElementById('post-job-submit');
    btn.disabled = true;
    try {
      await apiRequest('/api/jobs', {
        method: 'POST',
        body: {
          title: document.getElementById('job-title').value.trim(),
          type: document.getElementById('job-type').value,
          location: document.getElementById('job-location').value.trim(),
          departmentId: document.getElementById('job-departmentId').value,
          salaryMin: Number(document.getElementById('job-salaryMin').value),
          salaryMax: Number(document.getElementById('job-salaryMax').value),
          requiredSkills: document.getElementById('job-skills').value.trim(),
          deadline: document.getElementById('job-deadline').value,
          description: document.getElementById('job-description').value.trim(),
        },
      });
      showAlert('job-post-alert', 'Job submitted! It will go live once approved by Admin.', 'success');
      e.target.reset();
      await loadOwnJobs();
    } catch (err) {
      showAlert('job-post-alert', err.message || 'Could not post job');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('applicant-status-filter')?.addEventListener('change', loadApplicants);

  document.getElementById('close-interview-modal')?.addEventListener('click', () => {
    document.getElementById('interview-modal').classList.add('hidden');
  });

  document.getElementById('interview-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('interview-alert');
    try {
      await apiRequest('/api/applications', {
        method: 'PATCH',
        body: {
          applicationId: activeInterviewAppId,
          toStatus: 'INTERVIEW_SCHEDULED',
          note: 'Interview scheduled',
          interview: {
            scheduledAt: document.getElementById('iv-date').value,
            mode: document.getElementById('iv-mode').value,
            link: document.getElementById('iv-link').value.trim(),
          },
        },
      });
      document.getElementById('interview-modal').classList.add('hidden');
      await loadApplicants();
    } catch (err) {
      showAlert('interview-alert', err.message || 'Could not schedule interview');
    }
  });
});

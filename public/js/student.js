import {
  apiRequest,
  showAlert,
  hideAlert,
  loadSessionUser,
  renderNavbar,
  populateDepartmentSelect,
  renderNotificationsPanel,
  buildWorkflowStepper,
  statusBadgeClass,
  createEl,
  clearEl,
} from './api.js';

async function loadProfile() {
  const data = await apiRequest('/api/students/profile');
  const p = data.profile;
  document.getElementById('fullName').value = p.fullName || '';
  document.getElementById('studentIdNo').value = p.studentIdNo || '';
  document.getElementById('departmentId').value = p.departmentId || '';
  document.getElementById('cgpa').value = p.cgpa || '';
  document.getElementById('graduationYear').value = p.graduationYear || '';
  document.getElementById('skills').value = p.skills || '';
  document.getElementById('education').value = p.education || '';
  document.getElementById('projects').value = p.projects || '';
  document.getElementById('cvUrl').value = p.cvUrl || '';

  const badge = document.getElementById('verification-badge');
  badge.textContent = p.verifiedByAdmin === 'true' ? 'Verified Student' : 'Pending Verification';
  badge.className = statusBadgeClass(p.verifiedByAdmin);
}

async function loadSavedJobs() {
  const container = document.getElementById('saved-jobs-list');
  clearEl(container);
  const data = await apiRequest('/api/students/profile?resource=saved');
  const items = data.savedJobs || [];
  if (items.length === 0) {
    container.appendChild(createEl('p', 'subtitle', 'No bookmarked jobs yet.'));
    return;
  }
  items.forEach(({ job }) => {
    const card = createEl('div', 'job-card');
    card.appendChild(createEl('h3', '', job.title));
    card.appendChild(
      createEl('p', 'subtitle', `${job.type} | ${job.location} | Deadline: ${job.deadline}`)
    );
    const link = createEl('a', 'btn btn-outline btn-sm', 'View on Job Board');
    link.href = '/jobs';
    card.appendChild(link);
    container.appendChild(card);
  });
}

async function loadApplications() {
  const container = document.getElementById('student-apps-list');
  clearEl(container);
  const data = await apiRequest('/api/applications');
  const apps = data.applications || [];
  if (apps.length === 0) {
    container.appendChild(createEl('p', 'subtitle', 'You have not applied to any positions yet.'));
    return;
  }

  apps.forEach((app) => {
    const card = createEl('div', 'job-card');
    const top = createEl('div', 'section-header');
    top.appendChild(createEl('h3', '', `${app.jobTitle} — ${app.companyName}`));
    top.appendChild(createEl('span', statusBadgeClass(app.status), app.status));
    card.appendChild(top);

    card.appendChild(buildWorkflowStepper(app.status));

    if (app.interviews && app.interviews.length > 0) {
      const iv = app.interviews[app.interviews.length - 1];
      const ivBox = createEl(
        'div',
        'alert alert-warning',
        `Interview Scheduled: ${iv.scheduledAt} (${iv.mode}) ${iv.link ? `— Link: ${iv.link}` : ''}`
      );
      card.appendChild(ivBox);
    }

    const timeline = createEl('ul', 'timeline');
    (app.history || []).forEach((h) => {
      timeline.appendChild(
        createEl('li', '', `${h.fromStatus} -> ${h.toStatus} (${h.note || 'Updated'})`)
      );
    });
    card.appendChild(timeline);

    const actions = createEl('div', 'actions-row');
    (app.allowedNextStatuses || []).forEach((nextStatus) => {
      const label = nextStatus === 'OFFER_ACCEPTED' ? 'Accept Job Offer' : 'Withdraw Application';
      const cls =
        nextStatus === 'OFFER_ACCEPTED' ? 'btn btn-success btn-sm' : 'btn btn-danger btn-sm';
      const btn = createEl('button', cls, label);
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await apiRequest('/api/applications', {
          method: 'PATCH',
          body: {
            applicationId: app.id,
            toStatus: nextStatus,
            note:
              nextStatus === 'OFFER_ACCEPTED' ? 'Student accepted offer' : 'Withdrawn by student',
          },
        });
        await loadApplications();
      });
      actions.appendChild(btn);
    });
    card.appendChild(actions);
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadSessionUser();
  if (!user || user.role !== 'STUDENT') {
    window.location.href = '/login';
    return;
  }

  await renderNavbar(user);
  document.getElementById('student-email').textContent = user.email;
  await populateDepartmentSelect('departmentId', 'Select Department');

  await Promise.all([
    loadProfile(),
    loadSavedJobs(),
    loadApplications(),
    renderNotificationsPanel('notifications-list'),
  ]);

  document.getElementById('student-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('profile-alert');
    const btn = document.getElementById('profile-submit');
    btn.disabled = true;
    try {
      await apiRequest('/api/students/profile', {
        method: 'PUT',
        body: {
          fullName: document.getElementById('fullName').value.trim(),
          studentIdNo: document.getElementById('studentIdNo').value.trim(),
          departmentId: document.getElementById('departmentId').value,
          cgpa: document.getElementById('cgpa').value.trim(),
          graduationYear: document.getElementById('graduationYear').value.trim(),
          skills: document.getElementById('skills').value.trim(),
          education: document.getElementById('education').value.trim(),
          projects: document.getElementById('projects').value.trim(),
          cvUrl: document.getElementById('cvUrl').value.trim(),
        },
      });
      showAlert('profile-alert', 'Student profile saved successfully.', 'success');
    } catch (err) {
      showAlert('profile-alert', err.message || 'Failed to save profile');
    } finally {
      btn.disabled = false;
    }
  });
});

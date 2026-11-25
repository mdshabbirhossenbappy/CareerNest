import {
  apiRequest,
  showAlert,
  hideAlert,
  loadSessionUser,
  renderNavbar,
  populateDepartmentSelect,
  createEl,
  clearEl,
} from './api.js';

let currentUser = null;
let currentPage = 1;
let activeJobIdForModal = null;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

async function fetchAndRenderJobs(page = 1) {
  currentPage = page;
  const listEl = document.getElementById('jobs-list');
  const pagEl = document.getElementById('pagination-bar');
  if (!listEl) return;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '9');

  const q = document.getElementById('filter-q')?.value.trim();
  const departmentId = document.getElementById('filter-dept')?.value;
  const type = document.getElementById('filter-type')?.value;
  const location = document.getElementById('filter-location')?.value.trim();
  const minSalary = document.getElementById('filter-salary')?.value.trim();

  if (q) params.set('q', q);
  if (departmentId) params.set('departmentId', departmentId);
  if (type) params.set('type', type);
  if (location) params.set('location', location);
  if (minSalary) params.set('minSalary', minSalary);

  clearEl(listEl);
  listEl.appendChild(createEl('p', 'subtitle', 'Loading approved opportunities...'));

  try {
    const data = await apiRequest(`/api/jobs?${params.toString()}`);
    clearEl(listEl);
    clearEl(pagEl);

    const jobs = data.jobs || [];
    if (jobs.length === 0) {
      listEl.appendChild(createEl('p', 'subtitle', 'No jobs matched your search criteria.'));
      return;
    }

    jobs.forEach((job) => {
      const card = createEl('article', 'job-card');
      const header = createEl('div', 'section-header');
      header.appendChild(createEl('h3', '', job.title));

      if (job.skillMatch) {
        const matchBadge = createEl(
          'span',
          job.skillMatch.score >= 60 ? 'badge badge-success' : 'badge badge-warning',
          `${job.skillMatch.score}% Skill Match`
        );
        header.appendChild(matchBadge);
      }
      card.appendChild(header);

      const meta = createEl('div', 'job-meta');
      meta.appendChild(createEl('span', 'badge', job.type));
      meta.appendChild(createEl('span', '', job.companyName));
      meta.appendChild(createEl('span', '', job.location));
      meta.appendChild(createEl('span', '', job.departmentName));
      card.appendChild(meta);

      card.appendChild(createEl('p', '', job.description));
      card.appendChild(createEl('p', 'subtitle', `Skills: ${job.requiredSkills}`));
      card.appendChild(
        createEl(
          'p',
          'subtitle',
          `Salary: ${job.salaryMin} - ${job.salaryMax} | Deadline: ${job.deadline}`
        )
      );

      const actions = createEl('div', 'actions-row');

      if (currentUser && currentUser.role === 'STUDENT') {
        const applyBtn = createEl('button', 'btn btn-sm', 'Apply Now');
        applyBtn.type = 'button';
        applyBtn.addEventListener('click', () => {
          activeJobIdForModal = job.id;
          document.getElementById('apply-job-title').textContent = `${job.title} — ${job.companyName}`;
          hideAlert('apply-alert');
          document.getElementById('coverLetter').value = '';
          openModal('apply-modal');
        });
        actions.appendChild(applyBtn);

        const saveBtn = createEl(
          'button',
          'btn btn-outline btn-sm',
          job.isSaved ? 'Bookmarked' : 'Bookmark'
        );
        saveBtn.type = 'button';
        saveBtn.disabled = job.isSaved;
        saveBtn.addEventListener('click', async () => {
          await apiRequest('/api/students/profile?resource=saved', {
            method: 'POST',
            body: { jobId: job.id },
          });
          saveBtn.textContent = 'Bookmarked';
          saveBtn.disabled = true;
        });
        actions.appendChild(saveBtn);

        const reportBtn = createEl('button', 'btn btn-outline btn-sm', 'Report');
        reportBtn.type = 'button';
        reportBtn.addEventListener('click', () => {
          activeJobIdForModal = job.id;
          hideAlert('report-alert');
          document.getElementById('report-reason').value = '';
          openModal('report-modal');
        });
        actions.appendChild(reportBtn);
      } else if (!currentUser) {
        const loginToApply = createEl('a', 'btn btn-outline btn-sm', 'Sign In as Student to Apply');
        loginToApply.href = '/login';
        actions.appendChild(loginToApply);
      }

      card.appendChild(actions);
      listEl.appendChild(card);
    });

    const { totalPages } = data.pagination;
    if (totalPages > 1) {
      const prevBtn = createEl('button', 'btn btn-outline btn-sm', 'Previous');
      prevBtn.disabled = currentPage <= 1;
      prevBtn.addEventListener('click', () => fetchAndRenderJobs(currentPage - 1));
      pagEl.appendChild(prevBtn);

      pagEl.appendChild(createEl('span', 'subtitle', `Page ${currentPage} of ${totalPages}`));

      const nextBtn = createEl('button', 'btn btn-outline btn-sm', 'Next');
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.addEventListener('click', () => fetchAndRenderJobs(currentPage + 1));
      pagEl.appendChild(nextBtn);
    }
  } catch (err) {
    clearEl(listEl);
    showAlert('jobs-alert', err.message || 'Failed to load jobs');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await loadSessionUser();
  await renderNavbar(currentUser);
  await populateDepartmentSelect('filter-dept', 'All Departments');
  await fetchAndRenderJobs(1);

  document.getElementById('filter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    fetchAndRenderJobs(1);
  });

  document.getElementById('close-apply-modal')?.addEventListener('click', () => {
    closeModal('apply-modal');
  });

  document.getElementById('close-report-modal')?.addEventListener('click', () => {
    closeModal('report-modal');
  });

  document.getElementById('apply-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('apply-alert');
    const coverLetter = document.getElementById('coverLetter').value.trim();
    const btn = document.getElementById('apply-submit');
    btn.disabled = true;
    try {
      await apiRequest('/api/applications', {
        method: 'POST',
        body: { jobId: activeJobIdForModal, coverLetter },
      });
      showAlert('apply-alert', 'Application submitted successfully!', 'success');
      setTimeout(() => closeModal('apply-modal'), 900);
    } catch (err) {
      showAlert('apply-alert', err.message || 'Could not submit application');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('report-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('report-alert');
    const reason = document.getElementById('report-reason').value.trim();
    try {
      await apiRequest('/api/notifications?resource=reports', {
        method: 'POST',
        body: { targetType: 'JOB', targetId: activeJobIdForModal, reason },
      });
      showAlert('report-alert', 'Report submitted to the University Career Office.', 'success');
      setTimeout(() => closeModal('report-modal'), 900);
    } catch (err) {
      showAlert('report-alert', err.message || 'Could not submit report');
    }
  });
});

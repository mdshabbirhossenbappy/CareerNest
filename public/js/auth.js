import {
  apiRequest,
  getDashboardPath,
  showAlert,
  hideAlert,
  loadSessionUser,
  renderNavbar,
  populateDepartmentSelect,
  createEl,
  clearEl,
} from './api.js';

async function initLandingPage() {
  const featuredContainer = document.getElementById('featured-jobs');
  const heroActions = document.getElementById('hero-actions');
  if (!featuredContainer) return;

  const user = await loadSessionUser();
  await renderNavbar(user);

  if (heroActions && user) {
    clearEl(heroActions);
    const dashBtn = createEl('a', 'btn btn-light', 'Open My Dashboard');
    dashBtn.href = getDashboardPath(user.role);
    const browseBtn = createEl('a', 'btn btn-outline btn-light', 'Browse All Jobs');
    browseBtn.href = '/jobs';
    heroActions.appendChild(dashBtn);
    heroActions.appendChild(browseBtn);
  }

  try {
    const data = await apiRequest('/api/jobs?limit=6');
    clearEl(featuredContainer);
    const jobs = data.jobs || [];
    if (jobs.length === 0) {
      featuredContainer.appendChild(
        createEl('p', 'subtitle', 'No approved opportunities published yet. Check back soon!')
      );
      return;
    }

    jobs.forEach((job) => {
      const card = createEl('article', 'job-card');
      card.appendChild(createEl('h3', '', job.title));
      const meta = createEl('div', 'job-meta');
      meta.appendChild(createEl('span', 'badge', job.type));
      meta.appendChild(createEl('span', '', job.companyName));
      meta.appendChild(createEl('span', '', job.location));
      card.appendChild(meta);
      card.appendChild(createEl('p', 'subtitle', `Salary: ${job.salaryMin} - ${job.salaryMax}`));
      const link = createEl('a', 'btn btn-outline btn-sm', 'View & Apply');
      link.href = '/jobs';
      card.appendChild(link);
      featuredContainer.appendChild(card);
    });
  } catch {
    clearEl(featuredContainer);
    featuredContainer.appendChild(createEl('p', 'subtitle', 'Unable to load latest openings.'));
  }
}

async function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const user = await loadSessionUser();
  await renderNavbar(user);
  await populateDepartmentSelect('departmentId', 'Select Department (Students)');

  const roleSelect = document.getElementById('role');
  const deptGroup = document.getElementById('department-group');
  if (roleSelect && deptGroup) {
    roleSelect.addEventListener('change', () => {
      if (roleSelect.value === 'STUDENT') {
        deptGroup.classList.remove('hidden');
      } else {
        deptGroup.classList.add('hidden');
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('register-alert');

    const submitBtn = document.getElementById('register-submit');
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const departmentId = document.getElementById('departmentId')?.value || '';

    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      showAlert(
        'register-alert',
        'Password must be at least 10 characters and include both letters and numbers.'
      );
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const payload = { fullName, email, password, role };
      if (role === 'STUDENT' && departmentId) {
        payload.departmentId = departmentId;
      }
      if (role !== 'STUDENT') {
        payload.companyName = fullName;
      }
      await apiRequest('/api/auth/register', { method: 'POST', body: payload });
      window.location.href = '/login';
    } catch (err) {
      showAlert('register-alert', err.message || 'Registration failed');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}

async function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const user = await loadSessionUser();
  await renderNavbar(user);
  if (user) {
    window.location.href = getDashboardPath(user.role);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('login-alert');

    const submitBtn = document.getElementById('login-submit');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      window.location.href = getDashboardPath(data.user.role);
    } catch (err) {
      showAlert('login-alert', err.message || 'Login failed');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLandingPage();
  initRegisterPage();
  initLoginPage();
});

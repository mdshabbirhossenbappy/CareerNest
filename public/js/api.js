export async function apiRequest(url, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {},
  };

  if (options.body !== undefined) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const payload = await response.json().catch(() => ({
    success: false,
    data: null,
    error: 'Unexpected server response',
  }));

  if (!response.ok || !payload.success) {
    const err = new Error(payload.error || 'Request failed');
    err.status = response.status;
    throw err;
  }

  return payload.data;
}

export function getDashboardPath(role) {
  if (role === 'STUDENT') return '/student';
  if (role === 'EMPLOYER') return '/employer';
  if (role === 'RECRUITER') return '/recruiter';
  if (role === 'UNIVERSITY_ADMIN') return '/admin';
  return '/';
}

export function showAlert(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
}

export function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

export function createEl(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null && text !== '') {
    el.textContent = String(text);
  }
  return el;
}

export function clearEl(el) {
  while (el && el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function getInitials(name) {
  if (!name) return 'CN';
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() || '').join('') || 'CN';
}

export function buildSkillMeter(score, label = 'Skill Match') {
  const wrapper = createEl('div', 'skill-meter');
  const head = createEl('div', 'skill-meter-header');
  head.appendChild(createEl('span', '', label));
  head.appendChild(createEl('span', '', `${score}%`));
  wrapper.appendChild(head);

  const barClass =
    score >= 70 ? 'visual-bar bar-high' : score >= 40 ? 'visual-bar' : 'visual-bar bar-low';
  const progress = createEl('progress', barClass);
  progress.value = score;
  progress.max = 100;
  wrapper.appendChild(progress);
  return wrapper;
}

export function buildWorkflowStepper(currentStatus) {
  const stages = [
    ['SUBMITTED', 'Applied'],
    ['UNDER_REVIEW', 'Review'],
    ['SHORTLISTED', 'Shortlist'],
    ['INTERVIEW_SCHEDULED', 'Interview'],
    ['SELECTED', 'Selected'],
    ['OFFER_ACCEPTED', 'Accepted'],
  ];

  const currentIdx = stages.findIndex(([key]) => key === currentStatus);
  const isTerminalNegative = currentStatus === 'REJECTED' || currentStatus === 'WITHDRAWN';
  const stepper = createEl('div', 'stepper');

  stages.forEach(([_key, label], idx) => {
    let cls = 'step-node';
    if (isTerminalNegative && idx === 0) {
      cls += ' step-rejected';
    } else if (currentIdx > idx) {
      cls += ' step-done';
    } else if (currentIdx === idx) {
      cls += ' step-active';
    }
    const node = createEl('div', cls);
    node.appendChild(createEl('span', 'step-dot'));
    node.appendChild(createEl('span', 'step-label', label));
    stepper.appendChild(node);
  });

  return stepper;
}

export function statusBadgeClass(status) {
  if (['APPROVED', 'SELECTED', 'OFFER_ACCEPTED', 'RESOLVED', 'true'].includes(status)) {
    return 'badge badge-success';
  }
  if (['REJECTED', 'WITHDRAWN', 'CLOSED', 'OPEN', 'false'].includes(status)) {
    return 'badge badge-danger';
  }
  if (['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(status)) {
    return 'badge badge-warning';
  }
  return 'badge';
}

export async function loadSessionUser() {
  try {
    const data = await apiRequest('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function renderNavbar(activeUser = null) {
  const navContainer = document.getElementById('nav-actions');
  if (!navContainer) return;
  clearEl(navContainer);

  const jobsLink = createEl('a', 'nav-link', 'Browse Jobs');
  jobsLink.href = '/jobs';
  navContainer.appendChild(jobsLink);

  if (activeUser) {
    const dashLink = createEl('a', 'nav-link', 'Dashboard');
    dashLink.href = getDashboardPath(activeUser.role);
    navContainer.appendChild(dashLink);

    const badge = createEl('span', 'badge', activeUser.role);
    navContainer.appendChild(badge);

    const logoutBtn = createEl('button', 'btn btn-outline btn-sm', 'Sign Out');
    logoutBtn.type = 'button';
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/login';
    });
    navContainer.appendChild(logoutBtn);
  } else {
    const loginLink = createEl('a', 'btn btn-outline btn-sm', 'Sign In');
    loginLink.href = '/login';
    navContainer.appendChild(loginLink);

    const regLink = createEl('a', 'btn btn-sm', 'Register');
    regLink.href = '/register';
    navContainer.appendChild(regLink);
  }
}

export async function populateDepartmentSelect(selectId, includeAllLabel = '') {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const data = await apiRequest('/api/departments');
    clearEl(select);
    if (includeAllLabel) {
      const opt = createEl('option', '', includeAllLabel);
      opt.value = '';
      select.appendChild(opt);
    }
    (data.departments || []).forEach((dept) => {
      const opt = createEl('option', '', `${dept.name} (${dept.code})`);
      opt.value = dept.id;
      select.appendChild(opt);
    });
  } catch {
    clearEl(select);
    const opt = createEl('option', '', 'General / All Departments');
    opt.value = '';
    select.appendChild(opt);
  }
}

export async function renderNotificationsPanel(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const data = await apiRequest('/api/notifications');
    clearEl(container);
    const items = data.notifications || [];
    if (items.length === 0) {
      container.appendChild(createEl('p', 'subtitle', 'No notifications yet.'));
      return;
    }

    items.forEach((n) => {
      const row = createEl(
        'div',
        n.isRead === 'true' ? 'notif-item' : 'notif-item notif-unread'
      );
      row.appendChild(createEl('span', '', n.message));

      if (n.isRead !== 'true') {
        const btn = createEl('button', 'btn btn-outline btn-sm', 'Mark Read');
        btn.type = 'button';
        btn.addEventListener('click', async () => {
          await apiRequest('/api/notifications', {
            method: 'PATCH',
            body: { notificationId: n.id },
          });
          await renderNotificationsPanel(containerId);
        });
        row.appendChild(btn);
      }
      container.appendChild(row);
    });
  } catch {
    clearEl(container);
    container.appendChild(createEl('p', 'subtitle', 'Could not load notifications.'));
  }
}

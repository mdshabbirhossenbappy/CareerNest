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
      const msg = createEl('span', '', n.message);
      row.appendChild(msg);

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

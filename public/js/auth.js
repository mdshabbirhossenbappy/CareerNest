function showAlert(elementId, message, isSuccess = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = isSuccess ? 'alert alert-success' : 'alert alert-error';
  el.style.display = 'block';
}

function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

async function initLandingSession() {
  const sessionBox = document.getElementById('session-box');
  const guestBox = document.getElementById('guest-box');
  const userEmailEl = document.getElementById('user-email');
  const userRoleEl = document.getElementById('user-role');
  const logoutBtn = document.getElementById('logout-btn');

  if (!sessionBox || !guestBox) return;

  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
    });
    const result = await response.json();

    if (response.ok && result.success && result.data?.user) {
      userEmailEl.textContent = result.data.user.email;
      userRoleEl.textContent = result.data.user.role;
      guestBox.classList.add('hidden');
      sessionBox.classList.remove('hidden');
    } else {
      sessionBox.classList.add('hidden');
      guestBox.classList.remove('hidden');
    }
  } catch (_err) {
    sessionBox.classList.add('hidden');
    guestBox.classList.remove('hidden');
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.reload();
    });
  }
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('register-alert');

    const submitBtn = document.getElementById('register-submit');
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fullName, email, password, role }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        showAlert('register-alert', result.error || 'Registration failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        return;
      }

      showAlert('register-alert', 'Account created! Redirecting to login...', true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch (_err) {
      showAlert('register-alert', 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('login-alert');

    const submitBtn = document.getElementById('login-submit');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        showAlert('login-alert', result.error || 'Login failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        return;
      }

      showAlert('login-alert', 'Login successful! Redirecting...', true);
      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (_err) {
      showAlert('login-alert', 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLandingSession();
  initRegisterForm();
  initLoginForm();
});

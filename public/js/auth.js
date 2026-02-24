// ==================== AUTH.JS ====================
// Maneja login y registro

// Limpiar localStorage al cargar la página de login
// (el usuario llegó aquí porque hizo logout o es la primera vez)
localStorage.removeItem('currentUser');

// Temporary user storage for password change flow
let tempUser = null;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update forms
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById(tabName + 'Form').classList.add('active');
    
    // Clear message
    showMessage('', '');
  });
});

// Show message helper
function showMessage(text, type) {
  const messageEl = document.getElementById('authMessage');
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;
}

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }
    
    console.log('Login response:', data);
    
    // Check if user must change password
    if (data.mustChangePassword) {
      console.log('Showing password change modal');
      // Guardar usuario temporal para el modal
      tempUser = {
        id: data.userId,
        email: data.email,
        name: data.name
      };
      showChangePasswordModal();
    } else {
      console.log('Redirecting to dashboard.html');
      // Save user to localStorage and redirect
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    }
    
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userData = {
    name: document.getElementById('registerName').value,
    email: document.getElementById('registerEmail').value,
    password: document.getElementById('registerPassword').value,
    role: document.getElementById('registerRole').value,
    team: document.getElementById('registerTeam').value,
    hireDate: document.getElementById('registerHireDate').value
  };
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }
    
    // Save user and redirect
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

// Set default date for hire date field
document.getElementById('registerHireDate').valueAsDate = new Date();

// ==================== CHANGE PASSWORD ====================
function showChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.add('active');
}

// Password validation in real-time
document.getElementById('newPassword')?.addEventListener('input', (e) => {
  const password = e.target.value;
  
  // Check each requirement
  document.getElementById('req-length').classList.toggle('valid', password.length >= 8);
  document.getElementById('req-upper').classList.toggle('valid', /[A-Z]/.test(password));
  document.getElementById('req-lower').classList.toggle('valid', /[a-z]/.test(password));
  document.getElementById('req-number').classList.toggle('valid', /\d/.test(password));
  document.getElementById('req-special').classList.toggle('valid', /[@$!%*?&]/.test(password));
});

// Change password form submission
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('passwordError');
  
  // Check passwords match
  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Las contraseñas no coinciden';
    errorEl.className = 'message error';
    return;
  }
  
  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    errorEl.textContent = 'La contraseña no cumple con los requisitos';
    errorEl.className = 'message error';
    return;
  }
  
  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: tempUser.id,
        newPassword: newPassword
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }
    
    // Save user and redirect
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.className = 'message error';
  }
});

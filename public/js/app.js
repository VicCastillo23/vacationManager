// ==================== APP.JS ====================
// Main application logic for dashboard

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
  window.location.href = 'index.html';
}

// ==================== GLOBAL STATE ====================
let allUsers = [];
let allRequests = [];
let calendar = null;
let holidays = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // Set user info in header
  document.getElementById('userName').textContent = `${currentUser.name} (${getRoleName(currentUser.role)})`;
  
  // Hide employees section for regular employees
  if (currentUser.role === 'employee') {
    document.getElementById('navEmployees').style.display = 'none';
  }
  
  // Show bulk upload section only for administrators
  if (currentUser.role === 'administrator') {
    document.getElementById('navBulkUpload').style.display = 'flex';
  }
  
  // Setup navigation
  setupNavigation();
  
  // Setup mobile menu
  setupMobileMenu();
  
  // Setup logout
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Setup form events
  setupNewRequestForm();
  
  // Setup bulk upload (admin only)
  if (currentUser.role === 'administrator') {
    setupBulkUpload();
  }
  
  // Setup filters
  setupFilters();
  
  // Load initial data
  await loadData();
  
  // Update overview
  updateOverview();
  
  // Initialize calendar
  initializeCalendar();
}

// ==================== NAVIGATION ====================
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      
      // Update nav
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Update sections
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      
      // Close mobile menu after selection
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('mobile-visible');
      }
      
      // Load section data
      if (section === 'employees') loadEmployees();
      if (section === 'requests') loadRequests();
      if (section === 'new-request') updateAvailableDays();
      if (section === 'bulk-upload') resetBulkUploadForm();
    });
  });
}

function setupMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-visible');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && 
          !sidebar.contains(e.target) && 
          !menuToggle.contains(e.target) &&
          sidebar.classList.contains('mobile-visible')) {
        sidebar.classList.remove('mobile-visible');
      }
    });
  }
}

// ==================== DATA LOADING ====================
async function loadData() {
  await Promise.all([
    loadUsers(),
    loadRequestsData(),
    loadHolidays()
  ]);
}

async function loadUsers() {
  try {
    const params = new URLSearchParams({
      userId: currentUser.id,
      role: currentUser.role,
      team: currentUser.team
    });
    
    const response = await fetch(`/api/users?${params}`);
    allUsers = await response.json();
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

async function loadRequestsData() {
  try {
    const params = new URLSearchParams({
      userId: currentUser.id,
      role: currentUser.role,
      team: currentUser.team
    });
    
    const response = await fetch(`/api/requests?${params}`);
    allRequests = await response.json();
  } catch (error) {
    console.error('Error loading requests:', error);
  }
}

async function loadHolidays() {
  try {
    const response = await fetch('/api/holidays');
    holidays = await response.json();
  } catch (error) {
    console.error('Error loading holidays:', error);
  }
}

// ==================== OVERVIEW ====================
function updateOverview() {
  // Get fresh user data
  const user = allUsers.find(u => u.id === currentUser.id) || currentUser;
  
  // Calculate months of service
  const hireDate = new Date(user.hireDate);
  const today = new Date();
  const totalMonths = (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  let timeServiceText = '';
  if (years > 0 && months > 0) {
    timeServiceText = `${years} año${years > 1 ? 's' : ''} y ${months} mes${months !== 1 ? 'es' : ''}`;
  } else if (years > 0) {
    timeServiceText = `${years} año${years > 1 ? 's' : ''}`;
  } else {
    timeServiceText = `${months} mes${months !== 1 ? 'es' : ''}`;
  }
  
  // Stats - Vacaciones
  document.getElementById('vacationDays').textContent = user.vacationDays;
  
  // Stats - PTO
  document.getElementById('ptoDays').textContent = user.ptoDays;
  
  // Show total vacation days and years of service
  const totalVacEl = document.getElementById('totalVacationDays');
  if (totalVacEl && user.totalVacationDays) {
    totalVacEl.textContent = `de ${user.totalVacationDays} totales (${timeServiceText} de servicio)`;
  }
  
  // Show total PTO days
  const totalPtoEl = document.getElementById('totalPtoDays');
  if (totalPtoEl) {
    totalPtoEl.textContent = `disponibles de ${user.ptoDays}/5 totales`;
  }
  
  const myRequests = allRequests.filter(r => r.userId === currentUser.id);
  document.getElementById('pendingRequests').textContent = myRequests.filter(r => r.status === 'pending').length;
  document.getElementById('approvedRequests').textContent = myRequests.filter(r => r.status === 'approved').length;
  
  // Info
  document.getElementById('infoName').textContent = user.name;
  document.getElementById('infoEmail').textContent = user.email;
  document.getElementById('infoRole').textContent = getRoleName(user.role);
  document.getElementById('infoTeam').textContent = user.team;
  document.getElementById('infoHireDate').textContent = formatDate(user.hireDate);
  
  // Update localStorage with fresh data
  localStorage.setItem('currentUser', JSON.stringify(user));
  
  // Show pending approvals for managers/directors/administrators
  if (currentUser.role === 'manager' || currentUser.role === 'director' || currentUser.role === 'administrator') {
    showPendingApprovals();
  }
}

function showPendingApprovals() {
  const section = document.getElementById('pendingApprovalsSection');
  const list = document.getElementById('pendingApprovalsList');
  
  // Filter pending requests that this user can approve
  let pendingApprovals = allRequests.filter(r => {
    if (r.status !== 'pending') return false;
    if (r.userId === currentUser.id) return false; // Can't approve own requests
    
    if (currentUser.role === 'director' || currentUser.role === 'administrator') {
      // Directors and Administrators approve manager/employee requests
      return r.userRole === 'manager' || r.userRole === 'employee';
    } else if (currentUser.role === 'manager') {
      // Managers approve employee requests in their team
      const requestUser = allUsers.find(u => u.id === r.userId);
      return requestUser && requestUser.team === currentUser.team && r.userRole === 'employee';
    }
    return false;
  });
  
  if (pendingApprovals.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  list.innerHTML = pendingApprovals.map(r => `
    <div class="approval-item">
      <h4>${r.userName} - ${r.type === 'vacation' ? '<i class="fa-solid fa-umbrella-beach"></i> Vacaciones' : '<i class="fa-solid fa-calendar-day"></i> PTO'}</h4>
      <p>Fechas: ${formatDate(r.startDate)} - ${formatDate(r.endDate)} (${r.days} días)</p>
      ${r.comments ? `<p>Comentarios: ${r.comments}</p>` : ''}
      <div class="approval-actions">
        <button class="btn btn-success btn-sm" onclick="approveRequest('${r.id}')"><i class="fa-solid fa-check"></i> Aprobar</button>
        <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')"><i class="fa-solid fa-xmark"></i> Rechazar</button>
      </div>
    </div>
  `).join('');
}

// ==================== EMPLOYEES ====================
async function loadEmployees() {
  await loadUsers();
  
  // Load teams for filter
  const teamFilter = document.getElementById('filterTeam');
  const teams = [...new Set(allUsers.map(u => u.team))];
  teamFilter.innerHTML = '<option value="">Todos los equipos</option>' + 
    teams.map(t => `<option value="${t}">${t}</option>`).join('');
  
  renderEmployeesTable();
}

function renderEmployeesTable() {
  const filterTeam = document.getElementById('filterTeam').value;
  const filterRole = document.getElementById('filterRole').value;
  
  let filtered = allUsers;
  if (filterTeam) filtered = filtered.filter(u => u.team === filterTeam);
  if (filterRole) filtered = filtered.filter(u => u.role === filterRole);
  
  const tbody = document.getElementById('employeesTable');
  const isAdmin = currentUser.role === 'administrator';
  
  // Hide actions header - no longer needed
  const actionsHeader = document.getElementById('employeeActionsHeader');
  if (actionsHeader) {
    actionsHeader.style.display = 'none';
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p>No hay empleados para mostrar</p></td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtered.map(user => `
    <tr data-user-id="${user.id}" class="${isAdmin ? 'editable-row' : ''}" ondblclick="${isAdmin ? `startEditingUser('${user.id}')` : ''}">
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="role-badge role-${user.role}">${getRoleName(user.role)}</span></td>
      <td>${user.team}</td>
      <td>${formatDate(user.hireDate)}</td>
      <td>${user.vacationDays}</td>
      <td>${user.ptoDays}</td>
    </tr>
  `).join('');
}

// ==================== REQUESTS ====================
async function loadRequests() {
  await loadRequestsData();
  renderRequestsTable();
}

function renderRequestsTable() {
  const filterStatus = document.getElementById('filterStatus').value;
  const filterType = document.getElementById('filterType').value;
  
  let filtered = allRequests;
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);
  if (filterType) filtered = filtered.filter(r => r.type === filterType);
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const tbody = document.getElementById('requestsTable');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No hay solicitudes para mostrar</p></td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(r => {
    const canApprove = canUserApprove(r);
    const canDelete = r.userId === currentUser.id && r.status === 'pending';
    
    return `
      <tr>
        <td>${r.userName}</td>
        <td>${r.type === 'vacation' ? '<i class="fa-solid fa-umbrella-beach icon-type"></i> Vacaciones' : '<i class="fa-solid fa-calendar-day icon-type"></i> PTO'}</td>
        <td>${formatDate(r.startDate)}</td>
        <td>${formatDate(r.endDate)}</td>
        <td>${r.days}</td>
        <td><span class="status status-${r.status}">${getStatusName(r.status)}</span></td>
        <td>
          <div class="action-buttons">
            ${canApprove ? `
              <button class="btn btn-success btn-sm" onclick="approveRequest('${r.id}')"><i class="fa-solid fa-check"></i></button>
              <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-outline btn-sm" onclick="deleteRequest('${r.id}')"><i class="fa-solid fa-trash"></i></button>
            ` : ''}
            ${!canApprove && !canDelete ? '-' : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function canUserApprove(request) {
  if (request.status !== 'pending') return false;
  if (request.userId === currentUser.id) return false;
  
  if (currentUser.role === 'director' || currentUser.role === 'administrator') {
    return true; // Directors and Administrators can approve all
  } else if (currentUser.role === 'manager') {
    // Managers can approve employee requests in their team
    const requestUser = allUsers.find(u => u.id === request.userId);
    return requestUser && requestUser.team === currentUser.team && request.userRole === 'employee';
  }
  return false;
}

// ==================== REQUEST ACTIONS ====================
async function approveRequest(requestId) {
  try {
    const response = await fetch(`/api/requests/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'approved',
        approverId: currentUser.id,
        approverName: currentUser.name
      })
    });
    
    if (response.ok) {
      await loadData();
      updateOverview();
      renderRequestsTable();
      refreshCalendar();
      showModal('success', '¡Solicitud Aprobada!', 'La solicitud ha sido aprobada exitosamente.');
    }
  } catch (error) {
    console.error('Error approving request:', error);
    showModal('error', 'Error', 'No se pudo aprobar la solicitud. Inténtalo de nuevo.');
  }
}

async function rejectRequest(requestId) {
  showModal('confirm', 'Rechazar Solicitud', '¿Estás seguro de que deseas rechazar esta solicitud?', async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          approverId: currentUser.id,
          approverName: currentUser.name
        })
      });
      
      if (response.ok) {
        await loadData();
        updateOverview();
        renderRequestsTable();
        refreshCalendar();
        showModal('success', 'Solicitud Rechazada', 'La solicitud ha sido rechazada.');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      showModal('error', 'Error', 'No se pudo rechazar la solicitud.');
    }
  });
}

async function deleteRequest(requestId) {
  showModal('confirm', 'Eliminar Solicitud', '¿Estás seguro de que deseas eliminar esta solicitud?', async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadData();
        updateOverview();
        renderRequestsTable();
        refreshCalendar();
        showModal('success', 'Solicitud Eliminada', 'La solicitud ha sido eliminada correctamente.');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      showModal('error', 'Error', 'No se pudo eliminar la solicitud.');
    }
  });
}

// ==================== NEW REQUEST ====================
function setupNewRequestForm() {
  const startDate = document.getElementById('requestStartDate');
  const endDate = document.getElementById('requestEndDate');
  const daysInput = document.getElementById('requestDays');
  const typeSelect = document.getElementById('requestType');
  
  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  startDate.min = today;
  endDate.min = today;
  
  // Calculate business days (excluding weekends)
  function calculateDays() {
    if (startDate.value && endDate.value) {
      const start = parseLocalDate(startDate.value);
      const end = parseLocalDate(endDate.value);
      
      let businessDays = 0;
      const current = new Date(start);
      
      while (current <= end) {
        const dayOfWeek = current.getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays++;
        }
        current.setDate(current.getDate() + 1);
      }
      
      daysInput.value = businessDays > 0 ? businessDays : 0;
    }
  }
  
  startDate.addEventListener('change', () => {
    validateBusinessDay(startDate);
    endDate.min = startDate.value;
    calculateDays();
  });
  
  endDate.addEventListener('change', () => {
    validateBusinessDay(endDate);
    calculateDays();
  });
  
  // Update available days when type changes
  typeSelect.addEventListener('change', () => {
    updateAvailableDays();
    togglePTOWarning();
  });
  
  // Form submission
  document.getElementById('newRequestForm').addEventListener('submit', submitRequest);
}

// Validate that selected date is a business day
function validateBusinessDay(inputElement) {
  if (!inputElement.value) return;
  
  const selectedDate = parseLocalDate(inputElement.value);
  const dayOfWeek = selectedDate.getDay();
  const dateStr = inputElement.value;
  
  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const dayName = dayOfWeek === 0 ? 'domingo' : 'sábado';
    showModal('warning', 'Día no laborable', `No puedes seleccionar ${dayName}. Por favor selecciona un día laborable (lunes a viernes).`);
    inputElement.value = '';
    return false;
  }
  
  // Check if it's a holiday
  const isHolidayDate = holidays.some(h => h.date === dateStr);
  if (isHolidayDate) {
    const holiday = holidays.find(h => h.date === dateStr);
    showModal('warning', 'Día festivo', `${formatDate(dateStr)} es ${holiday.name}, un día festivo. Por favor selecciona otro día.`);
    inputElement.value = '';
    return false;
  }
  
  return true;
}

function updateAvailableDays() {
  const type = document.getElementById('requestType').value;
  const user = allUsers.find(u => u.id === currentUser.id) || currentUser;
  const availableInfoEl = document.getElementById('availableDaysInfo');
  
  if (type === 'vacation') {
    const total = user.totalVacationDays || 15;
    availableInfoEl.innerHTML = `<strong>${user.vacationDays}</strong> de <strong>${total}</strong> días disponibles (${user.yearsOfService || 0} años de antigüedad)`;
  } else if (type === 'pto') {
    availableInfoEl.innerHTML = `<strong>${user.ptoDays}</strong> de <strong>5</strong> días personales disponibles`;
  } else {
    // Para otros tipos de ausencias, no mostrar días disponibles
    availableInfoEl.innerHTML = '<em>No consume días de vacaciones ni PTO</em>';
  }
}

function togglePTOWarning() {
  const type = document.getElementById('requestType').value;
  const typeInfo = document.getElementById('typeInfo');
  if (!typeInfo) return;
  
  const typeInfoMap = {
    'vacation': '<i class="fa-solid fa-info-circle"></i> Solicita con 3 días de anticipación. Mínimo 5 días consecutivos una vez al año.',
    'pto': '<i class="fa-solid fa-triangle-exclamation"></i> Máximo 2 días laborables. Solicita con 3 días de anticipación.',
    'marriage': '<i class="fa-solid fa-heart"></i> 5 días hábiles desde el día laboral siguiente al evento.',
    'maternity': '<i class="fa-solid fa-baby"></i> 84 días naturales. Requiere incapacidad IMSS.',
    'paternity': '<i class="fa-solid fa-baby-carriage"></i> 15 días hábiles desde el nacimiento.',
    'birthday': '<i class="fa-solid fa-cake-candles"></i> 1 día en tu cumpleaños (movible si cae en fin de semana).',
    'death-immediate': '<i class="fa-solid fa-ribbon"></i> 5 días hábiles (padre, madre, hijo, hermano, cónyuge).',
    'death-family': '<i class="fa-solid fa-ribbon"></i> 3 días hábiles (abuelos, tíos).',
    'pet-death': '<i class="fa-solid fa-paw"></i> 1 día hábil dentro de 2 días del fallecimiento.',
    'medical-leave': '<i class="fa-solid fa-notes-medical"></i> Requiere incapacidad del IMSS.',
    'special': '<i class="fa-solid fa-file-contract"></i> Requiere autorización del Director del Área.'
  };
  
  typeInfo.innerHTML = typeInfoMap[type] || '';
  typeInfo.style.color = type === 'pto' ? '#f59e0b' : '#64748b';
}

async function submitRequest(e) {
  e.preventDefault();
  
  const type = document.getElementById('requestType').value;
  const startDate = document.getElementById('requestStartDate').value;
  const endDate = document.getElementById('requestEndDate').value;
  const days = parseInt(document.getElementById('requestDays').value);
  const comments = document.getElementById('requestComments').value;
  
  // Validate at least one business day
  if (days === 0) {
    showModal('warning', 'Sin días laborables', 'El rango seleccionado no incluye días laborables. Los fines de semana no se cuentan.');
    return;
  }
  
  // Validate 3 days advance notice for vacation and PTO
  if (type === 'vacation' || type === 'pto') {
    const start = parseLocalDate(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 3) {
      showModal('error', 'Anticipación requerida', 'Las solicitudes de vacaciones y días personales deben hacerse con al menos 3 días de anticipación.');
      return;
    }
  }
  
  // Validate PTO max 2 days
  if (type === 'pto' && days > 2) {
    showModal('error', 'Límite de PTO excedido', 'Las solicitudes de PTO no pueden ser de más de 2 días laborables seguidos.');
    return;
  }
  
  // Validate available days
  const user = allUsers.find(u => u.id === currentUser.id) || currentUser;
  const available = type === 'vacation' ? user.vacationDays : user.ptoDays;
  
  if (days > available) {
    showModal('error', 'Días insuficientes', `No tienes suficientes días disponibles. Tienes ${available} días laborables de ${type === 'vacation' ? 'vacaciones' : 'PTO'}.`);
    return;
  }
  
  try {
    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        type,
        startDate,
        endDate,
        days,
        comments
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('newRequestForm').reset();
      
      // Reload data
      await loadData();
      updateOverview();
      refreshCalendar();
      
      showModal('success', '¡Solicitud Enviada!', 'Tu solicitud ha sido enviada y está pendiente de aprobación.');
      
      // Navigate to requests after modal closes
      setTimeout(() => {
        document.querySelector('[data-section="requests"]').click();
      }, 1500);
    } else {
      // Handle overlap error
      if (data.conflictWith) {
        const conflict = data.conflictWith;
        showModal('error', 'Fechas en Conflicto', 
          `Ya tienes una solicitud del ${formatDate(conflict.startDate)} al ${formatDate(conflict.endDate)}. Las fechas no pueden empalarse.`);
      } else {
        showModal('error', 'Error', data.error || 'No se pudo enviar la solicitud.');
      }
    }
  } catch (error) {
    console.error('Error submitting request:', error);
    showModal('error', 'Error', 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
  }
}

// ==================== FILTERS ====================
function setupFilters() {
  document.getElementById('filterTeam')?.addEventListener('change', renderEmployeesTable);
  document.getElementById('filterRole')?.addEventListener('change', renderEmployeesTable);
  document.getElementById('filterStatus')?.addEventListener('change', renderRequestsTable);
  document.getElementById('filterType')?.addEventListener('change', renderRequestsTable);
}

// ==================== CALENDAR ====================
function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana'
    },
    events: getCalendarEvents(),
    eventClick: function(info) {
      const event = info.event;
      const props = event.extendedProps;
      showModal('confirm', event.title, 
        `Tipo: ${props.type === 'vacation' ? 'Vacaciones' : 'PTO'}\nFechas: ${formatDate(event.startStr)} - ${formatDate(props.endDate)}\nDías: ${props.days}\nEstado: ${getStatusName(props.status)}`,
        null
      );
    },
    height: 'auto'
  });
  
  calendar.render();
}

function getCalendarEvents() {
  let events = [];
  
  // Add holidays to calendar
  holidays.forEach(h => {
    // Add background color for the full day
    events.push({
      start: h.date,
      end: h.date,
      allDay: true,
      display: 'background',
      backgroundColor: '#fef3c7',
      extendedProps: {
        type: 'holiday-background',
        holidayName: h.name
      }
    });
    
    // Add holiday label as regular event
    events.push({
      title: `🎉 ${h.name}`,
      start: h.date,
      allDay: true,
      className: 'holiday-label',
      backgroundColor: '#f59e0b',
      borderColor: '#d97706',
      textColor: '#ffffff',
      extendedProps: {
        type: 'holiday',
        holidayName: h.name
      }
    });
  });
  
  // Get requests to show based on role
  let requestsToShow = [];
  
  if (currentUser.role === 'director' || currentUser.role === 'administrator') {
    // Director and Administrator see all requests
    requestsToShow = allRequests.filter(r => r.status === 'approved' || r.status === 'pending');
  } else if (currentUser.role === 'manager') {
    // Manager sees their team's requests + their own
    const teamUserIds = allUsers.filter(u => u.team === currentUser.team).map(u => u.id);
    requestsToShow = allRequests.filter(r => 
      (teamUserIds.includes(r.userId) || r.userId === currentUser.id) &&
      (r.status === 'approved' || r.status === 'pending')
    );
  } else {
    // Employee sees only their own
    requestsToShow = allRequests.filter(r => 
      r.userId === currentUser.id &&
      (r.status === 'approved' || r.status === 'pending')
    );
  }
  
  // Convert to calendar events
  requestsToShow.forEach(r => {
    const className = `${r.type}-${r.status}`;
    const statusIcon = r.status === 'pending' ? '⏳ ' : '';
    
    events.push({
      title: `${statusIcon}${r.userName}`,
      start: r.startDate,
      end: addOneDay(r.endDate), // FullCalendar end date is exclusive
      className: className,
      extendedProps: {
        type: r.type,
        status: r.status,
        days: r.days,
        endDate: r.endDate,
        userId: r.userId
      }
    });
  });
  
  return events;
}

function addOneDay(dateStr) {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshCalendar() {
  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(getCalendarEvents());
  }
}

// ==================== MODAL SYSTEM ====================
function showModal(type, title, message, onConfirm = null) {
  const modal = document.getElementById('customModal');
  const icon = document.getElementById('modalIcon');
  const titleEl = document.getElementById('modalTitle');
  const messageEl = document.getElementById('modalMessage');
  const actions = document.getElementById('modalActions');
  
  // Set icon based on type
  const icons = {
    success: '<i class="fa-solid fa-check"></i>',
    error: '<i class="fa-solid fa-xmark"></i>',
    warning: '<i class="fa-solid fa-exclamation"></i>',
    confirm: '<i class="fa-solid fa-question"></i>'
  };
  
  icon.className = 'custom-modal-icon ' + type;
  icon.innerHTML = icons[type] || icons.success;
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  // Set buttons based on type
  if (type === 'confirm') {
    actions.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="confirmBtn">Confirmar</button>
    `;
    document.getElementById('confirmBtn').onclick = () => {
      closeModal();
      if (onConfirm) onConfirm();
    };
  } else {
    actions.innerHTML = `
      <button class="btn btn-primary" onclick="closeModal()">Aceptar</button>
    `;
  }
  
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('customModal').classList.remove('active');
}

// Close modal on backdrop click
document.getElementById('customModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'customModal') closeModal();
});

// ==================== HELPERS ====================
function getRoleName(role) {
  const roles = {
    director: 'Director',
    manager: 'Manager',
    employee: 'Empleado',
    administrator: 'Administrador'
  };
  return roles[role] || role;
}

function getStatusName(status) {
  const statuses = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada'
  };
  return statuses[status] || status;
}

// Helper para crear fecha local desde string YYYY-MM-DD sin problemas de timezone
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper: Calcular años de servicio desde una fecha
function calculateYearsFromDate(hireDate) {
  const hire = parseLocalDate(hireDate);
  const today = new Date();
  return Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
}

// Helper: Calcular días de vacaciones según fecha de contratación
function calculateVacationDaysFromDate(hireDate) {
  const yearsOfService = calculateYearsFromDate(hireDate);
  
  if (yearsOfService < 1) return 12;
  if (yearsOfService === 1) return 12;
  if (yearsOfService === 2) return 16;
  if (yearsOfService === 3) return 18;
  if (yearsOfService === 4) return 20;
  if (yearsOfService === 5) return 22;
  if (yearsOfService >= 6 && yearsOfService <= 9) return 24;
  if (yearsOfService >= 10 && yearsOfService <= 14) return 26;
  if (yearsOfService >= 15 && yearsOfService <= 19) return 28;
  if (yearsOfService >= 20 && yearsOfService <= 24) return 30;
  if (yearsOfService >= 25 && yearsOfService <= 29) return 32;
  if (yearsOfService >= 30) return 34;
  return 12;
}

// Helper: Obtener período de aniversario actual (misma lógica que el servidor)
function getCurrentVacationPeriodClient(hireDate) {
  const hire = parseLocalDate(hireDate);
  const today = new Date();
  
  const periodStart = new Date(hire);
  periodStart.setFullYear(today.getFullYear());
  
  if (periodStart > today) {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }
  
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);
  
  const fmt = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// ==================== BULK UPLOAD (ADMIN) ====================
function setupBulkUpload() {
  // Template download
  document.getElementById('downloadTemplate').addEventListener('click', (e) => {
    e.preventDefault();
    downloadExcelTemplate();
  });
  
  // Form submission
  document.getElementById('bulkUploadForm').addEventListener('submit', handleBulkUpload);
}

function downloadExcelTemplate() {
  // Create sample data for the template
  const sampleData = [
    ['Nombre', 'Email', 'Equipo', 'Fecha de Ingreso', 'Rol', 'PTO Días Tomados', 'Vacaciones Días Tomadas'],
    ['Juan Pérez', 'juan.perez@example.com', 'Desarrollo', '2023-01-15', 'employee', '0', '0'],
    ['María García', 'maria.garcia@example.com', 'Marketing', '2022-06-20', 'manager', '2', '5'],
  ];
  
  // Create CSV content
  const csvContent = sampleData.map(row => row.join(',')).join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'plantilla_empleados.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function handleBulkUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('excelFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showModal('error', 'Error', 'Por favor selecciona un archivo Excel.');
    return;
  }
  
  // Validate file type
  const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
  if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    showModal('error', 'Error', 'Por favor selecciona un archivo Excel válido (.xlsx o .xls).');
    return;
  }
  
  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    showModal('error', 'Error', 'El archivo es demasiado grande. El tamaño máximo es 5MB.');
    return;
  }
  
  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...';
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userRole', currentUser.role);
    
    const response = await fetch('/api/admin/bulk-upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      displayUploadResults(data);
      
      // Reload data
      await loadData();
      updateOverview();
      
      showModal('success', '¡Carga Completada!', 
        `Se procesaron ${data.summary.total} registros: ${data.summary.created} creados, ${data.summary.updated} actualizados, ${data.summary.errors} errores.`);
      
      // Reset form
      fileInput.value = '';
    } else {
      showModal('error', 'Error', data.error || 'No se pudo procesar el archivo.');
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    showModal('error', 'Error', 'Error al cargar el archivo. Por favor inténtalo de nuevo.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function displayUploadResults(data) {
  const resultsDiv = document.getElementById('uploadResults');
  const summaryDiv = document.getElementById('uploadSummary');
  const detailsDiv = document.getElementById('uploadDetails');
  
  // Show summary stats
  summaryDiv.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon"><i class="fa-solid fa-file-import"></i></div>
      <div class="stat-info">
        <span class="stat-value">${data.summary.total}</span>
        <span class="stat-label">Total Procesados</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background: #10b981;"><i class="fa-solid fa-user-plus"></i></div>
      <div class="stat-info">
        <span class="stat-value">${data.summary.created}</span>
        <span class="stat-label">Creados</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background: #3b82f6;"><i class="fa-solid fa-user-pen"></i></div>
      <div class="stat-info">
        <span class="stat-value">${data.summary.updated}</span>
        <span class="stat-label">Actualizados</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="stat-info">
        <span class="stat-value">${data.summary.errors}</span>
        <span class="stat-label">Errores</span>
      </div>
    </div>
  `;
  
  // Show details
  let detailsHTML = '';
  
  if (data.details.created.length > 0) {
    detailsHTML += '<h4 style="color: #10b981; margin-top: 20px;"><i class="fa-solid fa-user-plus"></i> Usuarios Creados</h4>';
    detailsHTML += '<ul style="margin: 8px 0; padding-left: 20px;">';
    data.details.created.forEach(item => {
      detailsHTML += `<li>${item.name} (${item.email}) - Contraseña temporal: <strong>${item.tempPassword}</strong></li>`;
    });
    detailsHTML += '</ul>';
  }
  
  if (data.details.updated.length > 0) {
    detailsHTML += '<h4 style="color: #3b82f6; margin-top: 20px;"><i class="fa-solid fa-user-pen"></i> Usuarios Actualizados</h4>';
    detailsHTML += '<ul style="margin: 8px 0; padding-left: 20px;">';
    data.details.updated.forEach(item => {
      detailsHTML += `<li>${item.name} (${item.email})</li>`;
    });
    detailsHTML += '</ul>';
  }
  
  if (data.details.errors.length > 0) {
    detailsHTML += '<h4 style="color: #ef4444; margin-top: 20px;"><i class="fa-solid fa-triangle-exclamation"></i> Errores</h4>';
    detailsHTML += '<ul style="margin: 8px 0; padding-left: 20px;">';
    data.details.errors.forEach(error => {
      detailsHTML += `<li>Fila ${error.row} (${error.email}): ${error.error}</li>`;
    });
    detailsHTML += '</ul>';
  }
  
  detailsDiv.innerHTML = detailsHTML;
  resultsDiv.style.display = 'block';
}

function resetBulkUploadForm() {
  document.getElementById('bulkUploadForm')?.reset();
  document.getElementById('uploadResults').style.display = 'none';
}

// ==================== USER EDITING (ADMIN) ====================
let editingUserId = null;

function startEditingUser(userId) {
  if (currentUser.role !== 'administrator') return;
  
  const user = allUsers.find(u => u.id === userId);
  if (!user) {
    showModal('error', 'Error', 'Usuario no encontrado');
    return;
  }
  
  editingUserId = userId;
  
  // Obtener solicitudes previas aprobadas del usuario
  const pastRequests = allRequests.filter(r => 
    r.userId === userId && r.status === 'approved'
  ).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  
  const pastRequestsHTML = pastRequests.length > 0 
    ? pastRequests.map(r => `
        <div class="backfill-existing-item">
          <span class="backfill-type-badge ${r.type}">${r.type === 'vacation' ? 'Vacaciones' : 'PTO'}</span>
          <span>${formatDate(r.startDate)} - ${formatDate(r.endDate)}</span>
          <span><strong>${r.days}</strong> días</span>
          ${r.backfill ? '<span class="backfill-badge">Llenado previo</span>' : ''}
        </div>
      `).join('')
    : '<p style="color: #94a3b8; font-style: italic; margin: 8px 0;">No hay solicitudes previas registradas</p>';
  
  // Crear modal dinámicamente con mejor estructura
  const modalHTML = `
    <div class="edit-modal-backdrop" id="editModalBackdrop" onclick="cancelEditUser()">
      <div class="edit-modal-box" onclick="event.stopPropagation()">
        <div class="edit-modal-header">
          <h3><i class="fa-solid fa-user-pen"></i> Editar Usuario: ${user.name}</h3>
          <button class="close-btn" onclick="cancelEditUser()">&times;</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-form-grid">
            <div class="edit-field">
              <label>Nombre</label>
              <input type="text" id="edit_name" value="${user.name}" />
            </div>
            <div class="edit-field">
              <label>Email</label>
              <input type="email" id="edit_email" value="${user.email}" />
            </div>
            <div class="edit-field">
              <label>Rol</label>
              <select id="edit_role">
                <option value="employee" ${user.role === 'employee' ? 'selected' : ''}>Empleado</option>
                <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                <option value="director" ${user.role === 'director' ? 'selected' : ''}>Director</option>
                <option value="administrator" ${user.role === 'administrator' ? 'selected' : ''}>Administrador</option>
              </select>
            </div>
            <div class="edit-field">
              <label>Equipo</label>
              <input type="text" id="edit_team" value="${user.team}" />
            </div>
            <div class="edit-field">
              <label>Fecha de Contratación</label>
              <input type="date" id="edit_hireDate" value="${user.hireDate}" />
            </div>
            <div class="edit-field">
              <label>Días Vacaciones</label>
              <input type="text" id="edit_vacationDays" value="${user.vacationDays}" readonly style="background-color: #f1f5f9; cursor: not-allowed; color: #64748b;" />
              <small style="color: #3b82f6; font-size: 0.75rem; margin-top: 4px; display: block;">
                <i class="fa-solid fa-calculator"></i> Se recalcula al cambiar fecha de contratación
              </small>
            </div>
            <div class="edit-field">
              <label>Días PTO</label>
              <input type="number" id="edit_ptoDays" value="${user.ptoDays}" min="0" max="5" />
            </div>
            <div class="edit-field">
              <label>Nueva Contraseña (opcional)</label>
              <input type="password" id="edit_password" placeholder="Dejar vacío para no cambiar" />
            </div>
          </div>
          
          <!-- Sección de Llenado Previo -->
          <div class="backfill-section">
            <div class="backfill-header">
              <h4><i class="fa-solid fa-clock-rotate-left"></i> Llenado Previo de Vacaciones</h4>
              <small>Registra vacaciones o PTO que el empleado ya tomó antes de usar el sistema</small>
            </div>
            
            <div class="backfill-existing">
              <h5>Solicitudes registradas</h5>
              ${pastRequestsHTML}
            </div>
            
            <div id="backfillEntries"></div>
            
            <button type="button" class="backfill-add-btn" onclick="addBackfillEntry()">
              <i class="fa-solid fa-plus"></i> Agregar vacación previa
            </button>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn-cancel" onclick="cancelEditUser()">
            <i class="fa-solid fa-times"></i> Cancelar
          </button>
          <button class="btn-confirm" onclick="confirmEditUser()">
            <i class="fa-solid fa-check"></i> Guardar
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Agregar listener para recalcular días al cambiar fecha de contratación
  const hireDateInput = document.getElementById('edit_hireDate');
  const vacationDaysInput = document.getElementById('edit_vacationDays');
  
  hireDateInput.addEventListener('change', async () => {
    if (!hireDateInput.value) return;
    
    // Calcular días totales según antigüedad
    const totalDays = calculateVacationDaysFromDate(hireDateInput.value);
    
    // Obtener período actual basado en la nueva fecha de contratación
    const { periodStart, periodEnd } = getCurrentVacationPeriodClient(hireDateInput.value);
    
    // Contar solo días usados en el período actual
    const userRequests = allRequests.filter(r => 
      r.userId === userId && 
      r.type === 'vacation' && 
      (r.status === 'approved' || r.status === 'pending') &&
      r.startDate >= periodStart && r.startDate <= periodEnd
    );
    
    const daysUsed = userRequests.reduce((sum, r) => sum + r.days, 0);
    const daysAvailable = totalDays - daysUsed;
    
    // Actualizar el campo
    vacationDaysInput.value = Math.max(0, daysAvailable);
    
    // Mostrar información al usuario
    const years = calculateYearsFromDate(hireDateInput.value);
    const yearsText = years === 1 ? '1 año' : `${years} años`;
    showModal('success', 'Días Recalculados', 
      `Según ${yearsText} de antigüedad:\n` +
      `• Período: ${formatDate(periodStart)} - ${formatDate(periodEnd)}\n` +
      `• Días totales: ${totalDays}\n` +
      `• Días usados (período actual): ${daysUsed}\n` +
      `• Días disponibles: ${daysAvailable}`);
  });
}

function cancelEditUser() {
  const backdrop = document.getElementById('editModalBackdrop');
  if (backdrop) {
    backdrop.remove();
  }
  editingUserId = null;
}

async function confirmEditUser() {
  if (!editingUserId) return;
  
  const name = document.getElementById('edit_name').value;
  const email = document.getElementById('edit_email').value;
  const role = document.getElementById('edit_role').value;
  const team = document.getElementById('edit_team').value;
  const hireDate = document.getElementById('edit_hireDate').value;
  const password = document.getElementById('edit_password').value;
  
  // Validaciones
  if (!name || !email || !team) {
    showModal('error', 'Error', 'Nombre, email y equipo son requeridos');
    return;
  }
  
  try {
    const updateData = {
      name,
      email,
      role,
      team,
      hireDate,
      requestingUserRole: currentUser.role
    };
    
    if (password) {
      updateData.password = password;
    }
    
    const response = await fetch(`/api/users/${editingUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      // Puede ser HTML u otro formato
    }

    if (!response.ok) {
      const msg = data.error || `No se pudo actualizar el usuario (HTTP ${response.status}).`;
      showModal('error', 'Error', msg);
      return;
    }

    // Enviar entradas de backfill si hay
    const backfillEntries = getBackfillEntries();
    let backfillMsg = '';

    if (backfillEntries.length > 0) {
      try {
        const bfResponse = await fetch('/api/requests/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingUserId,
            userName: name,
            entries: backfillEntries,
            requestingUserRole: currentUser.role,
            approverId: currentUser.id,
            approverName: currentUser.name
          })
        });

        const bfRaw = await bfResponse.text();
        let bfData = {};
        try {
          bfData = bfRaw ? JSON.parse(bfRaw) : {};
        } catch (e) {
          // Puede ser HTML u otro formato
        }

        if (bfResponse.ok) {
          backfillMsg = `\n${bfData.created} vacación(es) previa(s) registrada(s).`;
          if (bfData.errors?.length > 0) {
            backfillMsg += ` ${bfData.errors.length} error(es).`;
          }
        } else {
          backfillMsg = `\nError al registrar vacaciones previas: ${bfData.error || `HTTP ${bfResponse.status}`}`;
        }
      } catch (error) {
        console.error('Error backfill:', error);
        backfillMsg = '\nError al registrar vacaciones previas. Inténtalo de nuevo.';
      }
    }
    
    cancelEditUser();
    await loadData();
    await loadEmployees();
    showModal('success', '¡Usuario Actualizado!', `Los datos de ${name} han sido actualizados correctamente.${backfillMsg}`);
  } catch (error) {
    console.error('Error updating user:', error);
    showModal('error', 'Error', 'No se pudo actualizar el usuario. Inténtalo de nuevo.');
  }
}

// ==================== BACKFILL (LLENADO PREVIO) ====================
let backfillCounter = 0;

function addBackfillEntry() {
  const container = document.getElementById('backfillEntries');
  if (!container) return;
  
  const id = backfillCounter++;
  const today = new Date().toISOString().split('T')[0];
  
  const entryHTML = `
    <div class="backfill-entry" id="backfillEntry_${id}">
      <div class="backfill-entry-header">
        <span>Nueva entrada</span>
        <button type="button" class="backfill-remove-btn" onclick="removeBackfillEntry(${id})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div class="backfill-entry-fields">
        <div class="backfill-field">
          <label>Tipo</label>
          <select id="bf_type_${id}">
            <optgroup label="🏖️ Días Regulares">
              <option value="vacation">🏖️ Vacaciones</option>
              <option value="pto">📅 Día Personal (PTO)</option>
            </optgroup>
            <optgroup label="💍 Eventos Personales">
              <option value="marriage">💍 Matrimonio (5 días)</option>
              <option value="maternity">👶 Maternidad (84 días)</option>
              <option value="paternity">🍼 Paternidad (15 días)</option>
              <option value="birthday">🎂 Cumpleaños (1 día)</option>
            </optgroup>
            <optgroup label="🎗️ Fallecimientos">
              <option value="death-immediate">🎗️ Familiar directo (5 días)</option>
              <option value="death-family">🎗️ Familiar (3 días)</option>
              <option value="pet-death">🐾 Mascota (1 día)</option>
            </optgroup>
            <optgroup label="📋 Otros">
              <option value="medical-leave">🏥 Incapacidad IMSS</option>
              <option value="special">📄 Permiso Especial</option>
            </optgroup>
          </select>
        </div>
        <div class="backfill-field">
          <label>Fecha inicio</label>
          <input type="date" id="bf_start_${id}" max="${today}" onchange="calculateBackfillDays(${id})" />
        </div>
        <div class="backfill-field">
          <label>Fecha fin</label>
          <input type="date" id="bf_end_${id}" max="${today}" onchange="calculateBackfillDays(${id})" />
        </div>
        <div class="backfill-field">
          <label>Días hábiles</label>
          <input type="number" id="bf_days_${id}" min="1" readonly style="background-color: #f1f5f9;" />
        </div>
        <div class="backfill-field backfill-field-wide">
          <label>Comentario (opcional)</label>
          <input type="text" id="bf_comments_${id}" placeholder="Ej: Vacaciones de verano 2025" />
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', entryHTML);
}

function removeBackfillEntry(id) {
  const entry = document.getElementById(`backfillEntry_${id}`);
  if (entry) entry.remove();
}

function calculateBackfillDays(id) {
  const startInput = document.getElementById(`bf_start_${id}`);
  const endInput = document.getElementById(`bf_end_${id}`);
  const daysInput = document.getElementById(`bf_days_${id}`);
  
  if (!startInput.value || !endInput.value) return;
  
  const start = parseLocalDate(startInput.value);
  const end = parseLocalDate(endInput.value);
  
  if (end < start) {
    showModal('warning', 'Fecha inválida', 'La fecha fin no puede ser anterior a la fecha inicio.');
    endInput.value = '';
    daysInput.value = '';
    return;
  }
  
  // Calcular días hábiles
  let businessDays = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) businessDays++;
    current.setDate(current.getDate() + 1);
  }
  
  daysInput.value = businessDays;
}

function getBackfillEntries() {
  const container = document.getElementById('backfillEntries');
  if (!container) return [];
  
  const entries = [];
  const entryElements = container.querySelectorAll('.backfill-entry');
  
  entryElements.forEach(el => {
    const id = el.id.replace('backfillEntry_', '');
    const type = document.getElementById(`bf_type_${id}`)?.value;
    const startDate = document.getElementById(`bf_start_${id}`)?.value;
    const endDate = document.getElementById(`bf_end_${id}`)?.value;
    const days = document.getElementById(`bf_days_${id}`)?.value;
    const comments = document.getElementById(`bf_comments_${id}`)?.value;
    
    if (type && startDate && endDate && days) {
      entries.push({ type, startDate, endDate, days: parseInt(days), comments });
    }
  });
  
  return entries;
}

// Make functions globally available
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.deleteRequest = deleteRequest;
window.closeModal = closeModal;
window.startEditingUser = startEditingUser;
window.cancelEditUser = cancelEditUser;
window.confirmEditUser = confirmEditUser;
window.addBackfillEntry = addBackfillEntry;
window.removeBackfillEntry = removeBackfillEntry;
window.calculateBackfillDays = calculateBackfillDays;

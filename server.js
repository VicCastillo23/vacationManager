require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const ENV = process.env.NODE_ENV || 'production';
const PORT = process.env.PORT || (ENV === 'test' ? 3001 : 3000);
const IS_VERCEL = process.env.VERCEL === '1';
const DB_FILE = ENV === 'test' ? 'db-test.json' : 'db.json';

// En Vercel el filesystem es read-only excepto /tmp
const DB_PATH = IS_VERCEL
  ? path.join('/tmp', DB_FILE)
  : path.join(__dirname, 'data', DB_FILE);
const DB_SEED_PATH = path.join(__dirname, 'data', 'db-seed.json');

// Inicializar DB desde seed si no existe (primer deploy en Railway/Render/Vercel)
if (!fs.existsSync(DB_PATH)) {
  try {
    // Asegurar que el directorio data/ exista
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    
    const seed = fs.existsSync(DB_SEED_PATH)
      ? fs.readFileSync(DB_SEED_PATH, 'utf8')
      : JSON.stringify({ users: [], requests: [] });
    fs.writeFileSync(DB_PATH, seed, 'utf8');
    console.log('DB inicializada desde seed en:', DB_PATH);
  } catch (e) {
    console.error('Error inicializando DB:', e.message);
  }
}

// Configuración de encriptación AES-256
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key-change-in-production').digest();
const IV_LENGTH = 16;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Configuración de multer para subida de archivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Helper: Encriptar datos
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Helper: Desencriptar datos
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper: Leer base de datos (desencriptada)
function readDB() {
  try {
    const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
    const decryptedData = decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (error) {
    // Si falla la desencriptación, intentar leer como JSON plano (migración)
    console.log('Intentando leer DB sin encriptar para migración...');
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const db = JSON.parse(data);
      // Encriptar y guardar
      console.log('Encriptando base de datos...');
      writeDB(db);
      return db;
    } catch (err) {
      console.error('Error al leer la base de datos:', err);
      throw err;
    }
  }
}

// Helper: Escribir base de datos (encriptada)
function writeDB(data) {
  const jsonData = JSON.stringify(data, null, 2);
  const encryptedData = encrypt(jsonData);
  fs.writeFileSync(DB_PATH, encryptedData, 'utf8');
}

// Helper: Calcular días de vacaciones según antigüedad
function calculateVacationDays(hireDate) {
  const hire = new Date(hireDate);
  const today = new Date();
  const yearsOfService = Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
  
  // Tabla de días según años de servicio
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

// Helper: Calcular años de servicio
function calculateYearsOfService(hireDate) {
  const hire = new Date(hireDate);
  const today = new Date();
  return Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
}

// Helper: Obtener el período de aniversario actual del empleado
function getCurrentVacationPeriod(hireDate) {
  const hire = new Date(hireDate);
  const today = new Date();
  
  // Calcular el aniversario más reciente
  const periodStart = new Date(hire);
  periodStart.setFullYear(today.getFullYear());
  
  // Si aún no llega el aniversario de este año, retroceder un año
  if (periodStart > today) {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }
  
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);
  
  const fmt = d => d.toISOString().split('T')[0];
  return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
}

// Helper: Calcular lunes cívicos
function getNthWeekdayOfMonth(year, month, weekday, n) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysUntilWeekday = (weekday - firstWeekday + 7) % 7;
  const nthWeekday = 1 + daysUntilWeekday + (n - 1) * 7;
  return new Date(year, month, nthWeekday).toISOString().split('T')[0];
}

// Helper: Calcular Jueves y Viernes Santo (basado en la Pascua)
function getEasterDates(year) {
  // Algoritmo de Butcher para calcular la Pascua
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month, day);
  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  
  return {
    jueves: juevesSanto.toISOString().split('T')[0],
    viernes: viernesSanto.toISOString().split('T')[0]
  };
}

// Helper: Días festivos mexicanos (2026)
function getMexicanHolidays2026() {
  const easter = getEasterDates(2026);
  
  return [
    { date: '2026-01-01', name: 'Año Nuevo', type: 'fixed' },
    { date: getNthWeekdayOfMonth(2026, 1, 1, 1), name: 'Día de la Constitución Mexicana', type: 'movable' },
    { date: getNthWeekdayOfMonth(2026, 2, 1, 3), name: 'Natalicio de Benito Juárez', type: 'movable' },
    { date: easter.jueves, name: 'Jueves Santo', type: 'movable' },
    { date: easter.viernes, name: 'Viernes Santo', type: 'movable' },
    { date: '2026-05-01', name: 'Día del Trabajo', type: 'fixed' },
    { date: '2026-09-16', name: 'Día de la Independencia', type: 'fixed' },
    { date: '2026-11-02', name: 'Día de Muertos', type: 'fixed' },
    { date: getNthWeekdayOfMonth(2026, 10, 1, 3), name: 'Día de la Revolución Mexicana', type: 'movable' },
    { date: '2026-12-12', name: 'Virgen de Guadalupe', type: 'fixed' },
    { date: '2026-12-25', name: 'Navidad', type: 'fixed' }
  ];
}

const MEXICAN_HOLIDAYS_2026 = getMexicanHolidays2026();

// Helper: Verificar si una fecha es festivo
function isHoliday(dateStr) {
  return MEXICAN_HOLIDAYS_2026.some(h => h.date === dateStr);
}

// Helper: Obtener nombre del festivo
function getHolidayName(dateStr) {
  const holiday = MEXICAN_HOLIDAYS_2026.find(h => h.date === dateStr);
  return holiday ? holiday.name : null;
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  
  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  
  console.log(`Login: ${user.email}, mustChangePassword: ${user.mustChangePassword}`);
  
  // Verificar si debe cambiar contraseña
  if (user.mustChangePassword) {
    console.log('Sending mustChangePassword response');
    return res.json({ 
      mustChangePassword: true,
      userId: user.id,
      email: user.email,
      name: user.name
    });
  }
  
  console.log('Sending normal user response');
  
  // No enviar password al cliente
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

// Registro
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role, team, hireDate } = req.body;
  const db = readDB();
  
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'El email ya está registrado' });
  }
  
  // Solo Yocelyn Rugerio puede registrarse como director o administrador
  if ((role === 'director' || role === 'administrator') &&
      !(name === 'Yocelyn Rugerio' && email === 'yocelyn.rugerio@globalpayments.com')) {
    return res.status(403).json({ error: 'No tienes permiso para registrarte con este rol.' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    email,
    password: hashedPassword,
    name,
    role: role || 'employee',
    team: team || 'Sin asignar',
    managerId: null,
    hireDate: hireDate || new Date().toISOString().split('T')[0],
    ptoDays: 5,
    vacationDays: 15,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  writeDB(db);
  
  const { password: _, ...userWithoutPassword } = newUser;
  res.json({ user: userWithoutPassword });
});

// Cambiar contraseña
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  const db = readDB();
  
  // Validar contraseña: mín 8 chars, mayúscula, minúscula, número, caracter especial
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un caracter especial (@$!%*?&)' 
    });
  }
  
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.users[userIndex].password = hashedPassword;
  db.users[userIndex].mustChangePassword = false;
  
  writeDB(db);
  
  const { password: _, ...userWithoutPassword } = db.users[userIndex];
  res.json({ user: userWithoutPassword });
});

// ==================== USERS ROUTES ====================

// Obtener todos los usuarios (según rol)
app.get('/api/users', (req, res) => {
  const { userId, role, team } = req.query;
  const db = readDB();
  
  let users = db.users.map(({ password, ...user }) => {
    // Calcular días de vacaciones dinámicamente según antigüedad y período
    const totalVacationDays = calculateVacationDays(user.hireDate);
    const yearsOfService = calculateYearsOfService(user.hireDate);
    const { periodStart, periodEnd } = getCurrentVacationPeriod(user.hireDate);
    
    // Contar solo días usados en el período actual
    const vacationUsed = db.requests
      .filter(r => r.userId === user.id && r.type === 'vacation' &&
        (r.status === 'approved' || r.status === 'pending') &&
        r.startDate >= periodStart && r.startDate <= periodEnd)
      .reduce((sum, r) => sum + r.days, 0);
    
    const ptoUsed = db.requests
      .filter(r => r.userId === user.id && r.type === 'pto' &&
        (r.status === 'approved' || r.status === 'pending') &&
        r.startDate >= periodStart && r.startDate <= periodEnd)
      .reduce((sum, r) => sum + r.days, 0);
    
    return {
      ...user,
      vacationDays: totalVacationDays - vacationUsed,
      ptoDays: 5 - ptoUsed,
      totalVacationDays,
      yearsOfService,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    };
  });
  
  if (role === 'director' || role === 'administrator') {
    // Director y Administrador ven todos
    return res.json(users);
  } else if (role === 'manager') {
    // Manager ve solo su equipo
    users = users.filter(u => u.team === team || u.id === userId);
    return res.json(users);
  } else {
    // Empleado ve solo su info
    users = users.filter(u => u.id === userId);
    return res.json(users);
  }
});

// Obtener un usuario
app.get('/api/users/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Actualizar usuario (solo administradores)
app.put('/api/users/:id', async (req, res) => {
  try {
    const { requestingUserRole } = req.body;
    
    // Validar que solo administradores puedan actualizar usuarios
    if (requestingUserRole !== 'administrator') {
      return res.status(403).json({ error: 'Solo los administradores pueden editar usuarios' });
    }
    
    const db = readDB();
    const index = db.users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const updates = { ...req.body };
    delete updates.requestingUserRole; // Remover el campo de control
    
    // Normalizar fecha si viene en formato ISO completo
    if (updates.hireDate && updates.hireDate.includes('T')) {
      updates.hireDate = updates.hireDate.split('T')[0];
    }
    
    // Validar email único si se está cambiando
    if (updates.email && updates.email !== db.users[index].email) {
      const emailExists = db.users.find(u => u.email === updates.email && u.id !== req.params.id);
      if (emailExists) {
        return res.status(400).json({ error: 'El email ya está en uso por otro usuario' });
      }
    }
    
    // Si se actualiza la contraseña, hashearla
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
      updates.mustChangePassword = true;
    }
    
    // Mantener campos que no deben modificarse
    delete updates.id;
    delete updates.createdAt;
    delete updates.vacationDays; // Se calcula dinámicamente por período
    delete updates.ptoDays; // Se calcula dinámicamente por período
    
    // Actualizar usuario
    db.users[index] = { ...db.users[index], ...updates };
    writeDB(db);
    
    const { password, ...userWithoutPassword } = db.users[index];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno al actualizar usuario: ' + error.message });
  }
});

// Obtener equipos únicos
app.get('/api/teams', (req, res) => {
  const db = readDB();
  const teams = [...new Set(db.users.map(u => u.team))];
  res.json(teams);
});

// Obtener días festivos
app.get('/api/holidays', (req, res) => {
  res.json(MEXICAN_HOLIDAYS_2026);
});

// ==================== REQUESTS (SOLICITUDES) ROUTES ====================

// Obtener solicitudes (según rol)
app.get('/api/requests', (req, res) => {
  const { userId, role, team } = req.query;
  const db = readDB();
  
  let requests = db.requests;
  
  if (role === 'director' || role === 'administrator') {
    // Director y Administrador ven todas las solicitudes
    return res.json(requests);
  } else if (role === 'manager') {
    // Manager ve solicitudes de su equipo + las propias
    const teamUserIds = db.users.filter(u => u.team === team).map(u => u.id);
    requests = requests.filter(r => teamUserIds.includes(r.userId));
    return res.json(requests);
  } else {
    // Empleado ve solo sus solicitudes
    requests = requests.filter(r => r.userId === userId);
    return res.json(requests);
  }
});

// Crear solicitud
app.post('/api/requests', (req, res) => {
  const { userId, userName, userRole, type, startDate, endDate, days, comments } = req.body;
  const db = readDB();
  
  // Validación de 3 días de anticipación (solo para vacaciones y PTO)
  if (type === 'vacation' || type === 'pto') {
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 3) {
      return res.status(400).json({ 
        error: 'Las solicitudes de vacaciones y días personales deben hacerse con al menos 3 días de anticipación'
      });
    }
  }
  
  // Validar que PTO no sea de más de 2 días
  if (type === 'pto' && parseInt(days) > 2) {
    return res.status(400).json({ 
      error: 'Las solicitudes de PTO no pueden ser de más de 2 días laborables seguidos'
    });
  }
  
  // Validar días específicos según tipo de ausencia
  const validDaysMap = {
    'marriage': 5,
    'maternity': 84,
    'paternity': 15,
    'birthday': 1,
    'death-immediate': 5,
    'death-family': 3,
    'pet-death': 1
  };
  
  if (validDaysMap[type] && parseInt(days) > validDaysMap[type]) {
    return res.status(400).json({ 
      error: `Este tipo de ausencia permite máximo ${validDaysMap[type]} días`
    });
  }
  
  // Verificar empalmes con solicitudes existentes (pendientes o aprobadas)
  const userRequests = db.requests.filter(r => 
    r.userId === userId && 
    (r.status === 'pending' || r.status === 'approved')
  );
  
  const newStart = new Date(startDate);
  const newEnd = new Date(endDate);
  
  const overlap = userRequests.find(r => {
    const existingStart = new Date(r.startDate);
    const existingEnd = new Date(r.endDate);
    // Check if dates overlap
    return (newStart <= existingEnd && newEnd >= existingStart);
  });
  
  if (overlap) {
    return res.status(400).json({ 
      error: 'Las fechas se empalman con una solicitud existente',
      conflictWith: overlap
    });
  }
  
  const newRequest = {
    id: uuidv4(),
    userId,
    userName,
    userRole,
    type,
    startDate,
    endDate,
    days: parseInt(days),
    status: 'pending',
    approverId: null,
    approverName: null,
    comments: comments || '',
    createdAt: new Date().toISOString()
  };
  
  db.requests.push(newRequest);
  writeDB(db);
  
  res.json(newRequest);
});

// Aprobar/Rechazar solicitud
app.put('/api/requests/:id', (req, res) => {
  const { status, approverId, approverName } = req.body;
  const db = readDB();
  
  const index = db.requests.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  
  db.requests[index] = {
    ...db.requests[index],
    status,
    approverId,
    approverName,
    updatedAt: new Date().toISOString()
  };
  
  // Los días se calculan dinámicamente desde las solicitudes aprobadas por período,
  // ya no se decrementan manualmente en la DB.
  
  writeDB(db);
  res.json(db.requests[index]);
});

// Eliminar solicitud
app.delete('/api/requests/:id', (req, res) => {
  const db = readDB();
  const index = db.requests.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  
  db.requests.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Solicitud eliminada' });
});

// ==================== ADMIN ROUTES ====================

// Llenado previo de vacaciones pasadas (backfill)
app.post('/api/requests/backfill', (req, res) => {
  try {
    const { userId, userName, entries, requestingUserRole, approverId, approverName } = req.body;
    
    // Solo administradores pueden hacer backfill
    if (requestingUserRole !== 'administrator') {
      return res.status(403).json({ error: 'Solo los administradores pueden registrar vacaciones previas' });
    }
    
    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron entradas' });
    }
    
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const created = [];
    const errors = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Validar campos requeridos
      if (!entry.type || !entry.startDate || !entry.endDate || !entry.days) {
        errors.push({ index: i, error: 'Campos incompletos' });
        continue;
      }
      
      // Verificar empalmes con solicitudes existentes
      const userRequests = db.requests.filter(r => 
        r.userId === userId && 
        (r.status === 'pending' || r.status === 'approved')
      );
      
      const newStart = new Date(entry.startDate);
      const newEnd = new Date(entry.endDate);
      
      const overlap = userRequests.find(r => {
        const existingStart = new Date(r.startDate);
        const existingEnd = new Date(r.endDate);
        return (newStart <= existingEnd && newEnd >= existingStart);
      });
      
      if (overlap) {
        errors.push({ index: i, error: `Empalme con solicitud del ${overlap.startDate} al ${overlap.endDate}` });
        continue;
      }
      
      // Crear solicitud pre-aprobada
      const newRequest = {
        id: uuidv4(),
        userId,
        userName,
        userRole: db.users[userIndex].role,
        type: entry.type,
        startDate: entry.startDate,
        endDate: entry.endDate,
        days: parseInt(entry.days),
        status: 'approved',
        approverId: approverId,
        approverName: approverName,
        comments: entry.comments || 'Llenado previo',
        backfill: true,
        createdAt: new Date().toISOString()
      };
      
      db.requests.push(newRequest);
      
      // Los días se calculan dinámicamente, no se decrementan manualmente.
      
      created.push(newRequest);
    }
    
    writeDB(db);
    
    // Calcular días disponibles dinámicamente para la respuesta
    const hireDate = db.users[userIndex].hireDate;
    const { periodStart, periodEnd } = getCurrentVacationPeriod(hireDate);
    const totalVacDays = calculateVacationDays(hireDate);
    const vacUsed = db.requests
      .filter(r => r.userId === userId && r.type === 'vacation' &&
        (r.status === 'approved' || r.status === 'pending') &&
        r.startDate >= periodStart && r.startDate <= periodEnd)
      .reduce((sum, r) => sum + r.days, 0);
    const ptoUsed = db.requests
      .filter(r => r.userId === userId && r.type === 'pto' &&
        (r.status === 'approved' || r.status === 'pending') &&
        r.startDate >= periodStart && r.startDate <= periodEnd)
      .reduce((sum, r) => sum + r.days, 0);
    
    res.json({
      success: true,
      created: created.length,
      errors,
      user: {
        vacationDays: totalVacDays - vacUsed,
        ptoDays: 5 - ptoUsed
      }
    });
  } catch (error) {
    console.error('Error en backfill:', error);
    res.status(500).json({ error: 'Error interno al registrar vacaciones previas: ' + error.message });
  }
});

// Carga masiva de empleados desde Excel
app.post('/api/admin/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    // Verificar que el usuario es administrador
    const { userRole } = req.body;
    if (userRole !== 'administrator') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    // Leer el archivo Excel
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    const db = readDB();
    const results = {
      created: [],
      updated: [],
      errors: []
    };

    // Procesar cada fila del Excel
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 porque Excel empieza en 1 y hay header

      try {
        // Validar campos requeridos
        const requiredFields = ['Nombre', 'Email', 'Equipo', 'Fecha de Ingreso'];
        const missingFields = requiredFields.filter(field => !row[field]);
        
        if (missingFields.length > 0) {
          results.errors.push({
            row: rowNum,
            email: row['Email'] || 'N/A',
            error: `Campos faltantes: ${missingFields.join(', ')}`
          });
          continue;
        }

        const email = row['Email'].toString().trim().toLowerCase();
        const name = row['Nombre'].toString().trim();
        const team = row['Equipo'].toString().trim();
        const hireDate = row['Fecha de Ingreso'];
        const role = row['Rol'] ? row['Rol'].toString().trim().toLowerCase() : 'employee';
        const ptoDaysTaken = parseInt(row['PTO Días Tomados']) || 0;
        const vacationDaysTaken = parseInt(row['Vacaciones Días Tomadas']) || 0;

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.errors.push({
            row: rowNum,
            email: email,
            error: 'Email inválido'
          });
          continue;
        }

        // Validar rol
        const validRoles = ['employee', 'manager', 'director', 'administrator'];
        if (!validRoles.includes(role)) {
          results.errors.push({
            row: rowNum,
            email: email,
            error: `Rol inválido: ${role}. Debe ser: employee, manager, director o administrator`
          });
          continue;
        }

        // Procesar fecha de ingreso
        let hireDateFormatted;
        if (typeof hireDate === 'number') {
          // Excel guarda fechas como números
          const date = xlsx.SSF.parse_date_code(hireDate);
          hireDateFormatted = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        } else {
          hireDateFormatted = hireDate;
        }

        // Calcular días disponibles
        const ptoDays = Math.max(0, 5 - ptoDaysTaken);
        const vacationDays = Math.max(0, 15 - vacationDaysTaken);

        // Buscar si el usuario ya existe
        const existingUserIndex = db.users.findIndex(u => u.email === email);

        if (existingUserIndex !== -1) {
          // Actualizar usuario existente
          db.users[existingUserIndex] = {
            ...db.users[existingUserIndex],
            name,
            team,
            role,
            hireDate: hireDateFormatted,
            ptoDays,
            vacationDays
          };
          results.updated.push({
            email,
            name,
            action: 'actualizado'
          });
        } else {
          // Crear nuevo usuario con contraseña temporal
          const tempPassword = '123456';
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          
          const newUser = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            name,
            role,
            team,
            managerId: null,
            hireDate: hireDateFormatted,
            ptoDays,
            vacationDays,
            mustChangePassword: true,
            createdAt: new Date().toISOString()
          };

          db.users.push(newUser);
          results.created.push({
            email,
            name,
            action: 'creado',
            tempPassword: '123456'
          });
        }
      } catch (error) {
        results.errors.push({
          row: rowNum,
          email: row['Email'] || 'N/A',
          error: error.message
        });
      }
    }

    // Procesar hoja de Solicitudes (si existe)
    const solicitudesSheet = workbook.Sheets['Solicitudes'];
    const requestResults = { imported: 0, skipped: 0, errors: [] };

    if (solicitudesSheet) {
      const solicitudesData = xlsx.utils.sheet_to_json(solicitudesSheet);

      const typeNamesReverse = {
        'Vacaciones': 'vacation', 'PTO': 'pto', 'Matrimonio': 'marriage',
        'Maternidad': 'maternity', 'Paternidad': 'paternity', 'Cumpleaños': 'birthday',
        'Fallecimiento directo': 'death-immediate', 'Fallecimiento familiar': 'death-family',
        'Fallecimiento mascota': 'pet-death', 'Incapacidad IMSS': 'medical-leave',
        'Permiso Especial': 'special'
      };
      const statusNamesReverse = {
        'Pendiente': 'pending', 'Aprobada': 'approved', 'Rechazada': 'rejected'
      };

      for (let i = 0; i < solicitudesData.length; i++) {
        const row = solicitudesData[i];
        const rowNum = i + 2;

        try {
          const empleadoName = row['Empleado'];
          const tipo = row['Tipo'];
          let fechaInicio = row['Fecha Inicio'];
          let fechaFin = row['Fecha Fin'];
          const dias = parseInt(row['Días']) || 0;
          const estado = row['Estado'];

          if (!empleadoName || !tipo || !fechaInicio || !fechaFin) {
            requestResults.errors.push({ row: rowNum, error: `Solicitud incompleta en fila ${rowNum}` });
            continue;
          }

          // Convertir fechas Excel numéricas
          if (typeof fechaInicio === 'number') {
            const d = xlsx.SSF.parse_date_code(fechaInicio);
            fechaInicio = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          }
          if (typeof fechaFin === 'number') {
            const d = xlsx.SSF.parse_date_code(fechaFin);
            fechaFin = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          }

          // Buscar usuario por nombre
          const user = db.users.find(u => u.name === empleadoName);
          if (!user) {
            requestResults.errors.push({ row: rowNum, error: `Usuario "${empleadoName}" no encontrado` });
            continue;
          }

          const type = typeNamesReverse[tipo] || tipo;
          const status = statusNamesReverse[estado] || estado;

          // Verificar si ya existe solicitud con mismas fechas para ese usuario
          const duplicate = db.requests.find(r =>
            r.userId === user.id &&
            r.startDate === fechaInicio &&
            r.endDate === fechaFin &&
            r.type === type
          );

          if (duplicate) {
            requestResults.skipped++;
            continue;
          }

          db.requests.push({
            id: uuidv4(),
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            type,
            startDate: fechaInicio,
            endDate: fechaFin,
            days: dias,
            status,
            comments: row['Comentarios'] || 'Importado desde Excel',
            backfill: true,
            createdAt: new Date().toISOString()
          });

          requestResults.imported++;
        } catch (error) {
          requestResults.errors.push({ row: rowNum, error: error.message });
        }
      }
    }

    // Guardar cambios
    writeDB(db);

    res.json({
      success: true,
      summary: {
        total: data.length,
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
        requestsImported: requestResults.imported,
        requestsSkipped: requestResults.skipped,
        requestErrors: requestResults.errors.length
      },
      details: {
        ...results,
        requestErrors: requestResults.errors
      }
    });

  } catch (error) {
    console.error('Error en carga masiva:', error);
    res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
  }
});

// Exportar datos a Excel (admin)
app.get('/api/admin/export-excel', (req, res) => {
  try {
    const { userRole } = req.query;
    if (userRole !== 'administrator') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const db = readDB();

    // Hoja 1: Empleados (formato compatible con importación)
    const employeesData = db.users.map(u => {
      let vacTotal = 0, vacUsed = 0, ptoUsed = 0;
      if (u.hireDate) {
        const { periodStart, periodEnd } = getCurrentVacationPeriod(u.hireDate);
        vacTotal = calculateVacationDays(u.hireDate);
        vacUsed = db.requests
          .filter(r => r.userId === u.id && r.type === 'vacation' &&
            (r.status === 'approved' || r.status === 'pending') &&
            r.startDate >= periodStart && r.startDate <= periodEnd)
          .reduce((sum, r) => sum + r.days, 0);
        ptoUsed = db.requests
          .filter(r => r.userId === u.id && r.type === 'pto' &&
            (r.status === 'approved' || r.status === 'pending') &&
            r.startDate >= periodStart && r.startDate <= periodEnd)
          .reduce((sum, r) => sum + r.days, 0);
      }

      return {
        'Nombre': u.name,
        'Email': u.email,
        'Equipo': u.team,
        'Fecha de Ingreso': u.hireDate || '',
        'Rol': u.role,
        'Vacaciones Totales': vacTotal,
        'Vacaciones Usadas': vacUsed,
        'PTO Usados': ptoUsed
      };
    });

    // Hoja 2: Solicitudes
    const typeNames = {
      vacation: 'Vacaciones', pto: 'PTO', marriage: 'Matrimonio',
      maternity: 'Maternidad', paternity: 'Paternidad', birthday: 'Cumpleaños',
      'death-immediate': 'Fallecimiento directo', 'death-family': 'Fallecimiento familiar',
      'pet-death': 'Fallecimiento mascota', 'medical-leave': 'Incapacidad IMSS',
      special: 'Permiso Especial'
    };
    const statusNames = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

    const requestsData = db.requests.map(r => ({
      'Empleado': r.userName,
      'Tipo': typeNames[r.type] || r.type,
      'Fecha Inicio': r.startDate,
      'Fecha Fin': r.endDate,
      'Días': r.days,
      'Estado': statusNames[r.status] || r.status,
      'Comentarios': r.comments || '',
      'Fecha Creación': r.createdAt ? r.createdAt.split('T')[0] : ''
    }));

    const wb = xlsx.utils.book_new();
    const wsEmpleados = xlsx.utils.json_to_sheet(employeesData);
    const wsSolicitudes = xlsx.utils.json_to_sheet(requestsData);

    // Ajustar ancho de columnas
    wsEmpleados['!cols'] = [
      { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }
    ];
    wsSolicitudes['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
      { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 15 }
    ];

    xlsx.utils.book_append_sheet(wb, wsEmpleados, 'Empleados');
    xlsx.utils.book_append_sheet(wb, wsSolicitudes, 'Solicitudes');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `vacation-manager-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    console.error('Error en exportación Excel:', error);
    res.status(500).json({ error: 'Error al exportar datos: ' + error.message });
  }
});

// ==================== START SERVER ====================

// Solo escuchar en modo local (no en Vercel)
if (!IS_VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏖️  Servidor de Gestión de Vacaciones iniciado`);
    console.log(`🔧 Ambiente: ${ENV.toUpperCase()}`);
    console.log(`📁 Base de datos: ${DB_FILE}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    
    // Mostrar IP local para acceso en red
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`🌐 Red local: http://${iface.address}:${PORT}`);
        }
      }
    }
    console.log(`\n`);
  });
}

// Exportar para Vercel serverless
module.exports = app;

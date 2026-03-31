require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const xlsx = require('xlsx');
const { connectDB, disconnectDB } = require('./lib/database');
const { calculateVacationDays, calculateYearsOfService, getCurrentVacationPeriod, getNthWeekdayOfMonth, getEasterDates, getMexicanHolidays2026, isHoliday, getHolidayName } = require('./lib/helpers');
const { authenticate, authorize, authorizeSelfOr, authorizeTeamOr } = require('./lib/auth');
const User = require('./models/User');
const Request = require('./models/Request');

const app = express();
const ENV = process.env.NODE_ENV || 'production';
const PORT = process.env.PORT || (ENV === 'test' ? 3001 : 3000);
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Configuración de multer para subida de archivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// ==================== HELPER FUNCTIONS ====================

const MEXICAN_HOLIDAYS_2026 = getMexicanHolidays2026();

function isDirectReport(userDoc, managerDoc) {
  if (!userDoc || !managerDoc) return false;
  const managerId = (managerDoc.id || managerDoc._id || '').toString();
  const userManagerId = (userDoc.managerId || '').toString();
  return !!managerId && !!userManagerId && userManagerId === managerId;
}

function getCookieOptions(req) {
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  const isHttps = req.secure || forwardedProto.includes('https');
  const explicitCookieSecure = process.env.COOKIE_SECURE;

  // Default behavior:
  // - production: secure only when request is HTTPS
  // - non-production: not secure
  let secure = ENV === 'production' ? isHttps : false;

  // Allow explicit override with env var when needed.
  if (explicitCookieSecure === 'true') secure = true;
  if (explicitCookieSecure === 'false') secure = false;

  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  };
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  // Crear JWT token para toda sesión válida (incluye flujo de cambio obligatorio)
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'vacation-manager-secret-key',
    { expiresIn: '24h' }
  );

  // Setear cookie HTTP-only
  res.cookie('token', token, getCookieOptions(req));
  
  console.log(`Login: ${user.email}, mustChangePassword: ${user.mustChangePassword}`);
  
  // Verificar si debe cambiar contraseña
  if (user.mustChangePassword) {
    console.log('Sending mustChangePassword response');
    return res.json({ 
      mustChangePassword: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      token
    });
  }
  
  console.log('Sending normal user response');
  
  // El schema de User ya excluye password en toJSON
  res.json({ user: user, token });
});

// Registro
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role, team, hireDate } = req.body;
  
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: 'El email ya está registrado' });
  }
  
  // Solo Yocelyn Rugerio puede registrarse como director o administrador
  if ((role === 'director' || role === 'administrator') &&
      !(name === 'Yocelyn Rugerio' && email === 'yocelyn.rugerio@globalpayments.com')) {
    return res.status(403).json({ error: 'No tienes permiso para registrarte con este rol.' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({
    email,
    password: hashedPassword,
    name,
    role: role || 'employee',
    team: team || 'Sin asignar',
    managerId: null,
    hireDate: hireDate || new Date(),
    mustChangePassword: false
  });
  
  await newUser.save();
  res.json({ user: newUser });
});

// Cambiar contraseña
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  
  // Validar contraseña: mín 8 chars, mayúscula, minúscula, número, caracter especial
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un caracter especial (@$!%*?&)' 
    });
  }
  
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.mustChangePassword = false;
  await user.save();

  // Emitir/renovar sesión al completar el cambio de contraseña
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'vacation-manager-secret-key',
    { expiresIn: '24h' }
  );
  res.cookie('token', token, getCookieOptions(req));
  
  res.json({ user: user, token });
});

// ==================== USERS ROUTES ====================

// Obtener todos los usuarios (según rol)
app.get('/api/users', authenticate, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'employee') {
      // Empleado ve solo su info
      query._id = req.user._id;
    } else if (req.user.role === 'manager') {
      // Manager ve sus reportes directos + fallback por equipo + sí mismo
      const directReportIds = await User.find({ managerId: req.user.id }).distinct('_id');
      query.$or = [
        { _id: req.user._id },
        { _id: { $in: directReportIds } },
        { team: req.user.team, role: 'employee' }
      ];
    }
    // Director y Administrador ven todos (query vacía)
    
    let users = await User.find(query).lean();
    
    // Calcular días disponibles dinámicamente para cada usuario
    const calculationPromises = users.map(async (user) => {
      // Calcular días de vacaciones dinámicamente según antigüedad y período
      const totalVacationDays = calculateVacationDays(user.hireDate);
      const yearsOfService = calculateYearsOfService(user.hireDate);
      const { periodStart, periodEnd } = getCurrentVacationPeriod(user.hireDate);
      
      // Contar solo días usados en el período actual
      const vacationUsed = await Request.aggregate([
        {
          $match: {
            userId: user._id,
            type: 'vacation',
            status: { $in: ['pending', 'approved'] },
            startDate: { $gte: periodStart, $lte: periodEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: '$days' }
          }
        }
      ]).then(results => results[0]?.totalDays || 0);
      
      const ptoUsed = await Request.aggregate([
        {
          $match: {
            userId: user._id,
            type: 'pto',
            status: { $in: ['pending', 'approved'] },
            startDate: { $gte: periodStart, $lte: periodEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: '$days' }
          }
        }
      ]).then(results => results[0]?.totalDays || 0);
      
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
    
    users = await Promise.all(calculationPromises);
    
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
});

// Obtener un usuario
app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isSelf = user._id.toString() === req.user._id.toString();
    const isAdminOrDirector = req.user.role === 'administrator' || req.user.role === 'director';
    const isManagerAndSameTeam = req.user.role === 'manager' && user.team === req.user.team;
    if (!isSelf && !isAdminOrDirector && !isManagerAndSameTeam) {
      return res.status(403).json({ error: 'No autorizado para ver este usuario' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario: ' + error.message });
  }
});

// Actualizar usuario (solo administradores)
app.put('/api/users/:id', authenticate, authorize('administrator'), async (req, res) => {
  try {
    const { requestingUserRole, ...updates } = req.body;
    
    // Campos que no deben modificarse
    delete updates.id;
    delete updates.createdAt;
    
    // Si se actualiza la contraseña, hashearla
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
      updates.mustChangePassword = true;
    }
    
    // Validar email único si se está cambiando
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      const emailExists = await User.findOne({ 
        email: updates.email, 
        _id: { $ne: req.params.id } 
      });
      if (emailExists) {
        return res.status(400).json({ error: 'El email ya está en uso por otro usuario' });
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno al actualizar usuario: ' + error.message });
  }
});

// Obtener equipos únicos
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await User.distinct('team');
    res.json(teams);
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener equipos: ' + error.message });
  }
});

// Obtener días festivos
app.get('/api/holidays', (req, res) => {
  res.json(MEXICAN_HOLIDAYS_2026);
});

// ==================== REQUESTS (SOLICITUDES) ROUTES ====================

// Obtener solicitudes (según rol)
app.get('/api/requests', authenticate, async (req, res) => {
  const { team } = req.query;
  
  try {
    let query = {};
    
    if (req.user.role === 'employee') {
      // Empleado ve solo sus solicitudes
      query.userId = req.user.id;
    } else if (req.user.role === 'manager') {
      // Manager ve solicitudes de sus reportes directos + fallback por equipo + las propias
      const directReportIds = await User.find({ managerId: req.user.id }).distinct('_id');
      const teamUserIds = await User.find({ team: req.user.team, role: 'employee' }).distinct('_id');
      const visibleUserIds = [...new Set([...directReportIds, ...teamUserIds].map(id => id.toString()))];
      query = {
        $or: [
          { userId: req.user.id },
          { userId: { $in: visibleUserIds } }
        ]
      };
    }
    // Director y Administrador ven todas (query vacía)
    
    const requests = await Request.find(query).sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes: ' + error.message });
  }
});

// Crear solicitud
app.post('/api/requests', authenticate, async (req, res) => {
  // Solo employees pueden crear solicitudes (verificado por authenticate middleware)
  const { userName, userRole, type, startDate, endDate, days, comments } = req.body;
  const userId = req.user.id; // userId viene del token
  
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Solo los empleados pueden crear solicitudes' });
  }
  
  try {
    //.Validar fechas
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Las fechas de inicio y fin son obligatorias' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser anterior o igual a la fecha de fin' });
    }

    // Validación de 3 días de anticipación para vacaciones/PTO
    if ((type === 'vacation' || type === 'pto') && type !== 'special'){
      const todayLocal = new Date();
      todayLocal.setHours(0,0,0,0);
      const diffDays = Math.ceil((start - todayLocal) / (1000 * 60 * 60 * 24));
      if (diffDays < 3) {
        return res.status(400).json({ error: 'Las solicitudes de vacaciones y días personales deben hacerse con al menos 3 días de anticipación' });
      }
    }

    // Validar que PTO no sea de más de 2 días
    if (type === 'pto' && parseInt(days) > 2) {
      return res.status(400).json({ error: 'Las solicitudes de PTO por día no pueden ser de más de 2 días' });
    }

    // Valida días específicos según tipo
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
      return res.status(400).json({ error: `Este tipo de ausencia permite máximo ${validDaysMap[type]} días` });
    }

    // Verificar que rango de request está dentro del período de vacaciones actual
    const { periodStart, periodEnd } = getCurrentVacationPeriod(req.user.hireDate);
    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (newStart < periodStart || newEnd > periodEnd) {
      return res.status(400).json({ error: 'Solicitud fuera de período de vacaciones' });
    }

    // Verificar empalmes con solicitudes existentes (pendientes o aprobadas)
    const overlap = await Request.findOne({
      userId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: newEnd }, endDate: { $gte: newStart } }
      ]
    });

    if (overlap) {
      return res.status(400).json({ 
        error: 'Las fechas se empalman con una solicitud existente',
        conflictWith: overlap
      });
    }

    const newRequest = new Request({
      userId,
      userName: userName || req.user.name,
      userRole: req.user.role,
      type,
      startDate: start,
      endDate: end,
      days: parseInt(days),
      status: 'pending',
      comments: comments || ''
    });

    await newRequest.save();
    res.json(newRequest);
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: 'Error al crear solicitud: ' + error.message });
  }
});

// Aprobar/Rechazar solicitud
app.put('/api/requests/:id', authenticate, authorize('manager', 'director', 'administrator'), async (req, res) => {
  const { status, approverId, approverName } = req.body;
  const requestId = req.params.id;
  
  try {
    const request = await Request.findById(requestId);
    
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    // Validar permisos según rol
    if (req.user.role === 'manager') {
      // Manager solo puede aprobar/rechazar reportes directos
      // (con fallback por equipo para compatibilidad de datos legacy)
      const requestUser = await User.findById(request.userId);
      const sameTeamEmployee = requestUser && requestUser.team === req.user.team && requestUser.role === 'employee';
      const directReport = isDirectReport(requestUser, req.user);
      if (!requestUser || (!sameTeamEmployee && !directReport)) {
        return res.status(403).json({ error: 'No autorizado: solo puedes aprobar solicitudes de tus reportes directos' });
      }
    }
    
    request.status = status;
    request.approverId = req.user.id; // Usar userId del token auth
    request.approverName = req.user.name;
    request.updatedAt = new Date();
    
    await request.save();
    
    res.json(request);
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ error: 'Error al actualizar solicitud: ' + error.message });
  }
});

// Eliminar solicitud
app.delete('/api/requests/:id', authenticate, async (req, res) => {
  const requestId = req.params.id;
  
  try {
    const request = await Request.findById(requestId);
    
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    // Validar permisos
    if (request.userId.toString() !== req.user.id.toString() && !['manager', 'director', 'administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado: solo puedes eliminar tus propias solicitudes' });
    }
    
    if (req.user.role === 'manager') {
      const requestUser = await User.findById(request.userId);
      const sameTeamEmployee = requestUser && requestUser.team === req.user.team && requestUser.role === 'employee';
      const directReport = isDirectReport(requestUser, req.user);
      if (!requestUser || (!sameTeamEmployee && !directReport)) {
        return res.status(403).json({ error: 'No autorizado: no puedes eliminar solicitudes fuera de tus reportes directos' });
      }
    }
    
    await Request.findByIdAndDelete(requestId);
    
    res.json({ message: 'Solicitud eliminada' });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud: ' + error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Llenado previo de vacaciones pasadas (backfill)
app.post('/api/requests/backfill', authenticate, authorize('administrator'), async (req, res) => {
  try {
    const { userId, userName, entries, requestingUserRole, approverId, approverName } = req.body;
    
    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron entradas' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
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
      const newStart = new Date(entry.startDate);
      const newEnd = new Date(entry.endDate);
      
      const overlap = await Request.findOne({
        userId,
        status: { $in: ['pending', 'approved'] },
        $or: [
          { startDate: { $lte: newEnd }, endDate: { $gte: newStart } }
        ]
      });
      
      if (overlap) {
        errors.push({ index: i, error: `Empalme con solicitud del ${overlap.startDate} al ${overlap.endDate}` });
        continue;
      }
      
      // Crear solicitud pre-aprobada
      const newRequest = new Request({
        userId,
        userName,
        userRole: user.role,
        type: entry.type,
        startDate: new Date(entry.startDate),
        endDate: new Date(entry.endDate),
        days: parseInt(entry.days),
        status: 'approved',
        approverId,
        approverName,
        comments: entry.comments || 'Llenado previo',
        backfill: true
      });
      
      await newRequest.save();
      created.push(newRequest);
    }
    
    // Calcular días disponibles dinámicamente para la respuesta
    const hireDate = user.hireDate;
    const { periodStart, periodEnd } = getCurrentVacationPeriod(hireDate);
    const totalVacDays = calculateVacationDays(hireDate);
    
    const vacUsed = await Request.aggregate([
      {
        $match: {
          userId,
          type: 'vacation',
          status: { $in: ['pending', 'approved'] },
          startDate: { $gte: periodStart, $lte: periodEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: '$days' }
        }
      }
    ]).then(results => results[0]?.totalDays || 0);
    
    const ptoUsed = await Request.aggregate([
      {
        $match: {
          userId,
          type: 'pto',
          status: { $in: ['pending', 'approved'] },
          startDate: { $gte: periodStart, $lte: periodEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: '$days' }
        }
      }
    ]).then(results => results[0]?.totalDays || 0);
    
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
    // Verificar que el usuario es administrador autenticado
    const token = req.cookies?.token || req.query?.token;
    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'vacation-manager-secret-key');
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const actor = await User.findById(decoded.userId);
    if (!actor || actor.role !== 'administrator') {
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
          hireDateFormatted = new Date(date.y, date.m - 1, date.d); // m es 1-indexed en Excel
        } else {
          hireDateFormatted = new Date(hireDate);
        }

        // Buscar si el usuario ya existe
        const existingUser = await User.findOne({ email });

        if (existingUser) {
          // Actualizar usuario existente
          existingUser.name = name;
          existingUser.team = team;
          existingUser.role = role;
          existingUser.hireDate = hireDateFormatted;
          await existingUser.save();
          
          results.updated.push({
            email,
            name,
            action: 'actualizado'
          });
        } else {
          // Crear nuevo usuario con contraseña temporal
          const tempPassword = 'Temporal123!';
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          
          const newUser = new User({
            email,
            password: hashedPassword,
            name,
            role,
            team,
            managerId: null,
            hireDate: hireDateFormatted,
            mustChangePassword: true
          });

          await newUser.save();
          results.created.push({
            email,
            name,
            action: 'creado',
            tempPassword: 'Temporal123!'
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
    const solicitudesSheetName = workbook.SheetNames.find(s => s === 'Solicitudes' || s.includes('Solicitud'));
    const solicitudesSheet = solicitudesSheetName ? workbook.Sheets[solicitudesSheetName] : null;
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

      // Crear mapa de nombre -> _id
      const allUsers = await User.find({});
      const userNameToId = {};
      allUsers.forEach(u => {
        userNameToId[u.name] = u._id;
      });

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
            fechaInicio = new Date(d.y, d.m - 1, d.d);
          }
          if (typeof fechaFin === 'number') {
            const d = xlsx.SSF.parse_date_code(fechaFin);
            fechaFin = new Date(d.y, d.m - 1, d.d);
          }

          // Buscar usuario por nombre
          const userId = userNameToId[empleadoName];
          if (!userId) {
            requestResults.errors.push({ row: rowNum, error: `Usuario "${empleadoName}" no encontrado` });
            continue;
          }

          const user = await User.findById(userId);
          const type = typeNamesReverse[tipo] || tipo;
          const status = statusNamesReverse[estado] || estado;

          // Verificar si ya existe solicitud con mismas fechas para ese usuario
          const duplicate = await Request.findOne({
            userId,
            startDate: fechaInicio,
            endDate: fechaFin,
            type
          });

          if (duplicate) {
            requestResults.skipped++;
            continue;
          }

          const newRequest = new Request({
            userId,
            userName: empleadoName,
            userRole: user.role,
            type,
            startDate: fechaInicio,
            endDate: fechaFin,
            days: dias,
            status,
            comments: row['Comentarios'] || 'Importado desde Excel',
            backfill: true
          });

          await newRequest.save();
          requestResults.imported++;
        } catch (error) {
          requestResults.errors.push({ row: rowNum, error: error.message });
        }
      }
    }

    res.json({
      success: true,
      summary: {
        total: data.length,
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
        requestsImported: requestResults.imported,
        requestsSkipped: requestResults.skipped,
        requestErrors: requestResults.errors.length,
        solicitudesSheetFound: !!solicitudesSheet
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
app.get('/api/admin/export-excel', async (req, res) => {
  try {
    const token = req.cookies?.token || req.query?.token;
    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'vacation-manager-secret-key');
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const actor = await User.findById(decoded.userId);
    if (!actor || actor.role !== 'administrator') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const users = await User.find({});

    // Hoja 1: Empleados (formato compatible con importación)
    const employeesData = await Promise.all(users.map(async (u) => {
      let vacTotal = 0, vacUsed = 0, ptoUsed = 0;
      if (u.hireDate) {
        const { periodStart, periodEnd } = getCurrentVacationPeriod(u.hireDate);
        vacTotal = calculateVacationDays(u.hireDate);
        
        vacUsed = await Request.aggregate([
          {
            $match: {
              userId: u._id,
              type: 'vacation',
              status: { $in: ['pending', 'approved'] },
              startDate: { $gte: periodStart, $lte: periodEnd }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: '$days' }
            }
          }
        ]).then(results => results[0]?.totalDays || 0);
        
        ptoUsed = await Request.aggregate([
          {
            $match: {
              userId: u._id,
              type: 'pto',
              status: { $in: ['pending', 'approved'] },
              startDate: { $gte: periodStart, $lte: periodEnd }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: '$days' }
            }
          }
        ]).then(results => results[0]?.totalDays || 0);
      }

      return {
        'Nombre': u.name,
        'Email': u.email,
        'Equipo': u.team,
        'Fecha de Ingreso': u.hireDate ? u.hireDate.toISOString().split('T')[0] : '',
        'Rol': u.role,
        'Vacaciones Totales': vacTotal,
        'Vacaciones Usadas': vacUsed,
        'PTO Usados': ptoUsed
      };
    }));

    // Hoja 2: Solicitudes
    const typeNames = {
      vacation: 'Vacaciones', pto: 'PTO', marriage: 'Matrimonio',
      maternity: 'Maternidad', paternity: 'Paternidad', birthday: 'Cumpleaños',
      'death-immediate': 'Fallecimiento directo', 'death-family': 'Fallecimiento familiar',
      'pet-death': 'Fallecimiento mascota', 'medical-leave': 'Incapacidad IMSS',
      special: 'Permiso Especial'
    };
    const statusNames = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

    const requests = await Request.find({});
    const requestsData = requests.map(r => ({
      'Empleado': r.userName,
      'Tipo': typeNames[r.type] || r.type,
      'Fecha Inicio': r.startDate.toISOString().split('T')[0],
      'Fecha Fin': r.endDate.toISOString().split('T')[0],
      'Días': r.days,
      'Estado': statusNames[r.status] || r.status,
      'Comentarios': r.comments || '',
      'Fecha Creación': r.createdAt ? r.createdAt.toISOString().split('T')[0] : ''
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

// Only start server when not in test mode
if (ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🏖️  Servidor de Gestión de Vacaciones iniciado`);
      console.log(`🔧 Ambiente: ${ENV.toUpperCase()}`);
      console.log(`📦 Base de datos: MongoDB`);
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
  }).catch(error => {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  });
}

module.exports = app;

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer: OriginalMMS } = require('mongodb-memory-server');
const User = require('../../models/User');
const Request = require('../../models/Request');

let mockMongod = null;
let app;

beforeAll(async () => {
  mockMongod = await MongoMemoryServer.create();
  const uri = mockMongod.getUri();
  await mongoose.connect(uri);
  
  const appModule = require('../../server.js');
  app = appModule.app || appModule;
  
  if (typeof appModule === 'function') {
    app = appModule;
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mockMongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Request.deleteMany({});
});

describe('Auth API - /api/auth/*', () => {
  test('POST /api/auth/login - login exitoso', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    await User.create({
      email: 'login@example.com',
      password: hashedPassword,
      name: 'Login User',
      role: 'employee',
      team: 'Team',
      hireDate: new Date('2020-01-01')
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Test123!' });

    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe('login@example.com');
    expect(response.body.user.password).toBeUndefined();
  });

  test('POST /api/auth/login - usuario no encontrado', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notfound@example.com', password: 'Test123!' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Usuario no encontrado');
  });

  test('POST /api/auth/login - contraseña incorrecta', async () => {
    const hashedPassword = await bcrypt.hash('Correct123!', 10);
    await User.create({
      email: 'wrongpass@example.com',
      password: hashedPassword,
      name: 'Wrong Password User',
      role: 'employee',
      team: 'Team',
      hireDate: new Date('2020-01-01')
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'Wrong123!' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Contraseña incorrecta');
  });

  test('POST /api/auth/register - registro exitoso', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'NewPass123!',
        name: 'New User',
        role: 'employee',
        team: 'Team',
        hireDate: '2020-01-01'
      });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('newuser@example.com');
    expect(response.body.user.password).toBeUndefined();
  });

  test('POST /api/auth/register - email duplicado', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    await User.create({
      email: 'existing@example.com',
      password: hashedPassword,
      name: 'Existing User',
      role: 'employee',
      team: 'Team',
      hireDate: new Date('2020-01-01')
    });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'Test123!',
        name: 'Duplicate User',
        role: 'employee',
        team: 'Team',
        hireDate: '2020-01-01'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('El email ya está registrado');
  });

  test('POST /api/auth/change-password - cambio exitoso', async () => {
    const hashedPassword = await bcrypt.hash('OldPass123!', 10);
    const user = await User.create({
      email: 'changepass@example.com',
      password: hashedPassword,
      name: 'Change Password User',
      role: 'employee',
      team: 'Team',
      hireDate: new Date('2020-01-01')
    });

    const response = await request(app)
      .post('/api/auth/change-password')
      .send({ userId: user.id, newPassword: 'NewPass123!' });

    expect(response.status).toBe(200);
    expect(response.body.user.mustChangePassword).toBe(false);
  });

  test('POST /api/auth/change-password - contraseña inválida', async () => {
    const hashedPassword = await bcrypt.hash('OldPass123!', 10);
    const user = await User.create({
      email: 'invalidpass@example.com',
      password: hashedPassword,
      name: 'Invalid Password User',
      role: 'employee',
      team: 'Team',
      hireDate: new Date('2020-01-01')
    });

    const response = await request(app)
      .post('/api/auth/change-password')
      .send({ userId: user.id, newPassword: 'weak' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('contraseña debe tener mínimo 8 caracteres');
  });
});

describe('Users API - /api/users/*', () => {
  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    
    await User.create([
      {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      },
      {
        email: 'manager@example.com',
        password: hashedPassword,
        name: 'Manager User',
        role: 'manager',
        team: 'Engineering',
        hireDate: new Date('2015-01-01')
      },
      {
        email: 'employee@example.com',
        password: hashedPassword,
        name: 'Employee User',
        role: 'employee',
        team: 'Engineering',
        hireDate: new Date('2021-01-01')
      }
    ]);
  });

  test('GET /api/users - administrador ve todos', async () => {
    const admin = await User.findOne({ role: 'administrator' });

    const response = await request(app)
      .get('/api/users')
      .query({ userId: admin.id, role: 'administrator' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(3);
  });

  test('GET /api/users - manager ve equipo propio + sí mismo', async () => {
    const manager = await User.findOne({ role: 'manager' });

    const response = await request(app)
      .get('/api/users')
      .query({ userId: manager.id, role: 'manager', team: 'Engineering' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/users - empleado ve solo su info', async () => {
    const employee = await User.findOne({ role: 'employee' });

    const response = await request(app)
      .get('/api/users')
      .query({ userId: employee.id, role: 'employee' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].email).toBe(employee.email);
  });

  test('GET /api/users/:id - obtener usuario específico', async () => {
    const user = await User.findOne({ role: 'employee' });

    const response = await request(app)
      .get(`/api/users/${user.id}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(user.email);
    expect(response.body.password).toBeUndefined();
  });

  test('GET /api/users/:id - usuario no encontrado', async () => {
    const fakeId = '507f1f77bcf86cd799439111';

    const response = await request(app)
      .get(`/api/users/${fakeId}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Usuario no encontrado');
  });

  test('GET /api/teams - obtener equipos únicos', async () => {
    const response = await request(app)
      .get('/api/teams');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toContain('Management');
    expect(response.body).toContain('Engineering');
  });
});

describe('Requests API - /api/requests/*', () => {
  let admin, manager, employee;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    
    admin = await User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'administrator',
      team: 'Management',
      hireDate: new Date('2010-01-01')
    });
    
    manager = await User.create({
      email: 'manager@example.com',
      password: hashedPassword,
      name: 'Manager User',
      role: 'manager',
      team: 'Engineering',
      hireDate: new Date('2015-01-01')
    });
    
    employee = await User.create({
      email: 'employee@example.com',
      password: hashedPassword,
      name: 'Employee User',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01')
    });
  });

  test('POST /api/requests - crear solicitud exitosa', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: employee.id,
        userName: 'Employee User',
        userRole: 'employee',
        type: 'vacation',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 2,
        comments: 'Testing'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('pending');
    expect(response.body.type).toBe('vacation');
  });

  test('POST /api/requests - anticipación insuficiente', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: employee.id,
        userName: 'Employee User',
        userRole: 'employee',
        type: 'vacation',
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
        days: 1,
        comments: 'Testing'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('3 días de anticipación');
  });

  test('POST /api/requests - PTO más de 2 días', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: employee.id,
        userName: 'Employee User',
        userRole: 'employee',
        type: 'pto',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 3,
        comments: 'Testing'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('no pueden ser de más de 2 días');
  });

  test('GET /api/requests - empleado ve solo sus solicitudes', async () => {
    await Request.create({
      userId: employee.id,
      userName: 'Employee User',
      userRole: 'employee',
      type: 'vacation',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      days: 3,
      status: 'pending'
    });

    const response = await request(app)
      .get('/api/requests')
      .query({ userId: employee.id, role: 'employee' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
  });

  test('GET /api/requests - administrador ve todas', async () => {
    await Request.create([
      {
        userId: employee.id,
        userName: 'Employee User',
        userRole: 'employee',
        type: 'vacation',
        startDate: '2026-04-01',
        endDate: '2020-04-03',
        days: 3,
        status: 'pending'
      },
      {
        userId: employee.id,
        userName: 'Employee User',
        userRole: 'employee',
        type: 'pto',
        startDate: '2026-04-10',
        endDate: '2026-04-11',
        days: 2,
        status: 'approved'
      }
    ]);

    const response = await request(app)
      .get('/api/requests')
      .query({ userId: admin.id, role: 'administrator' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  test('PUT /api/requests/:id - aprobar solicitud', async () => {
    const request1 = await Request.create({
      userId: employee.id,
      userName: 'Employee User',
      userRole: 'employee',
      type: 'vacation',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      days: 3,
      status: 'pending'
    });

    const response = await request(app)
      .put(`/api/requests/${request1.id}`)
      .send({
        status: 'approved',
        approverId: admin.id,
        approverName: 'Admin User'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
    expect(response.body.approverId).toBe(admin.id);
  });

  test('DELETE /api/requests/:id - eliminar solicitud', async () => {
    const request2 = await Request.create({
      userId: employee.id,
      userName: 'Employee User',
      userRole: 'employee',
      type: 'vacation',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      days: 3,
      status: 'pending'
    });

    const response = await request(app)
      .delete(`/api/requests/${request2.id}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Solicitud eliminada');
  });
});

describe('Other API - /api/holidays', () => {
  test('GET /api/holidays - retorna días festivos 2026', async () => {
    const response = await request(app)
      .get('/api/holidays');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(11);
    expect(response.body[0].name).toBe('Año Nuevo');
  });
});
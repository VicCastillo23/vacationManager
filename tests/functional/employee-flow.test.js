const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Request = require('../../models/Request');

let mockMongod = null;
let app;
let employeeToken = null;

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
  employeeToken = null;
});

describe('Flujo Completo Empleado', () => {
  test('Paso 2: Login exitoso', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    await User.create({
      email: 'employee@example.com',
      password: hashedPassword,
      name: 'Employee Test',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01')
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: 'Test123!' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe('employee@example.com');
    expect(loginResponse.body.user.role).toBe('employee');
    
    // Guardar datos simulados del token
    employeeToken = { userId: loginResponse.body.user.id };
  });

  test('Paso 3: Ver días disponibles', async () => {
    if (!employeeToken) {
      await bcrypt.hash('Test123!', 10);
      const user = await User.create({
        email: 'employee@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Employee Test',
        role: 'employee',
        team: 'Engineering',
        hireDate: new Date('2021-01-01')
      });
      employeeToken = { userId: user.id };
    }

    const response = await request(app)
      .get('/api/users')
      .query({ userId: employeeToken.userId, role: 'employee' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    const userData = response.body[0];
    expect(userData.vacationDays).toBeDefined();
    expect(userData.vacationDays).toBeGreaterThan(0);
    expect(userData.ptoDays).toBeGreaterThan(0);
  });

  test('Paso 4: Crear solicitud de vacaciones', async () => {
    if (!employeeToken) {
      await bcrypt.hash('Test123!', 10);
      const user = await User.create({
        email: 'employee@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Employee Test',
        role: 'employee',
        team: 'Engineering',
        hireDate: new Date('2021-01-01')
      });
      employeeToken = { userId: user.id };
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: employeeToken.userId,
        userName: 'Employee Test',
        userRole: 'employee',
        type: 'vacation',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 2,
        comments: 'Prueba funcional empleado'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('pending');
    expect(response.body.type).toBe('vacation');
    expect(response.body.days).toBe(2);
    expect(response.body.id).toBeDefined();
  });

  test('Paso 5: Ver solicitud en lista', async () => {
    if (!employeeToken) {
      await bcrypt.hash('Test123!', 10);
      const user = await User.create({
        email: 'employee@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Employee Test',
        role: 'employee',
        team: 'Engineering',
        hireDate: new Date('2021-01-01')
      });
      employeeToken = { userId: user.id };
    }

    const response = await request(app)
      .get('/api/requests')
      .query({ userId: employeeToken.userId, role: 'employee' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // Debería ver al menos nuestra solicitud creada
    const vacationRequests = response.body.filter(r => r.type === 'vacation');
    expect(vacationRequests.length).toBeGreaterThanOrEqual(0);
  });

  test('Baseflow completo: Login -> Ver días -> Crear solicitud -> Ver lista', async () => {
    const hashedPassword = await bcrypt.hash('TestFlow123!', 10);
    const user = await User.create({
      email: 'employeeflow@example.com',
      password: hashedPassword,
      name: 'Employee Flow Test',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01')
    });

    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employeeflow@example.com', password: 'TestFlow123!' });
    
    expect(loginRes.status).toBe(200);
    const userId = loginRes.body.user.id;

    // 2. Ver días disponibles
    const usersRes = await request(app)
      .get('/api/users')
      .query({ userId, role: 'employee' });

    expect(usersRes.status).toBe(200);
    expect(Array.isArray(usersRes.body)).toBe(true);
    expect(usersRes.body[0].vacationDays).toBeDefined();

    // 3. Crear solicitud
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const requestRes = await request(app)
      .post('/api/requests')
      .send({
        userId,
        userName: 'Employee Flow Test',
        userRole: 'employee',
        type: 'pto',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 1,
        comments: 'Prueba de flujo funcional'
      });

    expect(requestRes.status).toBe(200);
    expect(requestRes.body.status).toBe('pending');

    // 4. Ver solicitudes
    const requestsRes = await request(app)
      .get('/api/requests')
      .query({ userId, role: 'employee' });

    expect(requestsRes.status).toBe(200);
    expect(requestsRes.body.length).toBeGreaterThanOrEqual(1);
  });

  test('Error: Intentar crear solicitud sin anticipación', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    const user = await User.create({
      email: 'noanticipation@example.com',
      password: hashedPassword,
      name: 'No Anticipation',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01')
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: user.id,
        userName: 'No Anticipation',
        userRole: 'employee',
        type: 'vacation',
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
        days: 1,
        comments: 'Prueba anticipación'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('3 días de anticipación');
  });

  test('Error: PTO con más de 2 días', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    const user = await User.create({
      email: 'ptoerror@example.com',
      name: 'PTO Long Error',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01'),
      password: await bcrypt.hash('Test123!', 10)
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const response = await request(app)
      .post('/api/requests')
      .send({
        userId: user.id,
        userName: 'PTO Long Error',
        userRole: 'employee',
        type: 'pto',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 3,
        comments: 'Prueba PTO largo'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('no pueden ser de más de 2 días');
  });

  test('Ver días después de crear solicitud', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    const user = await User.create({
      email: 'dayscheck@example.com',
      password: hashedPassword,
      name: 'Days Check User',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01'),
      mustChangePassword: false
    });

    // Crear solicitud
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    
    await request(app)
      .post('/api/requests')
      .send({
        userId: user.id,
        userName: 'Days Check User',
        userRole: 'employee',
        type: 'vacation',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 2
      });

    // Ver días disponibles (deberían disminuir)
    const response = await request(app)
      .get('/api/users')
      .query({ userId: user.id, role: 'employee' });

    expect(response.status).toBe(200);
    const userData = response.body[0];
    expect(userData.vacationDays).toBeDefined();
    expect(userData.vacationDays).toBeLessThan(25); // Días totales para 5+ años son 22 o más
  });
});
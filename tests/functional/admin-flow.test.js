const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Request = require('../../models/Request');

let mockMongod = null;
let app;
let adminToken = null;

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
  adminToken = null;
});

describe('Flujo Completo Admin', () => {
  test('Login de admin', async () => {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin Test',
      role: 'administrator',
      team: 'Management',
      hireDate: new Date('2010-01-01')
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!' });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('administrator');
    adminToken = response.body.user.id;
  });

  test('Ver todos los usuarios', async () => {
    if (!adminToken) {
      const admin = await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Admin Test',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      });
      adminToken = admin.id;
    }

    await User.create([
      {
        email: 'user1@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'User 1',
        role: 'employee',
        team: 'Engineering',
        hireDate: new Date('2020-01-01')
      },
      {
        email: 'user2@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'User 2',
        role: 'manager',
        team: 'Sales',
        hireDate: new Date('2015-01-01')
      }
    ]);

    const response = await request(app)
      .get('/api/users')
      .query({ userId: adminToken, role: 'administrator' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(3);
  });

  test('Ver todas las solicitudes de todo el sistema', async () => {
    if (!adminToken) {
      const admin = await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Admin Test',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      });
      adminToken = admin.id;
    }

    const user1 = await User.create({
      email: 'user1@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'User 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2020-01-01')
    });

    const user2 = await User.create({
      email: 'user2@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'User 2',
      role: 'employee',
      team: 'Sales',
      hireDate: new Date('2021-01-01')
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    await Request.create([
      {
        userId: user1.id,
        userName: 'User 1',
        userRole: 'employee',
        type: 'vacation',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 3,
        status: 'pending'
      },
      {
        userId: user2.id,
        userName: 'User 2',
        userRole: 'employee',
        type: 'pto',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 1,
        status: 'approved'
      }
    ]);

    const response = await request(app)
      .get('/api/requests')
      .query({ userId: adminToken, role: 'administrator' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  test('Aprobar cualquier solicitud del sistema', async () => {
    if (!adminToken) {
      const admin = await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Admin Test',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      });
      adminToken = admin.id;
    }

    const employee = await User.create({
      email: 'user1@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'User 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2020-01-01')
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const medRequest = await Request.create({
      userId: employee.id,
      userName: 'User 1',
      userRole: 'employee',
      type: 'medical-leave',
      startDate: futureDate.toISOString().split('T')[0],
      endDate: futureDate.toISOString().split('T')[0],
      days: 1,
      status: 'pending'
    });

    const response = await request(app)
      .put(`/api/requests/${medRequest.id}`)
      .send({
        status: 'approved',
        approverId: adminToken,
        approverName: 'Admin Test'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
    expect(response.body.approverId).toBeDefined();
  });

  test('Crear nuevo usuario', async () => {
    // Crear admin primero
    if (!adminToken) {
      const admin = await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Admin Test',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      });
      adminToken = admin.id;
    }

    // Crear nuevo usuario (debería ser posible para admin)
    const newUser = await User.create({
      email: 'new@example.com',
      password: await bcrypt.hash('NewUser123!', 10),
      name: 'New Employee',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2023-01-01')
    });

    expect(newUser.email).toBe('new@example.com');
    expect(newUser.role).toBe('employee');
    expect(newUser._id).toBeDefined();
    
    // Verificar que el usuario puede leer su propia información
    const verifyResponse = await request(app)
      .get('/api/users')
      .query({ 
        userId: newUser.id, 
        role: 'employee'
      });

    expect(verifyResponse.status).toBe(200);
    expect(Array.isArray(verifyResponse.body)).toBe(true);
    expect(verifyResponse.body[0].email).toBe('new@example.com');
  });

  test('Ver estadísticas globales', async () => {
    if (!adminToken) {
      const admin = await User.create({
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin123!', 10),
        name: 'Admin Test',
        role: 'administrator',
        team: 'Management',
        hireDate: new Date('2010-01-01')
      });
      adminToken = admin.id;
    }

    // Crear múltiples solicitudes
    const employee = await User.create({
      email: 'employee@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'Employee 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2022-01-01')
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    await Request.create([
      {
        userId: employee.id,
        userName: 'Employee 1',
        userRole: 'employee',
        type: 'vacation',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 5,
        status: 'approved'
      },
      {
        userId: employee.id,
        userName: 'Employee 1',
        userRole: 'employee',
        type: 'pto',
        startDate: futureDate.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        days: 2,
        status: 'pending'
      }
    ]);

    // Verificar stats a través de solicitudes
    const response = await request(app)
      .get('/api/requests')
      .query({ userId: adminToken, role: 'administrator' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    const pending = response.body.filter(r => r.status === 'pending');
    const approved = response.body.filter(r => r.status === 'approved');
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(approved.length).toBeGreaterThanOrEqual(1);
  });
});
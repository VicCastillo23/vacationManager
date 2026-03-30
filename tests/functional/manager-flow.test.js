const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Request = require('../../models/Request');

let mockMongod = null;
let app;
let managerToken = null;

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
  managerToken = null;
});

describe('Flujo Completo Manager', () => {
  test('Login de manager', async () => {
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    await User.create({
      email: 'manager@example.com',
      password: hashedPassword,
      name: 'Manager Test',
      role: 'manager',
      team: 'Engineering',
      hireDate: new Date('2015-01-01')
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@example.com', password: 'Test123!' });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('manager');
    managerToken = { userId: response.body.user.id, role: 'manager', team: 'Engineering' };
  });

  test('Ver solicitudes del equipo', async () => {
    if (!managerToken) {
      await bcrypt.hash('Test123!', 10);
      const user = await User.create({
        email: 'manager@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Manager Test',
        role: 'manager',
        team: 'Engineering',
        hireDate: new Date('2015-01-01')
      });
      managerToken = { userId: user.id, role: 'manager', team: 'Engineering' };
    }

    const employee1 = await User.create({
      email: 'team1@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'Team Member 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2020-01-01')
    });

    await User.create({
      email: 'team2@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'Team Member 2',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2021-01-01')
    });

    // Crear solicitud para empleado1
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    await Request.create({
      userId: employee1.id,
      userName: 'Team Member 1',
      userRole: 'employee',
      type: 'vacation',
      startDate: futureDate.toISOString().split('T')[0],
      endDate: futureDate.toISOString().split('T')[0],
      days: 2,
      status: 'pending'
    });

    const response = await request(app)
      .get('/api/requests')
      .query({ 
        userId: managerToken.userId, 
        role: managerToken.role, 
        team: managerToken.team 
      });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('Aprobar solicitud de empleado', async () => {
    // Setup: crear manager y empleado con solicitud pendiente
    if (!managerToken) {
      await bcrypt.hash('Test123!', 10);
      const manager = await User.create({
        email: 'manager@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Manager Test',
        role: 'manager',
        team: 'Engineering',
        hireDate: new Date('2015-01-01')
      });
      managerToken = { userId: manager.id, role: 'manager', team: 'Engineering', name: 'Manager Test' };
    }

    const employee = await User.create({
      email: 'team1@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'Team Member 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2020-01-01')
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const vacRequest = await Request.create({
      userId: employee.id,
      userName: 'Team Member 1',
      userRole: 'employee',
      type: 'vacation',
      startDate: futureDate.toISOString().split('T')[0],
      endDate: futureDate.toISOString().split('T')[0],
      days: 2,
      status: 'pending'
    });

    const response = await request(app)
      .put(`/api/requests/${vacRequest.id}`)
      .send({
        status: 'approved',
        approverId: managerToken.userId,
        approverName: managerToken.name
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
    expect(response.body.approverId).toBeDefined();
    expect(response.body.approverName).toBe(managerToken.name);
  });

  test('Rechazar solicitud', async () => {
    if (!managerToken) {
      await bcrypt.hash('Test123!', 10);
      const manager = await User.create({
        email: 'manager@example.com',
        password: await bcrypt.hash('Test123!', 10),
        name: 'Manager Test',
        role: 'manager',
        team: 'Engineering',
        hireDate: new Date('2015-01-01')
      });
      managerToken = { userId: manager.id, role: 'manager', team: 'Engineering', name: 'Manager Test' };
    }

    const employee = await User.create({
      email: 'team1@example.com',
      password: await bcrypt.hash('Test123!', 10),
      name: 'Team Member 1',
      role: 'employee',
      team: 'Engineering',
      hireDate: new Date('2020-01-01')
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const vacRequest = await Request.create({
      userId: employee.id,
      userName: 'Team Member 1',
      userRole: 'employee',
      type: 'pto',
      startDate: futureDate.toISOString().split('T')[0],
      endDate: futureDate.toISOString().split('T')[0],
      days: 1,
      status: 'pending'
    });

    const response = await request(app)
      .put(`/api/requests/${vacRequest.id}`)
      .send({
        status: 'rejected',
        approverId: managerToken.userId,
        approverName: managerToken.name
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('rejected');
  });
});
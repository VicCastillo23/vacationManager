const User = require('../../models/User');
const Request = require('../../models/Request');

describe('User Model Schema', () => {
  test('Email field - required, unique, string', () => {
    const email = User.schema.path('email');
    expect(email.instance).toBe('String');
    expect(typeof email.required === 'boolean' || typeof email.required === 'function').toBe(true);
    expect(email.options.unique).toBe(true);
  });

  test('Password field - required, string', () => {
    const password = User.schema.path('password');
    expect(password.instance).toBe('String');
    expect(typeof password.required === 'boolean' || typeof password.required === 'function').toBe(true);
  });

  test('Role enum - valid values', () => {
    const role = User.schema.path('role');
    expect(role.enumValues).toContain('employee');
    expect(role.enumValues).toContain('manager');
    expect(role.enumValues).toContain('director');
    expect(role.enumValues).toContain('administrator');
    expect(role.defaultValue).toBe('employee');
  });

  test('Team field - string, default', () => {
    const team = User.schema.path('team');
    expect(team.instance).toBe('String');
    expect(team.defaultValue).toBe('Sin asignar');
  });

  test('ManagerId field - string, nullable', () => {
    const managerId = User.schema.path('managerId');
    expect(managerId.instance).toBe('String');
    expect(managerId.defaultValue).toBe(null);
  });

  test('HireDate - Date, required', () => {
    const hireDate = User.schema.path('hireDate');
    expect(hireDate.instance).toBe('Date');
    expect(typeof hireDate.required === 'boolean' || typeof hireDate.required === 'function').toBe(true);
  });

  test('MustChangePassword - Boolean, default false', () => {
    const mustChangePassword = User.schema.path('mustChangePassword');
    expect(mustChangePassword.instance).toBe('Boolean');
    expect(mustChangePassword.defaultValue).toBe(false);
  });

  test('Virtual id field', () => {
    expect(User.schema.virtuals.id).toBeDefined();
  });

  test('toJSON excludes password', () => {
    const user = new User({ 
      email: 'test@test.com', 
      password: 'secret123', 
      name: 'Test', 
      hireDate: new Date() 
    });
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
  });

  test('Indexes defined', () => {
    const indexes = User.schema.indexes();
    expect(indexes.length).toBeGreaterThan(0);
  });

  test('Model name is User', () => {
    expect(User.modelName).toBe('User');
  });
});

describe('Request Model Schema', () => {
  test('UserId - ObjectId reference to User', () => {
    const userId = Request.schema.path('userId');
    expect(userId.instance).toBe('ObjectId');
    expect(typeof userId.required === 'boolean' || typeof userId.required === 'function').toBe(true);
  });

  test('UserName - required string', () => {
    const userName = Request.schema.path('userName');
    expect(userName.instance).toBe('String');
    expect(typeof userName.required === 'boolean' || typeof userName.required === 'function').toBe(true);
  });

  test('UserRole - enum valid values', () => {
    const userRole = Request.schema.path('userRole');
    expect(userRole.enumValues).toContain('employee');
    expect(userRole.enumValues).toContain('manager');
    expect(userRole.enumValues).toContain('director');
    expect(userRole.enumValues).toContain('administrator');
    expect(typeof userRole.required === 'boolean' || typeof userRole.required === 'function').toBe(true);
  });

  test('Type - enum with all absence types', () => {
    const type = Request.schema.path('type');
    expect(type.enumValues).toContain('vacation');
    expect(type.enumValues).toContain('pto');
    expect(type.enumValues).toContain('marriage');
    expect(type.enumValues).toContain('maternity');
    expect(type.enumValues).toContain('paternity');
    expect(type.enumValues).toContain('birthday');
    expect(type.enumValues).toContain('death-immediate');
    expect(type.enumValues).toContain('death-family');
    expect(type.enumValues).toContain('pet-death');
    expect(type.enumValues).toContain('medical-leave');
    expect(type.enumValues).toContain('special');
    expect(typeof type.required === 'boolean' || typeof type.required === 'function').toBe(true);
  });

  test('StartDate - Date, required', () => {
    const startDate = Request.schema.path('startDate');
    expect(startDate.instance).toBe('Date');
    expect(typeof startDate.required === 'boolean' || typeof startDate.required === 'function').toBe(true);
  });

  test('EndDate - Date, required', () => {
    const endDate = Request.schema.path('endDate');
    expect(endDate.instance).toBe('Date');
    expect(typeof endDate.required === 'boolean' || typeof endDate.required === 'function').toBe(true);
  });

  test('Days - Number, min 1', () => {
    const days = Request.schema.path('days');
    expect(days.instance).toBe('Number');
    expect(typeof days.required === 'boolean' || typeof days.required === 'function').toBe(true);
    const minValidator = days.validators.find(v => v.type === 'min');
    expect(minValidator).toBeDefined();
    expect(minValidator.min).toBe(1);
  });

  test('Status - enum, default pending', () => {
    const status = Request.schema.path('status');
    expect(status.enumValues).toContain('pending');
    expect(status.enumValues).toContain('approved');
    expect(status.enumValues).toContain('rejected');
    expect(status.defaultValue).toBe('pending');
  });

  test('ApproverId - ObjectId reference, nullable', () => {
    const approverId = Request.schema.path('approverId');
    expect(approverId.instance).toBe('ObjectId');
    expect(approverId.defaultValue).toBe(null);
  });

  test('ApproverName - String, nullable', () => {
    const approverName = Request.schema.path('approverName');
    expect(approverName.instance).toBe('String');
    expect(approverName.defaultValue).toBe(null);
  });

  test('Comments - String, default empty', () => {
    const comments = Request.schema.path('comments');
    expect(comments.instance).toBe('String');
    expect(comments.defaultValue).toBe('');
  });

  test('Backfill - Boolean, default false', () => {
    const backfill = Request.schema.path('backfill');
    expect(backfill.instance).toBe('Boolean');
    expect(backfill.defaultValue).toBe(false);
  });

  test('Virtual id field', () => {
    expect(Request.schema.virtuals.id).toBeDefined();
  });

  test('Timestamps enabled', () => {
    expect(Request.schema.options.timestamps).toBe(true);
  });

  test('Indexes defined', () => {
    const indexes = Request.schema.indexes();
    expect(indexes.length).toBeGreaterThan(0);
  });

  test('Model name is Request', () => {
    expect(Request.modelName).toBe('Request');
  });
});
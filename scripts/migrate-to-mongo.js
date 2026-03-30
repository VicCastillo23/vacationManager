require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const { connectDB, disconnectDB } = require('../lib/database');
const User = require('../models/User');
const Request = require('../models/Request');

// Configuración de encriptación (debe coincidir con server.js para poder leer el archivo actual)
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key-change-in-production').digest();
const IV_LENGTH = 16;

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

// Helper: Leer base de datos JSON (desencriptada)
function readJSONDB() {
  const DB_PATH = process.env.DB_PATH || 'data/db.json';
  
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
      return db;
    } catch (err) {
      console.error('Error al leer la base de datos:', err);
      throw err;
    }
  }
}

async function migrate() {
  console.log('🚀 Iniciando migración de JSON encriptado a MongoDB...\n');
  
  // Conectar a MongoDB
  await connectDB();
  
  // Leer datos del JSON actual
  const dbData = readJSONDB();
  console.log(`📊 Datos leídos: ${dbData.users.length} usuarios, ${dbData.requests.length} solicitudes\n`);
  
  // Migrar usuarios
  console.log('👤 Migrando usuarios...');
  let usersCreated = 0;
  let usersUpdated = 0;
  
  for (const user of dbData.users) {
    try {
      // Verificar si el usuario ya existe por email
      const existingUser = await User.findOne({ email: user.email });
      
      const userData = {
        email: user.email,
        password: user.password,
        name: user.name,
        role: user.role,
        team: user.team,
        managerId: user.managerId || null,
        hireDate: new Date(user.hireDate),
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date()
      };
      
      if (existingUser) {
        // Actualizar usuario existente
        await User.updateOne({ _id: existingUser._id }, userData);
        usersUpdated++;
        console.log(`  ⟳ Actualizado: ${user.email}`);
      } else {
        // Crear nuevo usuario
        await User.create(userData);
        usersCreated++;
        console.log(`  ✅ Creado: ${user.email}`);
      }
    } catch (error) {
      console.error(`  ❌ Error migrando usuario ${user.email}:`, error.message);
    }
  }
  
  console.log(`\n📋 Usuarios creados: ${usersCreated}`);
  console.log(`📋 Usuarios actualizados: ${usersUpdated}\n`);
  
  // Migrar solicitudes
  console.log('📝 Migrando solicitudes...');
  let requestsCreated = 0;
  let requestsSkipped = 0;
  
  // Crear mapa de nombre -> _id de usuario para referencias
  const userMap = {};
  const allUsers = await User.find({});
  allUsers.forEach(u => {
    userMap[u.name] = u._id;
  });
  
  for (const request of dbData.requests) {
    try {
      // Buscar el ObjectId del usuario por email
      const userId = userMap[request.userName];
      
      if (!userId) {
        console.log(`  ⚠️  Omitido: usuario no encontrado (${request.userName})`);
        requestsSkipped++;
        continue;
      }
      
      const requestData = {
        userId,
        userName: request.userName,
        userRole: request.userRole,
        type: request.type,
        startDate: new Date(request.startDate),
        endDate: new Date(request.endDate),
        days: request.days,
        status: request.status,
        approverId: request.approverId || null,
        approverName: request.approverName || null,
        comments: request.comments || '',
        backfill: request.backfill || false,
        createdAt: request.createdAt ? new Date(request.createdAt) : new Date(),
        updatedAt: request.updatedAt ? new Date(request.updatedAt) : null
      };
      
      // Verificar si ya existe la solicitud (mismos campos para evitar duplicados)
      const existingRequest = await Request.findOne({
        userId,
        userName: request.userName,
        type: request.type,
        startDate: requestData.startDate,
        endDate: requestData.endDate,
        days: request.days
      });
      
      if (existingRequest) {
        console.log(`  ⟳ Ya exists: ${request.userName} - ${request.type} (${request.startDate})`);
        requestsSkipped++;
        continue;
      }
      
      await Request.create(requestData);
      requestsCreated++;
      console.log(`  ✅ Creada: ${request.userName} - ${request.type} (${request.startDate})`);
    } catch (error) {
      console.error(`  ❌ Error migrando solicitud:`, error.message);
    }
  }
  
  console.log(`\n📋 Solicitudes creadas: ${requestsCreated}`);
  console.log(`📋 Solicitudes omitidas: ${requestsSkipped}\n`);
  
  // Desconectar
  await disconnectDB();
  
  console.log('✅ Migración completada exitosamente!\n');
  console.log('💡 Siguiente paso: Actualiza .env con tu MONGODB_URI del servidor de producción');
}

// Ejecutar migración
migrate().catch(error => {
  console.error('💥 Error fatal en migración:', error);
  process.exit(1);
});
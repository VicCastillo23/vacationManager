const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vacation-manager';

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGODB_URI);

    console.log(`📦 MongoDB conectado: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error en conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
    });

    return conn;
  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error);
    process.exit(1);
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('📦 MongoDB desconectado');
  } catch (error) {
    console.error('❌ Error al desconectar MongoDB:', error);
  }
}

module.exports = { connectDB, disconnectDB };
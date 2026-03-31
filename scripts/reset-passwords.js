#!/usr/bin/env node

/**
 * Script para resetear contraseñas de usuarios en MongoDB a Temporal123!
 * Uso: node scripts/reset-passwords.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../lib/database');
const User = require('../models/User');

async function resetPasswords() {
  const NEW_PASSWORD = 'Temporal123!';

  try {
    console.log('📦 Conectando a MongoDB...');
    await connectDB();

    const totalUsers = await User.countDocuments({});
    if (totalUsers === 0) {
      console.log('⚠️  No hay usuarios para actualizar.');
      await disconnectDB();
      return;
    }

    console.log('🔑 Generando hash para Temporal123!...');
    const newPasswordHash = await bcrypt.hash(NEW_PASSWORD, 10);

    console.log('✏️  Actualizando usuarios...');
    const result = await User.updateMany(
      {},
      {
        $set: {
          password: newPasswordHash,
          mustChangePassword: true
        }
      }
    );

    console.log(`\n✅ ¡${result.modifiedCount} usuario(s) actualizados en MongoDB!`);
    console.log(`   Nueva contraseña para todos los usuarios: ${NEW_PASSWORD}`);
    console.log('   Todos los usuarios deberán cambiarla en el siguiente inicio de sesión.\n');

    await disconnectDB();
  } catch (error) {
    console.error('❌ Error al resetear contraseñas:', error.message);
    try {
      await disconnectDB();
    } catch (_) {}
    process.exit(1);
  }
}

resetPasswords();

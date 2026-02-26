#!/usr/bin/env node

/**
 * Script para resetear contraseñas de usuarios a Password123!
 * Uso: node scripts/reset-passwords.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ENV = process.env.NODE_ENV || 'production';
const DB_FILE = ENV === 'test' ? 'db-test.json' : 'db.json';
const DB_PATH = path.join(__dirname, '..', 'data', DB_FILE);
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key-change-in-production').digest();
const IV_LENGTH = 16;

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function resetPasswords() {
  try {
    console.log('📖 Leyendo base de datos encriptada...');
    const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
    const decryptedData = decrypt(encryptedData);
    const db = JSON.parse(decryptedData);
    
    console.log('🔑 Generando nuevo hash para Password123!...');
    const newPasswordHash = await bcrypt.hash('Password123!', 10);
    
    console.log('✏️  Actualizando contraseñas...');
    let updated = 0;
    for (let user of db.users) {
      user.password = newPasswordHash;
      user.mustChangePassword = false;
      updated++;
    }
    
    console.log('💾 Guardando base de datos encriptada...');
    const jsonData = JSON.stringify(db, null, 2);
    const encryptedNewData = encrypt(jsonData);
    fs.writeFileSync(DB_PATH, encryptedNewData, 'utf8');
    
    console.log(`\n✅ ¡${updated} contraseñas actualizadas exitosamente!`);
    console.log('   Nueva contraseña para todos los usuarios: Password123!\n');
    
  } catch (error) {
    console.error('❌ Error al resetear contraseñas:', error.message);
    console.error(error);
    process.exit(1);
  }
}

resetPasswords();

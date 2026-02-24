#!/usr/bin/env node

/**
 * Script para resetear todas las contraseñas a 123456
 * y forzar cambio de contraseña (excepto Vicente admin)
 * Uso: node scripts/reset-passwords-simple.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key-change-in-production').digest();
const IV_LENGTH = 16;
const NEW_PASSWORD = '123456';

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
    // Leer y desencriptar base de datos
    const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
    const decryptedData = decrypt(encryptedData);
    const db = JSON.parse(decryptedData);
    
    console.log('\n=== RESETEANDO CONTRASEÑAS ===\n');
    
    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
    
    // Resetear contraseñas de todos los usuarios
    for (const user of db.users) {
      user.password = hashedPassword;
      
      // Forzar cambio de contraseña para todos excepto Vicente (admin)
      if (user.name.toLowerCase().includes('vicente') && user.role === 'administrator') {
        user.mustChangePassword = false;
        console.log(`✅ ${user.name} (${user.email}) - Contraseña reseteada (NO requiere cambio)`);
      } else {
        user.mustChangePassword = true;
        console.log(`✅ ${user.name} (${user.email}) - Contraseña reseteada (requiere cambio)`);
      }
    }
    
    // Encriptar y guardar
    const newEncryptedData = encrypt(JSON.stringify(db, null, 2));
    fs.writeFileSync(DB_PATH, newEncryptedData, 'utf8');
    
    console.log('\n✅ Todas las contraseñas han sido reseteadas a: 123456');
    console.log('📋 Los usuarios deberán cambiar su contraseña en el primer login (excepto Vicente)\n');
  } catch (error) {
    console.error('❌ Error al resetear contraseñas:', error.message);
    process.exit(1);
  }
}

resetPasswords();

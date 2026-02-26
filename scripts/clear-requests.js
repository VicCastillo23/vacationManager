#!/usr/bin/env node

/**
 * Script para eliminar todas las solicitudes de la base de datos
 * Mantiene los usuarios intactos
 * Uso: node scripts/clear-requests.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

try {
  // Leer y desencriptar base de datos
  const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
  const decryptedData = decrypt(encryptedData);
  const db = JSON.parse(decryptedData);
  
  console.log(`\n=== LIMPIANDO SOLICITUDES (${ENV.toUpperCase()}) ===\n`);
  console.log(`Solicitudes actuales: ${db.requests?.length || 0}`);
  
  // Eliminar todas las solicitudes
  db.requests = [];
  
  // Encriptar y guardar
  const newEncryptedData = encrypt(JSON.stringify(db, null, 2));
  fs.writeFileSync(DB_PATH, newEncryptedData, 'utf8');
  
  console.log('✅ Todas las solicitudes han sido eliminadas');
  console.log(`Usuarios mantenidos: ${db.users?.length || 0}`);
  console.log('\n');
} catch (error) {
  console.error('❌ Error al limpiar solicitudes:', error.message);
  process.exit(1);
}

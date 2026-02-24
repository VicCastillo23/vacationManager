#!/usr/bin/env node

/**
 * Script para ver la base de datos desencriptada
 * SOLO PARA DEBUGGING - NO USAR EN PRODUCCIÓN
 * Uso: node scripts/view-db.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
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

try {
  const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
  const decryptedData = decrypt(encryptedData);
  const db = JSON.parse(decryptedData);
  
  console.log('\n=== BASE DE DATOS DESENCRIPTADA ===\n');
  console.log(JSON.stringify(db, null, 2));
  console.log('\n=== ESTADÍSTICAS ===');
  console.log(`Usuarios: ${db.users?.length || 0}`);
  console.log(`Solicitudes: ${db.requests?.length || 0}`);
  console.log('\n');
} catch (error) {
  console.error('Error al desencriptar la base de datos:', error.message);
  process.exit(1);
}

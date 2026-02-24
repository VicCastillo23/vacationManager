#!/usr/bin/env node

/**
 * Script para encriptar la base de datos existente
 * Uso: node scripts/encrypt-db.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'db.json.backup');
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'default-key-change-in-production').digest();
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function isEncrypted(data) {
  // Si el archivo contiene ':' y es hexadecimal, probablemente está encriptado
  return data.includes(':') && /^[0-9a-f]+:[0-9a-f]+$/i.test(data.trim());
}

try {
  console.log('📖 Leyendo base de datos...');
  const rawData = fs.readFileSync(DB_PATH, 'utf8');
  
  if (isEncrypted(rawData)) {
    console.log('✅ La base de datos ya está encriptada.');
    process.exit(0);
  }
  
  // Crear backup
  console.log('💾 Creando backup en:', BACKUP_PATH);
  fs.writeFileSync(BACKUP_PATH, rawData, 'utf8');
  
  // Validar que sea JSON válido
  console.log('✅ Validando JSON...');
  const db = JSON.parse(rawData);
  
  // Encriptar
  console.log('🔒 Encriptando base de datos...');
  const jsonData = JSON.stringify(db, null, 2);
  const encryptedData = encrypt(jsonData);
  
  // Guardar
  console.log('💾 Guardando base de datos encriptada...');
  fs.writeFileSync(DB_PATH, encryptedData, 'utf8');
  
  console.log('\n✅ ¡Base de datos encriptada exitosamente!');
  console.log(`   Backup guardado en: ${BACKUP_PATH}`);
  console.log(`   Usuarios: ${db.users?.length || 0}`);
  console.log(`   Solicitudes: ${db.requests?.length || 0}\n`);
  
} catch (error) {
  console.error('❌ Error al encriptar la base de datos:', error.message);
  console.error(error);
  process.exit(1);
}

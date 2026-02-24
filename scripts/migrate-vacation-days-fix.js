#!/usr/bin/env node

/**
 * Script para corregir días de vacaciones según antigüedad
 * - vacationDays debe ser los días DISPONIBLES (lo que le queda)
 * - El servidor calcula totalVacationDays según antigüedad
 * Uso: node scripts/migrate-vacation-days-fix.js
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

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function calculateVacationDays(hireDate) {
  const hire = new Date(hireDate);
  const today = new Date();
  const yearsOfService = Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
  
  if (yearsOfService < 1) return 12;
  if (yearsOfService === 1) return 12;
  if (yearsOfService === 2) return 16;
  if (yearsOfService === 3) return 18;
  if (yearsOfService === 4) return 20;
  if (yearsOfService === 5) return 22;
  if (yearsOfService >= 6 && yearsOfService <= 9) return 24;
  if (yearsOfService >= 10 && yearsOfService <= 14) return 26;
  if (yearsOfService >= 15 && yearsOfService <= 19) return 28;
  if (yearsOfService >= 20 && yearsOfService <= 24) return 30;
  if (yearsOfService >= 25 && yearsOfService <= 29) return 32;
  if (yearsOfService >= 30) return 34;
  return 12;
}

function calculateYearsOfService(hireDate) {
  const hire = new Date(hireDate);
  const today = new Date();
  return Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
}

async function migrateVacationDays() {
  try {
    console.log('📖 Leyendo base de datos encriptada...');
    const encryptedData = fs.readFileSync(DB_PATH, 'utf8');
    const decryptedData = decrypt(encryptedData);
    const db = JSON.parse(decryptedData);
    
    console.log('✏️  Migrando días de vacaciones...\n');
    
    for (let user of db.users) {
      const totalDays = calculateVacationDays(user.hireDate);
      const years = calculateYearsOfService(user.hireDate);
      
      // Calcular días usados de las solicitudes aprobadas
      const approvedVacations = db.requests.filter(r => 
        r.userId === user.id && 
        r.type === 'vacation' && 
        r.status === 'approved'
      );
      
      const daysUsed = approvedVacations.reduce((sum, r) => sum + r.days, 0);
      const daysAvailable = totalDays - daysUsed;
      
      console.log(`👤 ${user.name}`);
      console.log(`   Antigüedad: ${years} años`);
      console.log(`   Días totales: ${totalDays}`);
      console.log(`   Días usados: ${daysUsed}`);
      console.log(`   Días disponibles: ${daysAvailable}`);
      console.log(`   Anterior vacationDays: ${user.vacationDays} → Nuevo: ${daysAvailable}\n`);
      
      user.vacationDays = daysAvailable;
    }
    
    console.log('💾 Guardando base de datos encriptada...');
    const jsonData = JSON.stringify(db, null, 2);
    const encryptedNewData = encrypt(jsonData);
    fs.writeFileSync(DB_PATH, encryptedNewData, 'utf8');
    
    console.log('\n✅ ¡Migración completada exitosamente!\n');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateVacationDays();

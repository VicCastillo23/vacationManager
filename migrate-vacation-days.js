const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Función para calcular días de vacaciones según antigüedad
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

// Leer la base de datos
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔄 Iniciando migración de días de vacaciones...\n');

// Actualizar cada usuario
db.users.forEach(user => {
  const yearsOfService = calculateYearsOfService(user.hireDate);
  const totalVacationDays = calculateVacationDays(user.hireDate);
  
  // Si el usuario actualmente tiene más días disponibles que los que le corresponden,
  // ajustar proporcionalmente
  const oldTotal = 15; // Asumiendo que antes todos tenían 15
  const currentUsed = oldTotal - user.vacationDays;
  const newAvailable = Math.max(0, totalVacationDays - currentUsed);
  
  console.log(`📝 ${user.name}:`);
  console.log(`   - Antigüedad: ${yearsOfService} años`);
  console.log(`   - Días totales: ${oldTotal} → ${totalVacationDays}`);
  console.log(`   - Días disponibles: ${user.vacationDays} → ${newAvailable}`);
  
  user.vacationDays = newAvailable;
  
  // Resetear PTO a 5 si está por debajo
  if (user.ptoDays < 0) {
    console.log(`   - PTO corregido: ${user.ptoDays} → 5`);
    user.ptoDays = 5;
  }
  
  console.log('');
});

// Guardar cambios
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('✅ Migración completada exitosamente!');
console.log(`📊 ${db.users.length} usuarios actualizados.`);

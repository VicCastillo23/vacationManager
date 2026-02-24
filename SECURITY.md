# Seguridad y Encriptación de la Base de Datos

## 🔒 Encriptación AES-256

La base de datos (`data/db.json`) está completamente encriptada utilizando el algoritmo **AES-256-CBC**, uno de los estándares de encriptación más seguros disponibles.

### Características de Seguridad

- **Algoritmo**: AES-256-CBC (Advanced Encryption Standard con 256 bits)
- **Vector de Inicialización (IV)**: Aleatorio de 16 bytes por cada encriptación
- **Clave**: Derivada de una contraseña mediante SHA-256
- **Formato**: `IV:datos_encriptados` (en hexadecimal)

### Configuración

La clave de encriptación se configura en el archivo `.env`:

```bash
ENCRYPTION_KEY=VacationManagerSecretKey2026!!
```

⚠️ **IMPORTANTE**: 
- Cambia esta clave en producción
- Nunca subas el archivo `.env` al repositorio (ya está en `.gitignore`)
- Guarda la clave en un lugar seguro (gestor de contraseñas, vault, etc.)
- Si pierdes la clave, NO podrás recuperar los datos

### Scripts de Utilidad

#### Ver la base de datos (debugging)
```bash
node scripts/view-db.js
```

Desencripta y muestra el contenido completo de la base de datos. **Solo usar en desarrollo**.

#### Encriptar la base de datos manualmente
```bash
node scripts/encrypt-db.js
```

Encripta una base de datos en formato JSON plano. Crea automáticamente un backup antes de encriptar.

### Funcionamiento Automático

El servidor gestiona automáticamente la encriptación:

1. **Lectura**: Cada vez que se lee `db.json`, se desencripta en memoria
2. **Escritura**: Cada vez que se guarda, se encripta automáticamente
3. **Migración**: Si detecta un archivo JSON sin encriptar, lo encripta automáticamente en el primer uso

### Backup y Recuperación

El script de encriptación crea automáticamente un backup:
```
data/db.json.backup
```

Para restaurar desde el backup:
```bash
cp data/db.json.backup data/db.json
node scripts/encrypt-db.js
```

### Buenas Prácticas

1. **Backups regulares**: Haz copias de seguridad de `db.json` y `.env`
2. **Rotación de claves**: Considera cambiar la clave periódicamente
3. **Acceso restringido**: Limita quién puede acceder al servidor y archivos
4. **Logs seguros**: Los logs no contienen información sensible
5. **HTTPS en producción**: Usa siempre HTTPS para el servidor en producción

### Datos Protegidos

La encriptación protege:
- ✅ Contraseñas hasheadas de usuarios
- ✅ Información personal (nombres, correos, equipos)
- ✅ Fechas de contratación
- ✅ Días de vacaciones y PTO
- ✅ Historial de solicitudes
- ✅ Comentarios y notas

### Arquitectura de Seguridad

```
┌─────────────────┐
│  Aplicación     │
│  (memoria)      │ ← Datos desencriptados (temporalmente)
└────────┬────────┘
         │ encrypt/decrypt
         │
┌────────▼────────┐
│   db.json       │
│  (disco)        │ ← Datos siempre encriptados
└─────────────────┘
```

### Cambiar la Clave de Encriptación

Si necesitas cambiar la clave:

1. Desencripta con la clave antigua:
   ```bash
   node scripts/view-db.js > temp-db.json
   ```

2. Cambia `ENCRYPTION_KEY` en `.env`

3. Reemplaza y encripta con la nueva clave:
   ```bash
   cp temp-db.json data/db.json
   node scripts/encrypt-db.js
   rm temp-db.json
   ```

### Soporte

Para preguntas sobre seguridad, contacta al administrador del sistema.

---

**Última actualización**: Febrero 2026

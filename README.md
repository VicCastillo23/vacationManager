# Sistema de Gestión de Vacaciones - EVO Payments

Sistema completo de gestión de vacaciones con roles, permisos, y encriptación de base de datos.

## 🚀 Características

### Gestión de Usuarios
- ✅ 4 roles: Empleado, Manager, Director, Administrador
- ✅ Autenticación segura con bcrypt
- ✅ Cálculo automático de días de vacaciones por antigüedad (12-34 días)
- ✅ Gestión de días PTO (5 días anuales)
- ✅ Carga masiva de empleados por Excel (administradores)
- ✅ Edición completa de usuarios (administradores)

### Tipos de Ausencias
1. **Vacaciones** - Según antigüedad (12-34 días)
2. **PTO** - Días personales (5 días anuales, máx 2 consecutivos)
3. **Matrimonio** - 5 días
4. **Maternidad** - 84 días (12 semanas)
5. **Paternidad** - 15 días
6. **Cumpleaños** - 1 día
7. **Defunción familiar directo** - 5 días
8. **Defunción familiar** - 3 días
9. **Defunción mascota** - 1 día
10. **Incapacidad médica** - Variable
11. **Permiso especial** - Variable

### Días Festivos Mexicanos 2026
- 11 días festivos oficiales
- Cálculo automático de Semana Santa
- Cálculo automático de lunes cívicos
- Visualización en calendario

### Seguridad
- 🔒 **Encriptación AES-256** para la base de datos
- 🔐 Contraseñas hasheadas con bcrypt
- 🛡️ Validación de roles y permisos
- 📝 Variables de entorno para claves sensibles

## 📋 Requisitos

- Node.js 14+
- npm o yarn
- MongoDB 4.4+
- (Para AWS) EC2 o Elastic Beanstalk con Node.js

## 🛠️ Instalación

1. Clonar el repositorio
```bash
git clone <repository-url>
cd vacation-manager
```

2. Requisitos previos
- **MongoDB**: Instalar localmente o usar MongoDB Atlas
  - Local: `brew install mongodb-community` (Mac) o descargar desde mongodb.org
  - Atlas: Crear cuenta en https://www.mongodb.com/cloud/atlas

3. Instalar dependencias
```bash
npm install
```

4. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tu MONGODB_URI
```

 Ejemplo de `.env`:
```bash
ENCRYPTION_KEY=TuClaveSecretaAqui123!!
# MONGODB_URI=mongodb://localhost:27017/vacation-manager
# Para AWS con MongoDB Atlas:
# MONGODB_URI=mongodb+srv://USUARIO:PASSWORD@CLUSTER.mongodb.net/vacation-manager
NODE_ENV=production
PORT=3000
```

5. (Opcional) Migrar datos existentes

Si tienes datos en el formato JSON anterior, ejecuta el script de migración:
```bash
node scripts/migrate-to-mongo.js
```

6. Iniciar el servidor
```bash
npm start
```

8. Abrir en el navegador
```
http://localhost:3000
```

## 👥 Usuarios de Prueba

| Email | Contraseña | Rol |
|-------|------------|-----|
| yocelyn.rugerio@globalpayments.com | Password123! | Administrador |
| armando.martinez@globalpayments.com | Password123! | Manager |
| david.wence@globalpayments.com | Password123! | Manager |
| vicente.castillo@globalpayments.com | Password123! | Administrador |

## 📁 Estructura del Proyecto

```
vacation-manager/
├── server.js              # Servidor Express con MongoDB
├── .env.example           # Ejemplo de variables de entorno
├── package.json           # Dependencias
├── models/                # Modelos Mongoose
│   ├── User.js
│   └── Request.js
├── lib/                   # Helpers
│   ├── database.js        # Conexión MongoDB
│   └── helpers.js         # Funciones utilitarias
├── scripts/              # Scripts útiles
│   └── migrate-to-mongo.js
├── public/              # Frontend
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   └── js/
└── tests/              # Tests (próximamente)
    ├── unit/
    └── integration/
```

## 🔐 Seguridad

- MongoDB con schema validation (Mongoose)
- Índices optimizados para consultas
- Contraseñas hasheadas con bcrypt
- Validación de roles y permisos
- Variables de entorno en `.env`
- ENCRYPTION_KEY reservado para compatibilidad de migración

## 📊 Tabla de Días de Vacaciones

| Años de Servicio | Días de Vacaciones |
|------------------|-------------------|
| 1 año | 12 días |
| 2 años | 16 días |
| 3 años | 18 días |
| 4 años | 20 días |
| 5 años | 22 días |
| 6-9 años | 24 días |
| 10-14 años | 26 días |
| 15-19 años | 28 días |
| 20-24 años | 30 días |
| 25-29 años | 32 días |
| 30+ años | 34 días |

## 📤 Carga Masiva de Empleados

Los administradores pueden cargar múltiples empleados mediante archivos Excel (.xlsx):

### Formato del Excel

| Columna | Requerido | Ejemplo |
|---------|-----------|---------|
| Nombre | Sí | Juan Pérez |
| Email | Sí | juan.perez@empresa.com |
| Equipo | Sí | UPA |
| Rol | Sí | employee |
| Fecha Contratación | Sí | 2023-01-15 |

**Roles válidos**: employee, manager, director, administrator

## 🗓️ Calendario de Vacaciones

- Visualización mensual y semanal
- Filtros por equipo y estado
- Días festivos destacados en amarillo
- Diferentes colores por tipo de solicitud:
  - 🟦 Azul oscuro: Vacaciones
  - 🟩 Verde: PTO
  - 🟨 Amarillo: Días festivos

## 🚦 Reglas de Solicitudes

1. **Anticipación**: Vacaciones y PTO requieren 3 días de anticipación
2. **PTO**: Máximo 2 días consecutivos
3. **Empalme**: No se permiten solicitudes que se empalmen
4. **Aprobación**: Requiere aprobación de manager/director/administrador
5. **Días festivos**: Se muestran automáticamente en el calendario

## 🔄 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/change-password` - Cambiar contraseña

### Usuarios
- `GET /api/users` - Listar usuarios (según rol)
- `GET /api/users/:id` - Obtener usuario específico
- `PUT /api/users/:id` - Actualizar usuario (solo admin)
- `POST /api/users/bulk` - Carga masiva (solo admin)

### Solicitudes
- `GET /api/requests` - Listar solicitudes (según rol)
- `POST /api/requests` - Crear solicitud
- `PATCH /api/requests/:id` - Actualizar estado (aprobar/rechazar)

### Otros
- `GET /api/teams` - Obtener equipos
- `GET /api/holidays` - Obtener días festivos 2026

## 🗓️ Calendario de Vacaciones

- Visualización mensual y semanal
- Filtros por equipo y estado
- Días festivos destacados en amarillo
- Diferentes colores por tipo de solicitud

## 🐛 Solución de Problemas

### El servidor no inicia
```bash
# Verificar puerto
lsof -ti:3000 | xargs kill -9

# Verificar dependencias
npm install

# Verificar MongoDB
mongosh vacation-manager
```

### Error de conexión MongoDB
```bash
# Verificar que MongoDB esté corriendo
brew services list | grep mongodb

# Verificar .env tiene MONGODB_URI correcto
cat .env
```

## 📞 Soporte

Para preguntas o problemas, contacta al equipo de desarrollo.

## 📜 Licencia

© 2026 EVO Payments - Uso interno

---

**Última actualización**: Febrero 2026

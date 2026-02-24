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

## 🛠️ Instalación

1. Clonar el repositorio
```bash
git clone <repository-url>
cd vacation-manager
```

2. Instalar dependencias
```bash
npm install
```

3. Configurar variables de entorno
```bash
# Crear archivo .env en la raíz del proyecto
echo "ENCRYPTION_KEY=TuClaveSecretaAqui123!!" > .env
```

4. Iniciar el servidor
```bash
npm start
```

5. Abrir en el navegador
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
├── server.js                 # Servidor Express con API REST
├── .env                      # Variables de entorno (no incluir en git)
├── package.json             # Dependencias del proyecto
├── SECURITY.md              # Documentación de seguridad
├── data/
│   ├── db.json              # Base de datos encriptada
│   └── db.json.backup       # Backup automático
├── public/
│   ├── index.html           # Página de login
│   ├── dashboard.html       # Dashboard principal
│   ├── css/
│   │   └── styles.css       # Estilos globales
│   └── js/
│       └── app.js           # Lógica del frontend
└── scripts/
    ├── encrypt-db.js        # Script para encriptar DB
    └── view-db.js           # Script para ver DB (debugging)
```

## 🔐 Seguridad

La base de datos está completamente encriptada usando **AES-256-CBC**. Ver [SECURITY.md](./SECURITY.md) para más detalles.

### Scripts de Seguridad

Ver base de datos (desarrollo):
```bash
node scripts/view-db.js
```

Encriptar base de datos manualmente:
```bash
node scripts/encrypt-db.js
```

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

## 📝 Notas de Desarrollo

- Base de datos JSON con encriptación AES-256
- Frontend en vanilla JavaScript (sin frameworks)
- FullCalendar para visualización de calendario
- Font Awesome para iconos
- Responsive design para móviles

## 🐛 Solución de Problemas

### El servidor no inicia
```bash
# Verificar que el puerto 3000 esté libre
lsof -ti:3000 | xargs kill -9

# Verificar que las dependencias estén instaladas
npm install

# Verificar el archivo .env
cat .env
```

### No puedo ver la base de datos
```bash
# Usar el script de visualización
node scripts/view-db.js
```

### Error de encriptación
```bash
# Verificar que ENCRYPTION_KEY esté definida
echo $ENCRYPTION_KEY

# Si cambió la clave, ver SECURITY.md para migración
```

## 📞 Soporte

Para preguntas o problemas, contacta al equipo de desarrollo.

## 📜 Licencia

© 2026 EVO Payments - Uso interno

---

**Última actualización**: Febrero 2026

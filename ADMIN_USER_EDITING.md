# Funcionalidad de Edición de Usuarios (Administradores)

## 🎯 Descripción

Los **Administradores** ahora pueden editar completamente los datos de cualquier usuario del sistema desde la vista de Empleados.

## ✨ Funcionalidades Implementadas

### Acceso Exclusivo
- ✅ Solo los usuarios con rol **administrator** pueden ver y usar esta funcionalidad
- ✅ Validación tanto en frontend como en backend
- ✅ El botón "Editar" solo aparece para administradores

### Campos Editables

Los administradores pueden editar los siguientes campos de cualquier usuario:

1. **Información Personal**
   - Nombre completo
   - Email (con validación de unicidad)

2. **Información Laboral**
   - Rol (employee, manager, director, administrator)
   - Equipo
   - Fecha de contratación

3. **Días Disponibles**
   - Días de vacaciones disponibles
   - Días PTO disponibles (0-5)

4. **Seguridad**
   - Nueva contraseña (opcional)
   - Si se cambia, el usuario deberá cambiarla en su próximo login

## 🔧 Cómo Usar

### Paso 1: Acceder a la Vista de Empleados
1. Inicia sesión como administrador
2. Ve a la sección "Empleados" en el menú lateral
3. Verás una columna adicional "Acciones" con botones de editar

### Paso 2: Editar Usuario
1. Haz clic en el botón **"Editar"** en la fila del usuario que deseas modificar
2. Se abrirá un modal con todos los datos del usuario
3. Modifica los campos que necesites
4. Haz clic en **"Guardar Cambios"**

### Paso 3: Confirmación
- El sistema validará los datos
- Mostrará un mensaje de éxito o error
- La tabla de empleados se actualizará automáticamente

## ⚠️ Validaciones y Restricciones

### Backend
- ✅ **Rol**: Solo administradores pueden editar usuarios
- ✅ **Email único**: No puede haber emails duplicados
- ✅ **Días PTO**: Deben estar entre 0 y 5
- ✅ **Días de vacaciones**: No pueden ser negativos
- ✅ **Campos protegidos**: ID y fecha de creación no se pueden modificar

### Frontend
- ✅ **Validación en tiempo real**
- ✅ **Campos requeridos**: Nombre, email, rol, equipo, fecha
- ✅ **Formato de email**: Validación del formato
- ✅ **Contraseña opcional**: Puede dejarse vacía para no cambiarla

## 🔐 Seguridad

### Validaciones de Seguridad Implementadas

1. **Autenticación de Rol**
   - El endpoint `/api/users/:id` verifica que el usuario solicitante sea administrador
   - Si no lo es, retorna error 403 (Forbidden)

2. **Unicidad de Email**
   - Antes de actualizar, verifica que el nuevo email no esté en uso
   - Permite mantener el mismo email si no se modifica

3. **Protección de Campos Críticos**
   - Los campos `id` y `createdAt` no se pueden modificar
   - Se eliminan del objeto de actualización antes de aplicar

4. **Gestión de Contraseñas**
   - Las contraseñas se hashean con bcrypt antes de guardar
   - Si se cambia la contraseña, se marca `mustChangePassword: true`
   - El usuario deberá cambiarla en su próximo login

## 📝 Casos de Uso

### Caso 1: Actualizar Días Disponibles
Un administrador puede ajustar manualmente los días de vacaciones o PTO de un empleado si:
- Hubo un error en el cálculo
- Se otorgaron días adicionales por algún motivo especial
- Se necesita hacer una corrección administrativa

### Caso 2: Cambiar de Equipo o Rol
Cuando un empleado:
- Es promovido a manager o director
- Se transfiere a otro equipo
- Cambia de responsabilidades

### Caso 3: Corrección de Datos
Si hay errores en:
- Nombre del empleado
- Email corporativo
- Fecha de contratación

### Caso 4: Resetear Contraseña
Cuando un empleado:
- Olvidó su contraseña
- Necesita una contraseña temporal
- Por razones de seguridad

## 🎨 Interfaz de Usuario

### Modal de Edición
```
┌─────────────────────────────────────┐
│  👤  Editar Usuario                 │
├─────────────────────────────────────┤
│  Nombre completo: [____________]    │
│  Email: [____________________]      │
│                                     │
│  Rol: [▼ Administrator]             │
│  Equipo: [____________]             │
│                                     │
│  Fecha contratación: [__/__/____]   │
│                                     │
│  Días vacaciones: [__]              │
│  Días PTO: [__]                     │
│                                     │
│  Nueva contraseña: [__________]     │
│  (Dejar vacío para no cambiar)      │
│                                     │
│  [Cancelar]  [Guardar Cambios]      │
└─────────────────────────────────────┘
```

### Tabla de Empleados (Vista de Administrador)
```
┌────────────────────────────────────────────────────────────────┐
│ Nombre    Email    Rol    Equipo    Fecha    Vac   PTO  Acciones│
├────────────────────────────────────────────────────────────────┤
│ Juan P.   juan@... Emp    Dev      2023     12    5   [Editar] │
│ María G.  maria@.. Mgr    QA       2021     17    3   [Editar] │
└────────────────────────────────────────────────────────────────┘
```

## 🚀 API Endpoint

### PUT /api/users/:id

**Descripción**: Actualiza los datos de un usuario (solo administradores)

**Request Body**:
```json
{
  "requestingUserRole": "administrator",
  "name": "Nombre Actualizado",
  "email": "nuevo@email.com",
  "role": "manager",
  "team": "Equipo Nuevo",
  "hireDate": "2023-01-15",
  "vacationDays": 20,
  "ptoDays": 5,
  "password": "NuevaContraseña123!" // opcional
}
```

**Response (Success - 200)**:
```json
{
  "id": "usr-001",
  "name": "Nombre Actualizado",
  "email": "nuevo@email.com",
  "role": "manager",
  "team": "Equipo Nuevo",
  "hireDate": "2023-01-15",
  "vacationDays": 20,
  "ptoDays": 5,
  "mustChangePassword": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Response (Error - 403)**:
```json
{
  "error": "Solo los administradores pueden editar usuarios"
}
```

**Response (Error - 400)**:
```json
{
  "error": "El email ya está en uso por otro usuario"
}
```

## 📊 Registro de Cambios

Cuando un administrador edita un usuario:
1. ✅ Los cambios se aplican inmediatamente en la base de datos
2. ✅ El sistema recalcula los años de servicio y días totales
3. ✅ La tabla de empleados se actualiza automáticamente
4. ✅ Se muestra un mensaje de confirmación

## 💡 Notas Importantes

- **Recálculo Automático**: Aunque el administrador puede establecer manualmente los días disponibles, el sistema seguirá calculando los días totales según la antigüedad del usuario.

- **Días Totales vs Disponibles**: 
  - Los "días totales" se calculan automáticamente por antigüedad
  - Los "días disponibles" son los que el administrador puede editar manualmente

- **Contraseñas Temporales**: Si un administrador establece una nueva contraseña, se recomienda usar el formato: `Temporal123!` para cumplir con los requisitos de seguridad.

- **No hay Log de Auditoría**: Actualmente no se registra quién hizo los cambios. Esta es una funcionalidad pendiente para futuras versiones.

## 🔮 Mejoras Futuras

1. **Log de Auditoría**: Registrar quién, cuándo y qué cambió
2. **Historial de Cambios**: Ver el historial completo de modificaciones
3. **Confirmación de Cambios Críticos**: Diálogo de confirmación para cambios importantes
4. **Edición en Lote**: Actualizar múltiples usuarios a la vez
5. **Exportar/Importar**: Editar usuarios masivamente via Excel

## 🎓 Capacitación

Para capacitar a nuevos administradores:
1. Asegúrate de que tengan rol "administrator"
2. Muéstrales la sección de Empleados
3. Explica los campos editables y sus restricciones
4. Practica editando un usuario de prueba
5. Enfatiza la importancia de verificar los cambios antes de guardar

---

**Versión**: 1.0  
**Fecha**: 23 de Febrero 2026  
**Autor**: Sistema de Gestión de Vacaciones EVO Payments

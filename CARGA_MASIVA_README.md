# Instrucciones de Carga Masiva de Empleados

## Nuevo Rol: Administrador

Se ha agregado un nuevo rol llamado **Administrador** que tiene:
- Todos los permisos de un Director (ver todos los empleados y solicitudes, aprobar/rechazar)
- Acceso exclusivo a la funcionalidad de **Carga Masiva de Empleados**

## Cómo Usar la Carga Masiva

### 1. Acceso
- Solo los usuarios con rol **Administrador** pueden ver y usar esta funcionalidad
- En el dashboard, aparecerá una nueva opción en el menú lateral: "Carga de Empleados"

### 2. Preparar el Archivo Excel

El archivo debe tener las siguientes columnas:

#### Columnas Requeridas:
- **Nombre**: Nombre completo del empleado
- **Email**: Email único del empleado
- **Equipo**: Nombre del equipo al que pertenece
- **Fecha de Ingreso**: Formato YYYY-MM-DD (ej: 2023-01-15)

#### Columnas Opcionales:
- **Rol**: employee, manager, director o administrator (por defecto: employee)
- **PTO Días Tomados**: Número de días PTO ya tomados (por defecto: 0)
- **Vacaciones Días Tomadas**: Número de días de vacaciones ya tomados (por defecto: 0)

### 3. Ejemplo de Archivo

```csv
Nombre,Email,Equipo,Fecha de Ingreso,Rol,PTO Días Tomados,Vacaciones Días Tomadas
Juan Pérez,juan.perez@example.com,Desarrollo,2023-01-15,employee,0,0
María García,maria.garcia@example.com,Marketing,2022-06-20,manager,2,5
```

Puedes usar el archivo `plantilla_empleados_ejemplo.csv` como referencia o descargar la plantilla desde el dashboard.

### 4. Proceso de Carga

1. Haz clic en "Descargar Plantilla Excel" para obtener un archivo de ejemplo
2. Completa el archivo con la información de los empleados
3. Guarda el archivo en formato `.xlsx` o `.xls`
4. En el dashboard, selecciona el archivo usando el botón "Seleccionar archivo Excel"
5. Haz clic en "Cargar Empleados"

### 5. Resultados

Después de la carga, verás un resumen con:
- **Total Procesados**: Número total de registros en el archivo
- **Creados**: Nuevos empleados creados
- **Actualizados**: Empleados existentes actualizados
- **Errores**: Registros que no pudieron procesarse

### 6. Notas Importantes

#### Días Disponibles
El sistema calcula automáticamente los días disponibles:
- **PTO disponible** = 5 - días tomados
- **Vacaciones disponibles** = 15 - días tomados

#### Usuarios Nuevos
- Reciben una contraseña temporal: **Temporal123!**
- Deben cambiarla en su primer inicio de sesión
- Esta información se muestra en el resumen de resultados

#### Usuarios Existentes
- Si el email ya existe en el sistema, se actualizará la información del usuario
- La contraseña NO se modifica en actualizaciones

#### Validaciones
El sistema valida:
- Formato de email
- Campos requeridos
- Formato de fecha
- Rol válido

Si hay errores, se mostrarán en la sección de resultados con el número de fila y el motivo del error.

## Crear un Usuario Administrador

Para crear tu primer usuario administrador:

1. Ve a la página de registro
2. Selecciona "Administrador" en el campo Rol
3. Completa los demás campos y regístrate

O actualiza un usuario existente en `data/db.json` cambiando su `role` a `"administrator"`.

## Límites

- Tamaño máximo de archivo: **5MB**
- Formatos aceptados: `.xlsx`, `.xls`

# Lineamientos Implementados - Sistema de Vacaciones EVO Payments

## ✅ Cambios Implementados

### 1. Sistema de Vacaciones por Antigüedad

**Tabla de días según años de servicio:**

| Años de Servicio | Días de Vacaciones |
|------------------|-------------------|
| 1                | 12                |
| 2                | 16                |
| 3                | 18                |
| 4                | 20                |
| 5                | 22                |
| 6-9              | 24                |
| 10-14            | 26                |
| 15-19            | 28                |
| 20-24            | 30                |
| 25-29            | 32                |
| 30+              | 34                |

**Implementación:**
- ✅ Cálculo automático basado en fecha de ingreso (hireDate)
- ✅ Visualización de años de servicio en dashboard
- ✅ Actualización dinámica de días totales
- ✅ Migración de usuarios existentes completada

### 2. Días Personales (PTO)

**Reglas implementadas:**
- ✅ 5 días personales por año
- ✅ No acumulables año con año
- ✅ Máximo 2 días consecutivos
- ✅ Validación de 3 días de anticipación
- ✅ No compensables con remuneración

### 3. Nuevos Tipos de Ausencias

**Eventos Personales:**
- ✅ **Matrimonio**: 5 días hábiles desde el día laboral siguiente al evento
- ✅ **Maternidad**: 84 días naturales (requiere incapacidad IMSS)
- ✅ **Paternidad**: 15 días hábiles desde el nacimiento
- ✅ **Cumpleaños**: 1 día (movible si cae en fin de semana)

**Fallecimientos:**
- ✅ **Familiar directo** (padre, madre, hijo, hermano, cónyuge): 5 días hábiles
- ✅ **Familiar** (abuelos, tíos): 3 días hábiles
- ✅ **Mascota**: 1 día hábil dentro de 2 días del fallecimiento

**Otros:**
- ✅ **Incapacidad IMSS**: Requiere documentación
- ✅ **Permiso Especial**: Requiere autorización del Director del Área

### 4. Validaciones de Solicitudes

**Vacaciones:**
- ✅ Solicitud con 3 días mínimo de anticipación
- ⚠️  Periodo obligatorio de 5 días consecutivos al año (tracking pendiente)
- ⚠️  Vencimiento a 18 meses (cálculo pendiente)

**PTO:**
- ✅ Máximo 2 días consecutivos
- ✅ Solicitud con 3 días de anticipación

**General:**
- ✅ Validación de días disponibles
- ✅ Validación de empalmes de fechas
- ✅ Días máximos según tipo de ausencia

### 5. Días de Asueto (Festivos 2026)

**Festivos implementados:**
- ✅ 1 de Enero - Año Nuevo
- ✅ 2 de Febrero - Constitución (primer lunes de febrero)
- ✅ 16 de Marzo - Benito Juárez (tercer lunes de marzo)
- ✅ 2 de Abril - Jueves Santo
- ✅ 3 de Abril - Viernes Santo
- ✅ 1 de Mayo - Día del Trabajo
- ✅ 16 de Septiembre - Independencia
- ✅ 2 de Noviembre - Día de Muertos
- ✅ 16 de Noviembre - Revolución (tercer lunes de noviembre)
- ✅ 12 de Diciembre - Virgen de Guadalupe
- ✅ 25 de Diciembre - Navidad

**Nota:** La validación de festivos está implementada en el backend pero aún no bloquea activamente las solicitudes. Requiere integración adicional.

## 📋 Funcionalidades Adicionales del Sistema

### Interface de Usuario
- ✅ Selector con categorías de tipos de ausencia
- ✅ Información contextual por tipo de ausencia
- ✅ Visualización de días totales y disponibles
- ✅ Años de servicio en dashboard
- ✅ Alertas y validaciones en tiempo real

### Backend
- ✅ Cálculo dinámico de vacaciones por antigüedad
- ✅ Validación de anticipación de 3 días
- ✅ Validación de días máximos por tipo
- ✅ Tabla de días festivos
- ✅ Helper functions para cálculos de fecha

## ⚠️ Pendientes de Implementación Completa

Estas reglas están documentadas pero requieren desarrollo adicional:

### Alta Prioridad
1. **Tracking de periodo obligatorio de 5 días**
   - Registrar si el usuario ha tomado su periodo obligatorio
   - Alertar si no lo ha tomado
   - Validar que sea realmente consecutivo

2. **Vencimiento de vacaciones a 18 meses**
   - Calcular fecha de vencimiento por año de servicio
   - Alertas de próximo vencimiento
   - Prescripción automática de días vencidos

3. **Bloqueo activo de festivos**
   - Prevenir solicitudes que caigan en días festivos
   - Excluir festivos del cálculo de días laborables

### Prioridad Media
4. **Gestión de incapacidades IMSS**
   - Suspensión automática de vacaciones durante incapacidad
   - Tracking de documentación IMSS
   - Cálculo de subsidios (60%/40%)

5. **Reinicio anual de días**
   - Job automático para reiniciar PTO cada año
   - Actualización de vacaciones según nueva antigüedad
   - Limpieza de días vencidos

6. **Dashboard mejorado**
   - Visualización de festivos en calendario
   - Timeline de vencimiento de vacaciones
   - Historial detallado de ausencias

## 🔧 Cómo Usar el Sistema Actualizado

### Para Empleados
1. Al crear una solicitud, verás los nuevos tipos de ausencia organizados por categoría
2. El sistema te mostrará información específica según el tipo seleccionado
3. Tus días de vacaciones ahora se calculan según tu antigüedad
4. Puedes ver tus años de servicio en el dashboard

### Para Administradores
1. El cálculo de vacaciones es automático según la tabla de antigüedad
2. Los usuarios verán sus días totales y disponibles
3. Las validaciones de anticipación y días máximos se aplican automáticamente
4. Se ejecutó una migración para actualizar todos los usuarios existentes

## 📝 Script de Migración

Se creó el archivo `migrate-vacation-days.js` que:
- Recalcula días de vacaciones según antigüedad de cada usuario
- Ajusta días disponibles proporcionalmente
- Corrige valores negativos de PTO

**Resultado de la migración:**
- ✅ 8 usuarios actualizados exitosamente
- Vicente Castillo: 4 años → 20 días totales (17 disponibles)
- Yocelyn Rugerio: 6 años → 24 días totales (21 disponibles)

## 🚀 Próximos Pasos Recomendados

1. Implementar tracking de periodo obligatorio de 5 días
2. Agregar sistema de alertas de vencimiento
3. Crear job scheduler para actualizaciones automáticas
4. Implementar validación activa de festivos en cálculo de días
5. Agregar generación de reportes para RH
6. Implementar notificaciones por email

## 📚 Referencias

- Documento original: "LINEAMIENTOS PARA GOZAR VACACIONES, DIAS PERSONALES Y AUSENCIAS JUSTIFICADAS"
- Plan de implementación: Plan ID 7468b16c-878c-4f58-a080-d9d8e56d27ac

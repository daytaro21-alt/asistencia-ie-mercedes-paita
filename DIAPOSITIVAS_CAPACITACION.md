# Diapositivas de Capacitación: Sistema Automatizado de Asistencia QR
**I.E. Nuestra Señora de las Mercedes — Paita**  
*Piloto 5to de Secundaria (Turno Tarde)*  
**Ponente / Desarrollador:** Dayron Iván Talledo Rojas  

---

## Estructura General de la Capacitación
- **Bloque 1:** Introducción, Objetivos y Beneficios.
- **Bloque 2:** Horarios Oficiales y Reglas de Negocio en Portón.
- **Bloque 3:** Credenciales y Perfiles de Acceso (Auxiliares, TOECE, Admin).
- **Bloque 4:** Operación en Portón (Lector Láser y Cámara Web en Celular).
- **Bloque 5:** Alertas Automáticas de WhatsApp a los Padres de Familia.
- **Bloque 6:** Monitoreo en Tiempo Real, Cierre de Portón y Descarga de Reportes (PDF y Excel).
- **Bloque 7:** Asistente Analítico con Inteligencia Artificial (Gemini 2.5 Flash).
- **Bloque 8:** Preguntas Frecuentes y Soporte Técnico.

---

### Diapositiva 1: Portada Institucional
* **Título:** Sistema Automatizado de Gestión de Asistencia Estudiantil mediante Código QR
* **Subtítulo:** Capacitación Práctica y Operativa para Auxiliares de Educación y Personal de TOECE
* **Institución:** I.E. Nuestra Señora de las Mercedes — Paita
* **Ámbito del Piloto:** 5to de Secundaria (257 Estudiantes — Secciones A a la H)
* **Turno:** Tarde
* **Ponente:** Dayron Iván Talledo Rojas (Proyecto de Titulación)
* **[ESPACIO PARA IMAGEN]:** *Insignia oficial del colegio a la izquierda y captura de la pantalla principal del sistema.*

---

### Diapositiva 2: El Reto y la Solución Tecnológica
* **¿Cómo se hacía antes?**
  - Registro manual en cuadernos de asistencia en el portón.
  - Filas y aglomeraciones de alumnos al ingresar.
  - Retraso en avisar a los padres si sus hijos llegaron tarde o no llegaron.
  - Elaboración manual y tediosa de los consolidados mensuales de asistencia.
* **¿Cómo funciona con el nuevo sistema?**
  - Cada estudiante tiene un carnet escolar con código QR único de alta durabilidad.
  - Escaneo en menos de 1 segundo en el portón (pistola láser o celular).
  - Alerta inmediata y automática por WhatsApp al apoderado cuando hay tardanza o inasistencia.
  - Reportes en PDF en orden alfabético por sección y descarga de consolidado mensual en Excel en 1 clic.
* **[ESPACIO PARA IMAGEN]:** *Comparativa: Foto del carnet con código QR impreso vs. cuaderno de asistencia tradicional.*

---

### Diapositiva 3: Horarios Oficiales del Turno Tarde (Reglas del Sistema)
* **12:30 PM – 12:45 PM | INGRESO PUNTUAL 🟢**
  - El alumno pasa su QR por el lector del portón.
  - La pantalla marca verde con sonido de confirmación y registra "Puntual".
* **12:45:01 PM – 01:30 PM | TARDANZA 🟡**
  - El escaneo marca ámbar con registro de "Tardanza".
  - El sistema encola y envía en segundo plano un WhatsApp oficial al celular del apoderado.
* **01:00 PM | CASO ESPECIAL (PERMISO DE TRABAJO) 🔵**
  - Alumnos autorizados previamente en el sistema tienen tolerancia de ingreso puntual hasta la 1:00 PM.
* **01:30 PM | CIERRE DE PORTÓN (FALTA AUTOMÁTICA) 🔴**
  - Todo alumno que no haya ingresado hasta la 1:30 PM queda registrado con **"Falta"**.
  - Se disparan automáticamente los mensajes de inasistencia a los padres.
* **[ESPACIO PARA IMAGEN]:** *Infografía gráfica con línea de tiempo del horario (12:30, 12:45, 1:00 y 1:30).*

---

### Diapositiva 4: Credenciales y Perfiles de Usuario
* **Dirección Web Oficial del Sistema:**
  - `https://sistemaasistenciamercedes.duckdns.org`
* **Tabla de Accesos Oficiales:**
  - **Auxiliar 1:** Usuario `auxiliar_uno` | Clave `Mercedes_auxiliar1_2026*`
  - **Auxiliar 2:** Usuario `auxiliar_dos` | Clave `Mercedes_auxiliar2_2026*`
  - **Auxiliar 3:** Usuario `auxiliar_tres` | Clave `Mercedes_auxiliar3_2026*`
  - **Coordinación TOECE:** Usuario `admin_toece` | Clave `Mercedes_toece_2026*`
  - **Administración:** Usuario `admin` | Clave `Mercedes_admin_2026*`
* **Privilegios por Perfil:**
  - *Auxiliares:* Visualización de asistencia, filtros por sección, impresión de reportes y descarga Excel.
  - *TOECE y Administración:* Chat con IA, cierre manual de portón, edición de celulares y gestión del padrón.
* **[ESPACIO PARA IMAGEN]:** *Captura de la ventana de inicio de sesión con el logotipo del colegio.*

---

### Diapositiva 5: Operación en Portón (Modo Kiosco QR)
* **Dos formas de escanear los carnets:**
  1. **Lectora Láser USB conectada a Laptop:**
     - Simplemente apuntar al código QR del carnet. El campo de texto captura el DNI al instante sin tocar el teclado ni el mouse.
  2. **Cámara del Celular o Tablet:**
     - Pulsar el botón **"Activar Cámara"** y apuntar el celular al código QR del estudiante.
* **Semáforo en Pantalla:**
  - 🟢 **Verde:** Ingreso Puntual registrado con éxito.
  - 🟡 **Ámbar:** Ingreso con Tardanza (WhatsApp enviado).
  - 🔴 **Rojo:** Error o Doble Escaneo Bloqueado (si un alumno intenta pasar dos veces el mismo día).
* **[ESPACIO PARA IMAGEN]:** *Captura de pantalla de la tarjeta de escaneo mostrando el resultado verde y ámbar.*

---

### Diapositiva 6: Notificaciones Automáticas por WhatsApp
* **Mensaje Oficial enviado al Padre / Apoderado:**
  > **I.E. NUESTRA SEÑORA DE LAS MERCEDES**  
  > *Oficina de TOECE - Control de Asistencia*  
  > Estimado padre de familia / apoderado, le informamos el registro de asistencia de su menor hijo(a):  
  > 👤 **Estudiante:** ALZAMORA GARCIA, ANGEL DAVID  
  > 📅 **Fecha:** 2026-11-08  
  > 🕒 **Hora de ingreso:** 12:51:14  
  > ⏰ **Estado:** TARDANZA  
  > *Este es un mensaje automático del sistema de control por código QR.*
* **Protección Anti-Bloqueo:**
  - El sistema cuenta con una cola inteligente con pausas de 3 a 6 segundos entre envíos para que WhatsApp nunca bloquee la línea institucional.
* **[ESPACIO PARA IMAGEN]:** *Captura real de pantalla del mensaje recibido en WhatsApp.*

---

### Diapositiva 7: Monitoreo en Tiempo Real para los Auxiliares
* **¿Qué ve el auxiliar al ingresar a su panel?**
  - **KPIs en Vivo:** Total de Padrón Activo (257), Puntuales, Tardanzas, Faltas y Pendientes.
  - **Botones de Filtro Rápido:** Ver con un solo clic quiénes faltaron, quiénes llegaron tarde o la nómina completa.
  - **Buscador Instantáneo:** Permite buscar a un alumno por su DNI o por sus apellidos.
* **Actualización en Caliente:**
  - No es necesario recargar la página: cada escaneo en el portón se refleja automáticamente en la pantalla de los auxiliares.
* **[ESPACIO PARA IMAGEN]:** *Captura de la vista de monitoreo con las tarjetas numéricas (KPIs) y la tabla de alumnos.*

---

### Diapositiva 8: Descarga e Impresión de Reportes Diarios en PDF
* **Características solicitadas por los Auxiliares:**
  1. **Orden Alfabético Estricto:** La lista sale ordenada de la A a la Z por Apellidos y Nombres (orden de lista oficial), no por hora de llegada.
  2. **Separación por Sección (5to A, 5to B, ..., 5to H):**
     - Si seleccionas tu sección (ej. 5to B), sale solo tu sección lista para archivar.
     - Si seleccionas "Todas", cada sección se imprime en su propia hoja A4 independiente (salto de página automático).
  3. **Espacio para Firmas:**
     - Al pie de página incluye la línea para la firma del Auxiliar a cargo y el V°B° de TOECE / Dirección.
* **[ESPACIO PARA IMAGEN]:** *Captura del PDF generado con el encabezado institucional y la tabla de firmas.*

---

### Diapositiva 9: Backup y Consolidado Mensual en Excel
* **¿Cómo descargar la asistencia del mes?**
  - Hacer clic en el botón verde **"Descargar Excel (Mes / Semana)"**.
  - Seleccionar la sección correspondiente (o Todas).
  - Elegir el mes a consultar (ej. Noviembre 2026) y pulsar **"Descargar Archivo .xlsx"**.
* **Estructura del archivo Excel descargado:**
  - Lista de alumnos con DNI y Nombres.
  - Columnas de lunes a viernes con la sábana de asistencia:
    - **P:** Puntual | **T:** Tardanza | **F:** Falta | **-:** Sin Registro
  - Columnas de resumen final: Total Puntual, Total Tardanza, Total Falta y **% de Asistencia**.
* **Backup de Seguridad del Sistema:**
  - El servidor realiza automáticamente una copia de seguridad semanal de toda la base de datos todos los domingos a las 11:00 PM.
* **[ESPACIO PARA IMAGEN]:** *Captura de la ventana modal de descarga y muestra de la hoja de cálculo Excel abierta.*

---

### Diapositiva 10: Asistente Analítico con Inteligencia Artificial (TOECE)
* **Tecnología:** Google Gemini 2.5 Flash con consultas SQL en lenguaje natural.
* **¿Qué le puede preguntar el personal de TOECE?**
  - *"¿Quiénes llegaron tarde hoy en 5to C?"*
  - *"Dame el consolidado de asistencia de hoy por secciones"*
  - *"¿Qué alumnos tienen más de 3 tardanzas en esta semana?"*
  - *"¿Cuántos alumnos faltaron ayer en 5to A?"*
* **Beneficio:**
  - Permite tomar decisiones inmediatas de tutoría y orientación sin tener que revisar registro por registro a mano.
* **[ESPACIO PARA IMAGEN]:** *Captura de la ventana del Chat IA respondiendo una consulta de tardanzas.*

---

### Diapositiva 11: Protocolo de Contingencias y Preguntas Frecuentes
* **¿Qué pasa si un alumno olvidó o perdió su carnet QR?**
  - El auxiliar puede ingresar al panel, buscar al alumno por DNI o apellido y registrar su ingreso manual o imprimirle un nuevo carnet en segundos desde el botón **"Imprimir Carnets QR"**.
* **¿Qué pasa si se va el internet en el portón?**
  - La lectora láser USB conectada a la laptop almacena lecturas y el sistema se sincroniza en cuanto vuelve la conexión.
* **¿Qué pasa si el número de un apoderado cambia?**
  - En la pestaña "Teléfonos Apoderados", el auxiliar o TOECE escribe el nuevo número y pulsa **Guardar** en 1 segundo.
* **[ESPACIO PARA IMAGEN]:** *Iconos de soporte técnico, laptop y teléfono.*

---

### Diapositiva 12: Compromisos y Cierre
* **Próximos pasos del Piloto:**
  - Inicio de control formal en portón con 5to de Secundaria.
  - Seguimiento diario conjunto entre Auxiliares y TOECE.
  - Recepción de sugerencias de mejora durante la primera semana.
* **Agradecimientos:**
  - Al personal directivo, auxiliares de educación y coordinación de TOECE de la I.E. Nuestra Señora de las Mercedes por su colaboración activa en la modernización tecnológica del colegio.
* **Contacto y Soporte:**
  - Dayron Iván Talledo Rojas — Desarrollador del Proyecto
* **[ESPACIO PARA IMAGEN]:** *Foto del frontis del colegio o escudo institucional grande con mensaje de agradecimiento.*

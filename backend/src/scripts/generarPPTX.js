// backend/src/scripts/generarPPTX.js
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

async function crearPresentacionCapacitacion() {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 pulgadas
    pptx.author = 'Dayron Iván Talledo Rojas';
    pptx.company = 'I.E. Nuestra Señora de las Mercedes - Paita';
    pptx.title = 'Capacitación: Sistema Automatizado de Asistencia QR';

    // Paleta de Colores Institucionales
    const C_GUINDA = '7F091C';
    const C_ROJO = 'C8102E';
    const C_DORADO = 'FACC15';
    const C_DORADO_OSC = 'B45309';
    const C_FONDO = 'FAF8F5';
    const C_BLANCO = 'FFFFFF';
    const C_TEXTO = '1E293B';
    const C_GRIS = '64748B';
    const C_VERDE = '059669';
    const C_AZUL = '0284C7';

    const rutaInsignia = path.resolve(__dirname, '../../../frontend/INSIGNIA mercedes png.png');
    const existeInsignia = fs.existsSync(rutaInsignia);

    // Helper para cabecera institucional estándar en diapositivas 2 a 11
    function aplicarCabeceraInstitucional(slide, numSlide, titulo, subtitulo) {
        slide.background = { color: C_FONDO };

        // Franja superior guinda y línea dorada
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.9, fill: { color: C_GUINDA } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: 10, h: 0.06, fill: { color: C_DORADO } });

        if (existeInsignia) {
            slide.addImage({ path: rutaInsignia, x: 0.35, y: 0.1, w: 0.58, h: 0.7 });
        }

        slide.addText(titulo, {
            x: 1.1, y: 0.12, w: 7.5, h: 0.42,
            fontSize: 20, bold: true, color: C_BLANCO, fontFace: 'Arial'
        });
        slide.addText(subtitulo, {
            x: 1.1, y: 0.5, w: 7.5, h: 0.3,
            fontSize: 11, color: C_DORADO, bold: true, fontFace: 'Arial'
        });

        // Pie de página institucional
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 5.3, w: 10, h: 0.325, fill: { color: 'F1F5F9' } });
        slide.addText('I.E. Nuestra Señora de las Mercedes - Paita  |  Oficina de TOECE y Auxiliares  |  Piloto 5to de Secundaria', {
            x: 0.4, y: 5.33, w: 7.5, h: 0.25,
            fontSize: 9, color: C_GRIS, bold: true, fontFace: 'Arial'
        });
        slide.addText(`Diapositiva ${numSlide} de 12`, {
            x: 8.2, y: 5.33, w: 1.4, h: 0.25,
            fontSize: 9, color: C_GUINDA, bold: true, align: 'right', fontFace: 'Arial'
        });
    }

    // Helper para recuadro de "Espacio para Imagen"
    function agregarMarcoImagen(slide, x, y, w, h, instruccionImagen) {
        slide.addShape(pptx.ShapeType.roundRect, {
            x, y, w, h,
            fill: { color: 'FFFBEB' },
            line: { color: C_DORADO_OSC, width: 2, dashType: 'dash' },
            rectRadius: 0.08
        });
        slide.addText([
            { text: '📸 ESPACIO PARA CAPTURA / IMAGEN\n\n', options: { fontSize: 12, bold: true, color: C_GUINDA } },
            { text: instruccionImagen, options: { fontSize: 10.5, color: C_TEXTO, italic: true } }
        ], {
            x: x + 0.15, y: y + 0.15, w: w - 0.3, h: h - 0.3,
            align: 'center', valign: 'middle', fontFace: 'Arial'
        });
    }

    // =========================================================================
    // DIAPOSITIVA 1: PORTADA INSTITUCIONAL
    // =========================================================================
    {
        const s1 = pptx.addSlide();
        s1.background = { color: C_GUINDA };

        // Franja dorada decorativa
        s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: C_DORADO } });

        // Tarjeta blanca derecha para imagen de portada
        agregarMarcoImagen(s1, 6.0, 0.7, 3.6, 4.2,
            'Pega aquí una captura de la pantalla principal del sistema (https://sistemaasistenciamercedes.duckdns.org)'
        );

        if (existeInsignia) {
            s1.addShape(pptx.ShapeType.roundRect, { x: 0.65, y: 0.55, w: 1.05, h: 1.25, fill: { color: C_BLANCO }, line: { color: C_DORADO, width: 2 } });
            s1.addImage({ path: rutaInsignia, x: 0.73, y: 0.63, w: 0.89, h: 1.09 });
        }

        s1.addText('I.E. NUESTRA SEÑORA DE LAS MERCEDES — PAITA', {
            x: 1.85, y: 0.75, w: 4.0, h: 0.35,
            fontSize: 11, bold: true, color: C_DORADO, fontFace: 'Arial'
        });
        s1.addText(' CAPACITACIÓN OFICIAL: AUXILIARES Y TOECE ', {
            x: 1.85, y: 1.15, w: 3.6, h: 0.32,
            fontSize: 9.5, bold: true, color: C_GUINDA, fill: { color: C_DORADO }, fontFace: 'Arial'
        });

        s1.addText('Sistema Automatizado de Gestión de Asistencia Estudiantil mediante Código QR', {
            x: 0.65, y: 2.05, w: 5.1, h: 1.4,
            fontSize: 22, bold: true, color: C_BLANCO, fontFace: 'Arial'
        });

        s1.addText('Despliegue Piloto: 5to Grado de Secundaria (257 Estudiantes • Secciones A – H)\nTurno Tarde • Alertas WhatsApp • Reportes A4 • Inteligencia Artificial', {
            x: 0.65, y: 3.55, w: 5.1, h: 0.75,
            fontSize: 11.5, color: 'FDE047', fontFace: 'Arial'
        });

        s1.addText('Desarrollador y Ponente: Dayron Iván Talledo Rojas', {
            x: 0.65, y: 4.6, w: 5.1, h: 0.4,
            fontSize: 12, bold: true, color: C_BLANCO, fontFace: 'Arial'
        });
    }

    // =========================================================================
    // DIAPOSITIVA 2: EL RETO Y LA SOLUCIÓN TECNOLÓGICA
    // =========================================================================
    {
        const s2 = pptx.addSlide();
        aplicarCabeceraInstitucional(s2, 2, '1. El Reto y la Solución Tecnológica', 'Modernización del control de ingreso en el portón y seguimiento en TOECE');

        s2.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 2.8, h: 3.85, fill: { color: 'FEF2F2' }, line: { color: 'FCA5A5', width: 1.5 } });
        s2.addText('❌ ANTES (Proceso Manual)', { x: 0.55, y: 1.35, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: C_ROJO });
        s2.addText([
            { text: 'Registro manual lento en cuadernos físicos.\n\n', options: { bullet: true } },
            { text: 'Colas y aglomeración de alumnos en portón.\n\n', options: { bullet: true } },
            { text: 'Padres sin enterarse a tiempo de tardanzas o faltas.\n\n', options: { bullet: true } },
            { text: 'Consolidados mensuales hechos a mano.', options: { bullet: true } }
        ], { x: 0.55, y: 1.8, w: 2.5, h: 3.0, fontSize: 11, color: C_TEXTO, valign: 'top' });

        s2.addShape(pptx.ShapeType.roundRect, { x: 3.35, y: 1.2, w: 3.0, h: 3.85, fill: { color: 'ECFDF5' }, line: { color: '6EE7B7', width: 1.5 } });
        s2.addText('✅ AHORA (Sistema QR)', { x: 3.5, y: 1.35, w: 2.7, h: 0.35, fontSize: 13, bold: true, color: C_VERDE });
        s2.addText([
            { text: 'Carnet con código QR único de alta resistencia (Nivel H).\n\n', options: { bullet: true } },
            { text: 'Lectura en < 1 segundo con pistola láser o celular.\n\n', options: { bullet: true } },
            { text: 'WhatsApp automático al padre en tardanzas y faltas.\n\n', options: { bullet: true } },
            { text: 'PDF alfabético por sección y Excel mensual en 1 clic.', options: { bullet: true } }
        ], { x: 3.5, y: 1.8, w: 2.7, h: 3.0, fontSize: 11, color: C_TEXTO, valign: 'top' });

        agregarMarcoImagen(s2, 6.55, 1.2, 3.05, 3.85,
            'Coloca aquí la imagen de un Carnet Estudiantil QR generado en /carnets.html'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 3: HORARIOS OFICIALES DEL TURNO TARDE
    // =========================================================================
    {
        const s3 = pptx.addSlide();
        aplicarCabeceraInstitucional(s3, 3, '2. Horarios Oficiales y Reglas del Turno Tarde', 'Criterios automáticos de clasificación de asistencia en portón');

        const bloques = [
            { hora: '12:30 PM – 12:45 PM', titulo: 'INGRESO PUNTUAL', desc: 'El estudiante pasa su carnet QR. Pantalla marca VERDE y registra PUNTUAL.', color: C_VERDE, bg: 'ECFDF5' },
            { hora: '12:45:01 PM – 01:30 PM', titulo: 'TARDANZA (+ WHATSAPP)', desc: 'Pantalla marca ÁMBAR (Tardanza) y envía alerta automática por WhatsApp al apoderado.', color: C_DORADO_OSC, bg: 'FFFBEB' },
            { hora: 'HASTA 01:00 PM', titulo: 'PERMISO ESPECIAL (TRABAJO)', desc: 'Estudiantes autorizados por TOECE/Admin registran PUNTUAL hasta la 1:00 PM.', color: C_AZUL, bg: 'F0F9FF' },
            { hora: '01:30 PM EN PUNTO', titulo: 'CIERRE DE PORTÓN (FALTA)', desc: 'El sistema marca FALTA a quienes no ingresaron y notifica por WhatsApp a sus padres.', color: C_ROJO, bg: 'FEF2F2' }
        ];

        bloques.forEach((b, i) => {
            const yPos = 1.18 + (i * 0.98);
            s3.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: yPos, w: 5.9, h: 0.86, fill: { color: b.bg }, line: { color: b.color, width: 1.5 } });
            s3.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: yPos + 0.13, w: 1.95, h: 0.6, fill: { color: b.color } });
            s3.addText(b.hora, { x: 0.52, y: yPos + 0.15, w: 1.9, h: 0.55, fontSize: 10, bold: true, color: C_BLANCO, align: 'center', valign: 'middle' });
            s3.addText(b.titulo, { x: 2.58, y: yPos + 0.1, w: 3.6, h: 0.28, fontSize: 11.5, bold: true, color: b.color });
            s3.addText(b.desc, { x: 2.58, y: yPos + 0.38, w: 3.6, h: 0.42, fontSize: 9.8, color: C_TEXTO });
        });

        agregarMarcoImagen(s3, 6.5, 1.18, 3.1, 3.9,
            'Coloca aquí una captura del reloj y cartel de Horario Oficial de la vista Portón QR'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 4: CREDENCIALES Y PERFILES DE USUARIO
    // =========================================================================
    {
        const s4 = pptx.addSlide();
        aplicarCabeceraInstitucional(s4, 4, '3. Credenciales Oficiales y Perfiles de Acceso', 'Enlace oficial: https://sistemaasistenciamercedes.duckdns.org');

        const rows = [
            [
                { text: 'PERFIL / CARGO', options: { bold: true, fill: C_GUINDA, color: C_BLANCO, align: 'center' } },
                { text: 'USUARIO', options: { bold: true, fill: C_GUINDA, color: C_BLANCO, align: 'center' } },
                { text: 'CONTRASEÑA OFICIAL', options: { bold: true, fill: C_GUINDA, color: C_BLANCO, align: 'center' } },
                { text: 'FUNCIONES HABILITADAS', options: { bold: true, fill: C_GUINDA, color: C_BLANCO, align: 'center' } }
            ],
            ['Auxiliar de Educación 1', { text: 'auxiliar_uno', options: { bold: true, fontFace: 'Courier New' } }, { text: 'Mercedes_auxiliar1_2026*', options: { fontFace: 'Courier New', color: C_GUINDA, bold: true } }, 'Monitoreo por sección, PDF alfabético, Excel mensual y Chat IA'],
            ['Auxiliar de Educación 2', { text: 'auxiliar_dos', options: { bold: true, fontFace: 'Courier New' } }, { text: 'Mercedes_auxiliar2_2026*', options: { fontFace: 'Courier New', color: C_GUINDA, bold: true } }, 'Monitoreo por sección, PDF alfabético, Excel mensual y Chat IA'],
            ['Auxiliar de Educación 3', { text: 'auxiliar_tres', options: { bold: true, fontFace: 'Courier New' } }, { text: 'Mercedes_auxiliar3_2026*', options: { fontFace: 'Courier New', color: C_GUINDA, bold: true } }, 'Monitoreo por sección, PDF alfabético, Excel mensual y Chat IA'],
            ['Coordinación TOECE', { text: 'admin_toece', options: { bold: true, fontFace: 'Courier New' } }, { text: 'Mercedes_toece_2026*', options: { fontFace: 'Courier New', color: C_AZUL, bold: true } }, 'Todo lo anterior + Celulares WhatsApp, Permiso 1PM, Carnets y Cierre'],
            ['Administración', { text: 'admin', options: { bold: true, fontFace: 'Courier New' } }, { text: 'Mercedes_admin_2026*', options: { fontFace: 'Courier New', color: C_VERDE, bold: true } }, 'Control Total + Altas/Bajas, Traslados de Sección e Importación SIAGIE']
        ];

        s4.addTable(rows, {
            x: 0.4, y: 1.25, w: 6.0, h: 3.7,
            colW: [1.4, 1.15, 1.75, 1.7],
            fontSize: 9.5,
            border: { pt: 1, color: 'CBD5E1' },
            fill: { color: C_BLANCO },
            valign: 'middle'
        });

        agregarMarcoImagen(s4, 6.55, 1.25, 3.05, 3.7,
            'Coloca aquí la captura de la ventana de Login ("Acceso por Perfil Institucional")'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 5: OPERACIÓN EN PORTÓN (MODO KIOSCO QR)
    // =========================================================================
    {
        const s5 = pptx.addSlide();
        aplicarCabeceraInstitucional(s5, 5, '4. Operación en el Portón (Modo Kiosco QR)', 'Registro ultrarrápido mediante Lectora Láser USB o Cámara de Celular');

        s5.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s5.addText('¿Cómo registrar el ingreso de los estudiantes?', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_GUINDA });
        s5.addText([
            { text: 'Opción A — Pistola Lectora QR USB (En Laptop):\n', options: { bold: true, color: C_TEXTO } },
            { text: 'El cursor ya está enfocado automáticamente. Solo apunta el láser al carnet del alumno y el sistema registra y emite un sonido de confirmación.\n\n', options: { color: C_GRIS } },
            { text: 'Opción B — Cámara del Celular / Tablet:\n', options: { bold: true, color: C_TEXTO } },
            { text: 'Pulsa el botón "Activar Cámara", enfoca el carnet QR y se registrará al instante.\n\n', options: { color: C_GRIS } },
            { text: 'Semáforo Visual y Sonoro en Pantalla:\n', options: { bold: true, color: C_GUINDA } },
            { text: '• VERDE: Ingreso Puntual registrado.\n• ÁMBAR: Ingreso con Tardanza (envía WhatsApp).\n• ROJO: Doble escaneo bloqueado (ya pasó hoy).', options: { color: C_TEXTO } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10.5, valign: 'top' });

        agregarMarcoImagen(s5, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura de la vista "Portón QR" mostrando una lectura exitosa en verde o ámbar'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 6: ALERTAS AUTOMÁTICAS DE WHATSAPP
    // =========================================================================
    {
        const s6 = pptx.addSlide();
        aplicarCabeceraInstitucional(s6, 6, '5. Alertas Automáticas por WhatsApp al Apoderado', 'Comunicación inmediata con los padres de familia ante Tardanzas y Faltas');

        s6.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s6.addText('Funcionamiento del Bot Institucional de TOECE', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_GUINDA });
        s6.addText([
            { text: '1. Vinculación Única en el Panel Web:\n', options: { bold: true } },
            { text: 'En la pestaña "WhatsApp y Apoderados", TOECE escanea el QR una sola vez y la sesión queda guardada en la nube.\n\n', options: { color: C_GRIS } },
            { text: '2. Disparo Automático en Tardanzas y Faltas:\n', options: { bold: true } },
            { text: 'Cuando el alumno llega después de las 12:45 PM o cuando se cierra el portón a la 1:30 PM, el padre recibe el reporte con fecha, hora exacta y nombre.\n\n', options: { color: C_GRIS } },
            { text: '3. Cola Inteligente Anti-Bloqueo:\n', options: { bold: true } },
            { text: 'Los mensajes se envían con pausas automáticas de 3.5 a 6.5 segundos para proteger el número del colegio.', options: { color: C_GRIS } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10.5, valign: 'top' });

        agregarMarcoImagen(s6, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura real del mensaje de WhatsApp recibido en el celular del apoderado'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 7: MONITOREO EN TIEMPO REAL PARA AUXILIARES
    // =========================================================================
    {
        const s7 = pptx.addSlide();
        aplicarCabeceraInstitucional(s7, 7, '6. Panel de Monitoreo Diario para Auxiliares', 'Control en vivo por sección (5to A hasta 5to H) y filtros rápidos');

        s7.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s7.addText('¿Cómo revisa el auxiliar su sección cada tarde?', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_GUINDA });
        s7.addText([
            { text: 'Tarjetas Superiores (KPIs clicables):\n', options: { bold: true } },
            { text: 'Muestran al instante el total del padrón activo (257), cuántos llegaron Puntuales, Tardanzas, Faltaron y cuántos están Sin Registro.\n\n', options: { color: C_GRIS } },
            { text: 'Filtro por Sección (5to A – 5to H):\n', options: { bold: true } },
            { text: 'Cada auxiliar elige su sección en el selector superior para ver únicamente a sus alumnos en orden alfabético.\n\n', options: { color: C_GRIS } },
            { text: 'Botones Rápidos de Estado:\n', options: { bold: true } },
            { text: 'Permiten filtrar con un clic: "Todos", "No Faltaron (Asistieron)", "Puntuales", "Llegaron Tarde" o "Faltaron".', options: { color: C_GRIS } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10.5, valign: 'top' });

        agregarMarcoImagen(s7, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura de la tabla "Control de Quiénes Asistieron, Llegaron Tarde o Faltaron"'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 8: IMPRESIÓN DE ASISTENCIA DIARIA EN PDF (ORDEN ALFABÉTICO)
    // =========================================================================
    {
        const s8 = pptx.addSlide();
        aplicarCabeceraInstitucional(s8, 8, '7. Reportes Oficiales en PDF por Sección (Orden Alfabético)', 'Diseñado según el requerimiento de los Auxiliares de Educación');

        s8.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s8.addText('Botón Dorado: "Imprimir PDF del Día"', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_DORADO_OSC });
        s8.addText([
            { text: '1. Orden Alfabético Estricto (Lista Oficial SIAGIE):\n', options: { bold: true, color: C_GUINDA } },
            { text: 'La lista impresa SIEMPRE sale ordenada de la A a la Z por Apellidos y Nombres (1, 2, 3...), sin importar a qué hora haya entrado el alumno.\n\n', options: { color: C_TEXTO } },
            { text: '2. Separación Automática por Sección:\n', options: { bold: true, color: C_GUINDA } },
            { text: '• Si filtras "5to A", imprime solo la hoja oficial de 5to A.\n• Si eliges "Todas las secciones", genera cada sección (5to A, 5to B... 5to H) en su propia hoja A4 separada.\n\n', options: { color: C_TEXTO } },
            { text: '3. Pie de Firma Institucional:\n', options: { bold: true, color: C_GUINDA } },
            { text: 'Incluye línea de firma para el Auxiliar a cargo de la sección y V°B° de TOECE.', options: { color: C_TEXTO } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10.5, valign: 'top' });

        agregarMarcoImagen(s8, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura de la ventana de impresión PDF mostrando una sección ordenada de la A a la Z'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 9: DESCARGA MENSUAL EN EXCEL Y BACKUP SEMANAL
    // =========================================================================
    {
        const s9 = pptx.addSlide();
        aplicarCabeceraInstitucional(s9, 9, '8. Consolidado Mensual en Excel y Backup Semanal', 'Sábana de asistencia mensual/semanal descargable por sección');

        s9.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s9.addText('Botón Verde: "Descargar Excel (Mes / Semana)"', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_VERDE });
        s9.addText([
            { text: '¿Cómo descarga el auxiliar su registro mensual?\n', options: { bold: true } },
            { text: '1. Clic en el botón verde "Descargar Excel (Mes / Semana)".\n2. Selecciona su sección (ej. 5to "A") y el mes (ej. Noviembre 2026) o rango de fechas de la semana.\n3. Se descarga el archivo .xlsx listo para abrir en Excel.\n\n', options: { color: C_TEXTO } },
            { text: '¿Qué contiene el archivo Excel?\n', options: { bold: true, color: C_GUINDA } },
            { text: '• Nómina en orden alfabético con columnas día por día (Lunes a Viernes): P (Puntual), T (Tardanza), F (Falta).\n• Cálculo automático de Total Puntual, Tardanzas, Faltas y % de Asistencia.\n\n', options: { color: C_TEXTO } },
            { text: 'Respaldo Automático del Servidor:\n', options: { bold: true, color: C_AZUL } },
            { text: 'Todos los domingos a las 11:00 PM el servidor guarda un backup completo de la base de datos.', options: { color: C_TEXTO } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10, valign: 'top' });

        agregarMarcoImagen(s9, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura del modal "Descargar Asistencia en Excel" o del archivo Excel abierto'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 10: ASISTENTE ANALÍTICO CON IA (GEMINI 2.5 FLASH)
    // =========================================================================
    {
        const s10 = pptx.addSlide();
        aplicarCabeceraInstitucional(s10, 10, '9. Asistente Analítico Institucional con IA', 'Consultas en lenguaje natural conectadas en vivo a la base de datos');

        s10.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s10.addText('Reportes Instantáneos mediante Inteligencia Artificial', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 13.5, bold: true, color: C_GUINDA });
        s10.addText([
            { text: '¿Para qué sirve el Chat IA lateral?\n', options: { bold: true } },
            { text: 'Permite a los Auxiliares y a TOECE pedir estadísticas o listas específicas escribiendo como en WhatsApp.\n\n', options: { color: C_GRIS } },
            { text: 'Ejemplos de preguntas que puedes hacerle:\n', options: { bold: true, color: C_GUINDA } },
            { text: '• "¿Quiénes llegaron tarde hoy en 5to A?"\n• "Dame el resumen estadístico de asistencia de hoy por secciones"\n• "¿Qué alumnos registraron falta ayer en 5to C?"\n\n', options: { color: C_TEXTO, bold: true } },
            { text: 'Alta Disponibilidad:\n', options: { bold: true, color: C_VERDE } },
            { text: 'Cuenta con motor de respaldo SQL directo para responder siempre en menos de 2 segundos.', options: { color: C_TEXTO } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10.5, valign: 'top' });

        agregarMarcoImagen(s10, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura del "Asistente Analítico Institucional (IA)" respondiendo un reporte'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 11: GESTIÓN DE PADRÓN, PERMISOS 1PM Y TRASLADOS
    // =========================================================================
    {
        const s11 = pptx.addSlide();
        aplicarCabeceraInstitucional(s11, 11, '10. Casos Especiales: Permisos, Carnets y Traslados', 'Soluciones rápidas para las situaciones del día a día');

        s11.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 1.2, w: 5.8, h: 3.85, fill: { color: C_BLANCO }, line: { color: 'CBD5E1', width: 1 } });
        s11.addText('Protocolo ante situaciones frecuentes', { x: 0.6, y: 1.35, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: C_GUINDA });
        s11.addText([
            { text: '1. ¿Alumno con permiso de ingreso hasta la 1:00 PM por trabajo?\n', options: { bold: true, color: C_AZUL } },
            { text: 'En TOECE o Administración se activa el botón "Permiso 1:00 PM" del alumno y el sistema le respetará puntualidad hasta las 13:00:00.\n\n', options: { color: C_TEXTO } },
            { text: '2. ¿Alumno cambió de sección (ej. de 5to A a 5to D)?\n', options: { bold: true, color: C_GUINDA } },
            { text: 'En Administración se selecciona al estudiante en "Traslado de Estudiante a Otra Sección" y se actualiza al instante.\n\n', options: { color: C_TEXTO } },
            { text: '3. ¿Alumno perdió su carnet QR o cambió el celular de su papá?\n', options: { bold: true, color: C_VERDE } },
            { text: 'Desde "Imprimir Carnets QR" se reimprime su carnet individual y en "WhatsApp y Apoderados" se actualiza el celular en 1 clic.', options: { color: C_TEXTO } }
        ], { x: 0.6, y: 1.8, w: 5.4, h: 3.1, fontSize: 10, valign: 'top' });

        agregarMarcoImagen(s11, 6.4, 1.2, 3.2, 3.85,
            'Coloca aquí la captura del módulo de Administración de Padrón o de Impresión de Carnets'
        );
    }

    // =========================================================================
    // DIAPOSITIVA 12: CIERRE Y COMPROMISOS
    // =========================================================================
    {
        const s12 = pptx.addSlide();
        s12.background = { color: C_GUINDA };
        s12.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: C_DORADO } });

        if (existeInsignia) {
            s12.addShape(pptx.ShapeType.roundRect, { x: 4.45, y: 0.5, w: 1.1, h: 1.3, fill: { color: C_BLANCO }, line: { color: C_DORADO, width: 2 } });
            s12.addImage({ path: rutaInsignia, x: 4.53, y: 0.58, w: 0.94, h: 1.14 });
        }

        s12.addText('¡Gracias por su compromiso con la innovación educativa!', {
            x: 0.8, y: 2.0, w: 8.4, h: 0.55,
            fontSize: 22, bold: true, color: C_BLANCO, align: 'center'
        });

        s12.addText('I.E. NUESTRA SEÑORA DE LAS MERCEDES — PAITA\n"Saber, Progreso y Felicidad"', {
            x: 1.0, y: 2.6, w: 8.0, h: 0.6,
            fontSize: 13, bold: true, color: C_DORADO, align: 'center'
        });

        s12.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: 3.4, w: 7.0, h: 1.45, fill: { color: '5C0513' }, line: { color: C_DORADO, width: 1.5 } });
        s12.addText([
            { text: 'Acceso permanente al sistema:\n', options: { fontSize: 11, color: 'FDE047', bold: true } },
            { text: 'https://sistemaasistenciamercedes.duckdns.org\n\n', options: { fontSize: 14, color: C_BLANCO, bold: true } },
            { text: 'Soporte Técnico del Piloto: Dayron Iván Talledo Rojas', options: { fontSize: 10.5, color: 'FCA5A5', bold: true } }
        ], { x: 1.7, y: 3.5, w: 6.6, h: 1.25, align: 'center', valign: 'middle' });
    }

    const rutaSalida = path.resolve(__dirname, '../../../Capacitacion_Asistencia_QR_Mercedes.pptx');
    await pptx.writeFile({ fileName: rutaSalida });
    console.log(`✅ Presentación PowerPoint creada con éxito en: ${rutaSalida}`);
}

crearPresentacionCapacitacion().catch(err => {
    console.error('❌ Error generando PPTX:', err);
    process.exit(1);
});

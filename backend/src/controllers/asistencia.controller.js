// src/controllers/asistencia.controller.js
const pool = require('../config/db');

// Formateador determinista fijado a la zona horaria de Perú
const obtenerFechaHoraPeru = () => {
    const ahora = new Date();
    const opcionesFecha = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opcionesHora = { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    // Formato YYYY-MM-DD (usando locale sv-SE que estandariza ISO en zona local)
    const fechaSQL = new Intl.DateTimeFormat('sv-SE', opcionesFecha).format(ahora);
    const horaSQL = new Intl.DateTimeFormat('sv-SE', opcionesHora).format(ahora);

    return { fechaSQL, horaSQL };
};

const registrarAsistenciaQR = async (req, res) => {
    const { dni } = req.body;

    if (!dni || !/^\d{8}$/.test(dni.trim())) {
        return res.status(400).json({ error: 'DNI inválido o no proporcionado por el escáner.' });
    }

    try {
        const [estudiantes] = await pool.query(
            'SELECT id_estudiante, nombres, apellidos, telefono_apoderado FROM Estudiante WHERE dni = ?',
            [dni.trim()]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en el sistema.' });
        }

        const estudiante = estudiantes[0];
        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();

        const horaLimite = process.env.HORA_LIMITE_PUNTUAL || '07:30:00';
        const estadoAsistencia = horaSQL > horaLimite ? 'Tardanza' : 'Puntual';

        try {
            await pool.query(
                'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado) VALUES (?, ?, ?, ?)',
                [estudiante.id_estudiante, fechaSQL, horaSQL, estadoAsistencia]
            );
        } catch (dbError) {
            // Captura atómica si salta el UNIQUE INDEX (ER_DUP_ENTRY) o validación previa
            if (dbError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    error: 'El estudiante ya registró su asistencia el día de hoy.',
                    alumno: `${estudiante.nombres} ${estudiante.apellidos}`
                });
            }
            throw dbError;
        }

        // Disparo asíncrono (Fire-and-Forget) para no bloquear la fila en el portón
        if (estadoAsistencia === 'Tardanza' && estudiante.telefono_apoderado) {
            // Se desacopla con setImmediate para responder en <50ms al escáner
            setImmediate(() => {
                // enviarAlertaWhatsApp(estudiante.telefono_apoderado, `${estudiante.nombres} ${estudiante.apellidos}`, horaSQL);
            });
        }

        return res.status(200).json({
            mensaje: 'Asistencia registrada correctamente.',
            alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
            fecha: fechaSQL,
            hora: horaSQL,
            estado: estadoAsistencia
        });

    } catch (error) {
        console.error('❌ Error en el registro de asistencia:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la asistencia.' });
    }
};

module.exports = { registrarAsistenciaQR };
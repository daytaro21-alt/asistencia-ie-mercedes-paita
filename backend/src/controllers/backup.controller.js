const xlsx = require('xlsx');
const {
    generarBackupCompletoJSON,
    restaurarDesdeBackup
} = require('../utils/backupService');

/**
 * GET /api/backup/descargar
 * Descarga la copia de seguridad completa del sistema en formato JSON restaurable
 */
const descargarBackupJSON = async (req, res) => {
    try {
        const backup = await generarBackupCompletoJSON();
        const nombreArchivo = `Backup_Completo_${backup.fecha}.json`;
        const contenido = JSON.stringify(backup, null, 2);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        return res.status(200).send(contenido);
    } catch (error) {
        console.error('❌ Error al generar backup descargable:', error);
        return res.status(500).json({ error: 'No se pudo generar la copia de seguridad.' });
    }
};

/**
 * POST /api/backup/restaurar
 * Restaura datos desde un archivo .json de copia de seguridad o un Excel diario (.xlsx en base64)
 */
const restaurarSistema = async (req, res) => {
    try {
        const body = req.body || {};
        let payload = body;

        if (body.archivoBase64) {
            const buffer = Buffer.from(body.archivoBase64, 'base64');
            const wb = xlsx.read(buffer, { type: 'buffer' });
            const primeraHoja = wb.SheetNames[0];
            if (!primeraHoja) {
                return res.status(400).json({ error: 'El archivo Excel no contiene hojas válidas.' });
            }

            const filas = xlsx.utils.sheet_to_json(wb.Sheets[primeraHoja], { defval: '' });
            const registros = filas.map((f) => ({
                dni: f['DNI'] ?? f['dni'] ?? '',
                fecha: f['Fecha'] ?? f['fecha'] ?? body.fecha ?? '',
                hora_ingreso: f['Hora Ingreso'] ?? f['hora_ingreso'] ?? '',
                estado: f['Estado'] ?? f['estado'] ?? '',
                observacion: f['Observación'] ?? f['Observacion'] ?? f['observacion'] ?? ''
            }));

            payload = {
                tipo: 'asistencia_excel',
                fecha: body.fecha || null,
                registros
            };
        }

        const resultado = await restaurarDesdeBackup(payload);
        return res.status(200).json({
            mensaje: `Restauración completada: ${resultado.estudiantesRestaurados} estudiantes, ${resultado.asistenciasRestauradas} asistencias y ${resultado.permisosRestaurados} permisos procesados.`,
            ...resultado
        });
    } catch (error) {
        console.error('❌ Error al restaurar respaldo:', error);
        return res.status(400).json({
            error: error.message || 'No se pudo restaurar la copia de seguridad.'
        });
    }
};

module.exports = {
    descargarBackupJSON,
    restaurarSistema
};

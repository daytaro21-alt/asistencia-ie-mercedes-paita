// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

const normalizarRolToken = (rol) => {
    const r = String(rol || '').trim().toLowerCase();
    if (r === 'admin' || r === 'administracion' || r === 'administración') return 'Administracion';
    if (r === 'auxiliar') return 'Auxiliar';
    return 'TOECE';
};

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Acceso denegado. Token no proporcionado o formato inválido (Use: Bearer <token>).'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const secret = process.env.JWT_SECRET || 'mercedes_toece_secret_key_2026_piloto';
        const decoded = jwt.verify(token, secret);
        decoded.rol = normalizarRolToken(decoded.rol);

        // Inyectamos los datos del usuario autenticado en la request
        req.usuario = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'La sesión ha expirado. Inicie sesión nuevamente.' });
        }
        return res.status(403).json({ error: 'Token inválido o corrupto.' });
    }
};

/**
 * Middleware para restringir rutas por rol (ej. ['Administracion', 'TOECE'])
 */
const verificarRol = (rolesPermitidos = []) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'Usuario no autenticado.' });
        }

        const rolActual = normalizarRolToken(req.usuario.rol);
        if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rolActual)) {
            return res.status(403).json({
                error: `Permisos insuficientes para el perfil ${rolActual}. Se requiere perfil: ${rolesPermitidos.join(' o ')}.`
            });
        }

        next();
    };
};

module.exports = { verificarToken, verificarRol };

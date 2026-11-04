// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

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
 * Middleware opcional para restringir rutas por rol (ej. ['Admin', 'Auxiliar_TOECE'])
 */
const verificarRol = (rolesPermitidos = []) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'Usuario no autenticado.' });
        }

        if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Permisos insuficientes. Se requiere rol: ${rolesPermitidos.join(' o ')}.`
            });
        }

        next();
    };
};

module.exports = { verificarToken, verificarRol };

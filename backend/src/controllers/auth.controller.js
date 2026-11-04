// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const normalizarRol = (rol) => {
    const r = String(rol || '').trim().toLowerCase();
    if (r === 'admin' || r === 'administracion' || r === 'administración') return 'Administracion';
    if (r === 'auxiliar') return 'Auxiliar';
    return 'TOECE';
};

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Debe proporcionar usuario y contraseña.' });
    }

    try {
        const [usuarios] = await pool.query(
            'SELECT id_usuario, username, nombre_completo, password, rol FROM usuario WHERE username = ? LIMIT 1',
            [username.trim()]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const usuarioDB = usuarios[0];

        // Comparación segura con Bcrypt
        const passwordValido = await bcrypt.compare(password, usuarioDB.password);

        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const rolNormalizado = normalizarRol(usuarioDB.rol);

        const payload = {
            id_usuario: usuarioDB.id_usuario,
            username: usuarioDB.username,
            nombre_completo: usuarioDB.nombre_completo || usuarioDB.username,
            rol: rolNormalizado
        };

        const secret = process.env.JWT_SECRET || 'mercedes_toece_secret_key_2026_piloto';
        const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

        const token = jwt.sign(payload, secret, { expiresIn });

        return res.status(200).json({
            mensaje: 'Autenticación exitosa.',
            token,
            usuario: payload
        });

    } catch (error) {
        console.error('❌ Error en el login:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la autenticación.' });
    }
};

const listarUsuarios = async (req, res) => {
    try {
        const [usuarios] = await pool.query(
            'SELECT id_usuario, username, nombre_completo, rol FROM usuario ORDER BY id_usuario ASC'
        );
        return res.status(200).json({
            usuarios: usuarios.map(u => ({ ...u, rol: normalizarRol(u.rol) }))
        });
    } catch (error) {
        console.error('❌ Error listando usuarios:', error);
        return res.status(500).json({ error: 'Error al obtener la lista de usuarios.' });
    }
};

const crearOActualizarUsuario = async (req, res) => {
    const { username, nombre_completo, password, rol } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }

    const rolValido = normalizarRol(rol);
    const userLimpio = username.trim().toLowerCase();

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await pool.query(
            `INSERT INTO usuario (username, nombre_completo, password, rol)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                nombre_completo = VALUES(nombre_completo),
                password = VALUES(password),
                rol = VALUES(rol)`,
            [userLimpio, (nombre_completo || userLimpio).trim(), hash, rolValido]
        );

        return res.status(200).json({
            mensaje: `Usuario "${userLimpio}" guardado con el perfil ${rolValido}.`,
            username: userLimpio,
            rol: rolValido
        });
    } catch (error) {
        console.error('❌ Error guardando usuario:', error);
        return res.status(500).json({ error: 'Error al guardar el usuario.' });
    }
};

module.exports = { login, listarUsuarios, crearOActualizarUsuario, normalizarRol };

// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Debe proporcionar username y password.' });
    }

    try {
        const [usuarios] = await pool.query(
            'SELECT id_usuario, username, password, rol FROM usuario WHERE username = ? LIMIT 1',
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

        const payload = {
            id_usuario: usuarioDB.id_usuario,
            username: usuarioDB.username,
            rol: usuarioDB.rol
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

module.exports = { login };

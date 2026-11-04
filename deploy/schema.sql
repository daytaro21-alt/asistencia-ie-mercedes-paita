-- ==============================================================================
-- ESQUEMA OFICIAL DE BASE DE DATOS MYSQL EN PRODUCCIÓN (AWS EC2 / RDS)
-- Proyecto: Sistema Automatizado de Asistencia QR - I.E. Nuestra Señora de las Mercedes
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS asistencia_mercedes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asistencia_mercedes;

-- 1. Tabla de Estudiantes (Padrón SIAGIE - Piloto 5to de Secundaria)
CREATE TABLE IF NOT EXISTS Estudiante (
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    dni CHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    grado VARCHAR(30) NOT NULL,
    seccion VARCHAR(10) NOT NULL,
    telefono_apoderado VARCHAR(15) DEFAULT NULL,
    estado_matricula VARCHAR(20) NOT NULL DEFAULT 'DEFINITIVA',
    INDEX idx_grado_seccion (grado, seccion),
    INDEX idx_estado_matricula (estado_matricula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Asistencia (Con restricción UNIQUE diaria para bloquear doble escaneo)
CREATE TABLE IF NOT EXISTS Asistencia (
    id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_ingreso TIME NOT NULL,
    estado ENUM('Puntual', 'Tardanza', 'Falta') NOT NULL,
    UNIQUE KEY uk_estudiante_fecha (estudiante_id, fecha),
    INDEX idx_fecha_estado (fecha, estado),
    CONSTRAINT fk_asistencia_estudiante
        FOREIGN KEY (estudiante_id) REFERENCES Estudiante(id_estudiante)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Usuarios por Perfil (Administracion, TOECE, Auxiliar)
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    nombre_completo VARCHAR(100) DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'TOECE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

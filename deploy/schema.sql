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
    hora_limite_puntual VARCHAR(10) DEFAULT NULL,
    INDEX idx_grado_seccion (grado, seccion),
    INDEX idx_estado_matricula (estado_matricula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Asistencia (Con restricción UNIQUE diaria para bloquear doble escaneo)
CREATE TABLE IF NOT EXISTS Asistencia (
    id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_ingreso TIME NOT NULL,
    estado VARCHAR(35) NOT NULL,
    observacion VARCHAR(255) DEFAULT NULL,
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

-- 4. Tabla Independiente de Permisos de Salida (Controlado por Auxiliares / TOECE)
CREATE TABLE IF NOT EXISTS PermisoSalida (
    id_permiso INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_salida TIME NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    detalle VARCHAR(255) DEFAULT NULL,
    autorizado_por VARCHAR(50) DEFAULT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_permiso_fecha (fecha),
    INDEX idx_permiso_estudiante (estudiante_id, fecha),
    CONSTRAINT fk_permiso_estudiante
        FOREIGN KEY (estudiante_id) REFERENCES Estudiante(id_estudiante)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

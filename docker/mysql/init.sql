-- docker/mysql/init.sql — Initialisation base de métadonnées au démarrage Docker
CREATE DATABASE IF NOT EXISTS agent_dw_meta
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE agent_dw_meta;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    prefix        VARCHAR(50)   NOT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    last_login    TIMESTAMP     NULL,
    is_active     TINYINT(1)    DEFAULT 1,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des sessions
CREATE TABLE IF NOT EXISTS sessions (
    id          VARCHAR(100) PRIMARY KEY,
    user_id     INT          NOT NULL,
    state_json  LONGTEXT,
    status      VARCHAR(50)  DEFAULT 'running',
    etl_status  VARCHAR(50)  DEFAULT 'pending',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de l'audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_id    INT,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vue pour le dashboard admin
CREATE OR REPLACE VIEW v_session_summary AS
SELECT
    s.id           AS session_id,
    u.email        AS user_email,
    u.prefix       AS user_prefix,
    s.status,
    s.etl_status,
    s.created_at,
    s.updated_at,
    TIMESTAMPDIFF(MINUTE, s.created_at, s.updated_at) AS duration_minutes
FROM sessions s
JOIN users u ON s.user_id = u.id
ORDER BY s.updated_at DESC;

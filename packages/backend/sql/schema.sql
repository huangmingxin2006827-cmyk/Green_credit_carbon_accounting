CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploads (
  file_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  disk_path VARCHAR(512) NOT NULL,
  parsed_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id),
  KEY idx_uploads_user (user_id),
  CONSTRAINT fk_uploads_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  report_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  file_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NULL,
  industry VARCHAR(128) NULL,
  carbon_total DOUBLE NULL,
  scope1 DOUBLE NULL,
  scope2 DOUBLE NULL,
  scope3 DOUBLE NULL,
  content MEDIUMTEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'generating',
  confirmed TINYINT(1) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  exported_file_url VARCHAR(512) NULL,
  calculation_json JSON NULL,
  calculation_extra_json JSON NULL,
  parsed_json JSON NULL,
  benchmark_json JSON NULL,
  charts_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  KEY idx_reports_user_created (user_id, created_at),
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suggestions (
  suggestion_id VARCHAR(64) NOT NULL,
  report_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail MEDIUMTEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (suggestion_id),
  KEY idx_suggestions_user_report (user_id, report_id),
  CONSTRAINT fk_suggestions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  task_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  report_id VARCHAR(64) NULL,
  suggestion_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL,
  source VARCHAR(128) NULL,
  priority VARCHAR(32) NULL,
  suggested_due_date VARCHAR(32) NULL,
  checklist_json JSON NULL,
  checklist_done_json JSON NULL,
  approval_flow_json JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'inProgress',
  sync_status VARCHAR(32) NOT NULL DEFAULT 'done',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id),
  KEY idx_tasks_user_created (user_id, created_at),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  channel VARCHAR(32) NOT NULL,
  msg_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content MEDIUMTEXT NULL,
  report_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_user_channel (user_id, channel, id),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

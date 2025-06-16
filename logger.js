const { createLogger, format, transports } = require('winston');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

// Создаем директории для логов, если их нет
fs.ensureDirSync(config.logsDir);

// Создаем форматтер для логов
const logFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Создаем логгер
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Записываем все логи в файл
    new transports.File({ 
      filename: path.join(config.logsDir, 'axie-checker.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // Записываем ошибки в отдельный файл
    new transports.File({ 
      filename: path.join(config.logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Если не в production режиме, логируем также в консоль
if (process.env.NODE_ENV !== 'production' && process.env.SILENT_CONSOLE !== 'true') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      logFormat
    )
  }));
}

module.exports = logger; 
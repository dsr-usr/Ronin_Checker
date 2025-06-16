const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('./config');
const logger = require('./logger');

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.loadProxies();
  }

  // Загрузка прокси из файла
  loadProxies() {
    try {
      const content = fs.readFileSync(config.proxiesFile, 'utf8');
      this.proxies = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      if (this.proxies.length === 0) {
        logger.warn('Предупреждение: Файл с прокси пуст или не содержит валидных прокси');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`Файл с прокси ${config.proxiesFile} не найден. Создаем пустой файл с примером.`);
        // Создаем пустой файл с примером
        fs.writeFileSync(config.proxiesFile, '# Формат: ip:port:login:password\n127.0.0.1:8080:user:pass\n');
      } else {
        logger.error(`Ошибка при загрузке прокси: ${error.message}`);
      }
      this.proxies = [];
    }
  }

  // Получение случайного прокси
  getRandomProxy() {
    if (this.proxies.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.proxies.length);
    return this.proxies[randomIndex];
  }

  // Создание агента для прокси
  createProxyAgent() {
    const proxy = this.getRandomProxy();
    if (!proxy) {
      // Если нет прокси, возвращаем ошибку
      logger.error('Нет доступных прокси. Добавьте прокси в файл proxies.txt');
      return null;
    }

    try {
      // Разбиваем строку прокси на части
      const parts = proxy.split(':');
      
      // Проверяем формат
      if (parts.length < 2) {
        logger.error(`Неверный формат прокси: ${proxy}. Формат должен быть ip:port или ip:port:login:password`);
        return null;
      }
      
      const ip = parts[0];
      const port = parseInt(parts[1], 10);
      
      // Определяем, есть ли аутентификация
      let proxyUrl;
      if (parts.length >= 4) {
        // Если есть логин и пароль
        const login = parts[2];
        // Пароль может содержать двоеточия, объединяем оставшиеся части
        const password = parts.slice(3).join(':');
        proxyUrl = `http://${login}:${password}@${ip}:${port}`;
      } else {
        // Если только ip и порт
        proxyUrl = `http://${ip}:${port}`;
      }
      
      // Создаем новый экземпляр HttpsProxyAgent
      return new HttpsProxyAgent(proxyUrl);
    } catch (error) {
      // Логируем ошибку прокси
      logger.error(`Ошибка при создании прокси-агента для ${proxy}: ${error.message}`);
      return null;
    }
  }
}

module.exports = new ProxyManager(); 
const { Wallet } = require('ethers');
const logger = require('./logger');

class KeyUtils {
  // Проверяет, является ли строка адресом Ethereum
  isAddress(input) {
    // Адрес Ethereum: 0x + 40 символов в шестнадцатеричной системе
    return /^0x[a-fA-F0-9]{40}$/.test(input);
  }

  // Проверяет, является ли строка приватным ключом
  isPrivateKey(input) {
    // Приватный ключ может быть с 0x или без
    // 64 символа в шестнадцатеричной системе или с префиксом 0x (66 символов)
    return /^(0x)?[a-fA-F0-9]{64}$/.test(input);
  }

  // Преобразует приватный ключ в адрес
  keyToAddress(privateKey) {
    try {
      // Если ключ без 0x, добавляем
      if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
      }
      
      // Создаем кошелек и получаем адрес
      const wallet = new Wallet(privateKey);
      return wallet.address.toLowerCase();
    } catch (error) {
      logger.error(`Ошибка при конвертации ключа в адрес: ${error.message}`);
      return null;
    }
  }

  // Нормализует ввод: если это ключ, возвращает объект с ключом и адресом,
  // если адрес - возвращает объект только с адресом
  normalizeInput(input) {
    input = input.trim();
    
    if (this.isAddress(input)) {
      return {
        address: input.toLowerCase(),
        privateKey: null
      };
    } else if (this.isPrivateKey(input)) {
      const address = this.keyToAddress(input);
      return {
        address,
        privateKey: input
      };
    }
    
    return null; // Некорректный ввод
  }
}

module.exports = new KeyUtils(); 
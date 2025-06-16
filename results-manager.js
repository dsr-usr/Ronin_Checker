const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

class ResultsManager {
  constructor() {
    this.totalAxies = 0;
    this.totalUsdValue = 0;
    this.resultCount = 0;
    this.resultFileName = '';
    this.resultsDir = config.resultsDir;
    this.initResultsDirectory();
  }

  // Инициализация директории для результатов
  initResultsDirectory() {
    try {
      fs.ensureDirSync(this.resultsDir);
    } catch (error) {
      logger.error(`Ошибка при создании директории для результатов: ${error.message}`);
      process.exit(1);
    }
  }

  // Создает новый файл для результатов
  createResultFile(addressCount) {
    const date = new Date();
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;
    
    this.resultFileName = path.join(this.resultsDir, `${formattedDate} [${addressCount} address].txt`);
    
    // Создаем файл с заголовком и первичной статистикой
    const initialSummary = `====================\n\nTotal Finded: 0.00$\nTotal Axies: 0\n\n====================\n\n`;
    fs.writeFileSync(this.resultFileName, initialSummary);
    
    logger.info(`Создан файл для результатов: ${this.resultFileName}`);
    return this.resultFileName;
  }

  // Обновление суммарных данных
  updateTotals(axieCount, usdValue) {
    this.totalAxies += axieCount;
    this.totalUsdValue += usdValue;
    this.resultCount++;
    
    // Сразу обновляем сводную информацию
    this.updateSummary();
  }

  // Обновляет общую информацию в начале файла
  updateSummary() {
    try {
      if (!this.resultFileName) return;
      
      // Формируем новый заголовок
      const summary = `====================\n\nTotal Finded: ${this.totalUsdValue.toFixed(2)}$\nTotal Axies: ${this.totalAxies}\n\n====================\n\n`;
      
      // Читаем текущее содержимое файла
      const content = fs.readFileSync(this.resultFileName, 'utf8');
      
      // Заменяем существующий заголовок (все что до первого адреса)
      const updatedContent = content.replace(/^====================[\s\S]*?====================\n\n/, summary);
      
      // Записываем обновленное содержимое в файл
      fs.writeFileSync(this.resultFileName, updatedContent);
    } catch (error) {
      logger.error(`Ошибка при обновлении суммарной информации: ${error.message}`);
    }
  }

  // Форматирует результат для одного адреса
  formatAddressResult(addressInfo) {
    let result = `${addressInfo.address} - ${addressInfo.explorerUrl}\n`;
    
    // Добавляем информацию о приватном ключе, если есть
    if (addressInfo.privateKey) {
      result += `Key: ${addressInfo.privateKey}\n`;
    } else {
      result += `Key: None\n`;
    }
    
    result += `Total: ${addressInfo.totalUsdValue.toFixed(2)}$\n`;
    
    // Добавляем информацию о токенах
    if (addressInfo.tokens.length > 0) {
      result += 'Tokens:\n';
      for (const token of addressInfo.tokens) {
        result += ` - ${token.balance} ${token.symbol} (${token.usdValue.toFixed(2)}$)\n`;
      }
    }
    
    // Добавляем информацию о NFT
    if (addressInfo.axieCount > 0) {
      result += 'NFT:\n';
      result += ` - ${addressInfo.axieCount} Axies\n`;
    }
    
    result += '------------------------------------------\n';
    return result;
  }

  // Записывает результат для одного адреса
  writeAddressResult(addressInfo) {
    try {
      if (!this.resultFileName) return;
      
      // Форматируем результат
      const formattedResult = this.formatAddressResult(addressInfo);
      
      // Добавляем в файл
      fs.appendFileSync(this.resultFileName, formattedResult);
      
      // Обновляем суммарные данные
      this.updateTotals(addressInfo.axieCount, addressInfo.totalUsdValue);
      
      // Логируем только в файл, не в консоль
      logger.info(`Записан результат для адреса: ${addressInfo.address}`);
    } catch (error) {
      logger.error(`Ошибка при записи результата: ${error.message}`);
    }
  }
}

module.exports = new ResultsManager(); 
const fs = require('fs-extra');
const { SingleBar, Presets } = require('cli-progress');

// Подавляем вывод логов в консоль
process.env.SILENT_CONSOLE = 'true';

const logger = require('./logger');
const apiService = require('./api-service');
const resultsManager = require('./results-manager');
const config = require('./config');
const keyUtils = require('./key-utils');

// Функция для загрузки адресов из файла
async function loadAddresses() {
  try {
    if (!fs.existsSync(config.addressesFile)) {
      logger.error(`Файл с адресами ${config.addressesFile} не найден`);
      fs.writeFileSync(config.addressesFile, '# Один адрес или приватный ключ на строку\n0x946343a16b3b88dca7dad175f927949203723991\n# Также принимаются приватные ключи с 0x или без\n');
      console.log(`Создан пример файла с адресами: ${config.addressesFile}`);
      process.exit(1);
    }

    const content = fs.readFileSync(config.addressesFile, 'utf8');
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    const walletData = [];
    const invalidEntries = [];
    
    // Обрабатываем каждую строку
    for (const line of lines) {
      const normalized = keyUtils.normalizeInput(line);
      if (normalized && normalized.address) {
        walletData.push(normalized);
      } else {
        invalidEntries.push(line);
      }
    }
    
    // Логируем информацию о результатах
    if (invalidEntries.length > 0) {
      logger.warn(`Найдено ${invalidEntries.length} некорректных записей в файле. Они будут проигнорированы.`);
      invalidEntries.forEach(entry => logger.warn(`Некорректная запись: ${entry}`));
    }

    if (walletData.length === 0) {
      logger.error('Не найдено валидных адресов или приватных ключей в файле');
      console.log('Не найдено валидных адресов или приватных ключей в файле. Проверьте формат.');
      process.exit(1);
    }

    logger.info(`Загружено ${walletData.length} записей, из них ${walletData.filter(w => w.privateKey).length} приватных ключей`);
    return walletData;
  } catch (error) {
    logger.error(`Ошибка при загрузке адресов: ${error.message}`);
    console.error(`Ошибка при загрузке адресов: ${error.message}`);
    process.exit(1);
  }
}

// Функция для обработки адреса
async function processAddress(walletData) {
  try {
    const { address, privateKey } = walletData;
    // Записываем оригинальный privateKey для отображения в отчете
    const originalKey = privateKey;
    
    const addressInfo = await apiService.getAddressInfo(address);
    
    // Добавляем информацию о ключе, если он был
    if (originalKey) {
      addressInfo.privateKey = originalKey;
    }
    
    // Если есть токены или Axie, записываем результат
    if (addressInfo.totalUsdValue > 0 || addressInfo.axieCount > 0) {
      resultsManager.writeAddressResult(addressInfo);
      return {
        success: true,
        address,
        privateKey: originalKey,
        axieCount: addressInfo.axieCount,
        usdValue: addressInfo.totalUsdValue
      };
    }
    
    return { 
      success: true, 
      address,
      privateKey: originalKey,
      axieCount: 0,
      usdValue: 0
    };
  } catch (error) {
    logger.error(`Ошибка при обработке адреса ${walletData.address}: ${error.message}`);
    return { 
      success: false, 
      address: walletData.address,
      privateKey: walletData.privateKey,
      error: error.message 
    };
  }
}

// Главная функция программы
async function main() {
  // Настройка вывода сообщений
  process.env.SILENT_CONSOLE = 'true';

  console.log('Загрузка адресов и приватных ключей...');
  const walletData = await loadAddresses();
  console.log(`Загружено ${walletData.length} записей, из них ${walletData.filter(w => w.privateKey).length} приватных ключей.`);

  // Создаем файл для результатов
  resultsManager.createResultFile(walletData.length);

  // Инициализируем прогресс-бар
  const progressBar = new SingleBar({
    format: 'Прогресс [{bar}] {percentage}% | {value}/{total} | Axies: {axies} | Total: {usd}$',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true
  }, Presets.shades_classic);

  progressBar.start(walletData.length, 0, {
    axies: 0,
    usd: '0.00'
  });

  // Настройка параллельных запросов
  const concurrentRequests = Math.min(config.concurrentRequests, walletData.length);
  let completedCount = 0;
  
  // Функция для выполнения задач в пуле
  const processChunk = async (startIndex) => {
    for (let i = startIndex; i < walletData.length; i += concurrentRequests) {
      const data = walletData[i];
      const result = await processAddress(data);
      
      completedCount++;
      progressBar.update(completedCount, {
        axies: resultsManager.totalAxies,
        usd: resultsManager.totalUsdValue.toFixed(2)
      });
    }
  };

  // Запуск параллельных потоков
  const tasks = [];
  for (let i = 0; i < concurrentRequests; i++) {
    tasks.push(processChunk(i));
  }

  // Ожидаем завершения всех задач
  await Promise.all(tasks);

  // Завершаем прогресс-бар
  progressBar.stop();

  console.log(`\nГотово! Проверено ${walletData.length} адресов.`);
  console.log(`Всего найдено Axie: ${resultsManager.totalAxies}`);
  console.log(`Общая стоимость: ${resultsManager.totalUsdValue.toFixed(2)}$`);
  console.log(`Результаты сохранены в файл: ${resultsManager.resultFileName}`);
}

// Запуск программы
main().catch(error => {
  logger.error(`Критическая ошибка: ${error.message}`);
  console.error(`Критическая ошибка: ${error.message}`);
  process.exit(1);
}); 
const axios = require('axios');
const BigNumber = require('bignumber.js');
const proxyManager = require('./proxy-manager');
const logger = require('./logger');
const config = require('./config');

class ApiService {
  constructor() {
    this.tokenPrices = {}; // Кеш для цен токенов
    this.lastPriceUpdate = 0;
  }

  // Создаем базовую конфигурацию для axios
  getAxiosConfig() {
    const proxyAgent = proxyManager.createProxyAgent();
    if (!proxyAgent) {
      throw new Error('Не удалось получить прокси. Проверьте файл proxies.txt');
    }
    
    return {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
      },
      httpsAgent: proxyAgent,
      timeout: 30000 // 30 секунд таймаут
    };
  }

  // Выполнение API запроса с повторными попытками
  async makeApiRequest(url, data, retries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Для каждой попытки получаем новый прокси
        const config = this.getAxiosConfig();
        const response = await axios.post(url, data, config);
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Специальная обработка ошибки аутентификации прокси
        if (error.response && error.response.status === 407) {
          logger.error(`Ошибка аутентификации прокси (407): Проверьте правильность логина и пароля в proxies.txt`);
          // Переходим к следующей попытке с другим прокси
        } 
        // Если ошибка связана с прокси, пробуем другой прокси
        else if (error.message.includes('прокси')) {
          logger.error(`Ошибка прокси: ${error.message}. Пробуем другой прокси...`);
        } else {
          // Логируем ошибку только при последней попытке
          if (attempt === retries - 1) {
            logger.error(`API запрос не удался после ${retries} попыток: ${error.message}`);
          } else {
            logger.debug(`Попытка ${attempt + 1} не удалась: ${error.message}. Пробуем еще раз...`);
          }
        }
        
        // Пауза перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    throw lastError;
  }

  // Получаем информацию о NFT коллекциях (Axie)
  async getNftCollections(address) {
    try {
      const requestData = {
        addresses: [address],
        chain_ids: [config.chainId],
        exclude_spams: true
      };
      
      const responseData = await this.makeApiRequest(config.api.nftCollections, requestData);

      if (responseData && responseData.data && responseData.data.items) {
        // Находим коллекцию Axie
        const axieCollection = responseData.data.items.find(
          item => item.collection_address.toLowerCase() === config.axieCollectionAddress.toLowerCase()
        );
        
        return axieCollection ? axieCollection.item_amount : 0;
      }
      
      return 0;
    } catch (error) {
      logger.error(`Ошибка при получении NFT коллекций для адреса ${address}: ${error.message}`);
      return 0;
    }
  }

  // Получаем баланс токенов
  async getTokenBalances(address) {
    try {
      const requestData = {
        addresses: [address],
        chain_ids: [config.chainId],
        token_standards: ["erc20", "native"],
        exclude_spams: true,
        exclude_unverified: true
      };
      
      const responseData = await this.makeApiRequest(config.api.tokenBalance, requestData);

      if (responseData && responseData.data && responseData.data.items) {
        return responseData.data.items;
      }
      
      return [];
    } catch (error) {
      logger.error(`Ошибка при получении баланса токенов для адреса ${address}: ${error.message}`);
      return [];
    }
  }

  // Обновляем цены токенов
  async updateTokenPrices(tokens) {
    // Обновляем цены не чаще раза в минуту
    const now = Date.now();
    if (now - this.lastPriceUpdate < 60000 && Object.keys(this.tokenPrices).length > 0) {
      return;
    }

    try {
      const tokenAddresses = tokens.map(token => ({
        address: token.token_address,
        chain_id: config.chainId
      }));

      const responseData = await this.makeApiRequest(config.api.tokenPrices, { tokens: tokenAddresses });

      if (responseData && responseData.data && responseData.data.items) {
        // Обновляем кеш цен
        this.tokenPrices = {};
        responseData.data.items.forEach(item => {
          this.tokenPrices[item.address.toLowerCase()] = item.usd_price;
        });
        this.lastPriceUpdate = now;
      }
    } catch (error) {
      logger.error(`Ошибка при получении цен токенов: ${error.message}`);
    }
  }

  // Форматируем баланс токена с учетом decimals
  formatTokenBalance(rawBalance, decimals) {
    return new BigNumber(rawBalance).dividedBy(new BigNumber(10).pow(decimals)).toString();
  }

  // Получаем цену токена
  getTokenUsdPrice(tokenAddress) {
    return this.tokenPrices[tokenAddress.toLowerCase()] || 0;
  }

  // Рассчитываем стоимость токена в USD
  calculateUsdValue(balance, tokenAddress, decimals) {
    const formattedBalance = this.formatTokenBalance(balance, decimals);
    const price = this.getTokenUsdPrice(tokenAddress);
    return new BigNumber(formattedBalance).multipliedBy(price);
  }

  // Получаем полную информацию по адресу (токены и NFT)
  async getAddressInfo(address) {
    try {
      // Получаем баланс токенов
      const tokens = await this.getTokenBalances(address);
      
      // Если есть токены, обновляем их цены
      if (tokens.length > 0) {
        await this.updateTokenPrices(tokens);
      }
      
      // Получаем количество Axie NFT
      const axieCount = await this.getNftCollections(address);
      
      // Форматируем информацию о токенах
      const formattedTokens = tokens.map(token => {
        const balance = token.raw_balance;
        const decimals = token.decimals;
        const symbol = token.symbol;
        const formattedBalance = this.formatTokenBalance(balance, decimals);
        const usdPrice = this.getTokenUsdPrice(token.token_address);
        const usdValue = new BigNumber(formattedBalance).multipliedBy(usdPrice);
        
        return {
          symbol,
          balance: formattedBalance,
          usdPrice,
          usdValue: usdValue.toNumber()
        };
      });
      
      // Рассчитываем общую стоимость
      const totalUsdValue = formattedTokens.reduce((sum, token) => sum + token.usdValue, 0);
      
      return {
        address,
        explorerUrl: `https://app.roninchain.com/address/${address}`,
        tokens: formattedTokens,
        axieCount,
        totalUsdValue
      };
    } catch (error) {
      logger.error(`Ошибка при получении информации для адреса ${address}: ${error.message}`);
      return {
        address,
        explorerUrl: `https://app.roninchain.com/address/${address}`,
        tokens: [],
        axieCount: 0,
        totalUsdValue: 0,
        error: error.message
      };
    }
  }
}

module.exports = new ApiService(); 
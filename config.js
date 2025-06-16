module.exports = {
  // Файл с адресами для проверки
  addressesFile: 'addresses.txt',
  
  // Файл с прокси в формате ip:port:login:password
  proxiesFile: 'proxies.txt',
  
  // Количество одновременных потоков
  concurrentRequests: 100,
  
  // API endpoints
  api: {
    nftCollections: 'https://wallet-manager.skymavis.com/proxy/v3/public/portfolio/balance/nft-collections',
    tokenBalance: 'https://wallet-manager.skymavis.com/proxy/v3/public/portfolio/balance',
    tokenPrices: 'https://wallet-manager.skymavis.com/proxy/v3/public/fiat/tokens'
  },
  
  // Chain ID для Ronin
  chainId: 2020,
  
  // Адрес коллекции Axie NFT
  axieCollectionAddress: '0x32950db2a7164ae833121501c797d79e7b79d74c',
  
  // Директория для логов
  logsDir: './logs',
  
  // Директория для результатов
  resultsDir: './results',
  
  // Интервал обновления прогресс-бара (мс)
  progressUpdateInterval: 1000
}; 
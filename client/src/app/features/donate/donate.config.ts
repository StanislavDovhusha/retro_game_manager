/**
 * Ways to support the project shown in the "Support the project" popup. Change the values below — nothing else needs
 * editing. The support links are in DONATE_LINKS, crypto wallets in DONATE_CRYPTO (further down).
 */

/**
 * A button of the popup that opens a web page (in the system browser in the desktop app, in a new tab in the browser).
 * `id` selects the label (translated: `donate.links.<id>`); a link with an empty `url` is not shown.
 */
export interface DonateLink {
  readonly id: 'kofi' | 'github';
  readonly url: string;
  readonly icon: 'coffee' | 'star';
}

export const DONATE_LINKS: readonly DonateLink[] = [
  { id: 'kofi', url: 'https://ko-fi.com/stanislav31259', icon: 'coffee' },
  { id: 'github', url: 'https://github.com/StanislavDovhusha/retro_game_manager', icon: 'star' },
];

/**
 * Crypto wallets for the slider of the popup. Put your address into `address`; a coin with an empty address is not
 * shown (and with no address at all there is no slider). The coin, ticker and network names are proper names and
 * are not translated. Make sure every address belongs to the network written next to it: the popup warns the
 * sender to use exactly that network.
 */
export interface CryptoRequisite {
  readonly id: 'btc' | 'eth' | 'usdt-trc20' | 'usdc-erc20' | 'sol' | 'bnb' | 'dash' | 'ltc' | 'trx' | 'ton' | 'dog';
  readonly coin: string;
  readonly ticker: string;
  readonly network: string;
  readonly address: string;
  /** Colour of the coin badge (CSS colour). */
  readonly color: string;
}

export const DONATE_CRYPTO: readonly CryptoRequisite[] = [
  { id: 'btc', coin: 'Bitcoin', ticker: 'BTC', network: 'Bitcoin', address: 'bc1qr6lsv59pwrwvhhu0czkjjyetqnklrqc4zdjefv', color: '#f7931a' },
  { id: 'eth', coin: 'Ethereum', ticker: 'ETH', network: 'Ethereum', address: '0x665Fe4071cA3e2AF4AfEF1d61a533105748C48a7', color: '#627eea' },
  { id: 'usdt-trc20', coin: 'Tether', ticker: 'USDT', network: 'TRON (TRC-20)', address: 'TCqNGjp8a7559JMt8UKxMsFjKMSkZ8uUfC', color: '#26a17b' },
  { id: 'usdc-erc20', coin: 'USD Coin', ticker: 'USDC', network: 'Ethereum (ERC-20)', address: '0x665Fe4071cA3e2AF4AfEF1d61a533105748C48a7', color: '#2775ca' },
  { id: 'sol', coin: 'Solana', ticker: 'SOL', network: 'Solana', address: '2ptJpDZrt8xtJyNYynx6Wo8BdChD1ykiofzshXDGKAEV', color: '#9945ff' },
  { id: 'bnb', coin: 'BNB', ticker: 'BNB', network: 'BNB Smart Chain (BEP-20)', address: '0x665Fe4071cA3e2AF4AfEF1d61a533105748C48a7', color: '#f0b90b' },
  { id: 'dash', coin: 'Dash', ticker: 'DASH', network: 'Dash', address: 'Xir1HvL55pwMEnLb4ZUzogYS3CLjwYCrBR', color: '#008ce7' },
  { id: 'ltc', coin: 'Litecoin', ticker: 'LTC', network: 'Litecoin', address: 'LgEif4AZ9wU6oFW16U6EyuhsC9KwHYQfCX', color: '#345d9d' },
  { id: 'trx', coin: 'TRON', ticker: 'TRX', network: 'TRON', address: 'TCqNGjp8a7559JMt8UKxMsFjKMSkZ8uUfC', color: '#eb0029' },
  { id: 'ton', coin: 'Toncoin', ticker: 'TON', network: 'TON', address: 'UQA0dNe-9ueN3Dd0wrdluKb09mqPhsySHsK4POptvOoQ7rt_', color: '#00bfff' },
  { id: 'dog', coin: 'Dogecoin', ticker: 'DOGE', network: 'Dogecoin', address: 'DUBpxohYuvDPCsVkFh9RWTQqtDKmLSyMu2', color: '#c2a633' },
];

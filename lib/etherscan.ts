// 链上数据获取(Etherscan V2 多链端点统一接口)
// 数据维度:首笔交易时间(链上年龄)、总交易数、总转账ETH量、独立合约交互数、最常用合约 Top5

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";

export interface WalletStats {
  address: string;
  firstTxTimestamp: number | null;
  lastTxTimestamp: number | null;
  ageInDays: number;
  totalTxCount: number;
  outgoingTxCount: number;
  incomingTxCount: number;
  failedTxCount: number;
  totalEthVolumeOut: number;
  uniqueContractsInteracted: number;
  topContracts: Array<{ address: string; count: number; label?: string }>;
  balanceEth: number;
}

// imToken 用户高频接触的知名合约简易标签库(够看出"链上身份")
const KNOWN_CONTRACTS: Record<string, string> = {
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
  "0x66a9893cc07d91d95644aedd05d03f95e1dba8af": "Uniswap V4 Router",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Protocol",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch Router",
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch Router V4",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch Router V6",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
  "0x00000000219ab540356cbb839cbe05303d7705fa": "ETH 2.0 Staking",
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "Lido stETH",
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "Aave V2 Pool",
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "Aave V3 Pool",
  "0x39aa39c021dfbae8fac545936693ac917d5e7563": "Compound cUSDC",
  "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490": "Curve 3pool",
  "0x881d40237659c251811cec9c364ef91dc08d300c": "Metamask Swap",
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": "Coinbase 10",
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": "Seaport (OpenSea)",
  "0x1e0049783f008a0085193e00003d00cd54003c71": "OpenSea Conduit",
  "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb": "CryptoPunks",
  "0xb6909b960dbbe7392d405429eb2b3649752b4838": "Tornado Cash 0.1",
};

interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  isError: string;
  gasUsed: string;
  contractAddress: string;
}

interface EtherscanResp<T> {
  status: string;
  message: string;
  result: T;
}

export async function fetchWalletStats(
  address: string,
  apiKey: string,
): Promise<WalletStats> {
  const addr = address.toLowerCase();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const [txListResp, balanceResp] = await Promise.all([
      fetch(
        `${ETHERSCAN_BASE}?chainid=1&module=account&action=txlist&address=${addr}` +
          `&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`,
        { signal: ctrl.signal },
      ).then((r) => r.json() as Promise<EtherscanResp<EtherscanTx[]>>),
      fetch(
        `${ETHERSCAN_BASE}?chainid=1&module=account&action=balance&address=${addr}` +
          `&tag=latest&apikey=${apiKey}`,
        { signal: ctrl.signal },
      ).then((r) => r.json() as Promise<EtherscanResp<string>>),
    ]);

    if (txListResp.status !== "1" && txListResp.message !== "No transactions found") {
      throw new Error(`Etherscan error: ${txListResp.message}`);
    }

    const txs = Array.isArray(txListResp.result) ? txListResp.result : [];

    const balanceWei = BigInt(balanceResp.status === "1" ? balanceResp.result : "0");
    const balanceEth = Number(balanceWei) / 1e18;

    if (txs.length === 0) {
      return {
        address: addr,
        firstTxTimestamp: null,
        lastTxTimestamp: null,
        ageInDays: 0,
        totalTxCount: 0,
        outgoingTxCount: 0,
        incomingTxCount: 0,
        failedTxCount: 0,
        totalEthVolumeOut: 0,
        uniqueContractsInteracted: 0,
        topContracts: [],
        balanceEth,
      };
    }

    const firstTs = Number(txs[0].timeStamp);
    const lastTs = Number(txs[txs.length - 1].timeStamp);
    const ageInDays = Math.floor((Date.now() / 1000 - firstTs) / 86400);

    let outgoing = 0;
    let incoming = 0;
    let failed = 0;
    let ethOutWei = 0n;
    const contractCount = new Map<string, number>();

    for (const tx of txs) {
      const isOut = tx.from.toLowerCase() === addr;
      if (isOut) outgoing++;
      else incoming++;
      if (tx.isError === "1") failed++;
      if (isOut) {
        try {
          ethOutWei += BigInt(tx.value);
        } catch {
          /* ignore */
        }
      }
      if (tx.to && isOut) {
        const to = tx.to.toLowerCase();
        contractCount.set(to, (contractCount.get(to) ?? 0) + 1);
      }
    }

    const topContracts = Array.from(contractCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([address, count]) => ({
        address,
        count,
        label: KNOWN_CONTRACTS[address],
      }));

    return {
      address: addr,
      firstTxTimestamp: firstTs,
      lastTxTimestamp: lastTs,
      ageInDays,
      totalTxCount: txs.length,
      outgoingTxCount: outgoing,
      incomingTxCount: incoming,
      failedTxCount: failed,
      totalEthVolumeOut: Number(ethOutWei) / 1e18,
      uniqueContractsInteracted: contractCount.size,
      topContracts,
      balanceEth,
    };
  } finally {
    clearTimeout(timer);
  }
}

// 给前端展示用的派生指标
export function deriveTags(stats: WalletStats): string[] {
  const tags: string[] = [];

  if (stats.ageInDays >= 365 * 5) tags.push("链上元老");
  else if (stats.ageInDays >= 365 * 3) tags.push("老炮儿");
  else if (stats.ageInDays >= 365) tags.push("入坑老手");
  else if (stats.ageInDays > 0) tags.push("链上新人");

  if (stats.totalTxCount >= 1000) tags.push("交易狂魔");
  else if (stats.totalTxCount >= 100) tags.push("活跃玩家");
  else if (stats.totalTxCount >= 10) tags.push("低频选手");

  const knownLabels = stats.topContracts
    .map((c) => c.label)
    .filter(Boolean) as string[];

  const hasUniswap = knownLabels.some((l) => l.includes("Uniswap"));
  const has1inch = knownLabels.some((l) => l.includes("1inch"));
  const hasAave = knownLabels.some((l) => l.includes("Aave"));
  const hasLido = knownLabels.some((l) => l.includes("Lido"));
  const hasNFT = knownLabels.some((l) => l.includes("OpenSea") || l.includes("Punks"));
  const hasStaking = knownLabels.some((l) => l.includes("Staking") || hasLido);

  if (hasUniswap || has1inch) tags.push("DEX 老饕");
  if (hasAave) tags.push("DeFi 借贷玩家");
  if (hasStaking) tags.push("ETH 质押者");
  if (hasNFT) tags.push("NFT 收藏家");

  if (stats.failedTxCount / Math.max(stats.totalTxCount, 1) > 0.1) {
    tags.push("Gas 战士");
  }

  return tags.slice(0, 6);
}

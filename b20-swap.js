/**
 * B20 Token Swap — 0x Swap API v2 (Base chain)
 * ------------------------------------------------
 * يشمل: جلب السعر/العرض (quote)، فحص وتنفيذ الـ allowance (approve)،
 * وسواب بالاتجاهين (شراء B20 / بيع B20).
 *
 * يحتاج: ethers.js (v6) — npm install ethers
 *
 * تنبيه: عنوان عقد B20 أدناه مرشح ولم يتم التأكد منه 100%.
 * تأكد منه على basescan.org قبل الاستخدام في الإنتاج.
 */

import { ethers } from 'ethers';

// ---------- الإعدادات ----------

const ZERO_X_API_KEY = 'YOUR_API_KEY_HERE'; // لا تضع المفتاح في كود مرفوع للعام (استخدم env var)
const HEADERS = {
  '0x-api-key': ZERO_X_API_KEY,
  '0x-version': 'v2',
};

const BASE_CHAIN_ID = 8453;
const RPC_URL = 'https://mainnet.base.org'; // أو أي RPC provider تستخدمه

const B20_ADDRESS = '0x0257C1A27dbAC78EDAeCedBac6f3FC2869c7CdD3'; // تأكد منه قبل الاستخدام
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ---------- جلب عرض السواب (quote) ----------

async function getQuote({ sellToken, buyToken, sellAmount, takerAddress }) {
  const params = new URLSearchParams({
    chainId: BASE_CHAIN_ID.toString(),
    sellToken,
    buyToken,
    sellAmount,
    taker: takerAddress,
  });

  const res = await fetch(
    `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
    { headers: HEADERS }
  );

  if (!res.ok) {
    throw new Error(`0x API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// ---------- فحص وتنفيذ الـ Allowance (approve) ----------

/**
 * يتأكد أن العقد المسموح له (spender) عنده allowance كافي على sellToken.
 * إذا لا، يرسل approve وينتظر التأكيد.
 *
 * quote.issues.allowance يحتوي على العنوان الصحيح للـ spender وactualAllowance،
 * كما يرجعه رد /quote من 0x API.
 */
async function ensureAllowance({ signer, sellTokenAddress, quote, sellAmount }) {
  const allowanceIssue = quote.issues?.allowance;

  // لا حاجة لـ allowance (مثلا عند بيع native token)
  if (!allowanceIssue) {
    console.log('لا حاجة لـ approve — الرصيد المسموح كافٍ أو غير مطلوب.');
    return null;
  }

  const spender = allowanceIssue.spender;
  const token = new ethers.Contract(sellTokenAddress, ERC20_ABI, signer);

  const owner = await signer.getAddress();
  const currentAllowance = await token.allowance(owner, spender);

  if (currentAllowance >= BigInt(sellAmount)) {
    console.log('الـ allowance كافٍ بالفعل، لا حاجة لـ approve.');
    return null;
  }

  console.log(`إرسال approve لـ ${spender}...`);
  const tx = await token.approve(spender, sellAmount);
  const receipt = await tx.wait();
  console.log('تم تأكيد approve:', receipt.hash);
  return receipt;
}

// ---------- تنفيذ السواب (بعد الحصول على quote وapprove) ----------

async function executeSwap({ signer, quote }) {
  const tx = await signer.sendTransaction({
    to: quote.transaction.to,
    data: quote.transaction.data,
    value: quote.transaction.value ? BigInt(quote.transaction.value) : 0n,
    gasLimit: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
  });

  console.log('تم إرسال معاملة السواب:', tx.hash);
  const receipt = await tx.wait();
  console.log('تم تأكيد السواب:', receipt.hash);
  return receipt;
}

// ---------- دالة كاملة: شراء B20 مقابل USDC ----------

async function buyB20WithUSDC({ signer, sellAmount }) {
  const takerAddress = await signer.getAddress();

  const quote = await getQuote({
    sellToken: USDC_BASE,
    buyToken: B20_ADDRESS,
    sellAmount, // بأصغر وحدة (USDC = 6 decimals)
    takerAddress,
  });

  await ensureAllowance({
    signer,
    sellTokenAddress: USDC_BASE,
    quote,
    sellAmount,
  });

  return executeSwap({ signer, quote });
}

// ---------- دالة كاملة: بيع B20 مقابل USDC ----------

async function sellB20ForUSDC({ signer, sellAmount }) {
  const takerAddress = await signer.getAddress();

  const quote = await getQuote({
    sellToken: B20_ADDRESS,
    buyToken: USDC_BASE,
    sellAmount, // بأصغر وحدة حسب decimals تبع B20
    takerAddress,
  });

  await ensureAllowance({
    signer,
    sellTokenAddress: B20_ADDRESS,
    quote,
    sellAmount,
  });

  return executeSwap({ signer, quote });
}

// ---------- مثال استخدام ----------

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  // استبدل هذا بربط المحفظة الفعلي في تطبيقك (مثلا عبر wagmi/viem أو private key للاختبار فقط)
  const signer = new ethers.Wallet('YOUR_PRIVATE_KEY_FOR_TESTING_ONLY', provider);

  // شراء B20 بـ 1 USDC
  await buyB20WithUSDC({ signer, sellAmount: '1000000' }); // 1 USDC = 1_000_000 (6 decimals)

  // بيع B20 (مثال: يفترض 18 decimals لـ B20 — تأكد من القيمة الفعلية)
  // await sellB20ForUSDC({ signer, sellAmount: ethers.parseUnits('10', 18).toString() });
}

// main(); // فعّل هذا السطر عند التشغيل الفعلي

export {
  getQuote,
  ensureAllowance,
  executeSwap,
  buyB20WithUSDC,
  sellB20ForUSDC,
};

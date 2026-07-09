import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

type CaipNetwork = `${string}:${string}`;

function assertCaipNetwork(value: string): CaipNetwork {
  if (!/^[^:]+:[^:]+$/.test(value)) {
    throw new Error(`X402_NETWORK must be CAIP-2 formatted (e.g. "eip155:1952"), got "${value}"`);
  }
  return value as CaipNetwork;
}

// X Layer Mainnet by default — real funds. Set X402_NETWORK=eip155:1952 to test on testnet instead.
const NETWORK = assertCaipNetwork(process.env.X402_NETWORK ?? "eip155:196");
const PAY_TO = process.env.PAY_TO_ADDRESS;
const PRICE = process.env.FIT_CHECK_PRICE_USD ?? "$0.05";

if (!PAY_TO) {
  throw new Error("PAY_TO_ADDRESS env var is required (the wallet that receives payment)");
}
if (!process.env.OKX_API_KEY || !process.env.OKX_SECRET_KEY || !process.env.OKX_PASSPHRASE) {
  throw new Error(
    "OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE env vars are required (from the OKX Developer Portal)"
  );
}

const facilitatorClient = new OKXFacilitatorClient({
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
});

const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(NETWORK, new ExactEvmScheme());

export const fitCheckPaymentMiddleware = paymentMiddleware(
  {
    "POST /fit-check": {
      accepts: [
        {
          scheme: "exact",
          network: NETWORK,
          payTo: PAY_TO,
          price: PRICE,
        },
      ],
      description: "Rates an outfit photo against a specific occasion using a documented dress-code/color/tailoring reference standard.",
      mimeType: "application/json",
    },
  },
  resourceServer
);

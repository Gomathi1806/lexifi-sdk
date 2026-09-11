import { test } from "node:test";
import assert from "node:assert/strict";
import { getAddress, keccak256, toBytes } from "viem";
import {
  base,
  baseSepolia,
  getDeployment,
  NOT_DEPLOYED,
  ConfigFamily,
  PermissionFlags,
  AccessLevel,
  encodeRegionalConfig,
} from "../dist/index.js";

const ADDRESS_FIELDS = [
  "hook",
  "coinbaseProvider",
  "thresholdPolicy",
  "regionalPolicy",
  "institutionalPolicy",
  "selfAttestationProvider",
  "complianceAdapter",
  "allowlistChecker",
  "policyConfig",
  "poolManager",
];

// Superseded Base contracts. They are still on-chain and still answer calls, so an SDK that
// pointed at one would appear to work while enforcing the wrong rules.
const RETIRED_ON_BASE = [
  "0xa99a89cd5a61e975fb11047d3ed455fccad9a44f", // RegionalPolicy v1: requirement flags did not deny
  "0xad09fc63080736b1dfc4048f3589c481225db5fb", // InstitutionalPolicy v1: N-of-M quorum did not gate
  "0xf4f6af6ee5ff4a1bf712470e00fea2b6bafbf32c", // RegionalPolicy v2: fixed, never wired to a pool
  "0xaa3f1309219231091b606ca256771e51c3e9d822", // InstitutionalPolicy v2: fixed, never wired to a pool
];

for (const [name, deployment] of [
  ["base", base],
  ["baseSepolia", baseSepolia],
]) {
  test(`${name}: every address is EIP-55 checksummed`, () => {
    for (const field of ADDRESS_FIELDS) {
      assert.equal(deployment[field], getAddress(deployment[field]), `${name}.${field}`);
    }
  });
}

test("base: every contract is deployed", () => {
  for (const field of ADDRESS_FIELDS) {
    assert.notEqual(base[field], NOT_DEPLOYED, `base.${field} is NOT_DEPLOYED`);
  }
});

test("base: no retired contract is referenced", () => {
  const live = ADDRESS_FIELDS.map((field) => base[field].toLowerCase());
  for (const retired of RETIRED_ON_BASE) {
    assert.ok(!live.includes(retired), `retired contract ${retired} is still referenced`);
  }
});

test("base: chain metadata points at Base mainnet", () => {
  assert.equal(base.chainId, 8453);
  assert.equal(baseSepolia.chainId, 84532);
});

test("getDeployment routes by chain id", () => {
  assert.equal(getDeployment(8453), base);
  assert.equal(getDeployment(84532), baseSepolia);
});

test("ConfigFamily keys are keccak256 of their documented strings", () => {
  // These must never change: a redeployed policy finds its config by this key.
  assert.equal(ConfigFamily.regional, keccak256(toBytes("lexifi.policy.regional")));
  assert.equal(ConfigFamily.institutional, keccak256(toBytes("lexifi.policy.institutional")));
});

test("PermissionFlags match Uniswap's PermissionFlags.sol", () => {
  assert.equal(PermissionFlags.NONE, "0x0000");
  assert.equal(PermissionFlags.SWAP_ALLOWED, "0x0001");
  assert.equal(PermissionFlags.LIQUIDITY_ALLOWED, "0x0002");
  assert.equal(PermissionFlags.ALL_ALLOWED, "0xffff");
});

test("encodeRegionalConfig matches the bytes live on Base for the WETH/USDC pool", () => {
  // LexifiPolicyConfig.getConfig(ConfigFamily.regional, 0x54545d84…f424), read 2026-09-11.
  // Decodes to (requireCountry=true, requireAccount=false, minSwap=2, minLp=2, active=true).
  const live =
    "0x0000000000000000000000000000000000000000000000000000000000000001" +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "0000000000000000000000000000000000000000000000000000000000000002" +
    "0000000000000000000000000000000000000000000000000000000000000002" +
    "0000000000000000000000000000000000000000000000000000000000000001";
  const encoded = encodeRegionalConfig({
    requireCountryAttestation: true,
    requireAccountAttestation: false,
    minimumSwapLevel: AccessLevel.ACCREDITED,
    minimumLpLevel: AccessLevel.ACCREDITED,
  });
  assert.equal(encoded, live);
});

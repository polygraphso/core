import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { ERC20_ABI } from "./paymentConfig";
import { findMatchingTransfer } from "./priorityPayments";

const TOKEN = "0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3";
const TREASURY = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";

const iface = new ethers.Interface(ERC20_ABI);

function transferLog(opts: {
  address?: string;
  from?: string;
  to: string;
  value: bigint;
}) {
  const { data, topics } = iface.encodeEventLog("Transfer", [
    opts.from ?? PAYER,
    opts.to,
    opts.value,
  ]);
  return { address: opts.address ?? TOKEN, topics, data };
}

describe("findMatchingTransfer", () => {
  const amount = 99_000000000000000123n; // exact, with dust in the low digits

  it("matches a Transfer of the exact amount to the treasury", () => {
    const logs = [transferLog({ to: TREASURY, value: amount })];
    expect(findMatchingTransfer(logs, TOKEN, TREASURY, amount)).toEqual({ from: PAYER });
  });

  it("ignores a transfer to a different recipient", () => {
    const logs = [transferLog({ to: OTHER, value: amount })];
    expect(findMatchingTransfer(logs, TOKEN, TREASURY, amount)).toBeNull();
  });

  it("ignores a different amount (dust must match exactly)", () => {
    const logs = [transferLog({ to: TREASURY, value: amount + 1n })];
    expect(findMatchingTransfer(logs, TOKEN, TREASURY, amount)).toBeNull();
  });

  it("ignores a Transfer emitted by a different token contract", () => {
    const logs = [transferLog({ address: OTHER, to: TREASURY, value: amount })];
    expect(findMatchingTransfer(logs, TOKEN, TREASURY, amount)).toBeNull();
  });

  it("ignores non-Transfer logs and finds the match among them", () => {
    const junk = { address: TOKEN, topics: [ethers.id("Approval(address,address,uint256)")], data: "0x" };
    const logs = [junk, transferLog({ to: TREASURY, value: amount })];
    expect(findMatchingTransfer(logs, TOKEN, TREASURY, amount)).toEqual({ from: PAYER });
  });

  it("is case-insensitive on addresses", () => {
    const logs = [transferLog({ to: TREASURY.toUpperCase().replace("0X", "0x"), value: amount })];
    expect(findMatchingTransfer(logs, TOKEN.toUpperCase().replace("0X", "0x"), TREASURY, amount)).toEqual({
      from: PAYER,
    });
  });

  it("returns null on an empty log set", () => {
    expect(findMatchingTransfer([], TOKEN, TREASURY, amount)).toBeNull();
  });
});

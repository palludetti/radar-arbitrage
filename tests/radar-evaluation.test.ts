import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMarket } from "../lib/radar-evaluation.ts";

const confidence = { brand: 100, model: 100, askingPrice: 100 };

test("an overpriced item is PASSAR even when evidence is incomplete", () => {
  const result = evaluateMarket({
    askingPrice: 700,
    fees: 0,
    modelConfirmed: true,
    quickResale: 125,
    desirability: 75,
    marketConfidence: 85,
    extractionConfidence: confidence,
    comparables: [{ kind: "sold", match: "exact" }],
  });

  assert.equal(result.verdict, "PASSAR");
  assert.equal(result.needsVerification, true);
});

test("one exact asking-price comparable cannot release COMPRAR", () => {
  const result = evaluateMarket({
    askingPrice: 330,
    fees: 30,
    modelConfirmed: true,
    quickResale: 700,
    desirability: 70,
    marketConfidence: 70,
    extractionConfidence: confidence,
    comparables: [{ kind: "asking", match: "exact" }],
  });

  assert.equal(result.verdict, "NEGOCIAR");
  assert.equal(result.needsVerification, true);
});

test("COMPRAR requires two exact comparables including a completed sale", () => {
  const result = evaluateMarket({
    askingPrice: 300,
    fees: 20,
    modelConfirmed: true,
    quickResale: 800,
    desirability: 85,
    marketConfidence: 82,
    extractionConfidence: confidence,
    comparables: [
      { kind: "sold", match: "exact" },
      { kind: "asking", match: "exact" },
    ],
  });

  assert.equal(result.verdict, "COMPRAR");
  assert.equal(result.needsVerification, false);
  assert.equal(result.exactSoldComparables, 1);
});

test("sufficient evidence but a borderline discount remains NEGOCIAR", () => {
  const result = evaluateMarket({
    askingPrice: 560,
    fees: 20,
    modelConfirmed: true,
    quickResale: 800,
    desirability: 80,
    marketConfidence: 80,
    extractionConfidence: confidence,
    comparables: [
      { kind: "sold", match: "exact" },
      { kind: "asking", match: "exact" },
    ],
  });

  assert.equal(result.verdict, "NEGOCIAR");
});

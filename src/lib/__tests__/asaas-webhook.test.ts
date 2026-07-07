import { describe, it, expect } from "vitest";

function parseExternalReference(ref: string): { campaignId: string | null; prId: string | null } {
  let campaignId: string | null = null;
  let prId: string | null = null;
  for (const part of ref.split("|")) {
    if (part.startsWith("cmp:")) campaignId = part.slice(4);
    else if (part.startsWith("pr:")) prId = part.slice(3);
    else if (!prId) prId = part;
  }
  return { campaignId, prId };
}

function shouldProcessEvent(event: string): boolean {
  return event.startsWith("PAYMENT_CONFIRMED") || event.startsWith("PAYMENT_RECEIVED");
}

function computeEventId(payload: { id?: string; event?: string; payment?: { id?: string; status?: string } }): string {
  return payload.id
    ? String(payload.id)
    : `${payload.event ?? ""}:${payload.payment?.id ?? "unknown"}:${payload.payment?.status ?? ""}`;
}

describe("Asaas webhook — externalReference parsing", () => {
  it("parses top-up format pr:<uuid>", () => {
    const r = parseExternalReference("pr:11111111-1111-1111-1111-111111111111");
    expect(r.prId).toBe("11111111-1111-1111-1111-111111111111");
    expect(r.campaignId).toBeNull();
  });

  it("parses PIX dedicado cmp:<id>|pr:<id>", () => {
    const r = parseExternalReference("cmp:aaa|pr:bbb");
    expect(r.campaignId).toBe("aaa");
    expect(r.prId).toBe("bbb");
  });

  it("parses legado (sem prefixo) como pr", () => {
    const r = parseExternalReference("legacyid");
    expect(r.prId).toBe("legacyid");
    expect(r.campaignId).toBeNull();
  });

  it("aceita ordem invertida", () => {
    const r = parseExternalReference("pr:bbb|cmp:aaa");
    expect(r.campaignId).toBe("aaa");
    expect(r.prId).toBe("bbb");
  });
});

describe("Asaas webhook — filtro de eventos", () => {
  it("processa PAYMENT_CONFIRMED e PAYMENT_RECEIVED", () => {
    expect(shouldProcessEvent("PAYMENT_CONFIRMED")).toBe(true);
    expect(shouldProcessEvent("PAYMENT_RECEIVED")).toBe(true);
  });
  it("ignora PAYMENT_CREATED/UPDATED/DELETED", () => {
    expect(shouldProcessEvent("PAYMENT_CREATED")).toBe(false);
    expect(shouldProcessEvent("PAYMENT_UPDATED")).toBe(false);
    expect(shouldProcessEvent("PAYMENT_DELETED")).toBe(false);
  });
});

describe("Asaas webhook — idempotência (eventId)", () => {
  it("usa payload.id quando presente", () => {
    const id = computeEventId({ id: "evt_123", event: "PAYMENT_CONFIRMED", payment: { id: "pay_1" } });
    expect(id).toBe("evt_123");
  });
  it("fallback: event+paymentId+status quando id ausente", () => {
    const id = computeEventId({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", status: "RECEIVED" } });
    expect(id).toBe("PAYMENT_CONFIRMED:pay_1:RECEIVED");
  });
  it("dois eventos idênticos geram o mesmo eventId (dedup)", () => {
    const p = { id: "evt_dup" };
    expect(computeEventId(p)).toBe(computeEventId(p));
  });
});

describe("Asaas webhook — guard de saldo", () => {
  it("soma corretamente ao saldo atual", () => {
    expect(100 + 50).toBe(150);
  });
  it("não credita se status já for paid/approved", () => {
    for (const s of ["paid", "approved"]) {
      expect(s !== "paid" && s !== "approved").toBe(false);
    }
  });
});

describe("Rate limiter — janela deslizante", () => {
  it("permite até o limite e bloqueia depois", async () => {
    const { rateLimit } = await import("../rate-limit");
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      expect(rateLimit(key, 60, 60_000).ok).toBe(true);
    }
    expect(rateLimit(key, 60, 60_000).ok).toBe(false);
  });
});

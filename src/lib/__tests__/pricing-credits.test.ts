import { describe, expect, it } from "vitest";
import {
  campaignMediaBudget,
  campaignPricing,
  includedViewsForDays,
  packagePriceFor,
} from "../pricing";

describe("preço do plano Créditos/Pro Max", () => {
  it("usa R$ 57 no pacote mínimo de 3 dias e 4.000 visualizações", () => {
    expect(packagePriceFor(3, 4_000)).toBe(57);
    expect(campaignPricing(999, 3, "credits").total).toBe(57);
  });

  it("adiciona R$ 19 e 1.333 visualizações por dia", () => {
    expect(includedViewsForDays(4)).toBe(5_333);
    expect(packagePriceFor(4, 5_333)).toBe(76);
    expect(campaignPricing(999, 4, "pro_max").total).toBe(76);
  });

  it("mantém extras e order bump no valor efetivo pago", () => {
    const packageWithExtra = packagePriceFor(3, 5_000);
    const charged = packageWithExtra + 29.8;
    expect(packageWithExtra).toBe(71.25);
    expect(charged).toBe(101.05);
    expect(campaignMediaBudget(charged)).toBeGreaterThan(0);
  });

  it("não aplica a fórmula de créditos ao plano Pro", () => {
    expect(campaignPricing(20, 3, "pro").total).toBe(69);
  });
});

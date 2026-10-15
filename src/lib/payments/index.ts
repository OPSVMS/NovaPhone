import "server-only";

/**
 * Abstracción de pagos con tarjeta. El embudo (`src/lib/checkout.ts`) y los depósitos con tarjeta solo hablan con
 * esta interfaz; cambiar de proveedor es escribir otro adaptador como `./stripe`.
 * Todos los montos van en centavos de MXN (NovaPhone cobra solo en pesos).
 */

export type CheckoutKind = "order" | "deposit";

export type CheckoutLine = {
  name: string;
  description?: string;
  /** Centavos MXN. */
  amountCents: number;
};

export type CreateCheckoutInput = {
  kind: CheckoutKind;
  /** id del card_checkout (orden) o del depósito (client_reference_id). */
  referenceId: string;
  /** Prefill (cuenta conocida). Null: Stripe Checkout pide el correo. */
  email?: string | null;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  /** Minutos hasta que expire la sesión (mín. 30, máx. 24 h). */
  expiresInMinutes?: number;
  /** Campo de código promocional en Checkout. */
  allowPromotionCodes?: boolean;
};

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  paid: boolean;
  referenceId: string | null;
  metadata: Record<string, string>;
  email: string | null;
  name: string | null;
  customerId: string | null;
  paymentIntentId: string | null;
  /** Total cobrado (centavos) y su moneda en mayúsculas (MXN). */
  amountTotal: number | null;
  currency: string | null;
  receiptUrl: string | null;
  discountAmount: number | null;
  promotionCode: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<{ id: string; url: string }>;
  getCheckout(id: string): Promise<CheckoutSession>;
  /** Reembolsa un cobro. Sin monto = total. */
  refund(paymentIntentId: string, opts?: { amountCents?: number; reason?: string }): Promise<{ id: string }>;
}

export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;

let cached: PaymentProvider | null = null;

/** Proveedor configurado o null (sin llaves, el pago con tarjeta se muestra como "muy pronto"). */
export async function getPaymentProvider(): Promise<PaymentProvider | null> {
  if (!paymentsEnabled()) return null;
  if (!cached) {
    const { stripeProvider } = await import("./stripe");
    cached = stripeProvider;
  }
  return cached;
}

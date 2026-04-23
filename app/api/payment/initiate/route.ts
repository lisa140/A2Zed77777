import { NextRequest, NextResponse } from "next/server";

// NOTE: This route is no longer used in the primary payment flow.
// The Flutterwave inline modal (useFlutterwave) handles all payments directly.
// Kept as a fallback server-side charge endpoint if needed in future.

const NETWORK_MAP: Record<string, string> = {
  airtel: "AIRTEL",
  mtn:    "MTN",
  zamtel: "ZAMTEL",
};

export async function POST(req: NextRequest) {
  try {
    const { amount, customer, paymentMethod, tx_ref } = await req.json() as {
      amount:        number;
      customer:      { name: string; email: string; phone: string };
      paymentMethod: string;
      tx_ref:        string;
    };

    const network = NETWORK_MAP[paymentMethod];
    if (!network) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 });
    }

    const flwResponse = await fetch(
      "https://api.flutterwave.com/v3/charges?type=mobile_money_zambia",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          phone_number: customer.phone,
          amount,
          currency: "ZMW",
          email:    customer.email,
          tx_ref,
          fullname: customer.name,
          network,
        }),
      }
    );

    const flwData = await flwResponse.json() as {
      status:   string;
      message?: string;
      data?:    { id: number; status: string };
    };

    if (flwData.status === "success" && flwData.data?.id) {
      return NextResponse.json({
        status:         "success",
        transaction_id: flwData.data.id,
        tx_ref,
      });
    }

    return NextResponse.json(
      { status: "error", message: flwData.message ?? "Payment failed" },
      { status: 400 }
    );
  } catch (err) {
    const error = err as { message?: string };
    console.error("Payment initiation error:", err);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}

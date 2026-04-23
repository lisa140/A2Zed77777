import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { transaction_id } = await req.json() as { transaction_id: number | string };

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 });
    }

    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );

    const data = await res.json() as {
      status: string;
      data?: {
        status: string;
        amount: number;
        currency: string;
        tx_ref: string;
      };
    };

    if (data.status === "success" && data.data?.status === "successful") {
      return NextResponse.json({
        status:   "success",
        amount:   data.data.amount,
        currency: data.data.currency,
        tx_ref:   data.data.tx_ref,
      });
    }

    return NextResponse.json({
      status: data.data?.status ?? "pending",
    });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

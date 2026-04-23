import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  console.log("[upload] Route hit");
  console.log("[upload] Cloudinary cloud_name:", process.env.CLOUDINARY_CLOUD_NAME ?? "MISSING");
  console.log("[upload] CLOUDINARY_API_KEY set:", !!process.env.CLOUDINARY_API_KEY);
  console.log("[upload] CLOUDINARY_API_SECRET set:", !!process.env.CLOUDINARY_API_SECRET);

  try {
    const { data } = await req.json();

    if (!data || typeof data !== "string") {
      console.error("[upload] No base64 data received");
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    console.log("[upload] data prefix (first 50 chars):", data.slice(0, 50));

    // Cloudinary accepts the full data URI — make sure the prefix is present
    const dataUri = data.startsWith("data:")
      ? data
      : `data:image/jpeg;base64,${data}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "a2zed-store",
    });

    console.log("[upload] Success — secure_url:", result.secure_url);
    return NextResponse.json({ url: result.secure_url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    const httpCode =
      (err as { http_code?: number }).http_code ?? null;

    console.error("[upload] Cloudinary upload error:", err);
    console.error("[upload] error.message:", message);
    console.error("[upload] error.http_code:", httpCode);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

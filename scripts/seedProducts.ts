/**
 * Seed script — adds dummy products to Firestore.
 * Run with:  npx tsx scripts/seedProducts.ts
 *
 * Reads Firebase config from .env.local automatically.
 * No extra packages required beyond what's already installed.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ── 1. Load .env.local before any Firebase initialisation ─────────────────────

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) process.env[key] = val;
  }
  console.log("✓ Loaded .env.local");
} catch {
  console.error("✗ Could not read .env.local — make sure it exists at the project root.");
  process.exit(1);
}

// ── 2. Initialise Firebase (client SDK, inline — avoids browser guards in lib/firebase.ts) ──

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => `NEXT_PUBLIC_FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`);

if (missing.length) {
  console.error("✗ Missing Firebase env vars:", missing.join(", "));
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── 3. Product definitions ────────────────────────────────────────────────────

interface ProductSeed {
  name:            string;
  description:     string;
  category:        string;
  subcategory:     string;
  price:           number;
  compareAtPrice?: number;
  images:          string[];
  stock:           number;
  featured:        boolean;
  active:          true;
}

const products: ProductSeed[] = [

  // ── WOMEN ─────────────────────────────────────────────────────────────────
  {
    name:           "Floral Wrap Dress",
    description:    "Elegant floral wrap dress with a flattering A-line silhouette. Lightweight fabric perfect for Zambian weather. Available in multiple floral prints.",
    category:       "women",
    subcategory:    "dresses",
    price:          450,
    compareAtPrice: 600,
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
    ],
    stock:    25,
    featured: true,
    active:   true,
  },
  {
    name:        "Women's Silk Blouse",
    description: "Soft satin-finish silk blouse with a relaxed fit and subtle sheen. Pairs perfectly with trousers or a skirt for office or evening wear.",
    category:    "women",
    subcategory: "tops & blouses",
    price:       280,
    images: [
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800",
    ],
    stock:    40,
    featured: false,
    active:   true,
  },
  {
    name:           "High Waist Denim Skirt",
    description:    "Classic high-waist denim skirt with button-front detail. Mid-length hemline offers a chic yet modest look. Stretchy waistband for all-day comfort.",
    category:       "women",
    subcategory:    "skirts",
    price:          320,
    compareAtPrice: 420,
    images: [
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
    ],
    stock:    18,
    featured: true,
    active:   true,
  },
  {
    name:        "Ladies Leather Handbag",
    description: "Structured PU leather handbag with gold-tone hardware and a detachable shoulder strap. Spacious interior with card slots and a zip pocket.",
    category:    "women",
    subcategory: "handbags",
    price:       550,
    images: [
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800",
    ],
    stock:    12,
    featured: false,
    active:   true,
  },

  // ── MEN ───────────────────────────────────────────────────────────────────
  {
    name:        "Classic Polo T-Shirt",
    description: "Premium piqué cotton polo with a three-button placket and ribbed collar. Breathable and moisture-wicking — ideal for the Zambian heat. Available in 6 colours.",
    category:    "men",
    subcategory: "t-shirts",
    price:       180,
    images: [
      "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800",
    ],
    stock:    60,
    featured: true,
    active:   true,
  },
  {
    name:           "Slim Fit Chinos",
    description:    "Stretch-cotton slim fit chinos in a versatile neutral tone. Four-pocket construction with a button-fly and straight-leg cut below the knee.",
    category:       "men",
    subcategory:    "trousers",
    price:          350,
    compareAtPrice: 450,
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    ],
    stock:    30,
    featured: false,
    active:   true,
  },
  {
    name:        "Formal Oxford Shirt",
    description: "100% cotton Oxford shirt with a button-down collar and chest pocket. Easy-iron fabric keeps you sharp from morning meetings to evening events.",
    category:    "men",
    subcategory: "shirts",
    price:       280,
    images: [
      "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=800",
    ],
    stock:    25,
    featured: true,
    active:   true,
  },
  {
    name:           "Leather Belt & Wallet Set",
    description:    "Genuine leather gift set including a 35mm reversible belt and a bi-fold wallet with 6 card slots. Presented in a premium gift box.",
    category:       "men",
    subcategory:    "belts & wallets",
    price:          420,
    compareAtPrice: 520,
    images: [
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=800",
    ],
    stock:    15,
    featured: false,
    active:   true,
  },

  // ── ELECTRONICS ───────────────────────────────────────────────────────────
  {
    name:           "Wireless Earbuds Pro",
    description:    "Active noise-cancelling TWS earbuds with 30-hour total battery life (6h buds + 24h case). Bluetooth 5.3, IPX5 water resistance, and touch controls.",
    category:       "electronics",
    subcategory:    "earphones",
    price:          650,
    compareAtPrice: 850,
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800",
    ],
    stock:    35,
    featured: true,
    active:   true,
  },
  {
    name:        "Fast Charge Power Bank 20000mAh",
    description: "20,000 mAh power bank with 65W PD fast charging and two USB-A ports. Slim aluminium body, LED charge indicator, charges a laptop up to 1.5×.",
    category:    "electronics",
    subcategory: "chargers",
    price:       480,
    images: [
      "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    ],
    stock:    50,
    featured: false,
    active:   true,
  },
  {
    name:           "Smart Watch Series 6",
    description:    "Feature-packed smartwatch with 1.85\" AMOLED display, heart rate & SpO2 monitoring, 100+ sport modes, and 7-day battery. Interchangeable straps included.",
    category:       "electronics",
    subcategory:    "smart watches",
    price:          1200,
    compareAtPrice: 1500,
    images: [
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800",
    ],
    stock:    20,
    featured: true,
    active:   true,
  },
  {
    name:        "USB-C Cable 3 Pack",
    description: "Braided nylon USB-C to USB-C cables (1m × 2 + 2m × 1). Supports 100W PD, 480 Mbps data transfer, and is rated for 30,000+ bends.",
    category:    "electronics",
    subcategory: "chargers",
    price:       120,
    images: [
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800",
    ],
    stock:    100,
    featured: false,
    active:   true,
  },

  // ── BEAUTY ────────────────────────────────────────────────────────────────
  {
    name:           "Vitamin C Brightening Serum",
    description:    "20% stabilised Vitamin C serum with hyaluronic acid and niacinamide. Fades dark spots, evens skin tone, and boosts collagen production. 30ml dropper bottle.",
    category:       "beauty",
    subcategory:    "skincare",
    price:          380,
    compareAtPrice: 480,
    images: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800",
    ],
    stock:    45,
    featured: true,
    active:   true,
  },
  {
    name:        "Hair Growth Oil Treatment",
    description: "Castor and argan oil blend infused with biotin and peppermint. Stimulates scalp circulation, reduces breakage, and promotes longer, thicker hair. 100ml.",
    category:    "beauty",
    subcategory: "haircare",
    price:       250,
    images: [
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800",
    ],
    stock:    60,
    featured: false,
    active:   true,
  },
  {
    name:           "Full Coverage Foundation Kit",
    description:    "Long-wear matte foundation set with matching concealer and setting powder. 24-hour wear formula with SPF 15. Available in 12 shades to suit all African skin tones.",
    category:       "beauty",
    subcategory:    "makeup",
    price:          420,
    compareAtPrice: 550,
    images: [
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800",
    ],
    stock:    30,
    featured: true,
    active:   true,
  },
  {
    name:        "Rose Body Mist 200ml",
    description: "Light and refreshing rose water body mist with notes of peony and white musk. Alcohol-free formula suitable for all skin types. Perfect for daily freshness.",
    category:    "beauty",
    subcategory: "perfumes",
    price:       180,
    images: [
      "https://images.unsplash.com/photo-1570194065650-d99fb4abbd90?w=800",
    ],
    stock:    80,
    featured: false,
    active:   true,
  },

  // ── HOME & LIVING ─────────────────────────────────────────────────────────
  {
    name:           "Non-Stick Cookware Set 5pc",
    description:    "5-piece non-stick granite-coated cookware set: 16cm saucepan, 20cm & 24cm frying pans, 26cm wok, and glass lids. PFOA-free coating, induction-compatible.",
    category:       "home",
    subcategory:    "kitchen",
    price:          890,
    compareAtPrice: 1100,
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    ],
    stock:    15,
    featured: true,
    active:   true,
  },
  {
    name:        "Luxury Duvet Cover Set",
    description: "Hotel-quality microfibre duvet cover set (duvet cover + 2 pillowcases). 400-thread-count equivalent softness, easy-care and machine washable. Queen/King sizes.",
    category:    "home",
    subcategory: "bedding",
    price:       650,
    images: [
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800",
    ],
    stock:    20,
    featured: false,
    active:   true,
  },
  {
    name:           "LED Desk Lamp USB",
    description:    "Adjustable LED desk lamp with 5 colour temperatures and 10 brightness levels. Built-in USB-A charging port, touch controls, and eye-care flicker-free light.",
    category:       "home",
    subcategory:    "lighting",
    price:          280,
    compareAtPrice: 350,
    images: [
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    ],
    stock:    40,
    featured: false,
    active:   true,
  },
  {
    name:        "Storage Ottoman Box",
    description: "Foldable fabric storage ottoman that doubles as a footrest or extra seat. Holds up to 150kg, removable lid, internal storage capacity of 50L. Assembly-free.",
    category:    "home",
    subcategory: "storage",
    price:       450,
    images: [
      "https://images.unsplash.com/photo-1565183928294-7063f23ce0f8?w=800",
    ],
    stock:    12,
    featured: true,
    active:   true,
  },

  // ── CAR PARTS ─────────────────────────────────────────────────────────────
  {
    name:           "Car Dash Camera HD",
    description:    "2.5K dual-lens dash cam with 170° wide-angle front and 120° rear lens. Night vision, loop recording, G-sensor emergency lock, and parking monitor mode.",
    category:       "car-parts",
    subcategory:    "accessories",
    price:          780,
    compareAtPrice: 950,
    images: [
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800",
    ],
    stock:    20,
    featured: true,
    active:   true,
  },
  {
    name:        "Universal Car Phone Mount",
    description: "360° adjustable car phone mount with one-touch release and strong suction cup base. Fits phones 4\"–7\". Compatible with all dashboard and windscreen surfaces.",
    category:    "car-parts",
    subcategory: "accessories",
    price:       150,
    images: [
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800",
    ],
    stock:    80,
    featured: false,
    active:   true,
  },
  {
    name:           "Car Seat Cover Set",
    description:    "Full set of 9 leatherette seat covers with anti-slip backing. Universal fit for most sedan and SUV models. Easy wipe-clean surface, comes with headrest covers.",
    category:       "car-parts",
    subcategory:    "accessories",
    price:          520,
    compareAtPrice: 680,
    images: [
      "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800",
    ],
    stock:    15,
    featured: false,
    active:   true,
  },
  {
    name:        "LED Car Interior Light Strip",
    description: "Multi-colour RGB LED light strip for car interiors with app and remote control. 4 × 45cm strips, music-sync mode, adhesive backing, and 12V lighter plug.",
    category:    "car-parts",
    subcategory: "accessories",
    price:       180,
    images: [
      "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800",
    ],
    stock:    50,
    featured: true,
    active:   true,
  },

  // ── ACCESSORIES ───────────────────────────────────────────────────────────
  {
    name:           "Polarised Sunglasses",
    description:    "Classic aviator-style polarised sunglasses with UV400 protection and a lightweight metal frame. Reduces glare for driving and outdoor activities. Includes hard case.",
    category:       "accessories",
    subcategory:    "sunglasses",
    price:          280,
    compareAtPrice: 380,
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
    ],
    stock:    35,
    featured: true,
    active:   true,
  },
  {
    name:        "Canvas Backpack 30L",
    description: "Heavy-duty waxed canvas backpack with padded laptop sleeve (fits up to 15.6\"), 5 external pockets, YKK zips, and reinforced carry handle. Water-resistant.",
    category:    "accessories",
    subcategory: "bags",
    price:       420,
    images: [
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800",
    ],
    stock:    25,
    featured: false,
    active:   true,
  },
  {
    name:           "Snapback Cap Collection",
    description:    "Structured flat-brim snapback cap with embroidered front panel and adjustable snap closure. One-size-fits-most. Available in 8 colourways.",
    category:       "accessories",
    subcategory:    "caps",
    price:          160,
    compareAtPrice: 220,
    images: [
      "https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?w=800",
    ],
    stock:    50,
    featured: false,
    active:   true,
  },
  {
    name:        "Silk Scarf Multiway",
    description: "100% mulberry silk scarf (90cm × 90cm) with a hand-rolled hem and vibrant print. Wear as a headscarf, neck wrap, bag accent, or belt — styling card included.",
    category:    "accessories",
    subcategory: "scarves",
    price:       220,
    images: [
      "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800",
    ],
    stock:    30,
    featured: true,
    active:   true,
  },
];

// ── 4. Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  const col = collection(db, "products");
  let count = 0;

  for (const product of products) {
    try {
      await addDoc(col, { ...product, createdAt: serverTimestamp() });
      console.log(`  Added: ${product.name}`);
      count++;
    } catch (err) {
      console.error(`  ✗ Failed to add "${product.name}":`, err);
    }
  }

  console.log(`\n✓ Seeded ${count} of ${products.length} products successfully.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

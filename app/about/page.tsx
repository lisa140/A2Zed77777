import Link from "next/link";
import { Globe, Truck, Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="bg-brand_green text-white py-16 px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">A2Zed Global Store</h1>
        <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto">
          From A to Z — Everything You Need, Delivered to Zambia
        </p>
        <div className="mt-6 mx-auto w-16 h-0.5 bg-white/30 rounded-full" />
      </section>

      {/* Our Story */}
      <section className="py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-darkColor mb-6">Our Story</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            A2Zed was built on a simple belief — that Zambians deserve access to quality, affordable
            products without the complexity of international importing. We source directly from
            manufacturers in China and bring everything from fashion and electronics to home goods
            and car parts, straight to your door in Zambia.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Whether you're in Lusaka or anywhere across the country, we deliver. And if you can't
            find what you're looking for, just ask — our Custom Order service means we'll go and
            find it for you.
          </p>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-light_bg py-14 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-darkColor mb-8 text-center">Why Choose A2Zed?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon:  <Globe    className="w-8 h-8 text-brand_green" />,
                title: "Direct from China",
                body:  "We source products directly, cutting out middlemen and keeping prices low",
              },
              {
                icon:  <Truck    className="w-8 h-8 text-brand_green" />,
                title: "Delivered to Zambia",
                body:  "Lusaka delivery K60 | Outside Lusaka K150 | Fast and reliable",
              },
              {
                icon:  <Sparkles className="w-8 h-8 text-brand_gold" />,
                title: "Can't Find It?",
                body:  "Our Custom Order service lets you request any product and we'll source it for you",
              },
            ].map((card) => (
              <div key={card.title} className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <div className="flex justify-center mb-4">{card.icon}</div>
                <h3 className="font-bold text-darkColor text-base mb-2">{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand_green text-white py-12 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: "500+",  label: "Products Available" },
            { value: "24hr",  label: "Custom Order Response" },
            { value: "7 Days", label: "Easy Returns" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl md:text-4xl font-black mb-1">{stat.value}</p>
              <p className="text-white/70 text-xs md:text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 text-center">
        <h2 className="text-2xl font-bold text-darkColor mb-3">Ready to Shop?</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          Browse our full collection or submit a custom order request
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-brand_green text-white font-bold text-sm hover:bg-brand_green_hover transition-colors"
          >
            Browse Shop
          </Link>
          <Link
            href="/custom-order"
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl border-2 border-brand_red text-brand_red font-bold text-sm hover:bg-brand_red/5 transition-colors"
          >
            Custom Order
          </Link>
        </div>
      </section>

    </div>
  );
}

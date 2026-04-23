import { Clock, MapPin, Phone } from "lucide-react";
import React from "react";

interface ContactItemData {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const data: ContactItemData[] = [
  {
    title: "Visit Us",
    subtitle: "Lusaka, Zambia",
    icon: (
      <MapPin className="w-6 h-6 text-gray-600 group-hover:text-brand_gold transition-colors" />
    ),
  },
  {
    title: "Call Us",
    subtitle: "+123 456 7890",
    icon: (
      <Phone className="w-6 h-6 text-gray-600 group-hover:text-brand_gold transition-colors" />
    ),
  },
  {
    title: "Working Hours",
    subtitle: "Mon-Fri: 9AM - 6PM",
    icon: (
      <Clock className="w-6 h-6 text-gray-600 group-hover:text-brand_gold transition-colors" />
    ),
  },
  {
    title: "Email Us",
    subtitle: "contact@a2zedstore.com",
    icon: (
      <Clock className="w-6 h-6 text-gray-600 group-hover:text-brand_gold transition-colors" />
    ),
  },
];

const FooterTop = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b py-6">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-3 group-hover:bg-gray-50 p-4 transition-colors hoverEffect min-w-0"
        >
          {item?.icon}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-black hoverEffect">
              {item?.title}
            </h3>
            <p className="text-gray-600 text-sm mt-1 group-hover:text-gray-900 hoverEffect break-all">
              {item?.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FooterTop;

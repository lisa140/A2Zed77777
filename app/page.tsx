import CategoryIconRow from "@/components/CategoryIconRow";
import Container from "@/components/Container";
import HomeBanner from "@/components/HomeBanner";
import FeaturedProducts from "@/components/FeaturedProducts";

const HomePage = () => {
  return (
    <div className="bg-white">
      {/* Hero slider */}
      <Container className="py-4 md:py-6">
        <HomeBanner />
      </Container>

      {/* Category pill row — below the hero slider */}
      <CategoryIconRow />

      {/* Featured products grid */}
      <FeaturedProducts />
    </div>
  );
};
export default HomePage;

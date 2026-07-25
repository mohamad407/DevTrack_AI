import Navbar from '../components/landing/Navbar.jsx';
import Hero from '../components/landing/Hero.jsx';
import Features from '../components/landing/Features.jsx';
import DevOpsIllustration from '../components/landing/DevOpsIllustration.jsx';
import Testimonials from '../components/landing/Testimonials.jsx';
import CTASection from '../components/landing/CTASection.jsx';
import Footer from '../components/landing/Footer.jsx';

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <DevOpsIllustration />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

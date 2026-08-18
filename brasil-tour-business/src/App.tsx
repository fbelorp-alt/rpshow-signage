import Nav from "./components/Nav";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Experiences from "./components/Experiences";
import Differentials from "./components/Differentials";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-sand">
      <Nav />
      <main>
        <Hero />
        <About />
        <Services />
        <Experiences />
        <Differentials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

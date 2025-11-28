"use client";

import Hero from "@/components/site/Hero";
import Brands from "@/components/site/Brands";
import Feature from "@/components/site/Features";
import About from "@/components/site/About";
import FeaturesTab from "@/components/site/FeaturesTab";
import Integration from "@/components/site/Integration";
import CTA from "@/components/site/CTA";
import FAQ from "@/components/site/FAQ";
import Pricing from "@/components/site/Pricing";
import Contact from "@/components/site/Contact";
import Testimonial from "@/components/site/Testimonial";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  function handleStart() {
    if (user) router.push("/classrooms");
    else router.push("/auth/login");
  }

  return (
    <main>
      <Hero />
      <Brands />
      <Feature />
      <About />
      <FeaturesTab />
      <Integration />
      <CTA />
      <FAQ />
      <Testimonial />
      <Pricing />
      <Contact />

    </main>
  );
}

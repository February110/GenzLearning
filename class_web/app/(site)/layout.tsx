import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}

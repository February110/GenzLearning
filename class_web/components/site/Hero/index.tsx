"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { FormEvent } from "react";

const Hero = () => {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    try {
      const roleFromSession = (session?.user as any)?.systemRole as string | undefined;
      const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = raw ? JSON.parse(raw) : null;
      const role = (roleFromSession || user?.systemRole || "").toLowerCase();

      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/classrooms");
      }
    } catch {
      router.push("/classrooms");
    }
  };

  return (
    <>
      <section className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
        <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
          <div className="flex lg:items-center lg:gap-8 xl:gap-32.5">
            <div className="md:w-1/2">
              <h4 className="mb-4.5 text-lg font-medium text-black dark:text-white">
                🎓 Hệ thống hỗ trợ học tập trực tuyến
              </h4>
              <h1 className="mb-5 pr-16 text-3xl font-bold text-black dark:text-white xl:text-hero ">
                Nền tảng học tập trực tuyến{" "}
                <span className="relative inline-block before:absolute before:bottom-2.5 before:left-0 before:-z-1 before:h-3 before:w-full before:bg-titlebg dark:before:bg-titlebgdark ">
                  hiện đại
                </span>
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Website hỗ trợ học tập giúp kết nối giáo viên và học viên mọi lúc
                mọi nơi. Hệ thống cho phép tạo lớp học, giao bài tập, nộp bài và
                theo dõi tiến độ học tập một cách dễ dàng,
                nhưng được tối ưu và thân thiện hơn.
              </p>

              {/* Nút Bắt đầu ngay */}
              <div className="mt-10">
                <form onSubmit={handleSubmit}>
                  <button
                    type="submit"
                    aria-label="get started button"
                    className="flex rounded-full bg-primary px-8 py-3 text-white font-medium duration-300 ease-in-out hover:bg-primary/80 dark:bg-btndark dark:hover:bg-blackho cursor-pointer"
                  >
                    Bắt đầu ngay
                  </button>
                </form>

                <p className="mt-5 text-black dark:text-white">
                  Hoàn toàn miễn phí – không cần thẻ tín dụng.
                </p>
              </div>
            </div>

            {/* Ảnh bên phải */}
            <div className="animate_right hidden md:w-1/2 lg:block">
              <div className="relative 2xl:-mr-7.5">
                <Image
                  src="/images/shape/shape-01.png"
                  alt="shape"
                  width={46}
                  height={246}
                  className="absolute -left-11.5 top-0"
                />
                <Image
                  src="/images/shape/shape-02.svg"
                  alt="shape"
                  width={36.9}
                  height={36.7}
                  className="absolute bottom-0 right-0 z-10"
                />
                <Image
                  src="/images/shape/shape-03.svg"
                  alt="shape"
                  width={21.64}
                  height={21.66}
                  className="absolute -right-6.5 bottom-0 z-1"
                />
                <div className="relative aspect-700/444 w-full">
                  <Image
                    className="shadow-solid-l dark:hidden"
                    src="/images/hero/hero-light.svg"
                    alt="Hero"
                    fill
                  />
                  <Image
                    className="hidden shadow-solid-l dark:block"
                    src="/images/hero/hero-dark.svg"
                    alt="Hero"
                    fill
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}; 

export default Hero;

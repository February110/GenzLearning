"use client";
import { motion } from "framer-motion";
import Image from "next/image";

const Footer = () => {
  return (
    <>
      <footer className="border-t border-stroke bg-white dark:border-strokedark dark:bg-blacksection">
        <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">

          {/* Footer Top */}
          <div className="py-20 lg:py-25">
            <div className="flex flex-wrap gap-8 lg:justify-between lg:gap-0">

              {/* Left column */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: -20 },
                  visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                whileInView="visible"
                transition={{ duration: 1, delay: 0.5 }}
                viewport={{ once: true }}
                className="animate_top w-1/2 lg:w-1/4"
              >
                <a href="/" className="relative">
                  <Image
                    width={150}
                    height={60}
                    src="/images/logo/logo-light.png"
                    alt="Logo"
                    className="dark:hidden"
                  />
                  <Image
                    width={150}
                    height={60}
                    src="/images/logo/logo-darkk.png"
                    alt="Logo"
                    className="hidden dark:block"
                  />
                </a>

                <p className="mb-10 mt-5">
                  Hệ thống hỗ trợ học tập trực tuyến, quản lý lớp học, bài tập,
                  tài liệu và phòng họp WebRTC.
                </p>

                <p className="mb-1.5 text-sectiontitle uppercase tracking-[5px]">
                  Liên hệ
                </p>
                <a
                  href="mailto:anhtai1879@gmail.com"
                  className="text-itemtitle font-medium text-black dark:text-white"
                >
                  anhtai1879@gmail.com
                </a>
              </motion.div>

              {/* Right columns */}
              <div className="flex w-full flex-col gap-8 md:flex-row md:justify-between md:gap-0 lg:w-2/3 xl:w-7/12">

                {/* Quick Links */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: -20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  initial="hidden"
                  whileInView="visible"
                  transition={{ duration: 1, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="animate_top"
                >
                  <h4 className="mb-9 text-itemtitle2 font-medium text-black dark:text-white">
                    Liên kết nhanh
                  </h4>

                  <ul>
                    <li>
                      <a
                        href="/"
                        className="mb-3 inline-block hover:text-primary"
                      >
                        Trang chủ
                      </a>
                    </li>
                    <li>
                      <a
                        href="/classrooms"
                        className="mb-3 inline-block hover:text-primary"
                      >
                        Lớp học
                      </a>
                    </li>
                    <li>
                      <a
                        href="/assignments"
                        className="mb-3 inline-block hover:text-primary"
                      >
                        Bài tập
                      </a>
                    </li>
                    <li>
                      <a
                        href="/meet"
                        className="mb-3 inline-block hover:text-primary"
                      >
                        Phòng họp WebRTC
                      </a>
                    </li>
                  </ul>
                </motion.div>

                {/* Support */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: -20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  initial="hidden"
                  whileInView="visible"
                  transition={{ duration: 1, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="animate_top"
                >
                  <h4 className="mb-9 text-itemtitle2 font-medium text-black dark:text-white">
                    Hỗ trợ
                  </h4>

                  <ul>
                    <li>
                      <a href="#" className="mb-3 inline-block hover:text-primary">
                        Tài liệu hướng dẫn
                      </a>
                    </li>
                    <li>
                      <a href="#" className="mb-3 inline-block hover:text-primary">
                        Câu hỏi thường gặp
                      </a>
                    </li>
                    <li>
                      <a href="#" className="mb-3 inline-block hover:text-primary">
                        Chính sách & Quy định
                      </a>
                    </li>
                    <li>
                      <a href="#" className="mb-3 inline-block hover:text-primary">
                        Liên hệ hỗ trợ
                      </a>
                    </li>
                  </ul>
                </motion.div>

                {/* Newsletter – giữ nguyên nhưng sửa nội dung */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: -20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  initial="hidden"
                  whileInView="visible"
                  transition={{ duration: 1, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="animate_top"
                >
                  <h4 className="mb-9 text-itemtitle2 font-medium text-black dark:text-white">
                    Nhận thông báo
                  </h4>
                  <p className="mb-4 w-[90%]">
                    Đăng ký để nhận cập nhật mới nhất về lớp học và bài tập.
                  </p>

                  <form action="#">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Email của bạn"
                        className="w-full rounded-full border border-stroke px-6 py-3 shadow-solid-11 focus:border-primary focus:outline-hidden dark:border-strokedark dark:bg-black dark:shadow-none dark:focus:border-primary"
                      />

                      <button
                        aria-label="signup to newsletter"
                        className="absolute right-0 p-4"
                      >
                        <svg
                          className="fill-[#757693] hover:fill-primary dark:fill-white"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3.1175 1.17318L18.5025 9.63484L3.1175 18.8265V9.16651H8.33333V10.8332H4.16667V16.3473L15.7083 9.99984L4.16667 3.65234V9.16651H8.33333V10.8332H4.16667V1.53818Z" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="flex flex-col flex-wrap items-center justify-center gap-5 border-t border-stroke py-7 dark:border-strokedark lg:flex-row lg:justify-between lg:gap-0">

            <motion.div
              variants={{
                hidden: { opacity: 0, y: -20 },
                visible: { opacity: 1, y: 0 },
              }}
              initial="hidden"
              whileInView="visible"
              transition={{ duration: 1, delay: 0.1 }}
              viewport={{ once: true }}
              className="animate_top"
            >
              <ul className="flex items-center gap-8">
                <li><a href="#" className="hover:text-primary">Tiếng Việt</a></li>
                <li><a href="#" className="hover:text-primary">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-primary">Hỗ trợ</a></li>
              </ul>
            </motion.div>

            <motion.div                                                                                      
              variants={{
                hidden: { opacity: 0, y: -20 },
                visible: { opacity: 1, y: 0 },
              }}
              initial="hidden"
              whileInView="visible"
              transition={{ duration: 1, delay: 0.1 }}
              viewport={{ once: true }}
              className="animate_top"
            >
              <p>&copy; {new Date().getFullYear()} GenZ Learning — Developed by February110</p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: -20 },
                visible: { opacity: 1, y: 0 },
              }}
              initial="hidden"
              whileInView="visible"
              transition={{ duration: 1, delay: 0.1 }}
              viewport={{ once: true }}
              className="animate_top"
            >
              <ul className="flex items-center gap-5">
                <li><a href="#" aria-label="social icon">{/* facebook */}</a></li>
                <li><a href="#" aria-label="social icon">{/* twitter */}</a></li>
                <li><a href="#" aria-label="social icon">{/* linkedin */}</a></li>
                <li><a href="#" aria-label="social icon">{/* google */}</a></li>
              </ul>
            </motion.div>
          </div>

        </div>
      </footer>
    </>
  );
};

export default Footer;

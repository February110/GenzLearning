"use client";
import Image from "next/image";
import SectionHeader from "../Common/SectionHeader";

const Pricing = () => {
  return (
    <>
      {/* <!-- ===== Pricing Table Start ===== --> */}
      <section className="overflow-hidden pb-20 pt-15 lg:pb-25 xl:pb-30">
        <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
          {/* <!-- Section Title Start --> */}
          <div className="animate_top mx-auto text-center">
            <SectionHeader
              headerInfo={{
                title: `GÓI SỬ DỤNG`,
                subtitle: `Miễn phí cho học viên và giáo viên`,
                description: `Hệ thống hỗ trợ học tập cung cấp các tính năng hoàn toàn miễn phí cho cá nhân. 
                Các tổ chức hoặc trung tâm có thể sử dụng gói nâng cao để mở rộng dung lượng, cuộc họp và quản lý nhiều lớp.`,
              }}
            />
          </div>
          {/* <!-- Section Title End --> */}
        </div>

        <div className="relative mx-auto mt-15 max-w-[1207px] px-4 md:px-8 xl:mt-20 xl:px-0">
          <div className="absolute -bottom-15 -z-1 h-full w-full">
            <Image
              fill
              src="./images/shape/shape-dotted-light.svg"
              alt="Dotted"
              className="dark:hidden"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-7.5 lg:flex-nowrap xl:gap-12.5">

            {/* <!-- FREE --> */}
            <div className="animate_top group relative rounded-lg border border-stroke bg-white p-7.5 shadow-solid-10 dark:border-strokedark dark:bg-blacksection md:w-[45%] lg:w-1/3 xl:p-12.5">
              <h3 className="mb-7.5 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle3">
                Miễn phí
              </h3>
              <h4 className="mb-2.5 text-para2 font-medium text-black dark:text-white">
                Gói cá nhân
              </h4>
              <p>Dành cho học viên và giáo viên sử dụng các tính năng cơ bản.</p>

              <div className="mt-9 border-t border-stroke pb-12.5 pt-9 dark:border-strokedark">
                <ul>
                  <li className="mb-4 text-black dark:text-manatee">
                    Tham gia lớp học
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Nộp bài & xem điểm
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Nhận thông báo thời gian thực
                  </li>
                  <li className="mb-4 text-black opacity-40 dark:text-manatee">
                    Cuộc họp trực tuyến không giới hạn
                  </li>
                </ul>
              </div>

              <button
                aria-label="Get the Plan"
                className="group/btn inline-flex items-center gap-2.5 font-medium text-primary transition-all duration-300 dark:text-white dark:hover:text-primary"
              >
                <span className="duration-300 group-hover/btn:pr-2">
                  Sử dụng ngay
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.4767 6.16701L6.00668 1.69701L7.18501 0.518677L13.6667 7.00034L7.18501 13.482L6.00668 12.3037L10.4767 7.83368H0.333344V6.16701H10.4767Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            {/* <!-- POPULAR --> */}
            <div className="animate_top group relative rounded-lg border border-stroke bg-white p-7.5 shadow-solid-10 dark:border-strokedark dark:bg-blacksection md:w-[45%] lg:w-1/3 xl:p-12.5">
              <div className="absolute -right-3.5 top-7.5 -rotate-90 rounded-bl-full rounded-tl-full bg-primary px-4.5 py-1.5 text-metatitle font-medium uppercase text-white">
                phổ biến
              </div>

              <h3 className="mb-7.5 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle3">
                199.000₫
                <span className="text-regular text-waterloo dark:text-manatee">
                  /tháng
                </span>
              </h3>
              <h4 className="mb-2.5 text-para2 font-medium text-black dark:text-white">
                Gói trung tâm
              </h4>
              <p>Dành cho trung tâm/nhóm học lớn cần quản lý nhiều lớp học.</p>

              <div className="mt-9 border-t border-stroke pb-12.5 pt-9 dark:border-strokedark">
                <ul>
                  <li className="mb-4 text-black dark:text-manatee">
                    Quản lý tối đa 50 lớp học
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Cuộc họp trực tuyến không giới hạn
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Dung lượng lưu trữ mở rộng 50GB
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Hỗ trợ kỹ thuật ưu tiên
                  </li>
                </ul>
              </div>

              <button
                aria-label="Get the Plan"
                className="group/btn inline-flex items-center gap-2.5 font-medium text-primary transition-all duration-300 dark:text-white dark:hover:text-primary"
              >
                <span className="duration-300 group-hover/btn:pr-2">
                  Chọn gói
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.4767 6.16701L6.00668 1.69701L7.18501 0.518677L13.6667 7.00034L7.18501 13.482L6.00668 12.3037L10.4767 7.83368H0.333344V6.16701H10.4767Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            {/* <!-- PREMIUM --> */}
            <div className="animate_top group relative rounded-lg border border-stroke bg-white p-7.5 shadow-solid-10 dark:border-strokedark dark:bg-blacksection md:w-[45%] lg:w-1/3 xl:p-12.5">
              <h3 className="mb-7.5 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle3">
                499.000₫
                <span className="text-regular text-waterloo dark:text-manatee">
                  /tháng
                </span>
              </h3>
              <h4 className="mb-2.5 text-para2 font-medium text-black dark:text-white">
                Gói doanh nghiệp
              </h4>
              <p>Phù hợp cho các tổ chức lớn cần nhiều tính năng nâng cao.</p>

              <div className="mt-9 border-t border-stroke pb-12.5 pt-9 dark:border-strokedark">
                <ul>
                  <li className="mb-4 text-black dark:text-manatee">
                    Không giới hạn lớp học
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    200GB lưu trữ Cloud
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Cuộc họp WebRTC nâng cao
                  </li>
                  <li className="mb-4 text-black dark:text-manatee">
                    Tùy chỉnh thương hiệu (Branding)
                  </li>
                </ul>
              </div>

              <button
                aria-label="Get the Plan"
                className="group/btn inline-flex items-center gap-2.5 font-medium text-primary transition-all duration-300 dark:text-white dark:hover:text-primary"
              >
                <span className="duration-300 group-hover/btn:pr-2">
                  Đăng ký ngay
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.4767 6.16701L6.00668 1.69701L7.18501 0.518677L13.6667 7.00034L7.18501 13.482L6.00668 12.3037L10.4767 7.83368H0.333344V6.16701H10.4767Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* <!-- ===== Pricing Table End ===== --> */}
    </>
  );
};

export default Pricing;

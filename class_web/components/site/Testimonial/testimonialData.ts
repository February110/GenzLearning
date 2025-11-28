import image1 from "@/public/images/user/user-01.png";
import image2 from "@/public/images/user/user-02.png";
import { Testimonial } from "@/types/site/testimonial";

export const testimonialData: Testimonial[] = [
  {
    id: 1,
    name: "Nguyễn Minh Hoàng",
    designation: "Giáo viên Toán – THPT Trần Phú",
    image: image1,
    content:
      "Hệ thống rất trực quan, dễ sử dụng. Tôi có thể tạo lớp, giao bài, chấm điểm và họp trực tuyến với học sinh ngay trong một nền tảng duy nhất.",
  },
  {
    id: 2,
    name: "Trần Bảo Anh",
    designation: "Sinh viên năm 2 – CNTT",
    image: image2,
    content:
      "Các bài tập được quản lý rõ ràng, thông báo thời gian thực rất tiện lợi. Việc nộp bài và xem phản hồi của giảng viên nhanh chóng, không bị rối như các nền tảng khác.",
  },
  {
    id: 3,
    name: "Phạm Hữu Kiệt",
    designation: "Giảng viên Đại học",
    image: image1,
    content:
      "Tôi đặc biệt ấn tượng với tính năng họp trực tuyến tích hợp WebRTC. Chất lượng ổn định và không cần cài thêm phần mềm rườm rà.",
  },
  {
    id: 4,
    name: "Lê Khánh Vy",
    designation: "Học viên khóa lập trình Backend",
    image: image2,
    content:
      "Giao diện đẹp, tốc độ nhanh, đặc biệt thích mục thông báo realtime và phần nộp bài có lưu lịch sử. Quá phù hợp cho môi trường học trực tuyến.",
  },
];

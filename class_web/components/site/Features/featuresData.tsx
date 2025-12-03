import { Feature } from "@/types/site/feature";

const featuresData: Feature[] = [
  {
    id: 1,
    icon: "/images/icon/icon-01.svg",
    title: "Quản lý lớp học dễ dàng",
    description:
      "Giáo viên có thể tạo lớp, quản lý học viên và theo dõi tiến độ học tập theo thời gian thực.",
  },
  {
    id: 2,
    icon: "/images/icon/icon-02.svg",
    title: "Giao bài tập & chấm điểm",
    description:
      "Tạo bài tập, đặt hạn nộp, chấm điểm và gửi phản hồi trực tiếp trên hệ thống.",
  },
  {
    id: 3,
    icon: "/images/icon/icon-03.svg",
    title: "Nộp bài trực tuyến",
    description:
      "Học viên nộp bài dễ dàng, xem bình luận và điểm số sau khi giáo viên chấm.",
  },
  {
    id: 4,
    icon: "/images/icon/icon-04.svg",
    title: "Lịch học & thông báo",
    description:
      "Tự động cập nhật lịch học, buổi học trực tuyến, thông báo lớp và hạn bài tập.",
  },

  {
    id: 5,
    icon: "/images/icon/icon-05.svg", // đổi icon nếu anh muốn
    title: "Tạo cuộc họp trực tuyến",
    description:
      "Giáo viên có thể tạo phòng họp video dựa trên WebRTC. Học viên chỉ cần tham gia ngay lập tức.",
  },

  {
    id: 6,
    icon: "/images/icon/icon-06.svg",
    title: "Hỗ trợ trên mọi thiết bị",
    description:
      "Hệ thống hoạt động mượt mà trên điện thoại, máy tính bảng và máy tính.",
  },
];

export default featuresData;

import { FeatureTab } from "@/types/site/featureTab";

const featuresTabData: FeatureTab[] = [
  {
    id: "tabOne",
    title: "Giao diện trực quan, dễ sử dụng",
    desc1: `Hệ thống được thiết kế tối ưu cho giáo viên và học viên, giúp thao tác nhanh chóng và dễ dàng ngay cả với người mới.`,
    desc2: `Giao diện rõ ràng, bố cục hợp lý giúp quản lý lớp học, bài tập và điểm số một cách hiệu quả.`,
    image: "/images/features/features-light-01.png",
    imageDark: "/images/features/features-dark-01.svg",
  },
  {
    id: "tabTwo",
    title: "Đầy đủ trang & chức năng cần thiết cho lớp học",
    desc1: `Bao gồm các trang: lớp học, bài tập, bài nộp, điểm số, lịch học, hồ sơ và thông báo — đáp ứng đầy đủ nhu cầu học tập trực tuyến.`,
    desc2: `Hỗ trợ đăng nhập, đăng ký, phân quyền giáo viên – học viên và đồng bộ dữ liệu theo thời gian thực.`,
    image: "/images/features/features-light-01.png",
    imageDark: "/images/features/features-dark-01.svg",
  },
  {
    id: "tabThree",
    title: "Họp trực tuyến & tích hợp thời gian thực",
    desc1: `Tạo phòng họp trực tuyến giống Google Meet bằng WebRTC. Giáo viên chia sẻ mã phòng, học viên tham gia ngay.`,
    desc2: `Bao gồm chia sẻ màn hình, tắt/mở micro, quản lý người tham gia và kết nối ổn định nhờ signaling server.`,
    image: "/images/features/features-light-01.png",
    imageDark: "/images/features/features-dark-01.svg",
  },
];

export default featuresTabData;

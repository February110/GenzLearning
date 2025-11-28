import { FAQ } from "@/types/site/faq";

const faqData: FAQ[] = [
  {
    id: 1,
    quest: "Làm sao để tham gia vào một lớp học?",
    ans: "Học viên có thể tham gia lớp bằng cách nhập mã lớp do giáo viên cung cấp. Sau khi nhập mã, hệ thống sẽ tự động thêm bạn vào lớp tương ứng.",
  },
  {
    id: 2,
    quest: "Giáo viên có thể giao bài tập như thế nào?",
    ans: "Trong giao diện quản lý lớp, giáo viên có thể tạo bài tập mới, đính kèm file, đặt hạn nộp và mô tả yêu cầu. Học viên sẽ nhận thông báo ngay khi bài tập được tạo.",
  },
  {
    id: 3,
    quest: "Học viên có thể xem điểm và phản hồi ở đâu?",
    ans: "Sau khi giáo viên chấm bài, học viên có thể xem điểm, bình luận của giáo viên và file bài đã chấm trong mục 'Bài nộp' của lớp học.",
  },
  {
    id: 4,
    quest: "Hệ thống có hỗ trợ gửi thông báo không?",
    ans: "Có. Khi có bài tập mới, thông báo lớp, điểm mới hoặc phản hồi từ giáo viên, hệ thống sẽ gửi thông báo trực tiếp đến học viên.",
  },
  {
    id: 5,
    quest: "Có thể sử dụng hệ thống trên điện thoại không?",
    ans: "Hệ thống được thiết kế responsive, hỗ trợ tốt trên điện thoại, máy tính bảng và máy tính để bàn, giúp học viên và giáo viên sử dụng mọi lúc mọi nơi.",
  },
];

export default faqData;

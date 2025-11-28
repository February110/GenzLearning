import RegisterPage from "@/components/site/Auth/Register";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký - ClassApp"
};

export default function Register() {
  return (
    <>
      <RegisterPage />
    </>
  );
}

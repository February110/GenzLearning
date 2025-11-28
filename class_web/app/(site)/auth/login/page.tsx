import Signin from "@/components/site/Auth/Login";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập - ClassAppp"
};

const LoginPage = () => {
  return (
    <>
      <Signin />
    </>
  );
};

export default LoginPage;

import { Testimonial } from "@/types/site/testimonial";
import Image from "next/image";

const SingleTestimonial = ({ review }: { review: Testimonial }) => {
  const { name, designation, image, content } = review;

  return (
    <div className="rounded-lg bg-white p-9 pt-7.5 shadow-solid-9 dark:border dark:border-strokedark dark:bg-blacksection dark:shadow-none">
      <div className="mb-7.5 flex justify-between border-b border-stroke pb-6 dark:border-strokedark">
        <div>
          <h3 className="mb-1.5 text-metatitle3 text-black dark:text-white">
            {name}
          </h3>
          <p className="text-manatee dark:text-manatee">{designation}</p>
        </div>
        <Image width={60} height={50} src={image} alt={name} />
      </div>

      <p>{content}</p>
    </div>
  );
};

export default SingleTestimonial;

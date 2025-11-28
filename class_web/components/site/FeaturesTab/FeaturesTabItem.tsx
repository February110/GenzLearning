"use client";

import { FeatureTab } from "@/types/site/featureTab";
import Image from "next/image";
import { motion } from "framer-motion";

const FeaturesTabItem = ({ featureTab }: { featureTab: FeatureTab }) => {
  const { title, desc1, desc2, image, imageDark } = featureTab;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 },
      }}
      initial="hidden"
      whileInView="visible"
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="animate_top flex flex-wrap gap-12.5 md:flex-nowrap md:gap-20 lg:gap-32.5"
    >
      {/* LEFT TEXT */}
      <div className="md:w-1/2">
        <h3 className="mb-5 text-3xl font-bold text-black dark:text-white xl:text-hero">
          {title}
        </h3>

        <p className="mb-5 text-gray-600 dark:text-gray-300 leading-relaxed">
          {desc1}
        </p>

        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {desc2}
        </p>
      </div>

      {/* RIGHT IMAGE */}
      <div className="relative mx-auto md:w-1/2">
        <Image
          width={500}
          height={500}
          src={image}
          alt={title}
          className="dark:hidden"
        />
        <Image
          width={500}
          height={500}
          src={imageDark}
          alt={title}
          className="hidden dark:block"
        />
      </div>
    </motion.div>
  );
};

export default FeaturesTabItem;

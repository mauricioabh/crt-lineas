"use client";

import { motion, type Variants } from "framer-motion";

const variants: Variants = {
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export function PageEnter({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="initial" animate="animate" variants={variants}>
      {children}
    </motion.div>
  );
}

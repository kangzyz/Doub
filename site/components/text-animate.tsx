"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";

type AnimationType =
  | "fadeIn"
  | "fadeInUp"
  | "popIn"
  | "shiftInUp"
  | "rollIn"
  | "whipIn"
  | "whipInUp"
  | "calmInUp";

interface Props extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  text: string;
  type?: AnimationType;
  delay?: number;
}

type VariantPair = { container: Variants; child: Variants };

const variants: Record<AnimationType, VariantPair> = {
  fadeIn: {
    container: {
      hidden: { opacity: 0 },
      visible: (i = 1) => ({
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: (i as number) * 0.3 },
      }),
    },
    child: {
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", damping: 12, stiffness: 100 },
      },
      hidden: { opacity: 0, y: 10 },
    },
  },
  fadeInUp: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
      },
    },
    child: {
      visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
      hidden: { opacity: 0, y: 20 },
    },
  },
  popIn: {
    container: {
      hidden: { scale: 0 },
      visible: {
        scale: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.2 },
      },
    },
    child: {
      visible: {
        opacity: 1,
        scale: 1.1,
        transition: { type: "spring", damping: 15, stiffness: 400 },
      },
      hidden: { opacity: 0, scale: 0 },
    },
  },
  calmInUp: {
    container: {
      hidden: {},
      visible: (i = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: 0.2 * (i as number) },
      }),
    },
    child: {
      hidden: {
        y: "200%",
        transition: { ease: [0.455, 0.03, 0.515, 0.955], duration: 0.85 },
      },
      visible: {
        y: 0,
        transition: { ease: [0.125, 0.92, 0.69, 0.975], duration: 0.75 },
      },
    },
  },
  shiftInUp: {
    container: {
      hidden: {},
      visible: (i = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: 0.2 * (i as number) },
      }),
    },
    child: {
      hidden: {
        y: "100%",
        transition: { ease: [0.75, 0, 0.25, 1], duration: 0.6 },
      },
      visible: {
        y: 0,
        transition: { ease: [0.22, 1, 0.36, 1], duration: 0.8 },
      },
    },
  },
  whipInUp: {
    container: {
      hidden: {},
      visible: (i = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: 0.2 * (i as number) },
      }),
    },
    child: {
      hidden: {
        y: "200%",
        transition: { ease: [0.455, 0.03, 0.515, 0.955], duration: 0.45 },
      },
      visible: {
        y: 0,
        transition: { ease: [0.5, -0.15, 0.25, 1.05], duration: 0.75 },
      },
    },
  },
  rollIn: {
    container: { hidden: {}, visible: {} },
    child: {
      hidden: { opacity: 0, y: "0.25em" },
      visible: {
        opacity: 1,
        y: "0em",
        transition: { duration: 0.65, ease: [0.65, 0, 0.75, 1] },
      },
    },
  },
  whipIn: {
    container: { hidden: {}, visible: {} },
    child: {
      hidden: { opacity: 0, y: "0.35em" },
      visible: {
        opacity: 1,
        y: "0em",
        transition: { duration: 0.45, ease: [0.85, 0.1, 0.9, 1.2] },
      },
    },
  },
};

export function TextAnimate({
  text,
  type = "whipInUp",
  delay = 0,
  className,
  ...props
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const { container, child } = variants[type];
  const letters = Array.from(text);

  if (type === "rollIn" || type === "whipIn") {
    return (
      <motion.div
        ref={ref}
        className={className}
        style={{ display: "inline-block" }}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        {...props}
      >
        {text.split(" ").map((word, wIdx) => (
          <motion.span
            key={`${word}-${wIdx}`}
            style={{ display: "inline-block", whiteSpace: "nowrap" }}
            variants={container}
          >
            {word.split("").map((ch, cIdx) => (
              <motion.span
                key={`${ch}-${cIdx}`}
                style={{ display: "inline-block" }}
                variants={child}
              >
                {ch}
              </motion.span>
            ))}
            <span style={{ display: "inline-block" }}>&nbsp;</span>
          </motion.span>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ display: "inline-block", overflow: "hidden" }}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={1 + delay}
      variants={container}
      {...props}
    >
      {letters.map((letter, i) => (
        <motion.span
          key={`${letter}-${i}`}
          style={{ display: "inline-block" }}
          variants={child}
        >
          {letter === " " ? " " : letter}
        </motion.span>
      ))}
    </motion.div>
  );
}

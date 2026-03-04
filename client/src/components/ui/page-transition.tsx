import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const slideVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  enter: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

interface SlideTransitionProps {
  children: React.ReactNode;
  direction?: number;
  className?: string;
}

export function SlideTransition({ children, direction = 1, className = "" }: SlideTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={location}
        custom={direction}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={slideVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const scaleVariants = {
  initial: {
    scale: 0.98,
    opacity: 0,
  },
  enter: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    scale: 1.02,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function ScaleTransition({ children, className = "" }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={scaleVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

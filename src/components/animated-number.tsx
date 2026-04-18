"use client";

import CountUp from "react-countup";
import { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 1,
  className = "",
}: AnimatedNumberProps) {
  const [startValue, setStartValue] = useState(value);
  const [endValue, setEndValue] = useState(value);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (endValue !== value) {
      const frame = window.requestAnimationFrame(() => {
        setStartValue(endValue);
        setEndValue(value);
        setKey((k) => k + 1);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [endValue, value]);

  return (
    <span className={className}>
      <CountUp
        key={key}
        start={startValue}
        end={endValue}
        duration={duration}
        decimals={decimals}
        prefix={prefix}
        suffix={suffix}
        separator=","
        preserveValue
      />
    </span>
  );
}

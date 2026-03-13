"use client";

import CountUp from "react-countup";
import { useRef, useEffect, useState } from "react";

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
  const prevRef = useRef(value);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (prevRef.current !== value) {
      setKey((k) => k + 1);
    }
  }, [value]);

  const prev = prevRef.current;

  useEffect(() => {
    prevRef.current = value;
  }, [value]);

  return (
    <span className={className}>
      <CountUp
        key={key}
        start={prev}
        end={value}
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

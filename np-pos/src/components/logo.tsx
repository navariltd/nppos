import * as React from "react";

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
}

export function Logo({ size = 24, className, ...props }: LogoProps) {
  return (
    <img
      src="/assets/nppos/logo.png"
      alt="NP POS Logo"
      width={size}
      height={size}
      className={className}
      {...props}
    />
  );
}

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ff-dark-blue text-white hover:bg-[#2f4d85] focus-visible:outline-ff-dark-blue",
  secondary:
    "bg-white text-ff-dark-blue border border-ff-dark-blue/20 hover:bg-ff-pale-blue focus-visible:outline-ff-dark-blue",
  ghost: "bg-transparent text-ff-dark-blue hover:bg-ff-dark-blue/10",
  danger: "bg-ff-error text-white hover:bg-[#dc2f2f] focus-visible:outline-ff-error",
  success: "bg-ff-success text-white hover:bg-[#16a34a] focus-visible:outline-ff-success",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-5 py-2.5 text-base rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

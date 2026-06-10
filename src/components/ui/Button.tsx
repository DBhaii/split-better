import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    
    // Core styles that apply to every button
    const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

    // The different visual styles based on the 'variant' prop
    const variants = {
      primary: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20",
      secondary: "bg-white text-gray-700 border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 shadow-sm",
      danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20",
      ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} px-5 py-2.5 ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
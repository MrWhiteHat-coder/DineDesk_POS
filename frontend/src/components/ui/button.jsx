import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E23744]/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#E23744] text-white shadow-sm hover:bg-[#CB202D]",
        destructive:
          "bg-[#E23744] text-white shadow-sm hover:bg-[#CB202D]",
        outline:
          "border border-[#E8E8E8] bg-white text-[#1C1C1C] shadow-sm hover:bg-[#FFF5F6] hover:border-[#E23744]/40",
        secondary:
          "bg-[#FFF5F6] text-[#E23744] shadow-sm hover:bg-[#FDECEE]",
        ghost: "hover:bg-[#FFF5F6] text-[#1C1C1C]",
        link: "text-[#E23744] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }

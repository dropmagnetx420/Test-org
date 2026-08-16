import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5",
        gradient:
          "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 bg-[length:200%_auto] text-white shadow-lg shadow-violet-600/30 hover:bg-[position:right_center] hover:shadow-violet-600/50 hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90 hover:-translate-y-0.5",
        success:
          "bg-success text-success-foreground shadow-lg shadow-success/20 hover:bg-success/90 hover:-translate-y-0.5",
        outline:
          "border border-border bg-transparent hover:bg-secondary hover:border-primary/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "glass hover:bg-card/75 hover:border-primary/40",
      },
      size: {
        // Taller on phones to stay a comfortable tap target and to line up with
        // the inputs, which are also bumped to h-11 there.
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base sm:px-8",
        xl: "h-14 rounded-xl px-6 text-base sm:px-10",
        icon: "size-11 sm:size-10",
        "icon-sm": "size-9 rounded-md sm:size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

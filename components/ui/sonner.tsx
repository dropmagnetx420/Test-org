"use client";

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    position="top-right"
    richColors
    closeButton
    toastOptions={{
      classNames: {
        toast: "glass-strong !rounded-xl !border-border",
        description: "!text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };

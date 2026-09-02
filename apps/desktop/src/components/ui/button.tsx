import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "bg-[var(--primary)] text-black hover:brightness-110"
      : "border border-[var(--border)] bg-white/5 text-[var(--foreground)] hover:bg-white/10";

  return (
    <button
      className={[
        "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        variantClass,
        className,
      ].join(" ")}
      type={type}
      {...props}
    />
  );
}

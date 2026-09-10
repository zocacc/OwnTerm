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
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_6px_16px_-8px_var(--primary)] hover:brightness-110 disabled:shadow-none"
      : "border border-[var(--hairline)] bg-[var(--secondary-surface)] text-[var(--foreground)] hover:bg-[var(--secondary-hover)]";

  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium leading-none transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        variantClass,
        className,
      ].join(" ")}
      type={type}
      {...props}
    />
  );
}

"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant = "empty" | "error";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

function isEmptyStateAction(a: EmptyStateAction | ReactNode): a is EmptyStateAction {
  return (
    typeof a === "object" &&
    a !== null &&
    "label" in a &&
    typeof (a as EmptyStateAction).label === "string"
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: EmptyStateAction | ReactNode;
  variant?: EmptyStateVariant;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "empty",
  className,
}: EmptyStateProps) {
  const isError = variant === "error";
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
            isError ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-display text-base font-medium",
          isError ? "text-destructive" : "text-foreground"
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {isEmptyStateAction(action) ? (
            action.href ? (
              <Link href={action.href}>
                <Button variant={isError ? "destructive" : "default"} size="sm">
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={isError ? "destructive" : "default"}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          ) : (
            (action as ReactNode)
          )}
        </div>
      )}
    </div>
  );
  return content;
}

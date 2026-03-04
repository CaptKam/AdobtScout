import { startTransition } from "react";
import { useLocation } from "wouter";

interface SafeLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function SafeLink({ href, children, className, "data-testid": dataTestId }: SafeLinkProps) {
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    startTransition(() => setLocation(href));
  };

  return (
    <a 
      href={href} 
      onClick={handleClick} 
      className={className}
      data-testid={dataTestId}
    >
      {children}
    </a>
  );
}

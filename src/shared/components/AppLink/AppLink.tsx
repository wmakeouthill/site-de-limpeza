import type { AnchorHTMLAttributes } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { scrollToPageTarget } from "@/shared/utils/scrollToPageTarget";

interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function AppLink({ href, onClick, ...props }: AppLinkProps) {
  const isInRouter = useInRouterContext();
  const isInternalRoute = href.startsWith("/") && !href.startsWith("//");

  if (isInRouter && isInternalRoute) {
    return (
      <Link
        to={href}
        viewTransition
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }

          const isPrimaryClick =
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey;
          const targetUrl = new URL(href, window.location.href);
          const isCurrentTarget =
            targetUrl.pathname === window.location.pathname &&
            targetUrl.search === window.location.search &&
            targetUrl.hash === window.location.hash;

          if (isPrimaryClick && isCurrentTarget && targetUrl.hash) {
            event.preventDefault();
            scrollToPageTarget(targetUrl.hash);
          }
        }}
        {...props}
      />
    );
  }

  return <a href={href} onClick={onClick} {...props} />;
}

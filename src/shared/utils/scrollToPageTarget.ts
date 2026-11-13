export function scrollToPageTarget(hash: string) {
  const target = document.getElementById(hash.replace(/^#/, ""));
  if (!target) {
    return;
  }

  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  target.scrollIntoView({ block: "start" });
  root.style.scrollBehavior = previousScrollBehavior;
}

import React from "react";
import styles from "./ContentRenderer.module.css";

interface TableBlockProps extends React.ComponentPropsWithoutRef<"table"> {
  children?: React.ReactNode;
}

export function TableBlock({ children, className, ...props }: TableBlockProps) {
  return (
    <div className={styles.tableResponsive}>
      <table className={className} {...props}>
        {children}
      </table>
    </div>
  );
}

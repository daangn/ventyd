import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import logoDark from "@/assets/logo-dark.png";
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            src={logoDark}
            alt="Ventyd Logo"
            style={{ height: "28px", marginBottom: "4px" }}
          />
        </>
      ),
      url: "/docs",
    },
    themeSwitch: {
      enabled: false,
    },
  };
}

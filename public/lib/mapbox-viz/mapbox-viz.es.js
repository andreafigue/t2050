import { jsx as t } from "react/jsx-runtime";
import { useRef as s, useEffect as n } from "react";
const i = () => {
  const r = s(null);
  return n(() => {
    const e = document.createElement("script");
    return e.src = "./assets/index-D67vs96z.js", e.async = !0, r.current.appendChild(e), () => {
      r.current.removeChild(e);
    };
  }, []), /* @__PURE__ */ t("div", { ref: r });
};
export {
  i as default
};

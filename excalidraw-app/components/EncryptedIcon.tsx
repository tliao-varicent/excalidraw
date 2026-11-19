import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import { shield } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import { areExternalLinksDisabled } from "../app_constants";

export const EncryptedIcon = () => {
  const { t } = useI18n();

  const icon = (
    <Tooltip label={t("encrypted.tooltip")} long={true}>
      {shield}
    </Tooltip>
  );

  if (areExternalLinksDisabled) {
    return <span className="encrypted-icon tooltip">{icon}</span>;
  }

  return (
    <a
      className="encrypted-icon tooltip"
      href="https://plus.excalidraw.com/blog/end-to-end-encryption"
      target="_blank"
      rel="noopener"
      aria-label={t("encrypted.link")}
    >
      {icon}
    </a>
  );
};

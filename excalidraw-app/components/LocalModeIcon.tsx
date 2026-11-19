import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import { laptopIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

export const LocalModeIcon = () => {
  const { t } = useI18n();

  return (
    <span
      className="encrypted-icon tooltip"
      role="img"
      aria-label={t("localMode.label")}
    >
      <Tooltip label={t("localMode.tooltip")} long={true}>
        {laptopIcon}
      </Tooltip>
    </span>
  );
};

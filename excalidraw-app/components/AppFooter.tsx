import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser, isLocalMode } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";
import { LocalModeIcon } from "./LocalModeIcon";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {isLocalMode ? (
            <LocalModeIcon />
          ) : (
            !isExcalidrawPlusSignedUser && <EncryptedIcon />
          )}
        </div>
      </Footer>
    );
  },
);

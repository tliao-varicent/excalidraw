import { Excalidraw } from "@excalidraw/excalidraw";
import { fireEvent, render } from "@excalidraw/excalidraw/tests/test-utils";

import { AppFooter } from "../components/AppFooter";
import { AppMainMenu } from "../components/AppMainMenu";
import { AppWelcomeScreen } from "../components/AppWelcomeScreen";

vi.mock("../app_constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app_constants")>()),
  isLocalMode: true,
  isCollabFeatureDisabled: true,
  areExternalLinksDisabled: true,
}));

describe("local mode", () => {
  it("hides Excalidraw+, sign up and social links from the main menu", async () => {
    const { container } = await render(
      <Excalidraw>
        <AppMainMenu
          onCollabDialogOpen={() => {}}
          isCollaborating={false}
          isCollabEnabled={false}
          theme="light"
          refresh={() => {}}
        />
      </Excalidraw>,
    );

    fireEvent.click(container.querySelector(".main-menu-trigger")!);

    const menu = container.querySelector(".main-menu")!.textContent;
    for (const label of [
      "Excalidraw+",
      "Sign up",
      "Sign in",
      "GitHub",
      "Follow us",
      "Discord chat",
      "Live collaboration",
    ]) {
      expect(menu).not.toContain(label);
    }
    expect(menu).toContain("Help");
  });

  it("hides sign up from the welcome screen", async () => {
    const { container } = await render(
      <Excalidraw>
        <AppWelcomeScreen
          onCollabDialogOpen={() => {}}
          isCollabEnabled={false}
        />
      </Excalidraw>,
    );

    const welcome = container.querySelector(".welcome-screen-center")!;
    expect(welcome.textContent).not.toContain("Sign up");
    expect(welcome.textContent).not.toContain("Live collaboration");
  });

  it("shows the local mode icon instead of the encryption link", async () => {
    const { container } = await render(
      <Excalidraw>
        <AppFooter onChange={() => {}} />
      </Excalidraw>,
    );

    expect(container.querySelector("[aria-label='Local mode']")).not.toBeNull();
    expect(
      container.querySelector("a[href*='end-to-end-encryption']"),
    ).toBeNull();
  });
});

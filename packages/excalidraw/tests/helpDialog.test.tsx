import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const openHelpDialog = () =>
  act(() => {
    API.setAppState({ openDialog: { name: "help" } });
  });

const headerLinks = () =>
  [...document.querySelectorAll(".HelpDialog__header a")].map(
    (link) => link.textContent,
  );

describe("HelpDialog", () => {
  it("shows the documentation, blog, issue and YouTube links by default", async () => {
    await render(<Excalidraw />);
    openHelpDialog();

    expect(headerLinks()).toEqual([
      "Documentation",
      "Read our blog",
      "Found an issue? Submit",
      "YouTube",
    ]);
  });

  it("shows only the documentation link when socialLinks is off", async () => {
    await render(
      <Excalidraw UIOptions={{ helpDialog: { socialLinks: false } }} />,
    );
    openHelpDialog();

    expect(headerLinks()).toEqual(["Documentation"]);
  });
});

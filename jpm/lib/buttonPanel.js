/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {data} = require("sdk/self");

let {EventTarget, emit} = require("../../lib/eventTarget");
let result = EventTarget();

let manifest = require("./package.json");
if (!manifest.buttonPanel)
  throw new Error("No buttonPanel configuration in package.json");

let icon = Object.assign({}, manifest.buttonPanel.icon);
for (let key in icon)
  icon[key] = data.url(icon[key]);

let button;
require("./bug1258706_hotfix").fixButton(() =>
{
  button = require("sdk/ui/button/toggle").ToggleButton({
    id: manifest.name + "-button",
    label: manifest.title,
    icon: icon
  });
});

let contentScripts = manifest.buttonPanel.contentScript || [];
if (typeof contentScripts.join != "function")
  contentScripts = [contentScripts];
contentScripts = contentScripts.map(file => data.url(file));

let panel = require("sdk/panel").Panel({
  contentURL: data.url(manifest.buttonPanel.contentURL),
  contentScriptFile: contentScripts,
  position: button
});
require("./bug918600_hotfix").fixPanel(panel);

button.on("change", state => state.checked && panel.show());
panel.on("hide", () => button.state("window", {checked: false}));

panel.port.on("_resize", ([width, height]) =>
{
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=1270095 - on OS X we
  // need to request 2 extra pixels.
  if (require("sdk/system").platform == "darwin")
  {
    width += 2;
    height += 2;
  }

  panel.resize(width, height);
});

panel.on("show", () => emit(result, "show"));

panel.on("hide", () =>
{
  // Hiding will not unload the page, so we need to notify the page
  panel.port.emit("hide");

  emit(result, "hide");
});

result.hide = function()
{
  panel.hide();

  // Huge hack: closing a sidebar is the only way to set focus to the content
  // area.
  let sidebar = require("sdk/ui").Sidebar({
    id: "dummy",
    title: "dummy",
    url: data.url("dummy")
  });

  let tabs = require("sdk/tabs");
  sidebar.show(tabs.activeTab.window);
  sidebar.hide(tabs.activeTab.window);
  sidebar.dispose();
};

result.port = panel.port;

module.exports = result;

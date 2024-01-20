import { get_default_font_size } from "../generic/client";
import { undo as chatUndo, redo as chatRedo } from "../generic/chat";
import { Icon } from "@cocalc/frontend/components";
import { debounce } from "lodash";
import type { ReactNode } from "react";
import { FORMAT_SOURCE_ICON } from "../frame-tree/config";
import { IS_MACOS } from "@cocalc/frontend/feature";
import { IS_MOBILE } from "@cocalc/frontend/feature";
import userTracking from "@cocalc/frontend/user-tracking";

export const MENUS = {
  file: {
    label: "File",
    pos: 0,
    groups: ["export", "reload", "close"],
  },
  edit: {
    label: "Edit",
    pos: 1,
    groups: ["undo-redo", "find", "copy", "format", "config"],
  },
  view: {
    label: "View",
    pos: 2,
    groups: ["zoom", "frame-control", "show-frames"],
  },
  go: {
    label: "Go",
    pos: 3,
    groups: ["action", "build", "scan", "other-users", "get-info"],
  },
  help: {
    label: "Help",
    pos: 4,
    groups: ["help-link", "tour"],
  },
} as const;

type Group = (typeof MENUS)[keyof typeof MENUS]["groups"][number];

export interface Command {
  // group -- inside of a menu
  group: Group;
  // position, for sorting
  pos?: number;
  title?: JSX.Element | string;
  icon?: JSX.Element | string;
  label: string | (({ props }) => JSX.Element);
  // If onClick is NOT set, then editor_actions[name] must be defined
  // and be a function that takes the frame id as input.
  onClick?: ({ props, event }: { props?; event? }) => void;
  isVisible?: ({ props }) => boolean;
  disable?: string;
  keyboard?: string;
  children?: Partial<Command>[];
  disabled?: ({ props, read_only }) => boolean;
  // not used yet
  tour?: string;
  confirm?: {
    // popconfirm first
    title?: ReactNode;
    description?: ReactNode;
    okText?: string;
    cancelText?: string;
  };
  alwaysShow?: boolean;
}

export const COMMANDS: { [command: string]: Command } = {
  "split-row": {
    group: "frame-control",
    alwaysShow: true,
    pos: 1,
    title: "Split frame horizontally into two rows",
    onClick: ({ props }) => {
      if (props.is_full) {
        return props.actions.unset_frame_full();
      } else {
        return props.actions.split_frame("row", props.id);
      }
    },
    icon: "horizontal-split",
    label: "Split Down",
  },
  "split-col": {
    group: "frame-control",
    alwaysShow: true,
    pos: 2,
    title: "Split frame vertically into two columns",
    onClick: ({ props }) => {
      if (props.is_full) {
        return props.actions.unset_frame_full();
      } else {
        return props.actions.split_frame("col", props.id);
      }
    },
    icon: "vertical-split",
    label: "Split Right",
  },
  maximize: {
    group: "frame-control",
    alwaysShow: true,
    pos: 3,
    title: "Toggle whether or not this frame is maximized",
    onClick: ({ props }) => {
      if (props.is_full) {
        props.actions.unset_frame_full();
      } else {
        props.actions.set_frame_full(props.id);
      }
    },
    label: ({ props }) => {
      if (props.is_full) {
        return <span>Demaximize Frame</span>;
      } else {
        return <span>Maximize Frame</span>;
      }
    },
    icon: "expand",
  },
  close: {
    group: "frame-control",
    alwaysShow: true,
    pos: 4,
    title: "Close this frame. Close all frames to restore the default layout.",
    onClick: ({ props }) => {
      props.actions.close_frame(props.id);
    },
    label: "Close Frame",
    icon: "times",
  },
  show_table_of_contents: {
    group: "show-frames",
    title: "Show the Table of Contents",
    icon: "align-right",
    label: "Table of Contents",
  },
  guide: {
    group: "show-frames",
    title: "Show guidebook",
    onClick: ({ props }) => {
      props.actions.guide(props.id, props.type);
    },
    label: "Guide",
    icon: "magic",
  },
  show_search: {
    group: "find",
    pos: 0,
    title: "Show panel for searching in this document",
    label: "Search",
    icon: "search",
  },
  show_overview: {
    group: "show-frames",
    title: "Show overview of all pages",
    label: "Overview",
    icon: "overview",
  },
  show_pages: {
    group: "show-frames",
    title: "Show all pages of this document",
    label: "Pages",
    icon: "pic-centered",
  },
  show_slideshow: {
    group: "show-frames",
    title: "Display Slideshow Presentation",
    label: "Slideshow",
    icon: "play-square",
  },
  show_speaker_notes: {
    group: "show-frames",
    title: "Show Speaker Notes",
    label: "Speaker Notes",
    icon: "pencil",
  },
  shell: {
    group: "show-frames",
    title: "Open a terminal for running code",
    icon: "terminal",
    disable: "disableTerminals",
    label: "Shell",
  },
  terminal: {
    group: "show-frames",
    title: "Open a command line terminal for interacting with the Linux prompt",
    icon: "terminal",
    disable: "disableTerminals",
    label: "Terminal",
  },
  decrease_font_size: {
    pos: 1,
    group: "zoom",
    title: "Decrease font size",
    icon: "search-minus",
    label: "Zoom Out",
    keyboard: "control + <",
  },
  increase_font_size: {
    pos: 0,
    group: "zoom",
    title: "Increase font size",
    icon: "search-plus",
    label: "Zoom In",
    keyboard: "control + >",
  },
  zoom_page_width: {
    pos: 3,
    group: "zoom",
    title: "Zoom to page width",
    label: "Zoom to Width",
    icon: "ColumnWidthOutlined",
  },
  zoom_page_height: {
    pos: 4,
    group: "zoom",
    title: "Zoom to page height",
    label: "Zoom to Height",
    icon: "ColumnHeightOutlined",
  },
  set_zoom: {
    pos: 5,
    group: "zoom",
    title: "Zoom to a preset size",
    label: ({ props }) => (
      <span>
        {props.font_size == null
          ? "Set Zoom"
          : `${Math.round((100 * props.font_size) / get_default_font_size())}%`}
      </span>
    ),
    onClick: () => {},
    icon: "percentage",
    children: [50, 85, 100, 115, 125, 150, 200].map((zoom) => {
      return {
        label: `${zoom}%`,
        onClick: ({ props }) => {
          // console.log("set_zoom", { zoom }, zoom / 100, props.id);
          props.actions.set_zoom(zoom / 100, props.id);
        },
      };
    }),
  },
  undo: {
    group: "undo-redo",
    pos: 0,
    icon: "undo",
    label: "Undo",
    keyboard: "control + z",
    onClick: ({ props }) => {
      if (props.type == "chat") {
        // we have to special case this until we come up with a better way of having
        // different kinds of actions for other frames.
        chatUndo(props.project_id, props.path);
      } else {
        props.editor_actions.undo(props.id);
      }
    },
  },
  redo: {
    group: "undo-redo",
    pos: 1,
    icon: "redo",
    label: "Redo",
    keyboard: "control + shift + z",
    onClick: ({ props }) => {
      if (props.type == "chat") {
        // see undo comment above
        chatRedo(props.project_id, props.path);
      } else {
        props.editor_actions.redo(props.id);
      }
    },
  },
  cut: {
    group: "copy",
    pos: 0,
    label: "Cut",
    title: "Cut selection",
    icon: "scissors",
    keyboard: "control + x",
    disabled: ({ read_only }) => read_only,
  },
  copy: {
    group: "copy",
    pos: 1,
    label: "Copy",
    title: "Copy selection",
    icon: "copy",
    keyboard: "control + c",
  },
  paste: {
    group: "copy",
    pos: 2,
    label: "Paste",
    title: "Paste buffer",
    icon: "paste",
    keyboard: "control + v",
    disabled: ({ read_only }) => read_only,
    onClick: debounce(
      ({ props }) => props.editor_actions.paste(props.id, true),
      200,
      {
        leading: true,
        trailing: false,
      },
    ),
  },

  edit_init_script: {
    group: "config",
    label: "Init Script",
    title: "Edit the initialization script that is run when this starts",
    icon: "rocket",
    tour: "edit_init_script",
  },

  help: {
    group: "help-link",
    label: "Documentation",
    icon: "question-circle",
    title: "Show documentation for working with this editor",
    tour: "help",
  },

  clear: {
    group: "format",
    label: "Clear Frame",
    icon: <Icon unicode={0x2620} />,
    confirm: {
      title: "Clear this frame?",
    },
  },

  pause: {
    group: "action",
    icon: "pause",
    label: ({ props }) => {
      if (props.is_paused) {
        return (
          <div
            style={{
              display: "inline-block",
              background: "green",
              color: "white",
              padding: "0 20px",
            }}
          >
            Resume
          </div>
        );
      }
      return <span>Pause</span>;
    },
    title: "Pause this frame temporarily",
    onClick: ({ props }) => {
      if (props.is_paused) {
        props.actions.unpause(props.id);
      } else {
        props.actions.pause(props.id);
      }
    },
  },

  restart: {
    group: "action",
    icon: "sync",
    label: "Restart Server",
    title: "Restart the backend service",
  },

  kick_other_users_out: {
    group: "other-users",
    icon: "skull-crossbones",
    title:
      "Kick all other users out from this document. It will close in all other browsers.",
    tour: "kick_other_users_out",
    label: "Kick others users out",
  },

  print: {
    group: "export",
    icon: "print",
    title: "Show a printable version of this document in a popup window.",
    label: "Print",
  },

  halt_jupyter: {
    group: "close",
    icon: "PoweroffOutlined",
    label: "Close and Halt",
    title: "Halt the running Jupyter kernel and close this notebook.",
  },

  close_and_halt: {
    group: "close",
    icon: "PoweroffOutlined",
    label: "Close and Halt",
    title: "Halt backend server and close this file.",
  },

  reload: {
    group: "reload",
    icon: "reload",
    label: "Reload",
    title: "Reload this document",
  },

  time_travel: {
    group: "show-frames",
    pos: 3,
    icon: "history",
    label: "TimeTravel",
    title: "Show complete editing history of this document",
    onClick: ({ props, event }) => {
      if (props.actions.name != props.editor_actions.name) {
        // a subframe editor -- always open time travel in a name tab.
        props.editor_actions.time_travel({ frame: false });
        return;
      }
      // If a time_travel frame type is available and the
      // user does NOT shift+click, then open as a frame.
      // Otherwise, it opens as a new tab.
      const frame = !event.shiftKey && props.editor_spec["time_travel"] != null;
      props.actions.time_travel({
        frame,
      });
    },
  },
  find: {
    group: "find",
    pos: 0,
    label: "Find",
    icon: "search",
    keyboard: "control + f",
  },
  replace: {
    group: "find",
    pos: 0,
    label: "Replace",
    icon: "replace",
    disabled: ({ read_only }) => read_only,
  },
  goto_line: {
    group: "find",
    pos: 3,
    label: "Goto Line",
    icon: "bolt",
    keyboard: "control + l",
  },
  auto_indent: {
    group: "format",
    label: "Auto Indent",
    title: "Automatically indent selected code",
    disabled: ({ read_only }) => read_only,
    icon: "indent",
  },

  format: {
    group: "format",
    label: "Format",
    title: "Syntactically format the document.",
    icon: FORMAT_SOURCE_ICON,
  },

  build: {
    group: "build",
    label: "Build",
    title:
      "Build the document.  To disable automatic builds, change Account → Editor → 'Build on save'.",
    icon: "play-circle",
  },

  force_build: {
    group: "build",
    label: "Force Build",
    title: "Force rebuild entire project.",
    icon: "play",
  },

  clean: {
    group: "build",
    label: "Delete Aux Files",
    title: "Delete all temporary files left around from builds",
    icon: "trash",
  },

  rescan_latex_directive: {
    group: "scan",
    label: "Scan for Build Directives",
    title: (
      <>
        Rescan the document for build directives, starting{" "}
        <code>'% !TeX program = xelatex, pdflatex, etc'</code> or{" "}
        <code>'% !TeX cocalc = exact command line'</code>
      </>
    ),
    icon: "reload",
  },
  sync: {
    group: "show-frames",
    label: "Synchronize Views",
    keyboard: `${IS_MACOS ? "⌘" : "alt"} + enter`,
    title: "Synchronize the latex source view with the PDF output",
    icon: "sync",
    onClick: ({ props }) => {
      props.actions.sync?.(props.id, props.editor_actions);
    },
  },
  export_to_markdown: {
    group: "export",
    label: "Export to Markdown",
    title:
      "Create and open a markdown version of current view of this document.",
    icon: "markdown",
  },

  word_count: {
    group: "get-info",
    label: "Word Count",
    title: "Show information about the number of words in this document.",
    icon: "file-alt",
    onClick: ({ props }) => {
      props.actions.word_count?.(0, true);
    },
  },

  tour: {
    group: "tour",
    label: "Take the Tour",
    title: "Take a guided tour of the user interface for this editor.",
    icon: "map",
    isVisible: () => !IS_MOBILE,
    onClick: ({ props }) => {
      userTracking("tour", { name: `frame-${props.type}` });
      props.actions.set_frame_full(props.id);
      // we have to wait until the frame renders before
      // setting the tour; otherwise, the references won't
      // be defined and it won't work.
      setTimeout(
        () => props.actions.set_frame_tree({ id: props.id, tour: true }),
        1,
      );
    },
  },

  download: {
    group: "export",
    label: "Download",
    title: "Download this file",
    icon: "cloud-download",
  },

  readonly_view: {
    pos: -1,
    group: "show-frames",
    icon: "lock",
    title:
      "This is an editable view of the document. You can edit it directly.  Select this option to switch to a read only view.",
    label: "Switch to Readonly View",
    onClick: ({ props }) => {
      props.actions["readonly_view"]?.(props.id);
    },
  },

  edit: {
    pos: -1,
    group: "show-frames",
    icon: "pencil",
    title:
      "This is a readonly view of the document.  Select this option to switch to a directly editable view.",
    label: "Switch to Editable View",
    onClick: ({ props }) => props.actions["edit"]?.(props.id),
  },
} as const;

export const GROUPS: { [group: string]: string[] } = {};
for (const name in MENUS) {
  for (const group of MENUS[name].groups) {
    if (GROUPS[group] != null) {
      throw Error(
        "groups must be unique but '${group}' of '${key}' is duplicated",
      );
    } else {
      GROUPS[group] = [];
    }
  }
}

for (const name in COMMANDS) {
  const command = COMMANDS[name];
  const { group } = command;
  if (group != null) {
    const v = GROUPS[group];
    if (v == null) {
      throw Error(`command ${name} in unknown group '${group}'`);
    }
    v.push(name);
  }
}

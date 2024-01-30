/*

 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
FrameTitleBar - title bar in a frame, in the frame tree
*/

import {
  Button as AntdButton0,
  Input,
  InputNumber,
  Popover,
  Tooltip,
} from "antd";
import { List } from "immutable";
import { useMemo, useRef } from "react";
import {
  Button as AntdBootstrapButton,
  ButtonGroup,
} from "@cocalc/frontend/antd-bootstrap";
import {
  CSS,
  redux,
  Rendered,
  useRedux,
  useState,
} from "@cocalc/frontend/app-framework";
import {
  Icon,
  MenuItem,
  MenuItems,
  r_join,
  Gap,
} from "@cocalc/frontend/components";
import { DropdownMenu } from "@cocalc/frontend/components/dropdown-menu";
import { useStudentProjectFunctionality } from "@cocalc/frontend/course";
import { copy, path_split, trunc_middle, field_cmp } from "@cocalc/util/misc";
import { Actions } from "../code-editor/actions";
import { is_safari } from "../generic/browser";
import { SaveButton } from "./save-button";
import { ConnectionStatus, EditorDescription, EditorSpec } from "./types";
import LanguageModelTitleBarButton from "../chatgpt/title-bar-button";
import userTracking from "@cocalc/frontend/user-tracking";
import TitleBarTour from "./title-bar-tour";
import { IS_MOBILE } from "@cocalc/frontend/feature";
import SelectComputeServer from "@cocalc/frontend/compute/select-server";
import { computeServersEnabled } from "@cocalc/frontend/compute/config";
import {
  APPLICATION_MENU,
  COMMANDS,
  MENUS,
  GROUPS,
  SEARCH_COMMANDS,
  ManageCommands,
} from "./commands";

const MAX_SEARCH_RESULTS = 10;

// Certain special frame editors (e.g., for latex) have extra
// actions that are not defined in the base code editor actions.
// In all cases, we check these are actually defined before calling
// them to avoid a runtime stacktrace.
interface FrameActions extends Actions {
  zoom_page_width?: (id: string) => void;
  zoom_page_height?: (id: string) => void;
  sync?: (id: string, editor_actions: EditorActions) => void;
  show_table_of_contents?: (id: string) => void;
  build?: (id: string, boolean) => void;
  force_build?: (id: string) => void;
  clean?: (id: string) => void;
  word_count?: (time: number, force: boolean) => void;
  close_and_halt?: (id: string) => void;
}

interface EditorActions extends Actions {
  download?: (id: string) => void;
  restart?: () => void;
  rescan_latex_directive?: () => void;
  halt_jupyter?: () => void;
}

import { AvailableFeatures } from "@cocalc/frontend/project_configuration";

const COL_BAR_BACKGROUND = "#f8f8f8";
const COL_BAR_BACKGROUND_DARK = "#ddd";
const COL_BAR_BORDER = "rgb(204,204,204)";

const title_bar_style: CSS = {
  background: COL_BAR_BACKGROUND_DARK,
  border: `1px solid ${COL_BAR_BORDER}`,
  padding: "1px",
  flexDirection: "row",
  flexWrap: "nowrap",
  flex: "0 0 auto",
  display: "flex",
} as const;

const MAX_TITLE_WIDTH = 20;
const MAX_TITLE_WIDTH_INACTIVE = 40;

const TITLE_STYLE: CSS = {
  margin: "7.5px 5px",
  fontSize: "10pt",
  whiteSpace: "nowrap",
  display: "inline-block",
  maxWidth: `${MAX_TITLE_WIDTH + 2}ex`,
  overflow: "hidden",
  fontWeight: 550,
} as const;

const CONNECTION_STATUS_STYLE: CSS = {
  padding: "5px 5px 0 5px",
  fontSize: "10pt",
  float: "right",
} as const;

function connection_status_color(status: ConnectionStatus): string {
  switch (status) {
    case "disconnected":
      return "rgb(255, 0, 0)";
    case "connecting":
      return "rgb(255, 165, 0)";
    case "connected":
      return "#666";
    default:
      return "rgb(255, 165, 0)";
  }
}

export function ConnectionStatusIcon({ status }: { status: ConnectionStatus }) {
  return (
    <Icon
      style={{
        color: connection_status_color(status),
      }}
      name={"wifi"}
    />
  );
}

interface Props {
  actions: FrameActions;
  editor_actions: EditorActions;
  path: string;
  project_id: string; // assumed to not change for now
  active_id: string;
  id: string;
  is_full?: boolean;
  is_only?: boolean; // is the only frame
  is_public?: boolean; // public view of a file
  is_paused?: boolean;
  type: string;
  spec: EditorDescription;
  editor_spec: EditorSpec;
  status: string;
  title?: string;
  connection_status?: ConnectionStatus;
  font_size?: number;
  available_features?: AvailableFeatures;
  page?: number | string;
  pages?: number | List<string>;
  is_visible?: boolean;
  tab_is_visible?: boolean;
}

export function FrameTitleBar(props: Props) {
  // Whether this is *the* active currently focused frame:
  const is_active = props.active_id === props.id;
  const track = useMemo(() => {
    const { project_id, path } = props;
    return (action: string) => {
      userTracking("frame-tree", {
        project_id,
        path,
        action,
        type: props.type,
      });
    };
  }, [props.project_id, props.path]);

  const [showMainButtonsPopover, setShowMainButtonsPopover] =
    useState<boolean>(false);

  const [close_and_halt_confirm, set_close_and_halt_confirm] =
    useState<boolean>(false);

  const [showAI, setShowAI] = useState<boolean>(false);

  const [helpSearch, setHelpSearch] = useState<string>("");

  const student_project_functionality = useStudentProjectFunctionality(
    props.project_id,
  );

  if (props.editor_actions?.name == null) {
    throw Error("editor_actions must have name attribute");
  }
  if (props.actions.name == null) {
    throw Error("actions must have name attribute");
  }

  // REDUX:
  // state that is associated with the file being edited, not the
  // frame tree/tab in which this sits.  Note some more should
  // probably be moved down here...

  // These come from editor_actions's store:
  const read_only: boolean = useRedux([props.editor_actions.name, "read_only"]);

  const manageCommands = useMemo(
    () =>
      new ManageCommands({
        props,
        studentProjectFunctionality: student_project_functionality,
        setShowAI,
        helpSearch,
        setHelpSearch,
        readOnly: read_only,
      }),
    [
      props,
      student_project_functionality,
      helpSearch,
      setHelpSearch,
      setShowAI,
      read_only,
    ],
  );

  const has_unsaved_changes: boolean = useRedux([
    props.editor_actions.name,
    "has_unsaved_changes",
  ]);
  const has_uncommitted_changes: boolean = useRedux([
    props.editor_actions.name,
    "has_uncommitted_changes",
  ]);
  const show_uncommitted_changes: boolean = useRedux([
    props.editor_actions.name,
    "show_uncommitted_changes",
  ]);
  const is_saving: boolean = useRedux([props.editor_actions.name, "is_saving"]);
  const is_public: boolean = useRedux([props.editor_actions.name, "is_public"]);
  const otherSettings = useRedux(["account", "other_settings"]);
  const hideButtonTooltips = otherSettings.get("hide_button_tooltips");
  const darkMode = otherSettings.get("dark_mode");
  const disableTourRefs = useRef<boolean>(false);
  const tourRefs = useRef<{ [name: string]: { current: any } }>({});
  const getTourRef = (name: string) => {
    if (disableTourRefs.current) return null;
    if (tourRefs.current[name] == null) {
      tourRefs.current[name] = { current: null };
    }
    return tourRefs.current[name];
  };
  const tours = useRedux(["account", "tours"]);
  const hasTour = useMemo(() => {
    if (IS_MOBILE || !manageCommands.isVisible("tour")) {
      return false;
    }
    if (tours?.includes("all") || tours?.includes(`frame-${props.type}`)) {
      return false;
    }
    return true;
  }, [tours, props.type]);

  // comes from actions's store:
  const switch_to_files: List<string> = useRedux([
    props.actions.name,
    "switch_to_files",
  ]);

  function button_height(): string {
    return props.is_only || props.is_full ? "34px" : "30px";
  }

  const MENU_STYLE = {
    padding: `${props.is_only || props.is_full ? "7px" : "5px"} 10px`,
  };

  function button_style(style?: CSS): CSS {
    return {
      ...style,
      ...{ height: button_height(), marginBottom: "5px" },
    };
  }

  function wrapOnClick(props1, props0) {
    if (props0.onClick != null) {
      props1.onClick = async (...args) => {
        try {
          await props0.onClick(...args);
        } catch (err) {
          console.trace(`${err}`);
          props.actions.set_error(
            `${err}. Try reopening this file, refreshing your browser, or restarting your project.  If nothing works, click Help above and make a support request.`,
          );
        }
      };
    }
  }

  function StyledButton(props0) {
    let props1;
    if (hideButtonTooltips) {
      props1 = { ...props0 };
      delete props1.title;
    } else {
      props1 = { ...props0 };
    }
    wrapOnClick(props1, props0);
    return (
      <AntdBootstrapButton {...props1} style={button_style(props1.style)}>
        {props1.children}
      </AntdBootstrapButton>
    );
  }

  function Button(props) {
    return <StyledButton {...props}>{props.children}</StyledButton>;
  }

  function AntdButton(props0) {
    const props1 = { ...props0 };
    wrapOnClick(props1, props0);
    return <AntdButton0 {...props1} />;
  }
  AntdButton.Group = AntdButton0.Group;

  function isExplicitlyHidden(actionName: string): boolean {
    return !!props.spec.buttons?.[`-${actionName}`];
  }

  function click_close(): void {
    props.actions.close_frame(props.id);
  }

  function button_size(): "small" | undefined {
    if (props.is_only || props.is_full) {
      return;
    } else {
      return "small";
    }
  }

  function render_x(): Rendered {
    return (
      <AntdButton0
        title={"Close this frame"}
        key={"close"}
        size="small"
        type="text"
        onClick={click_close}
      >
        <Icon name={"times"} />
      </AntdButton0>
    );
  }

  function renderFrameControls(): Rendered {
    return (
      <div
        key="control-buttons-group"
        style={{
          overflow: "hidden",
          display: "inline-block",
        }}
        ref={getTourRef("control")}
      >
        <ButtonGroup
          style={{
            padding: "3.5px 0 0 0",
            background: is_active
              ? COL_BAR_BACKGROUND
              : COL_BAR_BACKGROUND_DARK,
            height: button_height(),
            float: "right",
          }}
          key={"control-buttons"}
        >
          {!props.is_full ? render_split_row() : undefined}
          {!props.is_full ? render_split_col() : undefined}
          {!props.is_only ? render_full() : undefined}
          {render_x()}
        </ButtonGroup>
      </div>
    );
  }

  function render_full(): Rendered {
    if (props.is_full) {
      return (
        <AntdButton0
          disabled={props.is_only}
          title={"Show all frames"}
          key={"full-screen-button"}
          size="small"
          type="text"
          onClick={() => {
            track("unset-full");
            props.actions.unset_frame_full();
          }}
          style={{
            color: darkMode ? "orange" : undefined,
            background: !darkMode ? "orange" : undefined,
          }}
        >
          <Icon name={"compress"} />
        </AntdButton0>
      );
    } else {
      return (
        <AntdButton0
          disabled={props.is_only}
          key={"full-screen-button"}
          title={"Show only this frame"}
          size="small"
          type="text"
          onClick={() => {
            track("set-full");
            props.actions.set_frame_full(props.id);
          }}
        >
          <Icon name={"expand"} />
        </AntdButton0>
      );
    }
  }

  function render_split_row(): Rendered {
    return (
      <AntdButton0
        key={"split-row-button"}
        title={"Split frame horizontally into two rows"}
        size="small"
        type="text"
        onClick={(e) => {
          e.stopPropagation();
          if (props.is_full) {
            track("unset-full");
            return props.actions.unset_frame_full();
          } else {
            track("split-row");
            return props.actions.split_frame("row", props.id);
          }
        }}
      >
        <Icon name="horizontal-split" />
      </AntdButton0>
    );
  }

  function render_split_col(): Rendered {
    return (
      <AntdButton0
        key={"split-col-button"}
        title={"Split frame vertically into two columns"}
        size="small"
        type="text"
        onClick={(e) => {
          e.stopPropagation();
          if (props.is_full) {
            track("unset-full");
            return props.actions.unset_frame_full();
          } else {
            track("split-col");
            return props.actions.split_frame("col", props.id);
          }
        }}
      >
        <Icon name="vertical-split" />
      </AntdButton0>
    );
  }

  function renderSwitchToFile(): Rendered {
    if (
      !manageCommands.isVisible("switch_to_file") ||
      props.actions.switch_to_file == null ||
      switch_to_files == null ||
      switch_to_files.size <= 1
    ) {
      return;
    }

    const items: MenuItems = switch_to_files.toJS().map((path) => {
      return {
        key: path,
        label: (
          <>
            {props.path == path ? <b>{path}</b> : path}
            {props.actions.path == path ? " (main)" : ""}
          </>
        ),
        onClick: () => props.actions.switch_to_file(path, props.id),
      };
    });

    return (
      <DropdownMenu
        key={"switch-to-file"}
        button={true}
        style={{
          height: button_height(),
        }}
        title={path_split(props.path).tail}
        items={items}
      />
    );
  }

  function render_timetravel(): Rendered {
    if (!manageCommands.isVisible("time_travel")) {
      return;
    }
    return (
      <Tooltip key="time-travel-button" title="TimeTravel edit history">
        <AntdButton
          key={"time-travel-button"}
          style={{
            ...button_style(),
            ...(!darkMode
              ? { color: "white", background: "#5bc0de" }
              : undefined),
          }}
          size={button_size()}
          onClick={(event) => {
            track("time-travel");
            if (props.actions.name != props.editor_actions.name) {
              // a subframe editor -- always open time travel in a name tab.
              props.editor_actions.time_travel({ frame: false });
              return;
            }
            // If a time_travel frame type is available and the
            // user does NOT shift+click, then open as a frame.
            // Otherwise, it opens as a new tab.
            const frame =
              !event.shiftKey && props.editor_spec["time_travel"] != null;
            props.actions.time_travel({
              frame,
            });
          }}
        >
          <Icon name="history" />
        </AntdButton>
      </Tooltip>
    );
  }

  function render_artificial_intelligence(): Rendered {
    if (
      !manageCommands.isVisible("chatgpt") ||
      !redux.getStore("projects").hasLanguageModelEnabled(props.project_id)
    ) {
      return;
    }
    return (
      <LanguageModelTitleBarButton
        showDialog={showAI}
        setShowDialog={setShowAI}
        project_id={props.project_id}
        buttonRef={getTourRef("chatgpt")}
        key={"ai-button"}
        id={props.id}
        actions={props.actions}
        path={props.path}
        buttonSize={button_size()}
        buttonStyle={{
          ...button_style(),
          ...(!darkMode
            ? { backgroundColor: "#f6bf61", color: "white" }
            : undefined),
        }}
        visible={props.tab_is_visible && props.is_visible}
      />
    );
  }

  function render_save(): Rendered {
    if (!manageCommands.isVisible("save")) {
      return;
    }
    return (
      <SaveButton
        key="save"
        has_unsaved_changes={has_unsaved_changes}
        has_uncommitted_changes={has_uncommitted_changes}
        show_uncommitted_changes={show_uncommitted_changes}
        set_show_uncommitted_changes={
          props.editor_actions.set_show_uncommitted_changes
        }
        read_only={read_only}
        is_public={is_public}
        is_saving={is_saving}
        no_labels={true}
        size={button_size()}
        style={button_style()}
        onClick={() => {
          props.editor_actions.save(true);
          props.actions.focus(props.id);
        }}
        type={darkMode ? "default" : undefined}
      />
    );
  }

  function renderSaveTimetravelGroup(): Rendered {
    const v: JSX.Element[] = [];
    let x;
    if ((x = render_save())) v.push(x);
    if ((x = render_timetravel())) v.push(x);
    if ((x = render_artificial_intelligence())) v.push(x);
    if ((x = renderComputeServer())) v.push(x);
    if (v.length == 1) return v[0];
    if (v.length > 0) {
      return (
        <ButtonGroup key={"save-timetravel-button-group"}>{v}</ButtonGroup>
      );
    }
  }

  function renderMenu(name: string) {
    const { label, pos, groups } = MENUS[name];
    const v: MenuItem[] = [];
    for (const group of groups) {
      let i = 0;
      const w: { pos?: number; item: MenuItem }[] = [];
      for (const commandName of GROUPS[group]) {
        const item = manageCommands.command(commandName);
        if (item != null) {
          w.push({ item, pos: COMMANDS[commandName].pos ?? 1e6 });
        }
        if (helpSearch.trim() && commandName == SEARCH_COMMANDS) {
          const search = helpSearch.trim().toLowerCase();
          // special case -- the search menu item
          for (const commandName in COMMANDS) {
            for (const item of manageCommands.searchCommands(
              commandName,
              search,
            )) {
              i += 1;
              w.push({
                item: { ...item, key: `__search-${commandName}-${i}` },
                pos: COMMANDS[commandName].pos ?? 1e6,
              });
              if (w.length >= MAX_SEARCH_RESULTS) {
                break;
              }
            }
            if (w.length >= MAX_SEARCH_RESULTS) {
              break;
            }
          }
        }
      }
      if (w.length > 0) {
        if (w.length > 1) {
          w.sort(field_cmp("pos"));
        }
        if (v.length > 0) {
          v.push({ type: "divider", key: `divider-${v.length}` });
        }
        v.push(...w.map((x) => x.item));
      }
    }
    if (v.length == 0) {
      return null;
    }
    return {
      menu: (
        <DropdownMenu
          key={`menu-${name}`}
          style={MENU_STYLE}
          title={
            label == APPLICATION_MENU
              ? manageCommands.applicationMenuTitle()
              : label
          }
          items={v}
        />
      ),
      pos,
    };
  }

  function renderMenus() {
    if (!is_active) return;

    const v: { menu: JSX.Element; pos: number }[] = [];
    for (const name in MENUS) {
      const x = renderMenu(name);
      if (x != null) {
        v.push(x);
      }
    }
    v.sort(field_cmp("pos"));
    return (
      <div
        key="dropdown-menus"
        style={{
          display: "inline-block",
          paddingTop: props.is_only || props.is_full ? "7px" : "5px",
        }}
      >
        {v.slice(0, -1).map((x) => x.menu)}
        {v[v.length - 1]?.menu}
      </div>
    );
    // todo move compute server as earlier menu, when it is a menu.
    // seems too horrible right now since it is a selector.
  }

  function renderButtons(style?: CSS, noRefs?): Rendered {
    if (!is_active) {
      return (
        <div
          key="title"
          style={{
            textAlign: "center",
            width: "100%",
            background: COL_BAR_BACKGROUND_DARK,
          }}
        >
          {renderTitle()}
        </div>
      );
    }
    if (!(props.is_only || props.is_full)) {
      // When in split view, we let the buttonbar flow around and hide, so that
      // extra buttons are cleanly not visible when frame is thin.
      style = {
        display: "flex",
        maxHeight: "30px",
        ...style,
      };
    } else {
      style = {
        display: "flex",
        maxHeight: "34px",
        marginLeft: "2px",
        ...style,
      };
    }
    try {
      if (noRefs) {
        // When rendering the buttons for the all button popover, we
        // must NOT set the tour refs, since if we do, then they get
        // stolen and the tour then breaks! So we temporarily disable
        // the refs and re-enable them in the finally below.
        disableTourRefs.current = true;
      }

      const v: (JSX.Element | undefined | null)[] = [];
      v.push(renderSaveTimetravelGroup());
      if (props.title != null) {
        v.push(renderTitle());
      }
      v.push(renderPage());
      v.push(renderMenus());
      v.push(renderSwitchToFile());

      const w: Rendered[] = [];
      for (const c of v) {
        if (c != null) {
          w.push(c);
        }
      }

      return (
        <div
          style={style}
          key={"buttons"}
          className={"cc-frame-tree-title-bar-buttons"}
        >
          {r_join(w, <Gap />)}
        </div>
      );
    } finally {
      if (noRefs) {
        disableTourRefs.current = false;
      }
    }
  }

  function renderMainMenusAndButtons(): Rendered {
    // This is complicated below (with the flex display) in order to have
    // a drop down menu that actually appears
    // and *ALSO* have buttons that vanish when there are many of them.
    return (
      <div
        style={{
          flexFlow: "row nowrap",
          display: "flex",
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {renderButtons()}
      </div>
    );
  }

  function allButtonsPopover() {
    return (
      <Popover
        overlayStyle={{ zIndex: 990 }}
        open={
          props.tab_is_visible && props.is_visible && showMainButtonsPopover
        }
        content={() => {
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: "100vw",
              }}
            >
              <div
                style={{
                  marginLeft: "3px",
                  marginRight: "3px",
                }}
              >
                {renderButtons({ maxHeight: "50vh", display: "block" }, true)}
              </div>
              <div>
                {renderFrameControls()}

                <Button
                  style={{ float: "right" }}
                  onClick={() => setShowMainButtonsPopover(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          );
        }}
      >
        <div
          key="all-buttons"
          ref={getTourRef("all-buttons")}
          style={{ display: "inline-block" }}
        >
          <AntdButton
            type="text"
            style={{
              padding: "0 5px",
              height: props.is_only || props.is_full ? "34px" : "30px",
              background: showMainButtonsPopover ? "#eee" : undefined,
            }}
            onClick={() => setShowMainButtonsPopover(!showMainButtonsPopover)}
          >
            <Icon name="ellipsis" rotate="90" />
          </AntdButton>
        </div>
      </Popover>
    );
  }

  function renderConnectionStatus(): Rendered | undefined {
    if (
      !props.connection_status ||
      !manageCommands.isVisible("connection_status")
    ) {
      return;
    }
    if (props.connection_status == "connected") {
      // To reduce clutter show nothing when connected.
      // NOTE: Keep this consistent with
      // cocalc/src/@cocalc/frontend/project/websocket/websocket-indicator.tsx
      return;
    }
    const is_active = props.active_id === props.id;
    const style = is_active
      ? Object.assign({}, CONNECTION_STATUS_STYLE, {
          background: COL_BAR_BACKGROUND,
        })
      : CONNECTION_STATUS_STYLE;

    return (
      <span style={style} title={props.connection_status}>
        <ConnectionStatusIcon status={props.connection_status} />
      </span>
    );
  }

  function renderComputeServer() {
    if (
      !manageCommands.isVisible("compute_server") ||
      !computeServersEnabled()
    ) {
      return null;
    }
    const { type } = props;
    if (type != "terminal" && type != "jupyter_cell_notebook") {
      // ONLY terminal and jupyter are supported
      return null;
    }
    return (
      <SelectComputeServer
        key="compute-server-selector"
        actions={props.actions}
        frame_id={props.id}
        type={type}
        project_id={props.project_id}
        path={props.path}
        style={{
          height: button_height(),
          borderRight: "1px solid #d9d9d9",
          borderTop: "1px solid #d9d9d9",
          borderBottom: "1px solid #d9d9d9",
          borderTopRightRadius: "5px",
          borderBottomRightRadius: "5px",
        }}
      />
    );
  }

  function renderTitle(): Rendered {
    let title: string = "";
    if (props.title !== undefined) {
      title = props.title;
    }
    if (props.editor_spec != null) {
      const spec = props.editor_spec[props.type];
      if (spec != null) {
        if (!title) {
          if (spec.name) {
            title = spec.name;
          } else if (spec.short) {
            title = spec.short;
          }
        }
      }
    }
    const label = (
      <span>
        {trunc_middle(
          title,
          is_active ? MAX_TITLE_WIDTH : MAX_TITLE_WIDTH_INACTIVE,
        )}
      </span>
    );

    if (props.title == null && is_active) {
      return label;
    }

    const body = (
      <div
        key="title"
        ref={getTourRef("title")}
        style={{
          ...TITLE_STYLE,
          margin: `${props.is_only || props.is_full ? "7px" : "5px"} 5px`,
          color: is_active ? undefined : "#777",
        }}
      >
        {label}
      </div>
    );
    if (title.length >= MAX_TITLE_WIDTH) {
      return (
        <Tooltip title={title} key="title">
          {body}
        </Tooltip>
      );
    }
    return body;
  }

  function renderCloseAndHaltConfirm(): Rendered {
    if (!close_and_halt_confirm) return;
    return (
      <div
        style={{
          padding: "5px",
          borderBottom: "1px solid lightgrey",
          position: "absolute",
          width: "100%",
          zIndex: 100,
          background: "white",
          boxShadow: "rgba(0, 0, 0, 0.25) 0px 6px 24px",
        }}
      >
        Halt the server and close this?
        <Button
          onClick={() => {
            set_close_and_halt_confirm(false);
            props.actions.close_and_halt?.(props.id);
          }}
          style={{
            marginLeft: "20px",
            marginRight: "5px",
          }}
          bsStyle="danger"
        >
          <Icon name={"PoweroffOutlined"} /> Close and Halt
        </Button>
        <Button onClick={() => set_close_and_halt_confirm(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  function renderConfirmBar(): Rendered {
    return (
      <div style={{ position: "relative" }}>{renderCloseAndHaltConfirm()}</div>
    );
  }

  function renderButtonToolbar() {
    // JUST A DEMO FOR NOW -- disable this
    return null;
    if (!is_active) {
      return null;
    }
    const body = renderSaveTimetravelGroup();
    if (!body) return null;
    return <div style={{ height: button_height() }}>{body}</div>;
  }

  function renderPage() {
    if (
      props.page == null ||
      props.pages == null ||
      isExplicitlyHidden("page")
    ) {
      // do not render anything unless both page and pages are set
      return;
    }
    let content;
    if (typeof props.pages == "number") {
      // pages contains the number of pages and page must also be a number
      if (props.pages <= 1) {
        // only one page so don't render anything
        return;
      }
      // Below we use step=-1 and do not set min/max so that
      // the up/down buttons are switched from usual, which makes
      // sense for page numbers.

      // Style: the button heights actually changes a bit depending
      // on if it's the only frame or not, so our input box also has
      // to adjust.
      content = (
        <>
          <InputNumber
            style={{
              width: "9ex",
              height: !props.is_only && !props.is_full ? "30px" : undefined,
            }}
            step={-1}
            value={props.page}
            onChange={(page: number) => {
              if (!page) return;
              if (page <= 1) {
                page = 1;
              }
              if (typeof props.pages == "number" && page >= props.pages) {
                page = props.pages;
              }
              props.actions.setPage(props.id, page);
            }}
          />{" "}
          / {props.pages}
        </>
      );
    } else {
      // pages is a immutable list of string names of the pages
      if (props.pages.size <= 1) {
        return;
      }
      const n = props.pages.indexOf(`${props.page}`);
      if (n == -1) {
        content = (
          <>
            <Input
              style={{ width: "9ex", height: "30px" }}
              value={props.page}
              onChange={(e) => {
                if (!e.target.value) return;
                props.actions.setPage(props.id, e.target.value);
              }}
            />{" "}
            / {props.pages.size}
          </>
        );
      } else {
        content = (
          <>
            <Input
              style={{ width: "9ex", height: "30px" }}
              value={props.page}
              onChange={(e) => props.actions.setPage(props.id, e.target.value)}
            />{" "}
            ({n + 1} of {props.pages.size})
          </>
        );
      }
    }
    return (
      <span
        key={"page"}
        style={{
          height: "30px",
          lineHeight: "30px",
          textAlign: "center",
        }}
      >
        {content}
      </span>
    );
  }

  let style;
  style = copy(title_bar_style);
  style.background = COL_BAR_BACKGROUND;
  if (!props.is_only && !props.is_full) {
    style.maxHeight = "34px";
  } else {
    style.maxHeight = "38px";
  }
  // position relative, so we can absolute position the
  // frame controls to the right
  style.position = "relative";

  if (is_safari()) {
    // ugly hack....
    // for some reason this is really necessary on safari, but
    // breaks on everything else!
    if (props.is_only || props.is_full) {
      style.minHeight = "36px";
    } else {
      style.minHeight = "32px";
    }
  }

  return (
    <>
      <div
        style={style}
        id={`titlebar-${props.id}`}
        className={"cc-frame-tree-title-bar"}
      >
        {renderMainMenusAndButtons()}
        {renderConnectionStatus()}
        {is_active && allButtonsPopover()}
        {renderFrameControls()}
      </div>
      {renderButtonToolbar()}
      {renderConfirmBar()}
      {hasTour && props.is_visible && props.tab_is_visible && (
        <TitleBarTour refs={tourRefs} />
      )}
    </>
  );
}

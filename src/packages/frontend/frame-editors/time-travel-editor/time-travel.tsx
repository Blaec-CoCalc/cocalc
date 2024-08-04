/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// Time travel editor react component

import { useState } from "react";
import { Checkbox, Tooltip } from "antd";
import { Map } from "immutable";
import { redux } from "../../app-framework";
import { Loading } from "../../components";
import { TimeTravelActions, TimeTravelState } from "./actions";
import { Diff } from "./diff";
import { NavigationButtons } from "./navigation-buttons";
import { NavigationSlider } from "./navigation-slider";
import { RangeSlider } from "./range-slider";
import { Version, VersionRange } from "./version";
import { Authors } from "./authors";
import { LoadFullHistory } from "./load-full-history";
import { OpenFile } from "./open-file";
import { RevertFile } from "./revert-file";
import { ChangesMode } from "./changes-mode";
import { OpenSnapshots } from "./open-snapshots";
import { Export } from "./export";
import json_stable from "json-stable-stringify";
import { to_ipynb } from "../../jupyter/history-viewer";
import { SagewsDiff } from "./sagews-diff";
import { useAsyncEffect, useEditorRedux } from "@cocalc/frontend/app-framework";
import { Viewer } from "./viewer";
import type { Document } from "@cocalc/sync/editor/generic/types";

const HAS_SPECIAL_VIEWER = new Set([
  "tasks",
  "ipynb",
  "sagews",
  "board",
  "slides",
  "md",
]);

interface Props {
  actions: TimeTravelActions;
  id: string;
  path: string;
  project_id: string;
  desc: Map<string, any>;
  font_size: number;
  editor_settings: Map<string, any>;
  resize: number;
  is_current: boolean;
  is_subframe: boolean;
}

export function TimeTravel(props: Props) {
  const { project_id, path } = props;
  const useEditor = useEditorRedux<TimeTravelState>({ project_id, path });
  const versions = useEditor("versions");
  const gitVersions = useEditor("git_versions");
  const hasFullHistory = useEditor("has_full_history");
  const loading = useEditor("loading");
  const docpath = useEditor("docpath");
  const docext = useEditor("docext");
  const git = !!useEditor("git");
  const gitMode = !!props.desc?.get("git_mode");
  const textMode = !!props.desc?.get("text_mode");
  const changesMode = !!props.desc?.get("changes_mode");

  const [doc, setDoc] = useState<Document | undefined>(undefined);
  const [doc0, setDoc0] = useState<string | undefined>(undefined);
  const [doc1, setDoc1] = useState<string | undefined>(undefined);
  const [useJson, setUseJson] = useState<boolean>(false);

  const version = props.desc?.get("version");
  const version0 = changesMode ? props.desc?.get("version0") : version;
  const version1 = changesMode ? props.desc?.get("version1") : version;

  const getDoc = async (
    version?: number | Date | undefined,
  ): Promise<Document | undefined> => {
    version =
      version == null || typeof version == "number"
        ? getVersion(version)
        : version;
    if (version == null) {
      return;
    }
    if (gitMode) {
      return await props.actions.gitDoc(version);
    }
    return props.actions.get_doc(version);
  };

  // convert from version number to Date object (or undefined)
  const getVersion = (version?): Date | undefined => {
    if (props.desc == null || versions == null) {
      return;
    }
    version = version ?? props.desc?.get("version");
    const d: Date | undefined = (gitMode ? gitVersions : versions)?.get(
      version,
    );
    if (d != null) return d;
    return versions.get(-1);
  };

  useAsyncEffect(async () => {
    if (docpath == null) {
      return;
    }
    if (!changesMode) {
      // non-changes mode
      setDoc(await getDoc(version));
    } else {
      // diff mode
      const doc0 = await getDoc(version0);
      if (doc0 == null) return; // something is wrong
      const doc1 = await getDoc(version1);
      if (doc1 == null) return; // something is wrong

      let v0, v1;
      if (docext == "ipynb") {
        v0 = json_stable(to_ipynb(doc0), { space: 1 });
        v1 = json_stable(to_ipynb(doc1), { space: 1 });
        setUseJson(true);
      } else {
        v0 = doc0.to_str();
        v1 = doc1.to_str();
        setUseJson(doc0["value"] == null);
      }
      setDoc0(v0);
      setDoc1(v1);
    }
  }, [
    version,
    version0,
    version1,
    changesMode,
    gitMode,
    versions,
    gitVersions,
  ]);

  const renderVersion = () => {
    const max = (gitMode ? gitVersions : versions)?.size;
    if (props.desc == null || max == null) {
      return;
    }
    if (changesMode) {
      return <VersionRange version0={version0} version1={version1} max={max} />;
    } else {
      const date = getVersion();
      if (date == null || version == null) {
        return;
      }
      return <Version date={date} number={version + 1} max={max} />;
    }
  };

  const renderDiff = () => {
    if (!changesMode) {
      return;
    }
    if (doc0 == null || doc1 == null) {
      return renderLoading();
    }

    if (docext == "sagews") {
      return (
        <SagewsDiff
          v0={doc0}
          v1={doc1}
          path={docpath}
          project_id={props.project_id}
          font_size={props.font_size}
          editor_settings={props.editor_settings}
        />
      );
    }

    return (
      <Diff
        v0={doc0}
        v1={doc1}
        path={docpath}
        font_size={props.font_size}
        editor_settings={props.editor_settings}
        use_json={useJson}
      />
    );
  };

  const renderNavigationButtons = () => {
    if (changesMode && (version0 == null || version1 == null)) {
      return;
    }
    const size = (gitMode ? gitVersions : versions)?.size;
    if (size == null) {
      return;
    }
    return (
      <NavigationButtons
        id={props.id}
        actions={props.actions}
        version0={version0}
        version1={version1}
        max={size - 1}
      />
    );
  };

  const renderNavigationSlider = () => {
    const size = (gitMode ? gitVersions : versions)?.size;
    if (size == null || changesMode) {
      return;
    }
    return (
      <NavigationSlider
        id={props.id}
        actions={props.actions}
        version={version}
        versions={gitMode ? gitVersions : versions}
      />
    );
  };

  const renderRangeSlider = () => {
    if (version0 == null || version1 == null || !changesMode) {
      return;
    }
    const v = gitMode ? gitVersions : versions;
    if (v == null) {
      return;
    }
    return (
      <RangeSlider
        id={props.id}
        actions={props.actions}
        versions={v}
        version0={version0}
        version1={version1}
      />
    );
  };

  const renderAuthor = () => {
    if (version0 == null || version1 == null) {
      return;
    }
    return (
      <Authors
        actions={props.actions}
        version0={version0}
        version1={version1}
      />
    );
  };

  const renderLoadFullHistory = () => {
    if (hasFullHistory) return;
    return <LoadFullHistory actions={props.actions} />;
  };

  const renderOpenFile = () => {
    if (props.is_subframe) return;
    return <OpenFile actions={props.actions} />;
  };

  const renderOpenSnapshots = () => {
    if (props.is_subframe) return;
    return <OpenSnapshots actions={props.actions} />;
  };

  const renderRevertFile = () => {
    if (changesMode) {
      return;
    }
    return <RevertFile actions={props.actions} version={getVersion()} />;
  };

  const renderChangesMode = () => {
    if (versions == null) return;
    return (
      <ChangesMode
        id={props.id}
        actions={props.actions}
        disabled={versions.size <= 1}
        changes_mode={changesMode}
      />
    );
  };

  const renderExport = () => {
    if (redux.getStore("page").get("fullscreen") == "kiosk") {
      // doesn't make sense in kiosk mode.
      return;
    }
    return <Export actions={props.actions} />;
  };

  const renderControls = () => {
    return (
      <div
        style={{
          background: props.is_current ? "#fafafa" : "#ddd",
          borderBottom: "1px solid #ccc",
          padding: "5px",
        }}
      >
        {renderChangesMode()}
        {!changesMode && HAS_SPECIAL_VIEWER.has(docext ?? "") && (
          <Tooltip title="Display underlying file as text">
            <Checkbox
              defaultChecked={textMode}
              onChange={(e) =>
                props.actions.setTextMode(props.id, e.target.checked)
              }
            >
              Text
            </Checkbox>
          </Tooltip>
        )}
        {git && (
          <Tooltip title="Show Git history instead of CoCalc edit history">
            <Checkbox
              defaultChecked={gitMode}
              onChange={(e) =>
                props.actions.setGitMode(props.id, e.target.checked)
              }
            >
              Git
            </Checkbox>
          </Tooltip>
        )}
        {renderNavigationButtons()}
        <div style={{ display: "inline-flex", margin: "0 5px" }}>
          {renderLoadFullHistory()}
          {renderOpenFile()}
          {renderRevertFile()}
          {renderOpenSnapshots()}
          {renderExport()}
        </div>
        {renderVersion()}
        {", "}
        {renderAuthor()}
      </div>
    );
  };

  const renderTimeSelect = () => {
    return (
      <>
        {renderNavigationSlider()}
        {renderRangeSlider()}
      </>
    );
  };

  const renderLoading = () => {
    return <Loading theme={"medium"} />;
  };

  if (loading) {
    return renderLoading();
  }
  return (
    <div className="smc-vfill">
      {renderControls()}
      {renderTimeSelect()}
      <>
        {doc != null && docpath != null && docext != null && !changesMode && (
          <Viewer
            ext={docext}
            doc={doc}
            textMode={textMode}
            actions={props.actions}
            id={props.id}
            path={docpath ? docpath : "a.js"}
            project_id={props.project_id}
            font_size={props.font_size}
            editor_settings={props.editor_settings}
          />
        )}
        {renderDiff()}
      </>
    </div>
  );
}

import { useEffect, useState } from "react";
import { CellOutput } from "@cocalc/frontend/jupyter/cell-output";
import { fromJS } from "immutable";
import { useFrameContext } from "../../hooks";
import { path_split } from "@cocalc/util/misc";
import { getJupyterEditorActions } from "./run";
import { useIsMountedRef } from "@cocalc/frontend/app-framework";
import type { JupyterActions } from "@cocalc/frontend/jupyter/browser-actions";

// Support for all the output Jupyter MIME types must be explicitly loaded.
import "@cocalc/frontend/jupyter/output-messages/mime-types/init-frontend";

export default function Output({ element }) {
  const { project_id, path } = useFrameContext();
  const isMounted = useIsMountedRef();
  const [jupyterActions, setJupyterActions] = useState<
    JupyterActions | undefined
  >(undefined);

  // Initialize state needed for widgets to work.
  useEffect(() => {
    (async () => {
      const actions = await getJupyterEditorActions(project_id, path);
      if (!isMounted.current) return;
      setJupyterActions(actions.jupyter_actions);
    })();
  }, []);

  if (jupyterActions == null) {
    // don't render CellOutput until loaded, since CellOutput doesn't
    // update when just the name changes from undefined to a string --
    // it just assumes name is known.
    return null;
  }

  return (
    <CellOutput
      actions={jupyterActions}
      name={jupyterActions?.name}
      id={element.id}
      cell={fromJS(element.data)}
      project_id={project_id}
      directory={path_split(path).head}
      trust={true}
      complete={false}
      hidePrompt
    />
  );
}

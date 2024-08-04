/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/* Export history to json.

- This is really just some minimal data *about* the history for now.
*/

import { Button } from "antd";
import { TimeTravelActions } from "./actions";
import { Icon } from "../../components";

interface Props {
  actions: TimeTravelActions;
}

export function Export({ actions }: Props) {
  return (
    <Button
      onClick={() => actions.exportEditHistory()}
      title="Export information about edit history to a JSON file"
    >
      <Icon name={"file-export"} /> Export
    </Button>
  );
}
